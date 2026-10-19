import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'pylevel_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const validToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

// Small interface also allows exercising the real SQL against an isolated test database.
export interface Database {
  query(sql: string, values?: any[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export function sessionStore(db: Database) {
  return {
    async create(userId: string) {
      const token = randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
        [hashToken(token), userId, SESSION_SECONDS],
      );
      return token;
    },
    async find(token: unknown): Promise<string | null> {
      // In particular, reject the old JSON cookie rather than trusting its user ID.
      if (!validToken(token)) return null;
      const result = await db.query(
        `SELECT s.user_id FROM auth_sessions s JOIN users u ON u.id::text = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true`,
        [hashToken(token)],
      );
      return result.rows[0]?.user_id ?? null;
    },
    async revoke(token: unknown) {
      if (validToken(token)) await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashToken(token)]);
    },
  };
}
