import { exam, validateAnswers, validateEvents, validateMonitoring, type Answers, type Attempt, type ExamEvent, type Monitoring } from './definition';
import { createPresenceTracker } from './presence';
import { createExamCamera } from './camera';

export function initExam() {
  const root = document.getElementById('exam-app');
  if (!root) return;
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const editors = Array.from(root.querySelectorAll<HTMLTextAreaElement>('[data-answer]'));
  const start = el<HTMLButtonElement>('exam-start');
  const submit = el<HTMLButtonElement>('exam-submit');
  const consent = el<HTMLInputElement>('exam-consent');
  const submitDialog = el<HTMLDialogElement>('submit-dialog');
  const conflictDialog = el<HTMLDialogElement>('conflict-dialog');
  let attempt: Attempt | null = null;
  let conflict: Attempt | null = null;
  let busy = false;
  const presence = createPresenceTracker(record);
  let dirty = false;
  let selected = 0;
  let timerOffset = 0;
  let expirationChecked = false;
  let retryAt = 0;
  let queue: ExamEvent[] = [];
  let pendingSave: ReturnType<typeof setTimeout> | undefined;
  let pendingMonitoring: Monitoring | undefined;
  let monitoringKey = '';
  let camera: ReturnType<typeof createExamCamera>;
  const active = () => attempt?.status === 'in_progress';
  const storageKey = () => `pylevel:exam:${root.dataset.userId}:${attempt?.id}`;
  const collect = (): Answers => Object.fromEntries(editors.map(e => [e.dataset.answer!, e.value]));
  const completed = (answers: Answers) => exam.questions.filter(q => (answers[q.id] ?? '').trim() && (answers[q.id] ?? '').trim() !== q.starter.trim()).length;
  const equal = (a: Answers, b: Answers) => exam.questions.every(q => (a[q.id] ?? q.starter) === (b[q.id] ?? q.starter));

  function message(text: string, error = false) {
    const target = el('exam-message');
    target.textContent = text;
    target.hidden = !text;
    target.dataset.error = String(error);
  }
  function cache() {
    if (!attempt || !active()) return;
    try { localStorage.setItem(storageKey(), JSON.stringify({ answers: collect(), queue, monitoring: pendingMonitoring, revision: attempt.revision, away: presence.away })); } catch { /* Server saving remains available when local storage is disabled. */ }
  }
  function progress() {
    const answers = collect();
    el('exam-progress').textContent = `${completed(answers)} de ${exam.questions.length} respuestas`;
    exam.questions.forEach(q => {
      const state = root!.querySelector(`[data-answer-state="${q.id}"]`);
      if (state) state.textContent = (answers[q.id] ?? '').trim() && answers[q.id].trim() !== q.starter.trim() ? 'Con respuesta' : 'Sin responder';
    });
    el('incident-count').textContent = `${attempt?.incidents ?? 0} salidas registradas`;
    const cameraCount = attempt?.cameraIncidents ?? 0;
    el('camera-incident-count').textContent = `${cameraCount} ${cameraCount === 1 ? 'incidencia' : 'incidencias'} de cámara`;
  }
  function fill(answers: Answers) {
    editors.forEach(e => { e.value = answers[e.dataset.answer!] ?? exam.questions.find(q => q.id === e.dataset.answer)!.starter; });
    progress();
  }
  function showQuestion(index: number) {
    selected = Math.min(Math.max(index, 0), exam.questions.length - 1);
    root!.querySelectorAll<HTMLElement>('[data-question-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.questionPanel) !== selected; });
    root!.querySelectorAll<HTMLButtonElement>('[data-question]').forEach(button => {
      if (Number(button.dataset.question) === selected) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    el<HTMLButtonElement>('question-prev').disabled = selected === 0;
    el<HTMLButtonElement>('question-next').disabled = selected === exam.questions.length - 1;
  }
  function record(kind: ExamEvent['kind'], source: ExamEvent['source']) {
    if (!active()) return;
    // A single away episode covers both blur and visibilitychange.
    queue.push({ id: crypto.randomUUID(), kind, source });
    // Batches are bounded, and unsent events are kept for subsequent retries.
    cache();
  }
  function recordCamera(event: ExamEvent) {
    if (!active() || (!attempt?.cameraConsentAt && !pendingMonitoring && !camera.monitoring)) return;
    queue = queue.filter(item => item.id !== event.id);
    queue.push(event);
    cache();
  }
  function cameraChanged() {
    start.disabled = busy || !consent.checked || !camera?.prepared;
    const monitoring = camera?.monitoring;
    if (active() && monitoring && JSON.stringify(monitoring) !== monitoringKey) {
      pendingMonitoring = monitoring;
      monitoringKey = JSON.stringify(monitoring);
      cache();
    }
  }
  camera = createExamCamera(recordCamera, cameraChanged);
  function leave(source: ExamEvent['source']) {
    if (active() && presence.leave(source)) beacon();
  }
  function resume(source: ExamEvent['source']) {
    if (!active() || document.hidden || !document.hasFocus()) return;
    if (presence.resume(true, true, source)) {
      el('exam-warning').hidden = false;
    }
    void sync();
  }
  function beacon() {
    if (!active() || !attempt) return;
    cache();
    // Do not send answers here: a late beacon must not overwrite newer edits.
    const body = JSON.stringify({ action: 'sync', attemptId: attempt.id, events: queue.slice(0, 40), monitoring: pendingMonitoring });
    if (typeof navigator.sendBeacon === 'function') navigator.sendBeacon('/api/exam/attempt', new Blob([body], { type: 'application/json' }));
  }
  function finish() {
    if (!attempt) return;
    camera.stop();
    el('exam-workspace').hidden = true;
    el('exam-intro').hidden = true;
    el('exam-warning').hidden = true;
    el('exam-result').hidden = false;
    editors.forEach(e => { e.disabled = true; });
    if (submitDialog.open) submitDialog.close();
    if (conflictDialog.open) conflictDialog.close();
    el('result-title').textContent = attempt.status === 'expired' ? 'El tiempo ha finalizado' : 'Examen entregado';
    el('result-description').textContent = attempt.status === 'expired'
      ? 'El intento se cerró con las últimas respuestas guardadas antes del vencimiento. Tu evaluación está pendiente de revisión.'
      : 'Tus respuestas quedaron guardadas. Tu evaluación está pendiente de revisión.';
    el('result-answers').textContent = `${completed(attempt.answers)} de ${exam.questions.length}`;
    el('result-incidents').textContent = `${attempt.incidents} salidas · ${attempt.cameraIncidents} de cámara`;
    const reasons: Record<string, string> = { permission: 'permiso bloqueado', device: 'cámara no disponible', unsupported: 'navegador no compatible', technical: 'dificultad técnica', accessibility: 'alternativa de accesibilidad' };
    el('result-camera-mode').textContent = attempt.cameraMode === 'camera' ? 'Control de cámara activado en este intento. Las incidencias requieren revisión.'
      : attempt.cameraMode === 'unavailable' ? `Dificultad de cámara declarada: ${reasons[attempt.cameraUnavailableReason ?? ''] ?? 'sin especificar'}. Requiere revisión.` : 'Este intento se inició antes de incorporar el control de cámara.';
    el('result-receipt').textContent = `Intento ${attempt.id} · ${new Date(attempt.submittedAt!).toLocaleString('es-CO')}`;
    const review = el('result-review');
    review.replaceChildren();
    for (const q of exam.questions) {
      const heading = document.createElement('h3'); heading.textContent = q.title;
      const code = document.createElement('pre'); code.textContent = attempt.answers[q.id] ?? 'Sin respuesta';
      review.append(heading, code);
    }
    const heading = document.createElement('h3'); heading.textContent = 'Registro de actividad (últimos 100 eventos)'; review.append(heading);
    const list = document.createElement('ul');
    for (const event of attempt.events) {
      const item = document.createElement('li');
      const labels: Record<string, string> = { away: 'Salida de la ventana', return: 'Regreso', camera_ready: 'Cámara activa: un rostro detectado', camera_missing: 'No se detectó un rostro', camera_multiple: 'Se detectaron varios rostros', camera_interrupted: 'Cámara o análisis interrumpido', camera_unavailable: 'Dificultad de cámara declarada' };
      item.textContent = `${labels[event.kind] ?? event.kind}${event.durationMs !== undefined ? ` · Duración aproximada: ${Math.ceil(event.durationMs / 1000)} s` : ''} · Recibido: ${new Date(event.occurredAt).toLocaleString('es-CO')}`;
      list.append(item);
    }
    if (!attempt.events.length) { const item = document.createElement('li'); item.textContent = 'Sin incidencias registradas.'; list.append(item); }
    review.append(list);
    // Retain a local unsaved draft after expiry so it can still be recovered for support.
    if (!dirty) { try { localStorage.removeItem(storageKey()); } catch {} }
    message(dirty ? 'Hay cambios locales que no llegaron al servidor antes del cierre. Se conserva una copia local; no forman parte de la entrega.' : '');
  }
  function updateTime() {
    if (!attempt || !active()) return;
    const seconds = Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - (Date.now() + timerOffset)) / 1000));
    const timer = el('exam-timer');
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    timer.dataset.urgent = String(seconds <= 300);
    if (seconds === 0) camera.stop();
    editors.forEach(e => { e.disabled = seconds === 0; });
    submit.disabled = seconds === 0 || busy || conflict !== null;
    if (seconds === 0 && !expirationChecked && Date.now() >= retryAt) {
      expirationChecked = true;
      // Server finalizes using its own clock; late local answers are never accepted.
      void sync();
    }
  }
  function setAttempt(next: Attempt, replaceAnswers = false) {
    attempt = next;
    if (!active()) { finish(); return; }
    el('exam-camera').hidden = false;
    camera.setActive(true, next.cameraMode === 'unavailable');
    el('exam-intro').hidden = true;
    el('exam-result').hidden = true;
    el('exam-workspace').hidden = false;
    if (replaceAnswers) fill(next.answers);
    progress();
    updateTime();
  }
  function clock(serverNow: string) { timerOffset = Date.parse(serverNow) - Date.now(); }

  async function sync(submitting = false) {
    if (!attempt || !active() || busy || conflict) return;
    busy = true;
    submit.disabled = true;
    if (submitting) editors.forEach(e => { e.disabled = true; });
    if (submitting) camera.flush();
    const answers = collect();
    const revision = attempt.revision;
    const previousAnswers = attempt.answers;
    const events = queue.slice(0, 40);
    const monitoring = pendingMonitoring;
    const includeAnswers = submitting || dirty;
    const payload = JSON.stringify({ action: submitting ? 'submit' : 'sync', attemptId: attempt.id, events, monitoring,
      ...(includeAnswers ? { answers, revision } : {}) });
    el('save-state').textContent = 'Guardando…';
    try {
      const response = await fetch('/api/exam/attempt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: new TextEncoder().encode(payload).length <= 60000,
      });
      const data = await response.json();
      if (data.serverNow) clock(data.serverNow);
      if (response.status === 409 && data.attempt) {
        if (equal(data.attempt.answers, collect())) {
          attempt = data.attempt;
          dirty = false;
          message('La versión actual ya está guardada.');
          return;
        }
        conflict = data.attempt;
        if (!conflictDialog.open) conflictDialog.showModal();
        el('save-state').textContent = 'Conflicto entre pestañas. Elige una versión.';
        return;
      }
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar.');
      queue = queue.filter(e => !events.includes(e));
      if (pendingMonitoring === monitoring) pendingMonitoring = undefined;
      // A heartbeat may observe another tab's save. Never adopt its revision while
      // keeping an unrelated stale editor, which would silently overwrite that save.
      if (!includeAnswers && data.attempt.status === 'in_progress' && data.attempt.revision !== revision) {
        if (dirty && !equal(data.attempt.answers, previousAnswers)) {
          conflict = data.attempt;
          if (!conflictDialog.open) conflictDialog.showModal();
          el('save-state').textContent = 'Conflicto entre pestañas. Elige una versión.';
          return;
        }
        if (!dirty) fill(data.attempt.answers);
      }
      if (includeAnswers) dirty = !equal(data.attempt.answers, collect());
      setAttempt(data.attempt);
      cache();
      if (active()) {
        message('');
        el('save-state').textContent = dirty ? 'Cambios pendientes de guardar' : `Guardado · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
      }
      retryAt = 0;
    } catch (error) {
      cache();
      message((error as Error).message || 'Sin conexión. Los cambios siguen en esta ventana; reintentaremos el guardado.', true);
      el('save-state').textContent = 'No se ha confirmado el guardado. Reintentando…';
      retryAt = Date.now() + 5000;
      expirationChecked = false;
    } finally {
      busy = false;
      updateTime();
      if (active() && !conflict && (dirty || queue.length) && Date.now() >= retryAt) {
        clearTimeout(pendingSave);
        pendingSave = setTimeout(() => void sync(), 1000);
      }
    }
  }

  async function load() {
    try {
      const response = await fetch('/api/exam/attempt');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar el examen.');
      clock(data.serverNow);
      message('');
      if (!data.attempt) { el('exam-intro').hidden = false; el('exam-camera').hidden = false; return; }
      setAttempt(data.attempt, true);
      if (!active() || !attempt) return;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null');
        if (saved && saved.revision === attempt.revision && saved.answers) {
          // Validate local recovery data as carefully as server payloads.
          fill(validateAnswers(saved.answers));
          const storedEvents = Array.isArray(saved.queue) ? saved.queue.slice(0, 2000) : [];
          const recovered: ExamEvent[] = [];
          for (let index = 0; index < storedEvents.length; index += 40) recovered.push(...validateEvents(storedEvents.slice(index, index + 40)));
          queue = [...recovered, ...queue.filter(event => !recovered.some(item => item.id === event.id))];
          if (saved.monitoring) pendingMonitoring = validateMonitoring(saved.monitoring);
          dirty = !equal(collect(), attempt.answers);
          presence.restore(Boolean(saved.away));
          if (dirty) message('Recuperamos cambios locales pendientes de guardar.');
        } else if (saved?.answers && !equal(saved.answers, attempt.answers)) {
          fill(validateAnswers(saved.answers)); dirty = true; conflict = attempt;
          conflictDialog.showModal();
        }
      } catch { message('No se pudo recuperar la copia local. Se cargaron las respuestas del servidor.'); }
      if (presence.away) resume('resume');
      void sync();
    } catch (error) {
      message(`${(error as Error).message} Recarga la página para volver a intentar.`, true);
    }
  }

  consent.addEventListener('change', cameraChanged);
  start.addEventListener('click', async () => {
    if (!consent.checked || !camera.prepared || !camera.monitoring || busy) return;
    busy = true; start.disabled = true; start.textContent = 'Preparando tu examen…';
    try {
      const monitoring = camera.monitoring;
      const response = await fetch('/api/exam/attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', monitoring }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar el examen.');
      clock(data.serverNow);
      monitoringKey = JSON.stringify(monitoring);
      setAttempt(data.attempt, true);
      // Persist starter code as part of the first acknowledged save.
      dirty = true;
      message('');
      editors[0].focus();
    } catch (error) { message((error as Error).message, true); }
    finally { busy = false; cameraChanged(); start.textContent = 'Comenzar examen →'; updateTime(); }
    void sync();
  });
  for (const editor of editors) {
    editor.addEventListener('input', () => {
      if (!active()) return;
      dirty = true; cache(); progress();
      el('save-state').textContent = 'Cambios pendientes de guardar';
      clearTimeout(pendingSave);
      pendingSave = setTimeout(() => void sync(), 1000);
    });
    editor.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.shiftKey || editor.disabled) return;
      event.preventDefault();
      if (editor.value.length + 4 > editor.maxLength) return;
      editor.setRangeText('    ', editor.selectionStart, editor.selectionEnd, 'end');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  root.querySelectorAll<HTMLButtonElement>('[data-question]').forEach(button => button.addEventListener('click', () => showQuestion(Number(button.dataset.question))));
  el('question-prev').addEventListener('click', () => showQuestion(selected - 1));
  el('question-next').addEventListener('click', () => showQuestion(selected + 1));
  el('exam-save').addEventListener('click', () => void sync());
  el('dismiss-warning').addEventListener('click', () => { el('exam-warning').hidden = true; });
  submit.addEventListener('click', () => {
    const count = completed(collect());
    el('submit-summary').textContent = `Tienes ${count} de ${exam.questions.length} respuestas. ${count < exam.questions.length ? 'Hay retos sin responder.' : 'Todas las preguntas tienen código modificado.'}`;
    submitDialog.showModal();
  });
  submitDialog.addEventListener('close', () => { if (submitDialog.returnValue === 'submit') void sync(true); });
  conflictDialog.addEventListener('cancel', event => event.preventDefault());
  conflictDialog.addEventListener('close', () => {
    if (!conflict || !active()) return;
    attempt = conflict; conflict = null;
    if (conflictDialog.returnValue === 'server') { fill(attempt.answers); dirty = false; }
    else dirty = true;
    cache(); void sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { leave('visibility'); void sync(); }
    else { expirationChecked = false; resume('visibility'); updateTime(); }
  });
  window.addEventListener('blur', () => leave('focus'));
  window.addEventListener('focus', () => resume('focus'));
  window.addEventListener('pagehide', () => { camera.flush(); leave('pagehide'); beacon(); });
  window.addEventListener('pageshow', event => { if (event.persisted) resume('resume'); });
  window.addEventListener('online', () => { retryAt = 0; void sync(); });
  window.addEventListener('offline', () => { if (active()) message('Sin conexión. Mantén esta ventana abierta; reintentaremos el guardado al reconectar.', true); });
  window.addEventListener('beforeunload', event => {
    if (!active()) return;
    cache(); event.preventDefault(); event.returnValue = '';
  });
  setInterval(updateTime, 1000);
  setInterval(() => { if (active() && Date.now() >= retryAt) void sync(); }, 5000);
  void load();
}
