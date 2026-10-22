import { chromium, type Browser } from 'playwright';
import type { StartInput } from '../shared/contracts';
let browser: Browser | undefined;
let stopping = false;
const send = (message: object) => process.parentPort?.postMessage(message);
process.parentPort?.on('message', async ({ data }) => {
  if (data.type === 'stop') {
    stopping = true;
    await browser?.close().catch(() => {});
    process.exit(0);
  }
  if (data.type !== 'start') return;
  const input = data.input as StartInput;
  try {
    send({ type: 'log', message: 'Iniciando o Chromium…' });
    browser = await chromium.launch({ headless: false });
    if (stopping) { await browser.close(); return; }
    browser.on('disconnected', () => { send({ type: 'closed' }); process.exit(0); });
    const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: false });
    const page = await context.newPage();
    send({ type: 'log', message: 'Abrindo o endereço e aguardando o conteúdo…' });
    const response = await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (response && response.status() >= 400) throw new Error(`O site respondeu com HTTP ${response.status()}.`);
    send({ type: 'log', message: 'Página carregada. Registrando a evidência…' });
    const title = await page.title();
    await page.screenshot({ path: data.screenshot, timeout: 15_000 });
    send({ type: 'result', title, screenshot: data.screenshot });
    if (!input.keepOpen) await browser.close();
  } catch (error) {
    if (!stopping) send({ type: 'failure', error: error instanceof Error ? error.message : String(error) });
    await browser?.close().catch(() => {});
    process.exit(1);
  }
});
