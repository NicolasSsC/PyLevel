import { catalogs, modePaths } from '../core/catalog';
import { exam } from '../exam/definition';
import { getDbPool } from '../lib/db';
import { activityStore, type Mode } from './activity';
import { buildProgress, type CatalogEntry } from './progress';

export const progressCatalog: CatalogEntry[] = (['classic', 'contextual'] as Mode[]).flatMap(mode => catalogs[mode].map(e => ({
  id: e.id, title: e.title, difficulty: e.difficulty, topics: e.topics, mode, href: `/ejercicios/${modePaths[mode]}/${e.id}/`,
})));
export async function loadProgress(userId: string) { return buildProgress(await activityStore(getDbPool()).read(userId), progressCatalog); }
export async function loadExamHistory(userId: string) {
  const db = getDbPool();
  await db.query(`UPDATE exam_attempts SET status = 'expired', submitted_at = expires_at
    WHERE user_id = $1 AND status = 'in_progress' AND expires_at <= clock_timestamp()`, [userId]);
  const result = await db.query(`SELECT id, exam_id, status, started_at, submitted_at FROM exam_attempts WHERE user_id = $1 ORDER BY started_at DESC`, [userId]);
  return result.rows.map(row => ({ id: row.id as string, title: row.exam_id === exam.id ? exam.title : row.exam_id as string,
    current: row.exam_id === exam.id, status: row.status as 'in_progress' | 'submitted' | 'expired',
    startedAt: new Date(row.started_at).toISOString(), submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null }));
}
