export function restore(id: string, initial: Record<string, string>): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(`pylevel:${id}`) || 'null');
    if (saved && Object.keys(initial).every(path => typeof saved[path] === 'string')) {
      return Object.fromEntries(Object.keys(initial).map(path => [path, saved[path]]));
    }
  } catch { /* Storage may be unavailable or contain an older format. */ }
  return { ...initial };
}

export function save(id: string, files: Record<string, string>): boolean {
  try { localStorage.setItem(`pylevel:${id}`, JSON.stringify(files)); return true; }
  catch { return false; }
}
