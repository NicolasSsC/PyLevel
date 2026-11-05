import { exam, uuidPattern } from './definition.ts';
import { ExamError } from './store.ts';
import type { Database } from '../lib/session-store.ts';

const examples: Record<string, { function: string; cases: [string, string][] }> = {
  acceso: { function: 'puede_acceder', cases: [['True, False, False', 'True'], ['False, True, True', 'False']] },
  pares: { function: 'sumar_pares', cases: [['[1, 2, 3, 4, 6]', '12'], ['[-4, -1, 2]', '-2'], ['[]', '0']] },
  clasificar: { function: 'clasificar_numero', cases: [['8', '"positivo"'], ['-3', '"negativo"'], ['0', '"cero"']] },
};
export type ExamCodeInput = { attemptId: string; questionId: string; code: string };

export async function examCodeInput(request: Request): Promise<ExamCodeInput> {
  const maximum = 48000;
  if (Number(request.headers.get('content-length')) > maximum) throw new ExamError('El código es demasiado grande.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ExamError('Solicitud inválida.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new ExamError('El código es demasiado grande.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ExamError('Solicitud inválida.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !uuidPattern.test(body.attemptId)
    || typeof body.questionId !== 'string' || !exam.questions.some(question => question.id === body.questionId)
    || typeof body.code !== 'string' || !body.code.trim() || body.code.length > 12000) {
    throw new ExamError('Revisa la pregunta y el código (máximo 12.000 caracteres).', 400);
  }
  return { attemptId: body.attemptId, questionId: body.questionId, code: body.code };
}

export function examPublicFiles(questionId: string, code: string) {
  const example = Object.hasOwn(examples, questionId) ? examples[questionId] : undefined;
  if (!example) throw new ExamError('Pregunta inválida.', 400);
  const tests = example.cases.map(([args, expected], index) => `    def test_ejemplo_${index + 1}(self):\n        self.assertEqual(${example.function}(${args}), ${expected})\n`).join('\n');
  return { 'main.py': code, 'tests/test_publico.py': `import unittest\nfrom main import ${example.function}\n\nclass TestEjemplos(unittest.TestCase):\n${tests}` };
}

export async function examExecutionAccess(db: Database, userId: string, attemptId: string) {
  const result = await db.query(`SELECT status, expires_at, camera_consent_at, clock_timestamp() AS server_now
    FROM exam_attempts WHERE id=$1 AND user_id=$2 AND exam_id=$3`, [attemptId, userId, exam.id]);
  const attempt = result.rows[0];
  if (!attempt) throw new ExamError('No se encontró el intento.', 404);
  const remainingMs = new Date(attempt.expires_at).getTime() - new Date(attempt.server_now).getTime();
  if (attempt.status !== 'in_progress' || remainingMs <= 0) throw new ExamError('El intento ha finalizado. Ya no puedes probar código.', 409);
  if (!attempt.camera_consent_at) throw new ExamError('Acepta las condiciones de cámara para probar el código.', 409);
  return remainingMs;
}
