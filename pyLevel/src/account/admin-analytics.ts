import { getDbPool } from '../lib/db';
import { getDbExercises } from '../lib/exercises-db';

export interface ExerciseAnalyticRow {
  id: string;
  title: string;
  mode: 'classic' | 'contextual';
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  attempts: number;
  passed: number;
  failed: number;
  uniqueStudents: number;
  passRate: number | null;
}

export interface RecentStudentAttempt {
  id: string;
  exerciseId: string;
  title: string;
  mode: 'classic' | 'contextual';
  kind: 'test' | 'run' | 'opened' | 'hint' | 'solution';
  result: string | null;
  testsRun: number;
  createdAt: string;
  studentName: string;
  studentEmail: string;
}

export interface AdminAnalyticsData {
  totalStudents: number;
  totalAttempts: number;
  totalTests: number;
  totalPassed: number;
  globalPassRate: number;
  activeExercises: number;
  exercises: ExerciseAnalyticRow[];
  mostDifficult: ExerciseAnalyticRow[];
  unattempted: ExerciseAnalyticRow[];
  recentActivity: RecentStudentAttempt[];
  days: { key: string; label: string; attempts: number }[];
}

export async function loadAdminAnalytics(): Promise<AdminAnalyticsData> {
  const db = getDbPool();
  const allExercises = await getDbExercises({ onlyActive: false });
  const activeCount = allExercises.filter(e => e.is_active).length;

  // 1. Conteo de estudiantes
  let totalStudents = 0;
  try {
    const res = await db.query("SELECT COUNT(*)::int AS c FROM users WHERE role <> 'admin'");
    totalStudents = res.rows[0]?.c ?? 0;
  } catch {
    const res = await db.query("SELECT COUNT(*)::int AS c FROM users");
    totalStudents = res.rows[0]?.c ?? 0;
  }

  // 2. Métricas de actividad general
  let totalAttempts = 0;
  let totalTests = 0;
  let totalPassed = 0;
  try {
    const statsRes = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN kind = 'test' THEN 1 END)::int AS tests,
        COUNT(CASE WHEN result = 'passed' THEN 1 END)::int AS passed
      FROM practice_activity
    `);
    const row = statsRes.rows[0] || {};
    totalAttempts = row.total || 0;
    totalTests = row.tests || 0;
    totalPassed = row.passed || 0;
  } catch (err) {
    console.warn('Error calculando métricas de actividad:', (err as Error).message);
  }

  const globalPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

  // 3. Métricas por cada ejercicio
  let exerciseStats: ExerciseAnalyticRow[] = [];
  try {
    const exRes = await db.query(`
      SELECT
        e.id,
        e.title,
        e.mode,
        e.difficulty,
        COUNT(a.id)::int AS attempts,
        COUNT(CASE WHEN a.result = 'passed' THEN 1 END)::int AS passed,
        COUNT(CASE WHEN a.result = 'failed' THEN 1 END)::int AS failed,
        COUNT(DISTINCT a.user_id)::int AS unique_students
      FROM catalog_exercises e
      LEFT JOIN practice_activity a ON e.id = a.exercise_id
      GROUP BY e.id, e.title, e.mode, e.difficulty
      ORDER BY attempts DESC, e.title ASC
    `);

    exerciseStats = exRes.rows.map(r => {
      const attempts = r.attempts || 0;
      const passed = r.passed || 0;
      return {
        id: r.id,
        title: r.title,
        mode: r.mode,
        difficulty: r.difficulty,
        attempts,
        passed,
        failed: r.failed || 0,
        uniqueStudents: r.unique_students || 0,
        passRate: attempts > 0 ? Math.round((passed / attempts) * 100) : null,
      };
    });
  } catch {
    exerciseStats = allExercises.map(e => ({
      id: e.id,
      title: e.title,
      mode: e.mode,
      difficulty: e.difficulty,
      attempts: 0,
      passed: 0,
      failed: 0,
      uniqueStudents: 0,
      passRate: null,
    }));
  }

  // Ejercicios más difíciles (con intentos y menor tasa de éxito)
  const attempted = exerciseStats.filter(e => e.attempts > 0);
  const mostDifficult = [...attempted].sort((a, b) => (a.passRate ?? 100) - (b.passRate ?? 100)).slice(0, 5);
  const unattempted = exerciseStats.filter(e => e.attempts === 0);

  // 4. Últimos intentos de estudiantes
  let recentActivity: RecentStudentAttempt[] = [];
  try {
    const recentRes = await db.query(`
      SELECT
        a.id,
        a.exercise_id,
        COALESCE(e.title, a.exercise_id) AS title,
        a.mode,
        a.kind,
        a.result,
        a.tests_run,
        a.created_at,
        COALESCE(p.display_name, split_part(u.email, '@', 1)) AS student_name,
        u.email AS student_email
      FROM practice_activity a
      LEFT JOIN users u ON a.user_id = u.id::text
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN catalog_exercises e ON a.exercise_id = e.id
      ORDER BY a.created_at DESC
      LIMIT 15
    `);

    recentActivity = recentRes.rows.map(r => ({
      id: r.id,
      exerciseId: r.exercise_id,
      title: r.title,
      mode: r.mode,
      kind: r.kind,
      result: r.result,
      testsRun: r.tests_run || 0,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      studentName: r.student_name || 'Estudiante',
      studentEmail: r.student_email || '',
    }));
  } catch {}

  // 5. Actividad de los últimos 7 días
  const days: { key: string; label: string; attempts: number }[] = [];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = dayNames[d.getDay()];

    days.push({
      key: dateStr,
      label,
      attempts: 0,
    });
  }

  try {
    const dailyRes = await db.query(`
      SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM practice_activity
      WHERE created_at >= now() - INTERVAL '7 days'
      GROUP BY to_char(created_at, 'YYYY-MM-DD')
    `);

    for (const row of dailyRes.rows) {
      const match = days.find(d => d.key === row.day);
      if (match) match.attempts = row.count;
    }
  } catch {}

  return {
    totalStudents,
    totalAttempts,
    totalTests,
    totalPassed,
    globalPassRate,
    activeExercises: activeCount,
    exercises: exerciseStats,
    mostDifficult,
    unattempted,
    recentActivity,
    days,
  };
}

