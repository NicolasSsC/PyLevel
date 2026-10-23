import bcrypt from 'bcryptjs';
import type { Database } from '../lib/session-store.ts';

export class ProfileError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const todayInBogota = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export function validateProfile(body: any, today = todayInBogota()) {
  if (!body || typeof body.displayName !== 'string' || !body.displayName.trim() || body.displayName.trim().length > 100) throw new ProfileError('Escribe un nombre de hasta 100 caracteres.');
  if (typeof body.email !== 'string' || body.email.length > 254 || !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(body.email.trim())) throw new ProfileError('Escribe un correo válido.');
  if (typeof body.occupation !== 'string' || body.occupation.trim().length > 100) throw new ProfileError('La ocupación admite hasta 100 caracteres.');
  if (typeof body.birthday !== 'string') throw new ProfileError('La fecha de cumpleaños no es válida.');
  if (body.birthday) {
    const date = new Date(`${body.birthday}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birthday) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.birthday || body.birthday < '1900-01-01' || body.birthday > today) throw new ProfileError('El cumpleaños debe ser una fecha válida entre 1900 y hoy.');
  }
  if (body.currentPassword !== undefined && (typeof body.currentPassword !== 'string' || body.currentPassword.length > 200)) throw new ProfileError('Contraseña inválida.');
  return { displayName: body.displayName.trim(), email: body.email.trim().toLowerCase(), occupation: body.occupation.trim() || null, birthday: body.birthday || null, currentPassword: body.currentPassword ?? '' };
}

// Run inside a transaction; lock the user to serialize profile changes.
export async function updateProfile(db: Database, userId: string, input: ReturnType<typeof validateProfile>, keepSessionHash: string) {
  const result = await db.query('SELECT id, email, password_hash FROM users WHERE id::text = $1 AND is_active = true FOR UPDATE', [userId]);
  const user = result.rows[0];
  if (!user) throw new ProfileError('La cuenta ya no está disponible.', 401);
  const emailChanged = input.email !== user.email.toLowerCase();
  if (emailChanged) {
    if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, user.password_hash))) throw new ProfileError('Confirma tu contraseña actual para cambiar el correo.', 403);
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = $1 AND id::text <> $2', [input.email, userId]);
    if (existing.rows.length) throw new ProfileError('Este correo ya está registrado.', 409);
    await db.query('UPDATE users SET email = $2, updated_at = now() WHERE id::text = $1', [userId, input.email]);
    await db.query('DELETE FROM auth_sessions WHERE user_id = $1 AND token_hash <> $2', [userId, keepSessionHash]);
  }
  const profile = await db.query(`UPDATE profiles SET display_name = $2, occupation = $3, birthday = $4::date, updated_at = now()
    WHERE user_id::text = $1 RETURNING user_id`, [userId, input.displayName, input.occupation, input.birthday]);
  if (!profile.rows.length) {
    await db.query(`INSERT INTO profiles (user_id, display_name, occupation, birthday, updated_at)
      SELECT id, $2, $3, $4::date, now() FROM users WHERE id::text = $1`, [userId, input.displayName, input.occupation, input.birthday]);
  }
}
