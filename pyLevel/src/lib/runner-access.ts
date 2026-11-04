import type { Database } from './session-store.ts';

export async function consumeRunnerAllowance(db: Database, userId: string,
  env: Record<string, string | undefined> = process.env) {
  const minute = Number(env.RUNNER_REQUESTS_PER_MINUTE || 20);
  const day = Number(env.RUNNER_REQUESTS_PER_DAY || 200);
  if (![minute, day].every(value => Number.isSafeInteger(value) && value > 0 && value <= 1_000_000)) throw new Error('Límites del ejecutor inválidos.');
  const result = await db.query(`WITH cleanup AS (
    DELETE FROM runner_request_usage WHERE window_start < now() - interval '7 days'
  ), per_minute AS (
    INSERT INTO runner_request_usage(user_id,period,window_start,requests)
    VALUES ($1,'minute',date_trunc('minute',now()),1)
    ON CONFLICT (user_id,period,window_start) DO UPDATE SET requests=runner_request_usage.requests+1
    WHERE runner_request_usage.requests < $2 RETURNING requests
  ), per_day AS (
    INSERT INTO runner_request_usage(user_id,period,window_start,requests)
    SELECT $1,'day',date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1
    WHERE EXISTS(SELECT 1 FROM per_minute)
    ON CONFLICT (user_id,period,window_start) DO UPDATE SET requests=runner_request_usage.requests+1
    WHERE runner_request_usage.requests < $3 RETURNING requests
  ) SELECT EXISTS(SELECT 1 FROM per_day) AS allowed`, [userId, minute, day]);
  return result.rows[0]?.allowed === true;
}
