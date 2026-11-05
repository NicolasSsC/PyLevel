import type { Attempt } from './definition';

export function setupExamCodeTesting(root: HTMLElement, getAttempt: () => Attempt | null) {
  const query = <T extends HTMLElement>(name: string, id: string) => root.querySelector<T>(`[data-code-${name}="${id}"]`)!;
  const editor = (id: string) => root.querySelector<HTMLTextAreaElement>(`[data-answer="${id}"]`)!;
  let enabled = false;
  let job: { controller: AbortController; id: string; reason: string } | null = null;
  function controls() {
    root.querySelectorAll<HTMLButtonElement>('[data-code-test]').forEach(button => { button.disabled = !enabled || !!job; });
    root.querySelectorAll<HTMLButtonElement>('[data-code-stop]').forEach(button => { button.hidden = job?.id !== button.dataset.codeStop; });
  }
  function stop(reason: string) { if (job) { job.reason = reason; job.controller.abort(); } }
  async function run(id: string) {
    const attempt = getAttempt();
    if (!enabled || job || !attempt || attempt.status !== 'in_progress') return;
    const code = editor(id).value;
    if (!code.trim()) { editor(id).focus(); return; }
    const current = { controller: new AbortController(), id, reason: 'Prueba detenida.' };
    job = current;
    const panel = query('output', id), status = query('status', id), terminal = query('terminal', id);
    panel.hidden = false; panel.dataset.state = 'running';
    status.textContent = 'Probando los ejemplos…'; terminal.textContent = '';
    controls();
    try {
      const response = await fetch('/api/exam/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attempt.id, questionId: id, code }),
        signal: AbortSignal.any([current.controller.signal, AbortSignal.timeout(47000)]),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo probar el código.');
      if (current.controller.signal.aborted || !enabled || job !== current) return;
      if (typeof result.output !== 'string' || typeof result.passed !== 'boolean' || !Number.isInteger(result.testsRun)) throw new Error('Respuesta del ejecutor inválida.');
      terminal.textContent = result.output || '(Sin salida)';
      if (editor(id).value !== code) {
        panel.dataset.state = 'changed'; status.textContent = 'Resultado de una versión anterior · vuelve a probar';
      } else {
        panel.dataset.state = result.passed ? 'passed' : 'failed';
        status.textContent = result.passed ? `✓ Ejemplos superados · ${result.testsRun} casos` : result.status === 'completed' ? 'Revisa el resultado de los ejemplos' : 'La prueba no pudo completarse';
      }
    } catch (error) {
      if (job !== current) return;
      panel.dataset.state = 'neutral';
      status.textContent = current.controller.signal.aborted ? current.reason : 'No se pudo completar la prueba';
      terminal.textContent = current.controller.signal.aborted ? current.reason : (error as Error).message;
    } finally { if (job === current) { job = null; controls(); } }
  }
  root.querySelectorAll<HTMLButtonElement>('[data-code-test]').forEach(button => button.addEventListener('click', () => void run(button.dataset.codeTest!)));
  root.querySelectorAll<HTMLButtonElement>('[data-code-stop]').forEach(button => button.addEventListener('click', () => stop('Prueba detenida.')));
  root.querySelectorAll<HTMLTextAreaElement>('[data-answer]').forEach(input => input.addEventListener('input', () => {
    const id = input.dataset.answer!;
    if (job?.id === id) stop('Código modificado · vuelve a probar');
    const panel = query('output', id);
    if (!panel.hidden) { panel.dataset.state = 'changed'; query('status', id).textContent = 'Código modificado · vuelve a probar'; }
  }));
  window.addEventListener('pagehide', () => stop('Prueba detenida al salir del examen.'));
  controls();
  return {
    update(available: boolean) { enabled = available; if (!available) stop('Prueba detenida al cerrar o finalizar el intento.'); controls(); },
    select(id: string) { if (job && job.id !== id) stop('Prueba detenida al cambiar de pregunta.'); },
    stop,
  };
}
