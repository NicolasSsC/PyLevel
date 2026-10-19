export async function trackActivity(exerciseId: string, mode: 'classic' | 'contextual', kind: 'opened' | 'hint' | 'solution') {
  try {
    const response = await fetch('/api/practice/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), exerciseId, mode, kind }), keepalive: true });
    return response.ok ? Boolean((await response.json()).saved) : null;
  } catch { return null; /* Viewing an exercise or a hint must remain available offline. */ }
}
export function practiceMessage(result: {tracking?: string; practiceResult?: string; testsRun?: number}, action: 'run' | 'test') {
  const assessment = action === 'test' && result.practiceResult === 'passed' ? `Pruebas públicas superadas (${result.testsRun}).` : '';
  const tracking = result.tracking === 'saved' ? 'Actividad guardada en tu progreso.' : result.tracking === 'guest' ? 'Inicia sesión para guardar tu progreso.' : 'No se pudo confirmar el guardado del progreso.';
  return `${assessment} ${tracking}`.trim();
}
