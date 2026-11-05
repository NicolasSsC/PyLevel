export const prerender = false;
import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { getDbPool } from '../../../lib/db';
import { json } from '../../../lib/http';
import { consumeRunnerAllowance } from '../../../lib/runner-access';
import { runnerFetch } from '../../../lib/runner';
import { ExamError } from '../../../exam/store';
import { examCodeInput, examExecutionAccess, examPublicFiles } from '../../../exam/execution';
import { classifyResult } from '../../../account/activity';

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const user = await currentUser(cookies);
    if (!user) return json({ error: 'Inicia sesión para probar el código del examen.' }, 401);
    const input = await examCodeInput(request);
    const remainingMs = await examExecutionAccess(getDbPool(), user.id, input.attemptId);
    if (!await consumeRunnerAllowance(getDbPool(), user.id)) {
      const response = json({ error: 'Alcanzaste el límite de ejecuciones. Intenta más tarde.' }, 429);
      response.headers.set('Retry-After', '60');
      return response;
    }
    const response = await runnerFetch('/api/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', files: examPublicFiles(input.questionId, input.code) }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(Math.max(1, Math.min(45000, remainingMs)))]),
    }, user.id);
    if (response.status === 429) {
      const limited = json({ error: 'Hay una ejecución en curso. Intenta nuevamente en unos segundos.' }, 429);
      limited.headers.set('Retry-After', '3'); return limited;
    }
    if (!response.ok) throw new Error('runner_unavailable');
    const result = await response.json();
    if (typeof result.status !== 'string' || typeof result.output !== 'string' || !Number.isInteger(result.exit_code)) throw new Error('invalid_runner_response');
    const evaluation = classifyResult('test', result);
    return json({ status: result.status, exit_code: result.exit_code, output: result.output, testsRun: evaluation.testsRun, passed: evaluation.result === 'passed' });
  } catch (error) {
    return json({ error: error instanceof ExamError ? error.message : 'No se pudo probar el código. Intenta nuevamente.' }, error instanceof ExamError ? error.status : 503);
  }
};
