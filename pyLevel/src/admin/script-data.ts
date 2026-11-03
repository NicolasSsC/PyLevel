export function scriptData(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
