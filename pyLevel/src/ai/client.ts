import { spawn } from 'node:child_process';
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
    | 'solve_project';
  data?: Record<string, any>;
}

export function invokeAI<T = any>(payload: AIActionPayload): Promise<T> {
  return new Promise((resolve, reject) => {
    // Attempt python or python3
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
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
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
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

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
