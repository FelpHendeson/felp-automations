import './style.css';
import type { AppState, DesktopApi, Run } from '../shared/contracts';
declare global { interface Window { desktop: DesktopApi } }
const icon = (name: string) => ({ play: '▷', grid: '▦', clock: '◷', arrow: '↗', check: '✓' }[name] || '○');
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<aside class="sidebar"><div class="brand" aria-label="FelpAutomations"><img class="brand-icon" src="./brand/felpautomations-128.png" alt=""><span class="brand-wordmark">Felp<span>Automations</span></span></div><div class="brand-caption">PRECISÃO EM CADA EXECUÇÃO</div><p class="workspace-label">CENTRO DE COMANDO <span class="alpha">ALPHA</span></p><button class="nav active" data-view="runner">${icon('grid')} <span>Central de execução</span></button><button class="nav" data-view="history">${icon('clock')} <span>Histórico</span><span id="history-count" class="count">0</span></button><div class="sidebar-bottom"><div class="system-label">SISTEMA OPERACIONAL</div><span class="online"></span> Executor disponível<div class="version">FelpAutomations · versão 0.1.0</div></div></aside>
<main><header><span>Workspace <span class="slash">/</span> <strong id="breadcrumb">Central de execução</strong></span><span class="local-badge"><span class="online"></span> Executor local</span></header>
<section class="page"><div class="page-heading"><div><div class="eyebrow">AUTOMAÇÃO SOB SEU COMANDO</div><h1 id="page-title">Central de execução</h1><p id="page-description">Configure o destino. Execute o fluxo. Acompanhe cada etapa.</p></div><span class="phase-badge"><span class="online"></span> Navegação · v1</span></div>
<div id="runner-view"><div class="layout"><div class="configuration"><section class="card"><div class="card-heading"><span class="step-number">01</span><div><h2>Configurar fluxo</h2><p>O ponto de partida da sua automação.</p></div></div><div class="flow-option"><span class="flow-icon">${icon('arrow')}</span><div><strong>Abrir um site</strong><p>Navegar, verificar o carregamento e capturar a tela.</p></div><span class="selected">${icon('check')}</span></div><form id="run-form"><label for="url">Endereço do site <span class="required">*</span></label><div class="input-wrap"><span>◎</span><input id="url" type="url" required value="https://example.com" placeholder="https://seu-site.com.br" spellcheck="false"></div><p class="hint">Use o endereço completo, incluindo https:// ou http://.</p><div class="browser-row"><div><span class="field-label">Navegador</span><div class="browser-choice"><span class="browser-symbol">◉</span> Chromium <span class="muted">Playwright</span></div></div><span class="tag">VISÍVEL</span></div><label class="checkbox-row"><input id="keep-open" type="checkbox" checked><span><strong>Manter navegador aberto</strong><small>Explore a página depois que o fluxo terminar.</small></span></label><div id="form-error" role="alert" class="error-message" hidden></div><button class="primary" id="run-button" type="submit">${icon('play')} Executar fluxo</button><button class="secondary" id="stop-button" type="button" disabled>Encerrar navegador</button></form></section><div class="tip"><span>◇</span><p><strong>Uma base para os próximos fluxos</strong><br>Comece pela navegação. Novos cenários poderão usar o mesmo executor e histórico.</p></div></div>
<section class="card monitor"><div class="monitor-heading"><div><h2>Acompanhamento</h2><p>Etapas e resultado da execução.</p></div><span class="status idle" id="run-status">Pronto para iniciar</span></div><div id="monitor-content" aria-live="polite"></div></section></div>
<section class="recent"><div class="section-heading"><h2>Execuções recentes</h2><button class="text-button" id="show-history">Ver histórico →</button></div><div id="recent-list"></div></section></div>
<section id="history-view" hidden><div class="card history-card"><div id="full-history"></div></div></section>
<footer><span><span class="online"></span> Tudo acontece no seu computador</span><span>Electron + Playwright</span></footer></section></main>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const labels: Record<Run['status'], string> = { running: 'Em execução', passed: 'Concluído', failed: 'Falhou', cancelled: 'Cancelado', interrupted: 'Interrompido' };
let state: AppState = { runs: [] };
let selectedId: string | undefined;
let submitting = false;
function duration(run: Run) { return `${Math.max(0, (new Date(run.finishedAt || Date.now()).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)} s`; }
function rows(runs: Run[]) {
  if (!runs.length) return '<div class="empty-history">Suas execuções aparecerão aqui assim que você iniciar o primeiro fluxo.</div>';
  return `<div class="history-head"><span>FLUXO / DESTINO</span><span>RESULTADO</span><span>INÍCIO</span><span>DURAÇÃO</span></div>${runs.map(run => `<button class="history-row" data-run="${escape(run.id)}"><span><strong>Abrir um site</strong><small>${escape(run.url)}</small></span><span class="status ${run.status}">${labels[run.status]}</span><span>${new Date(run.startedAt).toLocaleString('pt-BR')}</span><span>${duration(run)}</span></button>`).join('')}`;
}
function render() {
  const run = state.runs.find(item => item.id === selectedId) || state.runs[0];
  $('#history-count').textContent = String(state.runs.length);
  $<HTMLButtonElement>('#run-button').disabled = Boolean(state.activeId) || submitting;
  $<HTMLButtonElement>('#stop-button').disabled = !state.activeId;
  $('#stop-button').textContent = state.runs.find(item => item.id === state.activeId)?.status === 'running' ? 'Cancelar execução' : 'Encerrar navegador';
  $('#run-status').className = `status ${run?.status || 'idle'}`;
  $('#run-status').textContent = run ? labels[run.status] : 'Pronto para iniciar';
  if (!run) $('#monitor-content').innerHTML = `<div class="empty-monitor"><img class="empty-symbol" src="./brand/felpautomations-256.png" alt="Robô FelpAutomations"><span class="robot-label">FELP / PRONTO PARA EXECUTAR</span><h3>Aguardando seu comando</h3><p>Informe um site e clique em Executar fluxo.<br>Cada etapa será registrada aqui.</p><div class="preview-steps"><span>01 Abrir navegador</span><span>02 Navegar</span><span>03 Salvar evidência</span></div></div>`;
  else $('#monitor-content').innerHTML = `<div class="run-target"><span class="field-label">DESTINO</span><strong>${escape(run.url)}</strong></div><div class="result-details"><div><span class="field-label">DURAÇÃO</span><strong>${duration(run)}</strong></div><div><span class="field-label">PÁGINA</span><strong>${escape(run.title || 'Aguardando carregamento')}</strong></div></div><div class="timeline">${run.logs.map(log => `<div class="log"><span class="log-dot"></span><time>${new Date(log.time).toLocaleTimeString('pt-BR')}</time><span>${escape(log.message)}</span></div>`).join('')}</div>${run.error ? `<div class="failure" role="alert">${escape(run.error)}</div>` : ''}${run.browserOpen && run.status === 'passed' ? '<p class="notice">O navegador continua aberto. Encerre-o para iniciar outro fluxo.</p>' : ''}${run.screenshot ? '<button class="secondary evidence" id="evidence-button">↗ Abrir captura da página</button>' : ''}`;
  $('#recent-list').innerHTML = rows(state.runs.slice(0, 4));
  $('#full-history').innerHTML = rows(state.runs);
  $('#evidence-button')?.addEventListener('click', async () => { if (run) { const result = await window.desktop.openEvidence(run.id); if (!result.ok) showError(result.error); } });
}
function showError(message: string) { $('#form-error').hidden = !message; $('#form-error').textContent = message; }
function view(name: string) {
  $('#runner-view').hidden = name !== 'runner'; $('#history-view').hidden = name !== 'history';
  const title = name === 'runner' ? 'Central de execução' : 'Histórico de execuções';
  $('#page-title').textContent = title; $('#breadcrumb').textContent = title;
  $('#page-description').textContent = name === 'runner' ? 'Configure o destino. Execute o fluxo. Acompanhe cada etapa.' : 'Consulte os resultados e evidências dos seus fluxos.';
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === name));
}
document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-view], [data-run]');
  if (target?.dataset.view) view(target.dataset.view);
  if (target?.dataset.run) { selectedId = target.dataset.run; view('runner'); render(); }
});
$('#show-history').addEventListener('click', () => view('history'));
$('#run-form').addEventListener('submit', async event => {
  event.preventDefault(); if (submitting || state.activeId) return;
  showError(''); submitting = true; selectedId = undefined; render();
  try { const result = await window.desktop.start({ url: $<HTMLInputElement>('#url').value, keepOpen: $<HTMLInputElement>('#keep-open').checked }); if (!result.ok) showError(result.error); }
  catch { showError('Não foi possível iniciar o executor. Tente novamente.'); }
  finally { submitting = false; render(); }
});
$('#stop-button').addEventListener('click', async () => { const result = await window.desktop.stop(); if (!result.ok) showError(result.error); });
render();
if (window.desktop) {
  window.desktop.subscribe(next => { state = next; render(); });
  window.desktop.getState().then(next => { state = next; render(); }).catch(() => showError('Não foi possível carregar o histórico.'));
} else { showError('Abra este projeto pelo aplicativo desktop para executar os fluxos.'); $<HTMLButtonElement>('#run-button').disabled = true; }
setInterval(() => { if (state.runs.some(run => run.status === 'running')) render(); }, 1000);
