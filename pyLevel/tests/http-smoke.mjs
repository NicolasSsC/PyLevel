// Run only against the disposable local-db.mjs fixture, never a deployed service.
import assert from 'node:assert/strict';
const production = process.argv.includes('--production');
const base = production ? 'http://127.0.0.1:4340' : 'http://127.0.0.1:4335';
const call = (path, body, cookie, origin = base) => fetch(`${base}${path}`, {
  method: body ? 'POST' : 'GET', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
let response = await call('/api/auth/me');
assert.deepEqual(await response.json(), { user: null });
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal((await call('/api/exam/attempt')).status, 401);
assert.equal((await call('/examen/')).status, 302);
assert.equal((await call('/perfil')).status, 302);
assert.equal((await call('/api/auth/me', undefined, `pylevel_session=${encodeURIComponent(JSON.stringify({ id: 'forged' }))}`)).status, 200);
assert.equal((await call('/api/auth/login', { email: 'demo@pylevel.test', password: 'PruebaLocal2026!' }, undefined, 'https://foreign.example')).status, 403);
const identity = { email: `smoke-${Date.now()}@example.invalid`, password: 'LocalSmoke2026!' };
response = await call('/api/auth/register', { ...identity, displayName: 'Prueba HTTP' });
assert.equal(response.status, 201, await response.clone().text());
const setCookie = response.headers.get('set-cookie');
assert.match(setCookie, /HttpOnly/i);
assert.match(setCookie, /SameSite=Lax/i);
assert.match(setCookie, /Max-Age=604800/i);
if (production) assert.match(setCookie, /; Secure/i);
assert.doesNotMatch(setCookie, /displayName|email|%7B/i);
const cookie = setCookie.split(';')[0];
const user = (await (await call('/api/auth/me', undefined, cookie)).json()).user;
assert.equal(user.displayName, 'Prueba HTTP');
response = await call('/examen/', undefined, cookie);
assert.equal(response.status, 200);
assert.match(await response.text(), /Comenzar examen/);
response = await call('/api/exam/attempt', { action: 'start' }, cookie);
assert.equal(response.status, 200, await response.clone().text());
const attempt = (await response.json()).attempt;
assert.equal(attempt.status, 'in_progress');
response = await call('/api/exam/attempt', { action: 'sync', attemptId: attempt.id, revision: 0, answers: { acceso: 'def answer(): return True' }, events: [] }, cookie);
assert.equal(response.status, 200);
const saved = (await response.json()).attempt;
assert.equal(saved.revision, 1);
assert.equal(saved.answers.acceso, 'def answer(): return True');
response = await call('/api/exam/attempt', { action: 'sync', attemptId: attempt.id, revision: 0, answers: {} }, cookie);
assert.equal(response.status, 409);
assert.equal((await call('/api/exam/attempt', { action: 'sync', attemptId: attempt.id, answers: { acceso: 42 }, revision: 1 }, cookie)).status, 400);
response = await call('/api/exam/attempt', { action: 'submit', attemptId: attempt.id, answers: saved.answers, revision: 1 }, cookie);
assert.equal((await response.json()).attempt.status, 'submitted');
response = await call('/api/auth/login', identity, cookie);
assert.equal(response.status, 200);
const rotatedCookie = response.headers.get('set-cookie').split(';')[0];
assert.notEqual(rotatedCookie, cookie);
assert.equal((await (await call('/api/auth/me', undefined, cookie)).json()).user, null);
assert.equal((await call('/api/exam/attempt', undefined, cookie)).status, 401);
assert.equal((await (await call('/api/exam/attempt', undefined, rotatedCookie)).json()).attempt.status, 'submitted');
assert.equal((await call('/api/auth/logout', {}, rotatedCookie)).status, 200);
assert.equal((await (await call('/api/auth/me', undefined, rotatedCookie)).json()).user, null);
console.log('HTTP OK: registro/login, cookies HttpOnly/Secure, CSRF, rutas protegidas, guardado, conflictos, entrega, rotación y revocación.');
