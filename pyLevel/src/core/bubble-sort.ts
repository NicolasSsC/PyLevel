export type BubbleItem = { id: number; value: number };
export type BubbleFrame = {
  items: BubbleItem[];
  active: number[];
  sortedFrom: number;
  comparisons: number;
  swaps: number;
  pass: number;
  message: string;
  phase: 'ready' | 'compare' | 'swap' | 'settled' | 'done';
};

/** Teaching trace for a fixed example, independent of student Python execution. */
export function bubbleFrames(values: number[]): BubbleFrame[] {
  const items = values.map((value, id) => ({ value, id }));
  const frames: BubbleFrame[] = [];
  let comparisons = 0;
  let swaps = 0;
  const capture = (phase: BubbleFrame['phase'], pass: number, sortedFrom: number, active: number[], message: string) => {
    frames.push({ items: items.map(item => ({ ...item })), active, sortedFrom, comparisons, swaps, pass, message, phase });
  };
  capture('ready', 0, items.length, [], 'Comienza por comparar los dos primeros vecinos.');
  for (let end = items.length - 1, pass = 1; end > 0; end--, pass++) {
    let changed = false;
    for (let j = 0; j < end; j++) {
      const left = items[j];
      const right = items[j + 1];
      comparisons++;
      const relation = left.value > right.value ? '>' : left.value === right.value ? '=' : '<';
      capture('compare', pass, end + 1, [left.id, right.id], `${left.value} ${relation} ${right.value} · ${left.value > right.value ? 'Están al revés: se intercambiarán.' : 'Conservan su posición.'}`);
      if (left.value > right.value) {
        [items[j], items[j + 1]] = [right, left];
        swaps++;
        changed = true;
        capture('swap', pass, end + 1, [left.id, right.id], `Intercambio: ${right.value} queda antes que ${left.value}.`);
      }
    }
    capture('settled', pass, end, [], `Pasada ${pass}: el ${items[end].value} queda en su posición final.`);
    if (!changed || end === 1) {
      capture('done', pass, 0, [], changed ? 'Lista ordenada. Cada elemento está en su lugar.' : 'Una pasada sin intercambios: la lista ya está ordenada.');
      return frames;
    }
  }
  capture('done', 0, 0, [], 'La lista ya está ordenada.');
  return frames;
}
