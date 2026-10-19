import { randomUUID } from 'node:crypto';
import type { Database } from '../lib/session-store.ts';
import { exam, type Answers, type Attempt, type ExamEvent } from './definition.ts';

export class ExamError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

// Caller runs mutations in a transaction, locking the attempt before checking time/revision.
export function examStore(db: Database) {
  async function read(userId: string): Promise<Attempt | null> {
    await db.query(`UPDATE exam_attempts SET status = 'expired', submitted_at = expires_at
      WHERE user_id = $1 AND exam_id = $2 AND status = 'in_progress' AND expires_at <= clock_timestamp()`, [userId, exam.id]);
    const result = await db.query('SELECT * FROM exam_attempts WHERE user_id = $1 AND exam_id = $2', [userId, exam.id]);
    const row = result.rows[0];
    if (!row) return null;
    const events = await db.query('SELECT kind, source, occurred_at FROM exam_events WHERE attempt_id = $1 ORDER BY occurred_at DESC LIMIT 100', [row.id]);
    const count = await db.query("SELECT count(*)::integer AS total FROM exam_events WHERE attempt_id = $1 AND kind = 'away'", [row.id]);
    return {
      id: row.id, status: row.status, answers: row.answers, revision: row.revision,
      startedAt: new Date(row.started_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      lastSeenAt: new Date(row.last_seen_at).toISOString(), incidents: count.rows[0].total,
      events: events.rows.map(e => ({ kind: e.kind, source: e.source, occurredAt: new Date(e.occurred_at).toISOString() })),
    };
  }

  return {
    read,
    async start(userId: string) {
      await db.query(`INSERT INTO exam_attempts (id, user_id, exam_id, expires_at)
        VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'))
        ON CONFLICT (user_id, exam_id) DO NOTHING`, [randomUUID(), userId, exam.id, exam.durationMinutes]);
      return read(userId);
    },
    async sync(userId: string, input: {
      attemptId: string; submit: boolean; answers?: Answers; revision?: number; events: ExamEvent[];
    }) {
      const result = await db.query(`SELECT * FROM exam_attempts
        WHERE id = $1 AND user_id = $2 AND exam_id = $3 FOR UPDATE`, [input.attemptId, userId, exam.id]);
      const row = result.rows[0];
      if (!row) throw new ExamError('No se encontró el intento.', 404);
      // Check the database clock after acquiring the lock; never trust the browser timer.
      const time = await db.query('SELECT clock_timestamp() AS time');
      if (row.status !== 'in_progress' || new Date(row.expires_at) <= new Date(time.rows[0].time)) return read(userId);
      if (input.answers !== undefined && input.revision !== row.revision) {
        throw new ExamError('El intento se actualizó desde otra pestaña. Elige qué versión conservar.', 409);
      }
      for (const event of input.events) {
        await db.query(`INSERT INTO exam_events (id, attempt_id, kind, source) VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING`, [event.id, row.id, event.kind, event.source]);
      }
      await db.query(`UPDATE exam_attempts SET last_seen_at = clock_timestamp(),
        answers = COALESCE($2::jsonb, answers), revision = revision + CASE WHEN $2::jsonb IS NULL THEN 0 ELSE 1 END,
        status = CASE WHEN $3 THEN 'submitted' ELSE status END,
        submitted_at = CASE WHEN $3 THEN clock_timestamp() ELSE submitted_at END
        WHERE id = $1`, [row.id, input.answers === undefined ? null : JSON.stringify(input.answers), input.submit]);
      return read(userId);
    },
  };
}
