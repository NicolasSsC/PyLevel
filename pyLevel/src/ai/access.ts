import type { Database } from '../lib/session-store.ts';

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
  return { mensaje: mensaje.trim(), historial, contexto };
}
