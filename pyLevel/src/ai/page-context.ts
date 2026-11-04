import type { Action, Result } from '../core/client';

export type ExecutionContext = {
  action: Action; status: string; exitCode: number | null; output: string;
  files: Record<string, string>; truncated: boolean; createdAt: string; changedSinceExecution: boolean;
};
export type PageContext = {
  page: string; exerciseId?: string; mode?: 'classic' | 'contextual'; selectedFile?: string;
  files?: Record<string, string>; truncated?: boolean; running?: boolean; execution?: ExecutionContext;
};

// Budget by UTF-8 bytes so a multi-file workspace still fits the chat body limit.
export function clipText(value: string, maximum: number, tail = false) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length <= maximum) return value;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(tail ? bytes.slice(-maximum) : bytes.slice(0, maximum)).replace(/\uFFFD/g, '');
}
export function contextFiles(files: Record<string, string>, selected = 'main.py') {
  const result: Record<string, string> = {};
  let remaining = 6000;
  const paths = [...new Set([selected, 'main.py', ...Object.keys(files)])].filter(path => Object.hasOwn(files, path) && !path.startsWith('tests/'));
  for (const path of paths.slice(0, 6)) {
    if (remaining <= 0) break;
    const code = clipText(files[path], Math.min(3000, remaining));
    result[path] = code;
    remaining -= new TextEncoder().encode(code).length;
  }
  return { files: result, truncated: paths.some(path => result[path] !== files[path]) };
}

let practice: { path: string; title: string; read: () => PageContext } | null = null;
const changed = () => window.dispatchEvent(new Event('pylevel:context-change'));

export function registerPracticeContext(options: {
  id: string; mode: 'classic' | 'contextual'; title: string;
  getFiles: () => Record<string, string>; getSelectedFile: () => string;
}) {
  let execution: ExecutionContext | undefined;
  let submitted: Record<string, string> = {};
  let running = false;
  const path = location.pathname;
  practice = { path, title: options.title, read: () => ({
    page: path, exerciseId: options.id, mode: options.mode, selectedFile: options.getSelectedFile(),
    ...contextFiles(options.getFiles(), options.getSelectedFile()), running,
    ...(execution ? { execution: { ...execution, changedSinceExecution: JSON.stringify(options.getFiles()) !== JSON.stringify(submitted) } } : {}),
  }) };
  changed();
  return {
    changed,
    start(action: Action, files: Record<string, string>) {
      submitted = { ...files };
      running = true;
      execution = { action, status: 'running', exitCode: null, output: '', ...contextFiles(submitted, options.getSelectedFile()), createdAt: new Date().toISOString(), changedSinceExecution: false };
      changed();
    },
    finish(result: Pick<Result, 'status' | 'exit_code' | 'output'>) {
      if (!execution) return;
      running = false;
      execution = { ...execution, status: result.status, exitCode: result.exit_code, output: clipText(result.output, 3000, true) };
      changed();
    },
    fail(message: string, cancelled: boolean) {
      if (!execution) return;
      running = false;
      execution = { ...execution, status: cancelled ? 'cancelled' : 'technical_error', output: clipText(message, 3000), exitCode: null };
      changed();
    },
    reset() { execution = undefined; submitted = {}; running = false; changed(); },
  };
}

export function readPageContext(): PageContext {
  return practice?.path === location.pathname ? practice.read() : { page: location.pathname };
}
export function contextLabel(context: PageContext) {
  if (!context.exerciseId) return 'Tu progreso y herramientas de PyLevel';
  const result = context.running ? 'ejecutando…' : context.execution?.changedSinceExecution ? 'código modificado después de ejecutar'
    : context.execution ? context.execution.status === 'completed' ? context.execution.exitCode === 0 ? 'última ejecución finalizada' : 'última ejecución con errores' : 'revisar última ejecución' : 'sin ejecutar todavía';
  return `${practice?.title ?? 'Ejercicio'} · ${context.selectedFile} · ${result}`;
}
