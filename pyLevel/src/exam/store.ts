import { randomUUID } from 'node:crypto';
import type { Database } from '../lib/session-store.ts';
import { exam, type Answers, type Attempt, type ExamEvent, type Monitoring } from './definition.ts';

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
    const events = await db.query('SELECT kind, source, occurred_at, duration_ms FROM exam_events WHERE attempt_id = $1 ORDER BY occurred_at DESC, id DESC LIMIT 100', [row.id]);
    const count = await db.query(`SELECT count(*) FILTER (WHERE kind = 'away')::integer AS total,
      count(*) FILTER (WHERE kind IN ('camera_missing', 'camera_multiple', 'camera_interrupted', 'camera_unavailable'))::integer AS camera
      FROM exam_events WHERE attempt_id = $1`, [row.id]);
    return {
      id: row.id, status: row.status, answers: row.answers, revision: row.revision,
      startedAt: new Date(row.started_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      lastSeenAt: new Date(row.last_seen_at).toISOString(), incidents: count.rows[0].total,
      cameraIncidents: count.rows[0].camera, cameraMode: row.camera_mode,
      cameraConsentAt: row.camera_consent_at ? new Date(row.camera_consent_at).toISOString() : null,
      cameraUnavailableReason: row.camera_unavailable_reason,
      events: events.rows.map(e => ({ kind: e.kind, source: e.source, occurredAt: new Date(e.occurred_at).toISOString(), ...(e.duration_ms === null ? {} : { durationMs: e.duration_ms }) })),
    };
  }

  return {
    read,
    async start(userId: string, monitoring?: Monitoring) {
      await db.query(`INSERT INTO exam_attempts (id, user_id, exam_id, expires_at, camera_mode, camera_consent_at, camera_unavailable_reason)
        VALUES ($1, $2, $3, now() + ($4 * interval '1 minute'), $5, CASE WHEN $5 = 'legacy' THEN NULL ELSE clock_timestamp() END, $6)
        ON CONFLICT (user_id, exam_id) DO NOTHING`, [randomUUID(), userId, exam.id, exam.durationMinutes, monitoring?.mode ?? 'legacy', monitoring?.reason ?? null]);
      return read(userId);
    },
    async sync(userId: string, input: {
      attemptId: string; submit: boolean; answers?: Answers; revision?: number; events: ExamEvent[]; monitoring?: Monitoring;
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
      if (input.monitoring) {
        await db.query(`UPDATE exam_attempts SET camera_mode = $2, camera_consent_at = COALESCE(camera_consent_at, clock_timestamp()),
          camera_unavailable_reason = $3 WHERE id = $1`, [row.id, input.monitoring.mode, input.monitoring.reason ?? null]);
      }
      for (const event of input.events) {
        if (event.source === 'camera' && !row.camera_consent_at && !input.monitoring) throw new ExamError('Acepta las condiciones de cámara antes de enviar eventos.', 400);
        await db.query(`INSERT INTO exam_events (id, attempt_id, kind, source, duration_ms) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET duration_ms = GREATEST(exam_events.duration_ms, EXCLUDED.duration_ms)
          WHERE exam_events.attempt_id = EXCLUDED.attempt_id AND exam_events.kind = EXCLUDED.kind AND exam_events.source = 'camera'`,
          [event.id, row.id, event.kind, event.source, event.durationMs ?? null]);
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
