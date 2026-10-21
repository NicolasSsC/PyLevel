import type { Exercise } from '../core/catalog.ts';
import type { Database } from '../lib/session-store.ts';
import { activityStore, classifyResult, type Mode } from './activity.ts';

export type RunnerResult = { status: string; exit_code: number; output: string };
export function preparePracticeFiles(exercise: Exercise, action: 'run' | 'test', files: unknown) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Los archivos no son válidos.');
  const entries = Object.entries(files);
  if (entries.length > 64 || entries.some(([name, code]) => !Object.hasOwn(exercise.files, name) || typeof code !== 'string' || code.length > 100000)) throw new Error('El proyecto contiene archivos o tamaños no admitidos.');
  const prepared = Object.fromEntries(entries) as Record<string, string>;
  if (action === 'test') {
    // Ignore edited browser tests when calculating progress in either modality.
    for (const [path, code] of Object.entries(exercise.files)) if (path.startsWith('tests/')) prepared[path] = code;
  }
  if (Object.keys(exercise.files).some(name => !Object.hasOwn(prepared, name))) throw new Error('Faltan archivos del ejercicio. Restablece el proyecto para recuperarlos.');
  if (new TextEncoder().encode(JSON.stringify({ files: prepared, action })).length > 262144) throw new Error('El proyecto es demasiado grande.');
  return prepared;
}

export async function executePractice(options: {
  db: Database; userId: string | null; exercise: Exercise; mode: Mode; action: 'run' | 'test'; files: Record<string, string>;
  signal: AbortSignal; run: (files: Record<string, string>, action: 'run' | 'test', signal: AbortSignal) => Promise<RunnerResult>;
}) {
  const store = activityStore(options.db);
  const id = options.userId ? await store.record(options.userId, options.exercise.id, options.mode, options.action, undefined, 'pending') : null;
  const startedAt = performance.now();
  try {
    const result = await options.run(options.files, options.action, options.signal);
    if (typeof result.status !== 'string' || typeof result.output !== 'string' || !Number.isInteger(result.exit_code)) throw new Error('Respuesta inválida del ejecutor.');
    const evaluation = classifyResult(options.action, result);
    let tracking = options.userId ? 'saved' : 'guest';
    if (id && options.userId) {
      try { await store.finish(options.userId, id, evaluation.result, evaluation.testsRun, performance.now() - startedAt); }
      catch { tracking = 'unavailable'; }
    }
    return { ...result, tracking, practiceResult: evaluation.result, testsRun: evaluation.testsRun };
  } catch (error) {
    if (id && options.userId) {
      try { await store.finish(options.userId, id, options.signal.aborted ? 'cancelled' : 'technical_error', 0, performance.now() - startedAt); } catch {}
    }
    throw error;
  }
}
