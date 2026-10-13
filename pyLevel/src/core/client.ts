export type Action = 'run' | 'test';
export type Result = { status: string; exit_code: number; output: string };

export async function execute(files: Record<string, string>, action: Action, signal: AbortSignal): Promise<Result> {
  const response = await fetch('/api/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, action }), signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo ejecutar el proyecto.');
  if (typeof data.output !== 'string' || typeof data.status !== 'string' || typeof data.exit_code !== 'number') {
    throw new Error('Respuesta inválida del ejecutor.');
  }
  return data;
}
