import { app, BrowserWindow, dialog, ipcMain, screen, shell, utilityProcess, type UtilityProcess } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateInput, type AppState, type Reply, type Run } from '../shared/contracts';
let window: BrowserWindow;
let worker: UtilityProcess | undefined;
let state: AppState = { runs: [] };
let historyFile: string;
let saveChain = Promise.resolve();
let shuttingDown = false;
let starting = false;
app.setName('FelpAutomations');
app.setAppUserModelId('com.felp.automations');
// Mantém o identificador original de armazenamento para preservar o histórico existente.
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', path.join(app.getPath('appData'), 'flowdesk'));
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});
function publish() {
  if (window && !window.isDestroyed()) window.webContents.send('state:update', state);
  const snapshot = JSON.stringify({ runs: state.runs }, null, 2);
  saveChain = saveChain.then(() => writeFile(historyFile, snapshot)).catch(error => console.error('Não foi possível salvar o histórico:', error));
}
function finish(run: Run, status: Run['status'], error?: string) {
  if (run.status !== 'running') return;
  run.status = status; run.error = error; run.finishedAt = new Date().toISOString();
}
async function stop() {
  const current = worker;
  if (!current) return;
  const run = state.runs.find(item => item.id === state.activeId);
  if (run) finish(run, 'cancelled');
  current.postMessage({ type: 'stop' });
  publish();
  await new Promise<void>(resolve => {
    const timeout = setTimeout(() => { current.kill(); resolve(); }, 5000);
    current.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (window && !window.isDestroyed()) window.hide();
  const deadline = setTimeout(() => app.exit(1), 8000);
  deadline.unref();
  void stop().then(() => saveChain).finally(() => { clearTimeout(deadline); app.exit(0); });
}
async function reply(action: () => Promise<void>): Promise<Reply> {
  try { await action(); return { ok: true }; } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
}
app.whenReady().then(async () => {
  if (!ownsInstance) return;
  const root = app.getPath('userData');
  historyFile = path.join(root, 'history.json');
  await mkdir(root, { recursive: true });
  try {
    const saved = JSON.parse(await readFile(historyFile, 'utf8'));
    if (Array.isArray(saved.runs)) state.runs = saved.runs.slice(0, 100).map((run: Run) => ({ ...run, browserOpen: false, status: run.status === 'running' ? 'interrupted' : run.status }));
  } catch { /* A primeira inicialização ainda não tem histórico. */ }
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({ width: Math.min(1360, workArea.width), height: Math.min(940, workArea.height), minWidth: Math.min(920, workArea.width), minHeight: Math.min(700, workArea.height), show: false, title: 'FelpAutomations', icon: path.join(__dirname, '../../public/brand/felpautomations.ico'), backgroundColor: '#0b0e16', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.once('ready-to-show', () => { window.show(); window.focus(); });
  window.on('close', event => { event.preventDefault(); shutdown(); });
  const entry = path.join(__dirname, '../..', 'dist/index.html');
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Origem não autorizada.');
  };
  ipcMain.handle('state', event => { trusted(event); return state; });
  ipcMain.handle('start', (event, raw) => reply(async () => {
    trusted(event);
    const input = validateInput(raw);
    if (worker || starting) throw new Error('Encerre o navegador atual antes de iniciar outra execução.');
    starting = true;
    try {
    const run: Run = { id: randomUUID(), url: input.url, status: 'running', startedAt: new Date().toISOString(), logs: [], browserOpen: true };
    const folder = path.join(root, 'runs', run.id);
    await mkdir(folder, { recursive: true });
    const child = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], { stdio: 'pipe' });
    worker = child; state.activeId = run.id; state.runs = [run, ...state.runs].slice(0, 100);
    child.on('message', message => {
      if (worker !== child) return;
      if (message.type === 'log') run.logs.push({ time: new Date().toISOString(), message: message.message });
      if (message.type === 'result') { run.title = message.title; run.screenshot = message.screenshot; finish(run, 'passed'); run.logs.push({ time: new Date().toISOString(), message: 'Navegação concluída e evidência salva.' }); }
      if (message.type === 'failure') { finish(run, 'failed', message.error); }
      publish();
    });
    child.on('exit', code => {
      if (worker !== child) return;
      run.browserOpen = false;
      finish(run, 'failed', code === 0 ? 'O navegador foi fechado antes de concluir o fluxo.' : 'O executor foi encerrado inesperadamente.');
      worker = undefined; state.activeId = undefined; publish();
    });
    child.once('spawn', () => child.postMessage({ type: 'start', input, screenshot: path.join(folder, 'pagina.png') }));
    publish();
    } finally { starting = false; }
  }));
  ipcMain.handle('stop', event => reply(async () => { trusted(event); await stop(); }));
  ipcMain.handle('evidence', (event, id) => reply(async () => {
    trusted(event);
    const run = state.runs.find(item => item.id === id);
    if (!run?.screenshot) throw new Error('Esta execução ainda não tem evidência.');
    const expected = path.join(root, 'runs', run.id, 'pagina.png');
    if (path.resolve(run.screenshot) !== path.resolve(expected)) throw new Error('Evidência inválida.');
    const error = await shell.openPath(expected);
    if (error) throw new Error(error);
  }));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  await window.loadFile(entry);
}).catch(error => {
  dialog.showErrorBox('Não foi possível abrir o FelpAutomations', error instanceof Error ? error.message : String(error));
  app.exit(1);
});
app.on('window-all-closed', () => shutdown());
app.on('before-quit', event => {
  if (shuttingDown) return;
  event.preventDefault(); shutdown();
});
