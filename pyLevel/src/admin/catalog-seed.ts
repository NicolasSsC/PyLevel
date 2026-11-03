import { randomUUID } from 'node:crypto';
import { catalogs } from '../core/catalog.ts';
import { classic } from '../core/classic-exercises.ts';
import type { Database } from '../lib/session-store.ts';
import type { AdminExercise } from './types.ts';

export async function seedCatalog(db: Database) {
  let added = 0;
  for (const mode of ['classic','contextual'] as const) for (const source of catalogs[mode]) {
    const reference = mode === 'classic' ? classic.find(e => e.id === source.id) : null;
    const exercise: AdminExercise = { ...source, mode, is_active: true, hints: reference?.hints ?? [], solution: reference?.solution ?? '', version: 1 };
    const id = randomUUID();
    const result = await db.query(`INSERT INTO exercises(id,slug,title,description,difficulty,exercise_type,is_active)
      VALUES($1,$2,$3,$4,$5,$6,true) ON CONFLICT(slug) DO NOTHING RETURNING id`,[id,exercise.id,exercise.title,exercise.description,exercise.difficulty,mode]);
    if (result.rows.length) {
      await db.query(`INSERT INTO exercise_versions(id,exercise_id,version,repository_path,manifest_path,config,published_at)
        VALUES($1,$2,1,'pylevel/catalog',$3,$4,now())`,[randomUUID(),id,exercise.id,JSON.stringify(exercise)]);
      added++;
    }
  }
  return added;
}
