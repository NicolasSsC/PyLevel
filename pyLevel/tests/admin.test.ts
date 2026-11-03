import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { exerciseStore } from '../src/admin/exercise-store.ts';
import { seedCatalog } from '../src/admin/catalog-seed.ts';
import { accessStore } from '../src/admin/access-store.ts';
import { loadAdminAnalytics } from '../src/admin/analytics-store.ts';
import type { AdminDatabase } from '../src/admin/database.ts';

const pg=new PGlite();
const query=async(sql: string,values?:any[])=>{const r=await pg.query(sql,values);return {rows:r.rows as any[],rowCount:r.affectedRows};};
const db:AdminDatabase={query,async connect(){return {query,release(){}};}};
const store=exerciseStore(db),access=accessStore(db);
const admin=randomUUID(),student=randomUUID(),learner=randomUUID();
const project={id:'admin_project',mode:'contextual',title:'Proyecto de prueba',description:'Descripción',statement:'Implementa el proyecto',difficulty:'Fácil',topics:['Python'],files:{'main.py':'from model import value\nprint(value)','model.py':'value = 42','tests/test_publico.py':'import unittest\nclass Test(unittest.TestCase):\n    def test_value(self): self.assertTrue(True)'},briefing:{situacion:'Situación',pregunta:'Pregunta',queSeTiene:[{path:'model.py',role:'Modelo'}],queSeEspera:['Resultado'],salidaResumen:'42'}};
before(async()=>{
  await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY,email text UNIQUE,password_hash text,is_active boolean DEFAULT true,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());CREATE TABLE profiles(user_id uuid PRIMARY KEY,display_name text);`);
  for(const name of ['002_profile_progress.sql','004_admin.sql'])await pg.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  for(const [id,email,role] of [[admin,'admin@example.test','admin'],[student,'student@example.test','user'],[learner,'learner@example.test','user']])await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[id,email,'unchanged-hash',role]);
  await seedCatalog(db);
});
after(()=>pg.close());

test('seeding is explicit, idempotent and does not overwrite edited content',async()=>{
  const original=await store.list();assert.equal(original.length,20);
  const first=original[0];await store.update(first.id,{version:first.version,title:'Título conservado'});
  assert.equal(await seedCatalog(db),0);assert.equal((await store.find(first.id))!.title,'Título conservado');
});
test('versioned updates preserve project modules and reject stale writes',async()=>{
  const created=await store.create(project);
  const updated=await store.update(created.id,{version:created.version,title:'Nuevo título',files:{'main.py':'print(42)'}});
  assert.equal(updated.files['model.py'],'value = 42');assert.equal(updated.briefing!.pregunta,'Pregunta');assert.equal(updated.version,2);
  await assert.rejects(store.update(created.id,{version:1,title:'Obsoleto'}),{status:409});
  const history=await db.query('SELECT v.config FROM exercise_versions v JOIN exercises e ON e.id=v.exercise_id WHERE e.slug=$1 ORDER BY v.version',[created.id]);
  assert.equal(history.rows.length,2);assert.equal(history.rows[0].config.title,project.title);
  await assert.rejects(store.create(project),{status:409});
});
test('inactive and archived exercises cannot be read publicly or resurrected by seed',async()=>{
  const all=await store.list();const item=all[0];
  await store.update(item.id,{version:item.version,is_active:false});assert.equal(await store.find(item.id,item.mode,true),null);
  assert.equal(await store.find(project.id,'classic',true),null);
  await store.archive(item.id);await seedCatalog(db);assert.equal(await store.find(item.id),null);
  assert.ok((await store.list({includeArchived:true})).some(e=>e.id===item.id&&e.archivedAt));
  await db.query('UPDATE exercises SET is_active=false');assert.deepEqual(await store.list({publicOnly:true}),[]);
  await db.query('UPDATE exercises SET is_active=true WHERE archived_at IS NULL');
});
test('validation rejects unsafe paths, malformed content and oversized code',async()=>{
  await assert.rejects(store.create({...project,id:'../escape'}),{status:400});
  await assert.rejects(store.create({...project,id:'bad_path',files:{...project.files,'../escape.py':'pass'}}),{status:400});
  await assert.rejects(store.create({...project,id:'bad_topics',topics:[{}]}),{status:400});
  await assert.rejects(store.create({...project,id:'big',files:{...project.files,'main.py':'x'.repeat(100001)}}),{status:400});
});
test('granting uses existing active accounts without changing passwords; revoked actors lose authority',async()=>{
  await assert.rejects(access.change(admin,'unknown@example.test',true),{status:404});
  await access.change(admin,'student@example.test',true);assert.equal((await access.list()).length,2);
  assert.equal((await db.query('SELECT password_hash FROM users WHERE id=$1',[student])).rows[0].password_hash,'unchanged-hash');
  await assert.rejects(access.change(admin,admin,false),{status:409});
  await access.change(admin,student,false);await assert.rejects(access.change(student,'learner@example.test',true),{status:403});
});
test('real activity aggregation excludes admins, hints, zero-test successes and technical errors from pass rate',async()=>{
  const entries=[['test','passed',2,learner],['test','failed',0,learner],['test','technical_error',0,learner],['test','passed',0,learner],['run','passed',0,learner],['hint',null,0,learner],['test','passed',2,admin]];
  for(const [kind,result,tests,user] of entries)await db.query('INSERT INTO practice_activity(id,user_id,exercise_id,mode,kind,result,tests_run) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),user,project.id,'contextual',kind,result,tests]);
  const summary=await loadAdminAnalytics(db,await store.list({includeArchived:true}));
  assert.equal(summary.totalStudents,2);assert.equal(summary.totalAttempts,5);assert.equal(summary.totalTests,4);assert.equal(summary.globalPassRate,50);
  assert.equal(summary.exercises.find(e=>e.id===project.id)!.passRate,50);assert.equal(summary.recentActivity.length,5);
  assert.equal(summary.days.at(-1)!.attempts,5);
});
