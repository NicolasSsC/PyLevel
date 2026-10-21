import { createCameraPolicy } from './camera-policy';
import type { ExamEvent, Monitoring } from './definition';

export function createExamCamera(record: (event: ExamEvent) => void, change: () => void) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const video = el<HTMLVideoElement>('camera-preview');
  const consent = el<HTMLInputElement>('camera-consent');
  const enable = el<HTMLButtonElement>('camera-enable');
  const fallback = el<HTMLButtonElement>('camera-fallback');
  const reason = el<HTMLSelectElement>('camera-reason');
  const status = el('camera-status');
  let stream: MediaStream | null = null;
  let worker: Worker | null = null;
  let generation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let framePending = false;
  let frameSentAt = 0;
  let lastImageAt = 0;
  let requesting = false;
  let isActive = false;
  let finished = false;
  let ready = false;
  let lastCount: number | null = null;
  let mode: Monitoring | null = null;
  let declaredUnavailable = false;
  let readyRecorded = false;
  const policy = createCameraPolicy(event => { if (isActive) record(event); });

  function report(text: string, state: 'waiting' | 'ok' | 'warning' = 'waiting') {
    status.textContent = text; status.dataset.state = state;
    el('camera-live').textContent = text; el('camera-live').dataset.state = state;
  }
  function controls() {
    enable.disabled = !consent.checked || requesting || finished;
    fallback.disabled = !consent.checked || requesting || finished || !reason.value;
    change();
  }
  function release() {
    generation++;
    clearInterval(timer); clearTimeout(timeout);
    worker?.terminate(); worker = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    video.srcObject = null; video.hidden = true;
    framePending = false; ready = false; lastCount = null;
  }
  function unavailable(message: string) {
    policy.reset(performance.now()); release(); requesting = false;
    report(message, 'warning');
    if (isActive) policy.observe('interrupted', performance.now());
    controls();
  }
  function observe() {
    if (document.hidden || !stream || !worker || video.readyState < 2 || finished) return;
    if (framePending) {
      if (performance.now() - frameSentAt > 8000) unavailable('El análisis de cámara no responde. Reconecta la cámara o registra una dificultad técnica.');
      return;
    }
    framePending = true; frameSentAt = performance.now();
    const current = generation;
    void createImageBitmap(video, { resizeWidth: 320, resizeHeight: 240 }).then(frame => {
      if (current !== generation) { frame.close(); return; }
      if (!worker || document.hidden) { frame.close(); framePending = false; return; }
      worker.postMessage({ type: 'frame', frame, timestamp: performance.now() }, [frame]);
    }).catch(() => { if (current === generation) unavailable('No pudimos leer la imagen. Intenta reconectar la cámara.'); });
  }
  async function activate() {
    if (!consent.checked || requesting || finished) return;
    policy.reset(performance.now()); release();
    mode = null; declaredUnavailable = false; requesting = true; controls();
    report('Esperando permiso de cámara…');
    const current = generation;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.Worker || !window.createImageBitmap) {
        throw new Error('unsupported');
      }
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      if (current !== generation || finished) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; video.srcObject = stream; video.hidden = false;
      timeout = setTimeout(() => unavailable('La cámara no entrega imagen. Reintenta o registra una dificultad técnica.'), 12000);
      await video.play();
      if (current !== generation || finished) return;
      clearTimeout(timeout);
      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', () => { if (current === generation) unavailable('La cámara se desconectó. Puedes reconectarla sin perder tus respuestas.'); });
      track.addEventListener('mute', () => {
        if (finished || current !== generation) return;
        ready = false; lastCount = null; policy.reset(performance.now());
        if (isActive) policy.observe('interrupted', performance.now());
        report('La cámara dejó de entregar imagen. Revisa el dispositivo.', 'warning'); controls();
      });
      track.addEventListener('unmute', () => { if (current === generation) { lastCount = null; report('Cámara recuperada. Comprobando encuadre…'); } });
      report('Preparando el detector local…');
      worker = new Worker('/vendor/mediapipe/camera-worker.js');
      timeout = setTimeout(() => unavailable('No se pudo cargar el detector. Reintenta o registra una dificultad técnica.'), 20000);
      worker.onerror = () => { if (current === generation) unavailable('El detector no está disponible. Reintenta o registra una dificultad técnica.'); };
      worker.onmessage = ({ data }) => {
        if (current !== generation || finished) return;
        if (data.type === 'ready') {
          clearTimeout(timeout); requesting = false;
          lastImageAt = performance.now();
          mode = { mode: 'camera', consent: true }; readyRecorded = false;
          report('Ubícate frente a la cámara. Comprobando encuadre…');
          timer = setInterval(observe, 350); observe(); controls();
        } else if (data.type === 'faces') {
          framePending = false;
          lastImageAt = performance.now();
          if (document.hidden || track.muted) return;
          lastCount = data.count;
          const next = data.count === 1 ? 'single' : data.count === 0 ? 'missing' : 'multiple';
          const state = policy.observe(next, performance.now());
          ready = state.ready;
          if (ready) {
            report('Cámara activa · Un rostro detectado', 'ok');
            if (isActive && !readyRecorded) { record({ id: crypto.randomUUID(), kind: 'camera_ready', source: 'camera' }); readyRecorded = true; }
          } else if (state.alert) {
            report(next === 'missing' ? 'No se detecta un rostro. Revisa tu encuadre y la iluminación.' : 'Se detecta más de un rostro en el encuadre.', 'warning');
          } else report(next === 'single' ? 'Comprobando encuadre…' : 'Buscando un encuadre con un solo rostro…');
          controls();
        } else unavailable('El análisis de imagen se interrumpió. Intenta reconectar la cámara.');
      };
      worker.postMessage({ type: 'init' });
    } catch (error) {
      if (current !== generation || finished) return;
      const name = (error as Error).name;
      reason.value = (error as Error).message === 'unsupported' ? 'unsupported' : name === 'NotAllowedError' ? 'permission' : name === 'NotFoundError' ? 'device' : 'technical';
      unavailable(name === 'NotAllowedError' ? 'El permiso de cámara está bloqueado. Puedes habilitarlo en el navegador o registrar esta dificultad.'
        : name === 'NotFoundError' ? 'No encontramos una cámara. Conecta una o registra esta dificultad.'
          : 'No pudimos activar la cámara. Revisa que uses HTTPS o localhost y que otra aplicación no la esté ocupando.');
    }
  }
  enable.addEventListener('click', () => void activate());
  consent.addEventListener('change', () => {
    if (!consent.checked) { policy.reset(performance.now()); release(); requesting = false; mode = null; report('Cámara apagada. Acepta las condiciones para activarla.'); if (isActive) policy.observe('interrupted', performance.now()); }
    controls();
  });
  reason.addEventListener('change', controls);
  fallback.addEventListener('click', () => {
    if (!consent.checked || !reason.value || finished) return;
    policy.reset(performance.now()); release();
    mode = { mode: 'unavailable', reason: reason.value as Monitoring['reason'], consent: true };
    declaredUnavailable = true;
    report('Continuarás con una dificultad de cámara registrada para revisión.', 'warning');
    if (isActive) record({ id: crypto.randomUUID(), kind: 'camera_unavailable', source: 'camera' });
    controls();
  });
  document.addEventListener('visibilitychange', () => {
    policy.reset(performance.now()); ready = false; lastCount = null;
    lastImageAt = performance.now();
    if (!document.hidden && stream) report('Comprobando la cámara al volver…');
    controls();
  });
  // Keep technical interruptions visible even if inference has stopped.
  const health = setInterval(() => {
    if (isActive && !document.hidden && !declaredUnavailable && mode?.mode !== 'unavailable' && (!stream || stream.getVideoTracks()[0]?.muted)) policy.observe('interrupted', performance.now());
    if (!document.hidden && stream && worker && !requesting && performance.now() - lastImageAt > 8000) unavailable('La imagen o el análisis de cámara se interrumpió. Intenta reconectar.');
  }, 1000);
  window.addEventListener('pagehide', () => { policy.reset(performance.now()); release(); requesting = false; readyRecorded = false; });
  window.addEventListener('pageshow', event => { if (event.persisted && !finished) { mode = null; report('Activa de nuevo la cámara para continuar la supervisión.'); controls(); } });
  controls();
  return {
    get prepared() { return consent.checked && !!mode && (mode.mode === 'unavailable' || ready); },
    get monitoring() { return mode; },
    setActive(value: boolean, unavailableAlreadyDeclared = false) {
      if (value && !isActive) {
        policy.reset(performance.now()); isActive = true;
        if (unavailableAlreadyDeclared && !mode) {
          declaredUnavailable = true;
          report('Este intento tiene una dificultad de cámara registrada. Puedes activarla si ya está disponible.', 'warning');
          return;
        }
        if (mode?.mode === 'unavailable') record({ id: crypto.randomUUID(), kind: 'camera_unavailable', source: 'camera' });
        else if (ready && lastCount === 1) { record({ id: crypto.randomUUID(), kind: 'camera_ready', source: 'camera' }); readyRecorded = true; }
        else policy.observe('interrupted', performance.now());
      } else if (!value) isActive = false;
    },
    flush() { policy.flush(performance.now()); },
    stop() { policy.reset(performance.now()); isActive = false; finished = true; release(); clearInterval(health); el('exam-camera').hidden = true; },
  };
}
