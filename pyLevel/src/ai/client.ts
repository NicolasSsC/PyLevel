import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bridgeScript = join(__dirname, 'bridge.py');

export interface AIActionPayload {
  action:
    | 'generate_challenge'
    | 'generate_project'
    | 'hint_challenge'
    | 'hint_project'
    | 'explain_error'
    | 'chat'
    | 'solve_challenge'
    | 'solve_project'
    | 'generate_exam'
    | 'generate_question'
    | 'generate_bank';
  data?: Record<string, any>;
}

interface PendingRequest {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timeoutId: NodeJS.Timeout;
}

// Estado del worker persistente (Warm Worker)
let persistentWorker: ChildProcess | null = null;
let stdoutBuffer = '';
let requestCounter = 0;
const pendingRequests = new Map<string, PendingRequest>();

function getPythonCommand(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function getOrCreateWorker(): ChildProcess {
  if (persistentWorker && !persistentWorker.killed && persistentWorker.exitCode === null) {
    return persistentWorker;
  }

  const pythonCmd = getPythonCommand();
  const worker = spawn(pythonCmd, [bridgeScript, '--daemon'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    },
  });

  stdoutBuffer = '';

  worker.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf-8');
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const reqId = parsed.id;
        if (reqId && pendingRequests.has(reqId)) {
          const req = pendingRequests.get(reqId)!;
          clearTimeout(req.timeoutId);
          pendingRequests.delete(reqId);
          req.resolve(parsed);
        }
      } catch (err) {
        console.error('[AI Client Worker] JSON Parse error:', err);
      }
    }
  });

  worker.stderr?.on('data', (chunk: Buffer) => {
    const errText = chunk.toString('utf-8').trim();
    if (errText) {
      console.warn('[AI Client Worker STDERR]:', errText);
    }
  });

  worker.on('error', err => {
    console.error('[AI Client Worker Error]:', err.message);
    cleanupPendingRequests(new Error(`Worker de Python falló: ${err.message}`));
    persistentWorker = null;
  });

  worker.on('close', code => {
    if (code !== 0 && code !== null) {
      console.warn(`[AI Client Worker Closed] código: ${code}`);
    }
    cleanupPendingRequests(new Error(`Worker de Python terminó con código: ${code}`));
    persistentWorker = null;
  });

  persistentWorker = worker;
  return persistentWorker;
}

function cleanupPendingRequests(error: Error) {
  for (const [id, req] of pendingRequests.entries()) {
    clearTimeout(req.timeoutId);
    req.reject(error);
  }
  pendingRequests.clear();
}

// Hook de limpieza al apagar el servidor
if (typeof process !== 'undefined') {
  const killWorker = () => {
    if (persistentWorker && !persistentWorker.killed) {
      try {
        persistentWorker.kill();
      } catch {}
      persistentWorker = null;
    }
  };
  process.once('exit', killWorker);
  process.once('SIGINT', killWorker);
  process.once('SIGTERM', killWorker);
}

/**
 * Invoca el motor de IA usando el Worker persistente de alto rendimiento (<2ms overhead).
 * Si el worker falla, aplica fallback automático a spawn de ejecución única.
 */
export function invokeAI<T = any>(payload: AIActionPayload, timeoutMs: number = 40000): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      const worker = getOrCreateWorker();
      const id = `req_${Date.now()}_${++requestCounter}`;

      const timeoutId = setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Tiempo de espera agotado (${timeoutMs}ms) esperando respuesta de PyBot`));
        }
      }, timeoutMs);

      pendingRequests.set(id, { resolve, reject, timeoutId });

      const message = JSON.stringify({ id, ...payload }) + '\n';
      const success = worker.stdin?.write(message, 'utf-8');

      if (!success) {
        worker.stdin?.once('drain', () => {});
      }
    } catch (err: any) {
      // Fallback a ejecución aislada si el worker persistente falla
      console.warn('[AI Client] Fallback a ejecución aislada:', err.message);
      invokeAIOneShot<T>(payload).then(resolve).catch(reject);
    }
  });
}

/**
 * Ejecución aislada de proceso único (fallback de respaldo)
 */
export function invokeAIOneShot<T = any>(payload: AIActionPayload): Promise<T> {
  return new Promise((resolve, reject) => {
    const pythonCmd = getPythonCommand();
    const child = spawn(pythonCmd, [bridgeScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', err => {
      reject(new Error(`Error al iniciar Python para PyBot: ${err.message}`));
    });

    child.on('close', code => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`PyBot falló (código ${code}): ${stderr || 'Error desconocido'}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch (err: any) {
        reject(new Error(`Respuesta inválida de PyBot: ${stdout || stderr}`));
      }
    });

    child.stdin.write(JSON.stringify(payload), 'utf-8');
    child.stdin.end();
  });
}
