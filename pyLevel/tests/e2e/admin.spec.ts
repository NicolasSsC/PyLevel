import { test,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const origin='http://127.0.0.1:4341';
const headers={Origin:origin};
const project=(id:string)=>({id,mode:'contextual',title:'Proyecto administrativo E2E',description:'Proyecto de prueba',statement:'Resuelve el proyecto.',difficulty:'Fácil',topics:['Python'],files:{'main.py':'from model import value\nprint(value)','model.py':'value = 42','tests/test_publico.py':'import unittest\nclass Test(unittest.TestCase):\n    def test_value(self): self.assertTrue(True)'},briefing:{situacion:'Prueba',pregunta:'¿Cómo resolverlo?',queSeTiene:[{path:'model.py',role:'Modelo'}],queSeEspera:['42'],salidaResumen:'42'}});

test('admin pages and APIs reject guests, students and cross-origin writes',async({page})=>{
  for(const path of ['/admin/','/admin/metricas/','/admin/accesos/','/admin/manual/']){
    const response=await page.request.get(path,{maxRedirects:0});expect(response.status()).toBe(302);
  }
  expect((await page.request.get('/api/admin/exercises')).status()).toBe(401);
  expect((await page.request.post('/api/admin/admins',{headers:{Origin:'https://other.invalid'},data:{email:'x@example.test'}})).status()).toBe(403);
  const registration=await page.request.post('/api/auth/register',{headers,data:{email:`student-${randomUUID()}@example.test`,password:'PruebaLocal2026!',displayName:'Estudiante admin e2e',role:'admin'}});
  expect(registration.status()).toBe(201);expect((await registration.json()).user.role).toBe('user');
  expect((await page.request.get('/admin/metricas/')).status()).toBe(403);
  expect((await page.request.get('/api/admin/admins')).status()).toBe(403);
});

test('real catalog writes survive reload and control public access; administrators can be granted and revoked',async({page,browser})=>{
  const login=await page.request.post('/api/auth/login',{headers,data:{email:'admin@pylevel.test',password:'AdminLocal2026!'}});expect(login.status()).toBe(200);
  await page.goto('/admin/');await expect(page.locator('.admin-nav a')).toHaveCount(4);
  const id=`admin_e2e_${randomUUID().replaceAll('-','')}`;
  const created=await page.request.post('/api/admin/exercises',{headers,data:project(id)});expect(created.status()).toBe(201);
  let exercise=(await created.json()).exercise;
  const edited=await page.request.put(`/api/admin/exercises/${id}`,{headers,data:{version:exercise.version,title:'Título guardado',files:{'main.py':'print(42)'}}});expect(edited.status()).toBe(200);exercise=(await edited.json()).exercise;
  expect(exercise.files['model.py']).toBe('value = 42');
  expect((await page.request.put(`/api/admin/exercises/${id}`,{headers,data:{version:1,title:'Obsoleto'}})).status()).toBe(409);
  await page.goto(`/admin/?exercise=${id}`);await expect(page.locator('.exercise-row:visible .ex-title-text')).toHaveText('Título guardado');
  await page.locator('.exercise-row:visible .btn-edit').click();await page.locator('#form-title').fill('Editado con formulario');await page.locator('#modal-save-btn').click();await expect(page.locator('#exercise-modal')).not.toBeVisible();
  await page.reload();await expect(page.locator('.exercise-row:visible .ex-title-text')).toHaveText('Editado con formulario');
  await page.locator('.exercise-row:visible .btn-toggle-status').click();await expect(page.locator('.exercise-row:visible .status-text')).toHaveText('Desactivado');
  expect((await page.request.get(`/ejercicios/contextualizados/${id}/`)).status()).toBe(404);
  expect((await page.request.post('/api/practice/execute',{headers,data:{exerciseId:id,mode:'contextual',action:'run',files:project(id).files}})).status()).toBe(404);
  await page.locator('.exercise-row:visible .btn-toggle-status').click();await expect(page.locator('.exercise-row:visible .status-text')).toHaveText('Activo');
  const opened=await page.request.get(`/ejercicios/contextualizados/${id}/`);expect(opened.status()).toBe(200);expect(await opened.text()).toContain('Editado con formulario');
  await page.goto('/admin/metricas/');await expect(page.getByRole('heading',{name:'Rendimiento por Ejercicio'})).toBeVisible();await expect(page.locator('body')).not.toContainText('Métricas de demostración');
  const learnerContext=await browser.newContext({baseURL:origin});const learner=await learnerContext.newPage();
  const email=`promoted-${randomUUID()}@example.test`;
  const registration=await learner.request.post('/api/auth/register',{headers,data:{email,password:'AlumnoLocal2026!',displayName:'Alumno a promover'}});expect(registration.status()).toBe(201);const user=(await registration.json()).user;
  expect((await page.request.post('/api/admin/admins',{headers,data:{email:'missing@example.test'}})).status()).toBe(404);
  await page.goto('/admin/accesos/');await page.locator('#admin-email').fill(email);await page.locator('#btn-submit-admin').click();await expect(page.locator('#admins-table-rows')).toContainText(email);
  expect((await learner.request.get('/api/admin/exercises')).status()).toBe(200);
  await page.request.delete(`/api/admin/admins/${user.id}`,{headers});expect((await learner.request.get('/api/admin/exercises')).status()).toBe(403);
  const me=(await (await page.request.get('/api/auth/me')).json()).user;
  expect((await page.request.delete(`/api/admin/admins/${me.id}`,{headers})).status()).toBe(409);
  await learnerContext.close();
  await page.request.delete(`/api/admin/exercises/${id}`,{headers});expect((await page.request.get(`/ejercicios/contextualizados/${id}/`)).status()).toBe(404);
  const privatePage=await page.request.get('/admin/');expect(privatePage.headers()['cache-control']).toContain('no-store');
});
