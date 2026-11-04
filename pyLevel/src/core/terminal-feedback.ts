import type { Action, Result } from './client';

export function showTerminalResult(terminal: HTMLElement, label: HTMLElement, result: Result, action: Action) {
  const correct = action === 'test' && result.status === 'completed' && result.exit_code === 0
    && result.practiceResult === 'passed' && Number(result.testsRun) > 0;
  terminal.dataset.feedback = correct ? 'correct' : 'neutral';
  const statuses: Record<string, string> = { timeout: 'Tiempo máximo excedido', output_limit: 'Límite de salida excedido', cleanup_failed: 'Error de limpieza del ejecutor' };
  label.textContent = correct ? `✓ Correcto · ${result.testsRun} pruebas superadas`
    : result.status !== 'completed' ? statuses[result.status] || result.status
    : action === 'test' ? `Pruebas no superadas · código ${result.exit_code}`
    : `Finalizado${result.exit_code === 0 ? '' : ' con errores'} · código ${result.exit_code}`;
}

export function resetTerminalFeedback(terminal: HTMLElement, label: HTMLElement, edited = false) {
  const wasCorrect = terminal.dataset.feedback === 'correct';
  terminal.dataset.feedback = 'neutral';
  if (edited && wasCorrect) label.textContent = 'Código modificado · vuelve a probar';
}
