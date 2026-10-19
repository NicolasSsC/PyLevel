// The server must use local-db.mjs and local-runner.mjs; no real user data is modified.
import assert from 'node:assert/strict';
const base = process.argv.includes('--production') ? 'http://127.0.0.1:4340' : 'http://127.0.0.1:4335';
const call = (path, body, cookie, origin = base) => fetch(`${base}${path}`, {
  method: body ? 'POST' : 'GET', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
assert.equal((await call('/progreso/')).status, 302);
assert.equal((await call('/api/account/profile', {})).status, 401);
const identity = { email: `profile-${Date.now()}@example.invalid`, password: 'LocalAccount2026!' };
let response = await call('/api/auth/register', { ...identity, displayName: 'Cuenta aislada' });
assert.equal(response.status, 201, await response.clone().text());
const cookie = response.headers.get('set-cookie').split(';')[0];
const input = { displayName: 'Ana Martínez', email: identity.email, occupation: 'Desarrolladora', birthday: '2000-05-21' };
assert.equal((await call('/api/account/profile', input, cookie, 'https://foreign.example')).status, 403);
assert.equal((await call('/api/account/profile', { ...input, birthday: '2025-02-29' }, cookie)).status, 400);
response = await call('/api/account/profile', { ...input, userId: 'ignored-foreign-account' }, cookie);
assert.equal(response.status, 200, await response.clone().text());
assert.equal((await response.json()).user.occupation, 'Desarrolladora');
const me = (await (await call('/api/auth/me', undefined, cookie)).json()).user;
assert.equal(me.displayName, input.displayName);
assert.equal(me.birthday, input.birthday);
response = await call('/perfil', undefined, cookie);
assert.equal(response.status, 200);
const profileHtml = await response.text();
assert.match(profileHtml, /Ana Martínez/);
assert.match(profileHtml, /Mis exámenes/);
assert.doesNotMatch(profileHtml, /Simulación de perfil|3 resueltos/);
const context = { mode: 'classic', exerciseId: 'clasico_operadores_logicos', files: { 'main.py': 'pass', 'tests/test_publico.py': 'tampered' } };
assert.equal((await call('/api/practice/activity', { ...context, id: crypto.randomUUID(), kind: 'completed' }, cookie)).status, 400);
assert.equal((await call('/api/practice/activity', { ...context, id: crypto.randomUUID(), kind: 'hint' }, cookie)).status, 200);
response = await call('/api/practice/execute', { ...context, action: 'run' }, cookie);
assert.equal(response.status, 200);
assert.equal((await response.json()).tracking, 'saved');
response = await call('/api/practice/execute', { ...context, action: 'test' }, cookie);
assert.equal(response.status, 200, await response.clone().text());
assert.equal((await response.json()).practiceResult, 'passed'); // Original tests replaced the tampered file.
const second = { ...context, exerciseId: 'clasico_sumar_pares', files: { 'main.py': 'FAIL_FIXTURE', 'tests/test_publico.py': 'tampered' } };
response = await call('/api/practice/execute', { ...second, action: 'test' }, cookie);
assert.equal((await response.json()).practiceResult, 'failed');
response = await call('/api/practice/execute', { ...second, action: 'test', files: { ...second.files, 'main.py': 'TECHNICAL_FIXTURE' } }, cookie);
assert.equal(response.status, 503);
response = await call('/progreso/', undefined, cookie);
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /Un reto para seguir mejorando/);
assert.match(html, /Hay incidencias del ejecutor/);
assert.match(html, /data-progress-state="completed"/);
assert.match(html, /data-progress-state="in_progress"/);
assert.match(html, /Ejercicios superados/);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal((await call('/api/account/profile', { ...input, email: `changed-${identity.email}` }, cookie)).status, 403);
response = await call('/api/account/profile', { ...input, email: `changed-${identity.email}`, currentPassword: identity.password }, cookie);
assert.equal(response.status, 200);
assert.equal((await response.json()).user.email, `changed-${identity.email}`);
response = await call('/api/exam/attempt', { action: 'start' }, cookie);
const examAttempt = (await response.json()).attempt;
response = await call('/api/exam/attempt', { action: 'submit', attemptId: examAttempt.id, answers: {}, revision: 0, events: [] }, cookie);
assert.equal((await response.json()).attempt.status, 'submitted');
response = await call('/perfil', undefined, cookie);
const historyHtml = await response.text();
assert.match(historyHtml, /1 finalizados/);
assert.match(historyHtml, /Fundamentos de Python/);
assert.match(historyHtml, /Pendiente de revisión/);
assert.equal((await call('/api/auth/logout', {}, cookie)).status, 200);
assert.equal((await call('/perfil', undefined, cookie)).status, 302);
console.log('Perfil/progreso HTTP OK: datos persistidos, correo protegido, actividad desde ejecutor, pruebas originales, feedback, páginas privadas y logout.');
