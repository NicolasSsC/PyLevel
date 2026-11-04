import type { Database } from '../lib/session-store.ts';
import type { PageContext, ExecutionContext } from './page-context.ts';

export function aiLimits(env: Record<string, string | undefined> = process.env) {
  const minute = Number(env.PYBOT_REQUESTS_PER_MINUTE || 10);
  const day = Number(env.PYBOT_REQUESTS_PER_DAY || 100);
  if (![minute, day].every(n => Number.isSafeInteger(n) && n > 0 && n <= 1_000_000)) throw new Error('Límites de PyBot inválidos.');
  return { minute, day };
}

export async function consumeAiAllowance(db: Database, userId: string, limits = aiLimits()) {
  const result = await db.query(`WITH cleanup AS (
    DELETE FROM ai_request_usage WHERE window_start < now() - interval '7 days'
  ), per_minute AS (
    INSERT INTO ai_request_usage(user_id,period,window_start,requests)
    VALUES ($1,'minute',date_trunc('minute',now()),1)
    ON CONFLICT (user_id,period,window_start) DO UPDATE SET requests=ai_request_usage.requests+1
    WHERE ai_request_usage.requests < $2 RETURNING requests
  ), per_day AS (
    INSERT INTO ai_request_usage(user_id,period,window_start,requests)
    SELECT $1,'day',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1
    WHERE EXISTS(SELECT 1 FROM per_minute)
    ON CONFLICT (user_id,period,window_start) DO UPDATE SET requests=ai_request_usage.requests+1
    WHERE ai_request_usage.requests < $3 RETURNING requests
  ) SELECT EXISTS(SELECT 1 FROM per_day) AS allowed`, [userId, limits.minute, limits.day]);
  return result.rows[0]?.allowed === true;
}

export class AiRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function aiBody(request: Request): Promise<Record<string, any>> {
  const maximum = 48_000;
  if (Number(request.headers.get('content-length')) > maximum) throw new AiRequestError('La consulta es demasiado grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AiRequestError('Consulta inválida.');
  let length = 0;
  let raw = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new AiRequestError('La consulta es demasiado grande.', 413); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    throw new AiRequestError('Consulta inválida.');
  } finally { reader.releaseLock(); }
}

export function chatInput(body: Record<string, any>) {
  const { mensaje, historial = [], contexto = {} } = body;
  if (typeof mensaje !== 'string' || !mensaje.trim() || mensaje.length > 4000 ||
      !Array.isArray(historial) || historial.length > 6 || historial.some(item => !item ||
        !['user', 'bot', 'assistant'].includes(item.rol) || typeof item.contenido !== 'string' || item.contenido.length > 4000) ||
      !contexto || typeof contexto !== 'object' || Array.isArray(contexto) ||
      ['tema', 'codigo_actual'].some(key => contexto[key] !== undefined && (typeof contexto[key] !== 'string' || contexto[key].length > 10000))) {
    throw new AiRequestError('La consulta o su contexto no son válidos.');
  }
  return { mensaje: mensaje.trim(), historial, contexto: pageContextInput(contexto) };
}

function pageContextInput(value: Record<string, any>): PageContext {
  const invalid = () => { throw new AiRequestError('La consulta o su contexto no son válidos.'); };
  const string = (item: unknown, max: number) => typeof item === 'string' && item.length <= max;
  const fileMap = (item: unknown): Record<string, string> => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return invalid();
    const entries = Object.entries(item);
    if (entries.length > 6 || entries.some(([path, code]) => !/^[a-zA-Z0-9_/-]+\.py$/.test(path) || path.length > 160 || path.startsWith('/') || path.split('/').includes('..') || !string(code, 6000)) || new TextEncoder().encode(JSON.stringify(item)).length > 14000) return invalid();
    return Object.fromEntries(entries) as Record<string, string>;
  };
  const page = value.page ?? '/';
  if (!string(page, 250) || !/^\/(?!\/)[a-zA-Z0-9_/-]*$/.test(page)) return invalid();
  if (value.exerciseId === undefined) return { page };
  if (!string(value.exerciseId, 120) || !/^[a-z0-9_]+$/.test(value.exerciseId) || !['classic', 'contextual'].includes(value.mode) || !string(value.selectedFile, 160) || (value.running !== undefined && typeof value.running !== 'boolean') || (value.truncated !== undefined && typeof value.truncated !== 'boolean')) return invalid();
  let execution: ExecutionContext | undefined;
  if (value.execution !== undefined) {
    const run = value.execution;
    if (!run || typeof run !== 'object' || !['run', 'test'].includes(run.action) || !['running', 'completed', 'timeout', 'output_limit', 'cleanup_failed', 'cancelled', 'technical_error'].includes(run.status) || !(run.exitCode === null || Number.isSafeInteger(run.exitCode)) || !string(run.output, 6000) || !string(run.createdAt, 40) || !Number.isFinite(Date.parse(run.createdAt)) || typeof run.truncated !== 'boolean' || typeof run.changedSinceExecution !== 'boolean') return invalid();
    execution = { action: run.action, status: run.status, exitCode: run.exitCode, output: run.output, files: fileMap(run.files), createdAt: run.createdAt, truncated: run.truncated, changedSinceExecution: run.changedSinceExecution };
  }
  return { page, exerciseId: value.exerciseId, mode: value.mode, selectedFile: value.selectedFile, files: fileMap(value.files ?? {}), running: !!value.running, truncated: !!value.truncated, ...(execution ? { execution } : {}) };
}
