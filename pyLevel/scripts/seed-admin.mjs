import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'password',
  database: 'pylevel_db',
});

const email = 'admin@pylevel.dev';
const passwordHash = await bcrypt.hash('admin123', 10);
const now = new Date();

const check = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
if (check.rows.length === 0) {
  const userId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, is_active, role, created_at, updated_at)
     VALUES ($1, $2, $3, true, 'admin', $4, $4)`,
    [userId, email, passwordHash, now]
  );
  await pool.query(
    `INSERT INTO profiles (user_id, display_name, bio, updated_at)
     VALUES ($1, 'Administrador PyLevel', 'Administrador del Sistema', $2)`,
    [userId, now]
  );
  console.log('Usuario admin@pylevel.dev creado exitosamente con contraseña admin123');
} else {
  await pool.query(
    `UPDATE users SET password_hash = $1, role = 'admin' WHERE LOWER(email) = $2`,
    [passwordHash, email]
  );
  console.log('Usuario admin@pylevel.dev actualizado con contraseña admin123');
}

// También podemos actualizar santiagopinilla112@gmail.com a admin123 si el usuario lo desea:
const santiagoCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', ['santiagopinilla112@gmail.com']);
if (santiagoCheck.rows.length > 0) {
  await pool.query(
    `UPDATE users SET password_hash = $1, role = 'admin' WHERE LOWER(email) = 'santiagopinilla112@gmail.com'`,
    [passwordHash]
  );
  console.log('Cuenta santiagopinilla112@gmail.com actualizada con contraseña admin123 y rol admin');
}

await pool.end();

