export type RunStatus = 'running' | 'passed' | 'failed' | 'cancelled' | 'interrupted';
export interface RunLog { time: string; message: string }
export interface Run { id: string; url: string; status: RunStatus; startedAt: string; finishedAt?: string; title?: string; screenshot?: string; error?: string; logs: RunLog[]; browserOpen: boolean }
export interface StartInput { url: string; keepOpen: boolean }
export interface AppState { runs: Run[]; activeId?: string }
export type Reply = { ok: true } | { ok: false; error: string };
export interface DesktopApi { getState(): Promise<AppState>; start(input: StartInput): Promise<Reply>; stop(): Promise<Reply>; openEvidence(id: string): Promise<Reply>; subscribe(callback: (state: AppState) => void): () => void }
export function validateInput(value: unknown): StartInput {
  if (!value || typeof value !== 'object') throw new Error('Informe as configurações da execução.');
  const input = value as Record<string, unknown>;
  if (typeof input.url !== 'string' || typeof input.keepOpen !== 'boolean') throw new Error('Configuração inválida.');
  let url: URL;
  try { url = new URL(input.url.trim()); } catch { throw new Error('Informe uma URL completa, começando por https:// ou http://.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Use uma URL HTTP ou HTTPS sem credenciais no endereço.');
  return { url: url.href, keepOpen: input.keepOpen };
}
