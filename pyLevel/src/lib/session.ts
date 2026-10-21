import type { AstroCookies } from 'astro';
import { getDbPool, getUserById } from './db';
import { SESSION_COOKIE, SESSION_SECONDS, sessionStore } from './session-store';

export async function currentUser(cookies: AstroCookies) {
  const id = await sessionStore(getDbPool()).find(cookies.get(SESSION_COOKIE)?.value);
  if (!id) {
    if (cookies.has(SESSION_COOKIE)) cookies.delete(SESSION_COOKIE, { path: '/' });
    return null;
  }
  const user = await getUserById(id);
  return user?.isActive ? user : null;
}

export async function startSession(cookies: AstroCookies, request: Request, userId: string) {
  const store = sessionStore(getDbPool());
  const token = await store.create(userId);
  await store.revoke(cookies.get(SESSION_COOKIE)?.value);
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD || new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession(cookies: AstroCookies) {
  await sessionStore(getDbPool()).revoke(cookies.get(SESSION_COOKIE)?.value);
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
