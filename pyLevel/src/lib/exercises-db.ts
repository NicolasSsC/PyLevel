import { getDbPool } from './db.ts';
import { catalogs, type Exercise, type ContextualBriefing } from '../core/catalog.ts';
import { classic, type ClassicExercise } from '../core/classic-exercises.ts';

export interface DbExerciseRecord {
  id: string;
  mode: 'classic' | 'contextual';
  title: string;
  level: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  topics: string[];
  description: string;
  statement: string;
  expected: string;
  files: Record<string, string>;
  briefing?: ContextualBriefing | null;
  hints?: string[];
  solution?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

let isSeeding = false;
let isSeeded = false;

/**
 * Asegura que los ejercicios predeterminados existan en la base de datos PostgreSQL
 */
export async function ensureCatalogSeeded(): Promise<void> {
  if (isSeeded || isSeeding) return;
  isSeeding = true;

  try {
    const db = getDbPool();
    const countRes = await db.query('SELECT COUNT(*)::int AS total FROM catalog_exercises');
    if (countRes.rows[0].total > 0) {
      isSeeded = true;
      isSeeding = false;
      return;
    }

    // Sembrar ejercicios clásicos
    for (const c of classic) {
      await db.query(
        `INSERT INTO catalog_exercises
          (id, mode, title, level, difficulty, topics, description, statement, expected, files, hints, solution, is_active)
         VALUES ($1, 'classic', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         ON CONFLICT (id) DO NOTHING`,
        [
          c.id,
          c.title,
          c.level || 'Inicial',
          c.difficulty,
          JSON.stringify(c.topics || []),
          c.description,
          c.statement,
          c.expected || '',
          JSON.stringify(c.files || {}),
          JSON.stringify(c.hints || []),
          c.solution || '',
        ]
      );
    }

    // Sembrar proyectos contextualizados
    for (const p of catalogs.contextual) {
      await db.query(
        `INSERT INTO catalog_exercises
          (id, mode, title, level, difficulty, topics, description, statement, expected, files, briefing, is_active)
         VALUES ($1, 'contextual', $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         ON CONFLICT (id) DO NOTHING`,
        [
          p.id,
          p.title,
          p.level || 'Inicial',
          p.difficulty,
          JSON.stringify(p.topics || []),
          p.description,
          p.statement,
          p.expected || '',
          JSON.stringify(p.files || {}),
          p.briefing ? JSON.stringify(p.briefing) : null,
        ]
      );
    }

    isSeeded = true;
  } catch (err) {
    console.warn('Nota al inicializar catálogo en base de datos:', (err as Error).message);
  } finally {
    isSeeding = false;
  }
}

/**
 * Mapea una fila de PostgreSQL a formato DbExerciseRecord
 */
function mapRow(row: any): DbExerciseRecord {
  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    level: row.level,
    difficulty: row.difficulty,
    topics: Array.isArray(row.topics) ? row.topics : (typeof row.topics === 'string' ? JSON.parse(row.topics) : []),
    description: row.description,
    statement: row.statement,
    expected: row.expected || '',
    files: typeof row.files === 'object' && row.files !== null ? row.files : (typeof row.files === 'string' ? JSON.parse(row.files) : {}),
    briefing: row.briefing ? (typeof row.briefing === 'object' ? row.briefing : JSON.parse(row.briefing)) : null,
    hints: Array.isArray(row.hints) ? row.hints : (typeof row.hints === 'string' ? JSON.parse(row.hints) : []),
    solution: row.solution || '',
    is_active: Boolean(row.is_active),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Obtiene la lista de ejercicios (activos para estudiantes, o todos para administradores)
 */
export async function getDbExercises(options: {
  mode?: 'classic' | 'contextual';
  onlyActive?: boolean;
} = {}): Promise<DbExerciseRecord[]> {
  await ensureCatalogSeeded();
  try {
    const db = getDbPool();
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.mode) {
      params.push(options.mode);
      conditions.push(`mode = $${params.length}`);
    }

    if (options.onlyActive !== false) {
      conditions.push('is_active = true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await db.query(
      `SELECT * FROM catalog_exercises ${whereClause} ORDER BY created_at ASC`,
      params
    );

    if (res.rows.length > 0) {
      return res.rows.map(mapRow);
    }
  } catch (err) {
    console.warn('Error leyendo ejercicios de BD, usando catálogo estático de respaldo:', (err as Error).message);
  }

  // Fallback a memoria si la base de datos no está disponible
  const list: DbExerciseRecord[] = [];
  if (!options.mode || options.mode === 'classic') {
    list.push(...classic.map(c => ({
      id: c.id,
      mode: 'classic' as const,
      title: c.title,
      level: c.level,
      difficulty: c.difficulty,
      topics: c.topics,
      description: c.description,
      statement: c.statement,
      expected: c.expected,
      files: c.files,
      hints: c.hints,
      solution: c.solution,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })));
  }
  if (!options.mode || options.mode === 'contextual') {
    list.push(...catalogs.contextual.map(p => ({
      id: p.id,
      mode: 'contextual' as const,
      title: p.title,
      level: p.level,
      difficulty: p.difficulty,
      topics: p.topics,
      description: p.description,
      statement: p.statement,
      expected: p.expected,
      files: p.files,
      briefing: p.briefing,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })));
  }
  return list;
}

/**
 * Obtiene un ejercicio por su ID desde la base de datos o fallback
 */
export async function getDbExerciseById(id: string): Promise<DbExerciseRecord | null> {
  await ensureCatalogSeeded();
  try {
    const db = getDbPool();
    const res = await db.query('SELECT * FROM catalog_exercises WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      return mapRow(res.rows[0]);
    }
  } catch (err) {
    console.warn('Error buscando ejercicio por ID en BD:', (err as Error).message);
  }

  // Fallback
  const c = classic.find(item => item.id === id);
  if (c) {
    return {
      id: c.id,
      mode: 'classic',
      title: c.title,
      level: c.level,
      difficulty: c.difficulty,
      topics: c.topics,
      description: c.description,
      statement: c.statement,
      expected: c.expected,
      files: c.files,
      hints: c.hints,
      solution: c.solution,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const p = catalogs.contextual.find(item => item.id === id);
  if (p) {
    return {
      id: p.id,
      mode: 'contextual',
      title: p.title,
      level: p.level,
      difficulty: p.difficulty,
      topics: p.topics,
      description: p.description,
      statement: p.statement,
      expected: p.expected,
      files: p.files,
      briefing: p.briefing,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Crea un nuevo ejercicio en la base de datos
 */
export async function createDbExercise(data: {
  id: string;
  mode: 'classic' | 'contextual';
  title: string;
  level?: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  topics: string[];
  description: string;
  statement: string;
  expected?: string;
  files: Record<string, string>;
  briefing?: ContextualBriefing | null;
  hints?: string[];
  solution?: string;
  is_active?: boolean;
}): Promise<DbExerciseRecord> {
  await ensureCatalogSeeded();
  const db = getDbPool();

  const id = data.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!id) throw new Error('El identificador del ejercicio es obligatorio.');

  const existing = await db.query('SELECT id FROM catalog_exercises WHERE id = $1', [id]);
  if (existing.rows.length > 0) {
    throw new Error(`Ya existe un ejercicio con el identificador "${id}".`);
  }

  const now = new Date();
  const res = await db.query(
    `INSERT INTO catalog_exercises
      (id, mode, title, level, difficulty, topics, description, statement, expected, files, briefing, hints, solution, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
     RETURNING *`,
    [
      id,
      data.mode,
      data.title.trim(),
      data.level || 'Inicial',
      data.difficulty,
      JSON.stringify(data.topics || []),
      data.description.trim(),
      data.statement.trim(),
      data.expected || '',
      JSON.stringify(data.files || {}),
      data.briefing ? JSON.stringify(data.briefing) : null,
      JSON.stringify(data.hints || []),
      data.solution || '',
      data.is_active !== undefined ? data.is_active : true,
      now,
    ]
  );

  return mapRow(res.rows[0]);
}

/**
 * Actualiza un ejercicio existente
 */
export async function updateDbExercise(
  id: string,
  data: Partial<{
    title: string;
    level: string;
    difficulty: 'Fácil' | 'Medio' | 'Difícil';
    topics: string[];
    description: string;
    statement: string;
    expected: string;
    files: Record<string, string>;
    briefing?: ContextualBriefing | null;
    hints?: string[];
    solution?: string;
    is_active?: boolean;
  }>
): Promise<DbExerciseRecord> {
  await ensureCatalogSeeded();
  const db = getDbPool();

  const check = await db.query('SELECT * FROM catalog_exercises WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    throw new Error('No se encontró el ejercicio a actualizar.');
  }

  const current = check.rows[0];
  const now = new Date();

  const title = data.title !== undefined ? data.title.trim() : current.title;
  const level = data.level !== undefined ? data.level : current.level;
  const difficulty = data.difficulty !== undefined ? data.difficulty : current.difficulty;
  const topics = data.topics !== undefined
    ? JSON.stringify(data.topics)
    : (typeof current.topics === 'string' ? current.topics : JSON.stringify(current.topics || []));
  const description = data.description !== undefined ? data.description.trim() : current.description;
  const statement = data.statement !== undefined ? data.statement.trim() : current.statement;
  const expected = data.expected !== undefined ? data.expected : current.expected;
  const files = data.files !== undefined
    ? JSON.stringify(data.files)
    : (typeof current.files === 'string' ? current.files : JSON.stringify(current.files || {}));
  const briefing = data.briefing !== undefined
    ? (data.briefing ? JSON.stringify(data.briefing) : null)
    : (current.briefing ? (typeof current.briefing === 'string' ? current.briefing : JSON.stringify(current.briefing)) : null);
  const hints = data.hints !== undefined
    ? JSON.stringify(data.hints)
    : (current.hints ? (typeof current.hints === 'string' ? current.hints : JSON.stringify(current.hints)) : '[]');
  const solution = data.solution !== undefined ? data.solution : current.solution;
  const isActive = data.is_active !== undefined ? data.is_active : current.is_active;

  const res = await db.query(
    `UPDATE catalog_exercises SET
      title = $2,
      level = $3,
      difficulty = $4,
      topics = $5,
      description = $6,
      statement = $7,
      expected = $8,
      files = $9,
      briefing = $10,
      hints = $11,
      solution = $12,
      is_active = $13,
      updated_at = $14
     WHERE id = $1
     RETURNING *`,
    [
      id,
      title,
      level,
      difficulty,
      topics,
      description,
      statement,
      expected,
      files,
      briefing,
      hints,
      solution,
      isActive,
      now,
    ]
  );

  return mapRow(res.rows[0]);
}

/**
 * Alterna el estado activo/desactivado de un ejercicio
 */
export async function toggleDbExercise(id: string): Promise<DbExerciseRecord> {
  await ensureCatalogSeeded();
  const db = getDbPool();

  const res = await db.query(
    `UPDATE catalog_exercises
     SET is_active = NOT is_active, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (res.rows.length === 0) {
    throw new Error('No se encontró el ejercicio.');
  }

  return mapRow(res.rows[0]);
}

/**
 * Elimina un ejercicio de la base de datos
 */
export async function deleteDbExercise(id: string): Promise<boolean> {
  await ensureCatalogSeeded();
  const db = getDbPool();

  const res = await db.query('DELETE FROM catalog_exercises WHERE id = $1 RETURNING id', [id]);
  return (res.rowCount ?? 0) > 0;
}
