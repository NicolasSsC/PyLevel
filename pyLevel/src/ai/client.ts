import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

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

export function getGeminiApiKey(): string | null {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
    return process.env.GEMINI_API_KEY;
  }
  const candidatePaths = [
    join(process.cwd(), '.gemini_key'),
    join(process.cwd(), '.env'),
    join(__dirname, '.gemini_key'),
    join(__dirname, '.env'),
    join(__dirname, '..', '..', '.gemini_key'),
    join(__dirname, '..', '..', '.env'),
    join(__dirname, '..', '..', '..', '.gemini_key'),
    join(__dirname, '..', '..', '..', '.env'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('GEMINI_API_KEY=')) {
            const key = trimmed.split('=', 2)[1].replace(/["']/g, '').trim();
            if (key.length > 10) return key;
          } else if (p.endsWith('.gemini_key') && trimmed && !trimmed.startsWith('#') && trimmed.length > 10) {
            return trimmed;
          }
        }
      } catch {}
    }
  }
  return null;
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

/**
 * Transmisión en tiempo real de chat token por token vía Server-Sent Events (SSE).
 * Se conecta a Gemini streamGenerateContent directamente cuando hay clave,
 * o simula streaming fluido sobre el motor pedagógico local en caso contrario.
 */
export async function streamChat(options: {
  mensaje: string;
  historial?: Array<{ rol: string; contenido: string }>;
  contexto?: { tema?: string; codigo_actual?: string };
}): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    let ctxTexto = '';
    if (options.contexto?.tema) {
      ctxTexto += `Tema actual de trabajo: ${options.contexto.tema}.\n`;
    }
    if (options.contexto?.codigo_actual) {
      ctxTexto += `Código que el estudiante tiene en pantalla:\n\`\`\`python\n${options.contexto.codigo_actual.slice(0, 600)}\n\`\`\`\n`;
    }

    let historialTexto = '';
    if (options.historial) {
      for (const h of options.historial.slice(-4)) {
        const rol = h.rol === 'user' ? 'Estudiante' : 'PyBot';
        historialTexto += `${rol}: ${h.contenido}\n`;
      }
    }

    const prompt = `${ctxTexto}${historialTexto}Estudiante pregunta: "${options.mensaje.trim()}"\n\nPor favor responde de forma concisa, cordial, pedagógica y con código Python formateado cuando sea relevante.`;

    const systemInstruction = 'Eres PyBot, el asistente inteligente y tutor amigable de Python en PyLevel. Explicas conceptos de programación de forma sencilla, usando analogías claras y snippets breves de código Python.';

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1200,
      },
    };

    const models = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
    ];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (resp.ok && resp.body) {
          return new ReadableStream({
            async start(controller) {
              const reader = resp.body!.getReader();
              const decoder = new TextDecoder();
              let sseBuffer = '';

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  sseBuffer += decoder.decode(value, { stream: true });
                  const lines = sseBuffer.split('\n');
                  sseBuffer = lines.pop() ?? '';

                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const jsonStr = trimmed.slice(5).trim();
                    if (!jsonStr) continue;

                    try {
                      const data = JSON.parse(jsonStr);
                      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                      if (text) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`));
                      }
                    } catch {}
                  }
                }

                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              } catch (err: any) {
                controller.error(err);
              }
            },
          });
        }
      } catch {
        continue;
      }
    }
  }

  // Fallback garantizado: Motor pedagógico local
  const localRes = await invokeAI({
    action: 'chat',
    data: {
      mensaje: options.mensaje,
      historial: options.historial,
      contexto: options.contexto,
    },
  });

  const textoFinal = localRes.respuesta || 'Hola, estoy analizando tu consulta de Python.';
  return new ReadableStream({
    async start(controller) {
      const palabras = textoFinal.split(/(\s+)/);
      for (const p of palabras) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: p })}\n\n`));
        await new Promise(r => setTimeout(r, 12));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}
