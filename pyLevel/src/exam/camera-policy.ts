import type { CameraKind, ExamEvent } from './definition.ts';

export const cameraThresholds = { missing: 5000, multiple: 3000, ready: 1500 };
type Signal = 'single' | 'missing' | 'multiple' | 'interrupted';

// Durations describe observations, not proof of misconduct. An episode has a stable
// id so its completion updates the same database row rather than inflating counts.
export function createCameraPolicy(emit: (event: ExamEvent) => void, id: () => string = () => crypto.randomUUID()) {
  let signal: Signal | null = null;
  let since = 0;
  let episode: ExamEvent | null = null;
  let lastReported = 0;
  const kind: Record<Exclude<Signal, 'single'>, CameraKind> = {
    missing: 'camera_missing', multiple: 'camera_multiple', interrupted: 'camera_interrupted',
  };
  function duration(now: number) { return Math.min(7200000, Math.max(0, Math.round(now - since))); }
  function flush(now: number) {
    if (episode) emit({ ...episode, durationMs: duration(now) });
  }
  return {
    flush,
    observe(next: Signal, now: number) {
      if (signal !== next) { flush(now); signal = next; since = now; episode = null; lastReported = 0; }
      const elapsed = duration(now);
      const threshold = next === 'missing' ? cameraThresholds.missing : next === 'multiple' ? cameraThresholds.multiple : 0;
      if (next !== 'single' && elapsed >= threshold && (!episode || elapsed - lastReported >= 10000)) {
        episode ??= { id: id(), kind: kind[next], source: 'camera' };
        lastReported = elapsed;
        emit({ ...episode, durationMs: elapsed });
      }
      return { ready: next === 'single' && elapsed >= cameraThresholds.ready, alert: next !== 'single' && elapsed >= threshold };
    },
    reset(now: number) { flush(now); signal = null; episode = null; },
  };
}
