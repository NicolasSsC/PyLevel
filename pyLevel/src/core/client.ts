export type Action = 'run' | 'test';
export type Result = { status: string; exit_code: number; output: string; tracking?: string; practiceResult?: string; testsRun?: number };

export async function execute(files: Record<string, string>, action: Action, signal: AbortSignal, context: {exerciseId: string; mode: 'classic' | 'contextual'}): Promise<Result> {
  const response = await fetch('/api/practice/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, action, ...context }), signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo ejecutar el proyecto.');
  if (typeof data.output !== 'string' || typeof data.status !== 'string' || typeof data.exit_code !== 'number') {
    throw new Error('Respuesta inválida del ejecutor.');
  }
  return data;
}
