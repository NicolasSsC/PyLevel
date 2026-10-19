import type { ExamEvent } from './definition.ts';

// Browsers commonly emit both blur and visibilitychange for the same departure.
export function createPresenceTracker(record: (kind: ExamEvent['kind'], source: ExamEvent['source']) => void) {
  let away = false;
  return {
    get away() { return away; },
    restore(value: boolean) { away = value; },
    leave(source: ExamEvent['source']) {
      if (away) return false;
      away = true;
      record('away', source);
      return true;
    },
    resume(visible: boolean, focused: boolean, source: ExamEvent['source']) {
      if (!away || !visible || !focused) return false;
      away = false;
      record('return', source);
      return true;
    },
  };
}
