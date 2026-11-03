import { randomUUID } from 'node:crypto';
import type { Database } from '../lib/session-store.ts';
import { transaction, type AdminDatabase } from './database.ts';
import { AdminError, type AdminExercise } from './types.ts';

const selection = `SELECT e.*, v.config, v.version FROM exercises e
  JOIN LATERAL (SELECT config,version FROM exercise_versions WHERE exercise_id=e.id ORDER BY version DESC LIMIT 1) v ON true`;
function map(row: any): AdminExercise {
  return { ...row.config, id: row.slug, title: row.title, description: row.description,
    difficulty: row.difficulty, mode: row.exercise_type, is_active: row.is_active,
    hints: row.config?.hints ?? [], solution: row.config?.solution ?? '',
    version: row.version, archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null };
}
function required(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AdminError(`${label} no es válido.`);
  return value.trim();
}
export function validateExercise(body: any, current?: AdminExercise): AdminExercise {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminError('Ejercicio inválido.');
  const id = current?.id ?? required(body.id, 'El identificador', 120);
  if (!/^[a-z0-9_]+$/.test(id)) throw new AdminError('El ID solo admite letras minúsculas, números y guiones bajos.');
  const mode = body.mode ?? current?.mode;
  if (!['classic','contextual'].includes(mode) || (current && mode !== current.mode)) throw new AdminError('La modalidad no es válida o no se puede cambiar.');
  const difficulty = body.difficulty ?? current?.difficulty;
  if (!['Fácil','Medio','Difícil'].includes(difficulty)) throw new AdminError('Dificultad inválida.');
  const topics = body.topics ?? current?.topics ?? [];
  const hints = body.hints ?? current?.hints ?? [];
  if (!Array.isArray(topics) || topics.length > 20 || topics.some(t => typeof t !== 'string' || t.length > 100)
    || !Array.isArray(hints) || hints.length > 20 || hints.some(h => typeof h !== 'string' || h.length > 5000)) throw new AdminError('Temas o pistas inválidos.');
  if (body.files !== undefined && (!body.files || typeof body.files !== 'object' || Array.isArray(body.files))) throw new AdminError('Archivos inválidos.');
  // The form may edit only main and tests: keep every additional project module.
  const files = { ...current?.files, ...body.files };
  if (!files['main.py'] || !Object.keys(files).some(p => p.startsWith('tests/') && p.endsWith('.py'))) throw new AdminError('Incluye main.py y al menos un archivo de pruebas en tests/.');
  if (Object.keys(files).length > 64 || Object.entries(files).some(([name, code]) => !/^[a-zA-Z0-9_/-]+\.py$/.test(name) || name.startsWith('/') || name.split('/').includes('..') || name.includes('//') || typeof code !== 'string' || code.length > 100000)) throw new AdminError('El proyecto contiene archivos o tamaños no admitidos.');
  if (Buffer.byteLength(JSON.stringify(files)) > 240000) throw new AdminError('El proyecto es demasiado grande.');
  const optional = (key: string, max: number) => {
    const value = body[key] ?? (current as any)?.[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new AdminError(`El campo ${key} no es válido.`);
    return value;
  };
  if (body.is_active !== undefined && typeof body.is_active !== 'boolean') throw new AdminError('Estado inválido.');
  const briefing = body.briefing ?? current?.briefing;
  if (briefing && (typeof briefing.situacion !== 'string' || typeof briefing.pregunta !== 'string' || typeof briefing.salidaResumen !== 'string' || !Array.isArray(briefing.queSeTiene) || briefing.queSeTiene.some((f: any) => !f || typeof f.path !== 'string' || typeof f.role !== 'string') || !Array.isArray(briefing.queSeEspera) || briefing.queSeEspera.some((s: any) => typeof s !== 'string') || JSON.stringify(briefing).length > 20000)) throw new AdminError('Contexto del proyecto inválido.');
  return { ...current, id, mode, difficulty,
    title: required(body.title ?? current?.title, 'El título', 255),
    description: required(body.description ?? current?.description, 'La descripción', 3000),
    statement: required(body.statement ?? current?.statement, 'El enunciado', 30000),
    level: optional('level',100) || 'Inicial', expected: optional('expected',20000), solution: optional('solution',100000),
    topics, hints, files, ...(briefing ? {briefing} : {}), is_active: body.is_active ?? current?.is_active ?? true, version: (current?.version ?? 0) + 1 };
}
async function addVersion(db: Database, recordId: string, exercise: AdminExercise) {
  await db.query(`INSERT INTO exercise_versions(id,exercise_id,version,repository_path,manifest_path,config,published_at)
    VALUES($1,$2,$3,$4,$5,$6,now())`,[randomUUID(),recordId,exercise.version,'pylevel/catalog',exercise.id,JSON.stringify(exercise)]);
}
export function exerciseStore(db: AdminDatabase) {
  return {
    async list(options: { mode?: string; publicOnly?: boolean; includeArchived?: boolean } = {}) {
      const rows = await db.query(`${selection} WHERE ($1::text IS NULL OR e.exercise_type=$1)
        AND ($2::boolean=false OR (e.is_active=true AND e.archived_at IS NULL))
        AND ($3::boolean=true OR e.archived_at IS NULL) ORDER BY e.created_at,e.slug`,[options.mode ?? null,!!options.publicOnly,!!options.includeArchived]);
      return rows.rows.map(map);
    },
    async find(id: string, mode?: string, publicOnly = false): Promise<AdminExercise | null> {
      const result = await db.query(`${selection} WHERE e.slug=$1 AND ($2::text IS NULL OR e.exercise_type=$2)
        AND e.archived_at IS NULL AND ($3::boolean=false OR e.is_active=true)`,[id,mode ?? null,publicOnly]);
      return result.rows[0] ? map(result.rows[0]) : null;
    },
    async create(body: unknown) {
      const exercise = validateExercise(body);
      return transaction(db,async client => {
        const recordId = randomUUID();
        const inserted = await client.query(`INSERT INTO exercises(id,slug,title,description,difficulty,exercise_type,is_active)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(slug) DO NOTHING RETURNING id`,[recordId,exercise.id,exercise.title,exercise.description,exercise.difficulty,exercise.mode,exercise.is_active]);
        if (!inserted.rows.length) throw new AdminError('Ya existe un ejercicio con ese identificador, incluso entre los retirados.',409);
        await addVersion(client,recordId,exercise);
        return exercise;
      });
    },
    async update(id: string, body: any) {
      return transaction(db,async client => {
        const locked = await client.query('SELECT id FROM exercises WHERE slug=$1 AND archived_at IS NULL FOR UPDATE',[id]);
        if (!locked.rows[0]) throw new AdminError('Ejercicio no encontrado.',404);
        const rows = await client.query(`${selection} WHERE e.id=$1`,[locked.rows[0].id]);
        const current = map(rows.rows[0]);
        if (!Number.isInteger(body?.version) || body.version !== current.version) throw new AdminError('Otro administrador modificó este ejercicio. Vuelve a abrirlo antes de guardar.',409);
        const exercise = validateExercise(body,current);
        await client.query('UPDATE exercises SET title=$2,description=$3,difficulty=$4,is_active=$5 WHERE id=$1',[locked.rows[0].id,exercise.title,exercise.description,exercise.difficulty,exercise.is_active]);
        await addVersion(client,locked.rows[0].id,exercise);
        return exercise;
      });
    },
    async archive(id: string) {
      const result = await db.query('UPDATE exercises SET archived_at=now(),is_active=false WHERE slug=$1 AND archived_at IS NULL RETURNING id',[id]);
      if (!result.rows.length) throw new AdminError('Ejercicio no encontrado.',404);
    },
  };
}
