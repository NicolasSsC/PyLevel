import { randomUUID } from 'node:crypto';
import type { Database } from '../lib/session-store.ts';

export type Mode = 'classic' | 'contextual';
export type ActivityKind = 'opened' | 'hint' | 'solution' | 'run' | 'test';
export type PracticeResult = 'pending' | 'passed' | 'failed' | 'technical_error' | 'cancelled';
export type ExerciseActivity = {
  exerciseId: string; mode: Mode; attempts: number; tests: number; runs: number;
  passedTests: number; failedTests: number; technicalErrors: number; hints: number; solutions: number;
  completedAt: string | null; lastActivityAt: string;
};

export function classifyResult(action: 'run' | 'test', result: { status: string; exit_code: number; output: string }) {
  if (result.status === 'cancelled') return { result: 'cancelled' as PracticeResult, testsRun: 0 };
  if (result.status !== 'completed') return { result: 'technical_error' as PracticeResult, testsRun: 0 };
  // Public practice evidence only, not an official grade. Exit 0 without tests is insufficient.
  const match = [...result.output.matchAll(/^Ran (\d+) tests? in [^\r\n]+$/gm)].at(-1);
  const testsRun = match ? Number(match[1]) : 0;
  const passed = result.exit_code === 0 && (action === 'run' || (testsRun > 0 && /^OK\s*$/m.test(result.output)));
  return { result: (passed ? 'passed' : 'failed') as PracticeResult, testsRun };
}

export function activityStore(db: Database) {
  return {
    async record(userId: string, exerciseId: string, mode: Mode, kind: ActivityKind, id = randomUUID(), result: PracticeResult | null = null) {
      await db.query(`INSERT INTO practice_activity (id, user_id, exercise_id, mode, kind, result)
        VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`, [id, userId, exerciseId, mode, kind, result]);
      return id;
    },
    async finish(userId: string, id: string, result: PracticeResult, testsRun: number, durationMs: number) {
      await db.query(`UPDATE practice_activity SET result = $3, tests_run = $4, duration_ms = $5
        WHERE id = $1 AND user_id = $2 AND result = 'pending'`, [id, userId, result, testsRun, Math.max(0, Math.round(durationMs))]);
    },
    async read(userId: string) {
      const grouped = await db.query(`SELECT exercise_id, mode, max(created_at) AS last_activity_at,
        count(*) FILTER (WHERE kind IN ('run', 'test'))::integer AS attempts,
        count(*) FILTER (WHERE kind = 'run')::integer AS runs,
        count(*) FILTER (WHERE kind = 'test')::integer AS tests,
        count(*) FILTER (WHERE kind = 'test' AND result = 'passed' AND tests_run > 0)::integer AS passed_tests,
        count(*) FILTER (WHERE kind = 'test' AND result = 'failed')::integer AS failed_tests,
        count(*) FILTER (WHERE result = 'technical_error')::integer AS technical_errors,
        count(*) FILTER (WHERE kind = 'hint')::integer AS hints,
        count(*) FILTER (WHERE kind = 'solution')::integer AS solutions,
        min(created_at) FILTER (WHERE kind = 'test' AND result = 'passed' AND tests_run > 0) AS completed_at
        FROM practice_activity WHERE user_id = $1 GROUP BY exercise_id, mode ORDER BY last_activity_at DESC`, [userId]);
      const recent = await db.query(`SELECT exercise_id, mode, kind, result, tests_run, created_at
        FROM practice_activity WHERE user_id = $1 AND kind IN ('run', 'test') ORDER BY created_at DESC, id DESC LIMIT 20`, [userId]);
      const days = await db.query(`SELECT to_char(created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS day, count(*)::integer AS attempts
        FROM practice_activity WHERE user_id = $1 AND kind IN ('run', 'test') AND created_at >= now() - interval '8 days'
        GROUP BY day ORDER BY day`, [userId]);
      const exercises: ExerciseActivity[] = grouped.rows.map(row => ({
        exerciseId: row.exercise_id, mode: row.mode, attempts: row.attempts, runs: row.runs, tests: row.tests,
        passedTests: row.passed_tests, failedTests: row.failed_tests, technicalErrors: row.technical_errors,
        hints: row.hints, solutions: row.solutions, completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
        lastActivityAt: new Date(row.last_activity_at).toISOString(),
      }));
      return { exercises, recent: recent.rows.map(row => ({ exerciseId: row.exercise_id as string, mode: row.mode as Mode, kind: row.kind as ActivityKind, result: row.result as PracticeResult, testsRun: row.tests_run as number, createdAt: new Date(row.created_at).toISOString() })), days: days.rows as { day: string; attempts: number }[] };
    },
  };
}
export type ActivityData = Awaited<ReturnType<ReturnType<typeof activityStore>['read']>>;
