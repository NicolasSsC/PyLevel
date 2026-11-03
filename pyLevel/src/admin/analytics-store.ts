import type { Database } from '../lib/session-store.ts';
import type { AdminExercise } from './types.ts';

function weekDays() {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return Array.from({length:7},(_,i)=>{
    const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-6+i);
    return {key:date.toISOString().slice(0,10),label:new Intl.DateTimeFormat('es-CO',{weekday:'short',timeZone:'UTC'}).format(date),attempts:0};
  });
}
export async function loadAdminAnalytics(db: Database, catalog: AdminExercise[]) {
  const [students,grouped,recent,daily]=await Promise.all([
    db.query("SELECT count(*)::int AS count FROM users WHERE role='user'"),
    db.query(`SELECT a.exercise_id,a.mode,count(*)::int AS attempts,
      count(*) FILTER(WHERE a.kind='test')::int AS tests,
      count(*) FILTER(WHERE a.kind='test' AND a.result='passed' AND a.tests_run>0)::int AS passed,
      count(*) FILTER(WHERE a.kind='test' AND a.result='failed')::int AS failed,
      count(DISTINCT a.user_id)::int AS students
      FROM practice_activity a JOIN users u ON u.id::text=a.user_id
      WHERE u.role='user' AND a.kind IN ('run','test') GROUP BY a.exercise_id,a.mode`),
    db.query(`SELECT a.id,a.exercise_id,a.mode,a.kind,a.result,a.created_at,u.email,COALESCE(p.display_name,u.email) AS name
      FROM practice_activity a JOIN users u ON u.id::text=a.user_id LEFT JOIN profiles p ON p.user_id=u.id
      WHERE u.role='user' AND a.kind IN ('run','test') ORDER BY a.created_at DESC,a.id DESC LIMIT 15`),
    db.query(`SELECT to_char(a.created_at AT TIME ZONE 'America/Bogota','YYYY-MM-DD') AS day,count(*)::int AS count
      FROM practice_activity a JOIN users u ON u.id::text=a.user_id WHERE u.role='user' AND a.kind IN ('run','test')
      AND a.created_at>=now()-interval '8 days' GROUP BY day`),
  ]);
  const exercises=catalog.filter(e=>!e.archivedAt).map(e=>{
    const stats=grouped.rows.find(r=>r.exercise_id===e.id&&r.mode===e.mode);
    const passed=stats?.passed ?? 0,failed=stats?.failed ?? 0;
    return {id:e.id,title:e.title,mode:e.mode,difficulty:e.difficulty,active:e.is_active,
      attempts:stats?.attempts ?? 0,tests:stats?.tests ?? 0,passed,failed,uniqueStudents:stats?.students ?? 0,
      passRate:passed+failed ? Math.round(passed/(passed+failed)*100) : null};
  });
  const total=(field: string)=>grouped.rows.reduce((sum,row)=>sum+Number(row[field]),0);
  const totalPassed=total('passed'),totalFailed=total('failed');
  const days=weekDays();
  for(const day of days)day.attempts=daily.rows.find(r=>r.day===day.key)?.count ?? 0;
  return {
    totalStudents:students.rows[0].count,totalAttempts:total('attempts'),totalTests:total('tests'),totalPassed,
    globalPassRate:totalPassed+totalFailed?Math.round(totalPassed/(totalPassed+totalFailed)*100):0,
    activeExercises:exercises.filter(e=>e.active).length,exercises,
    mostDifficult:exercises.filter(e=>e.active&&e.passRate!==null).sort((a,b)=>a.passRate!-b.passRate!).slice(0,5),
    unattempted:exercises.filter(e=>e.active&&!e.attempts),days,
    recentActivity:recent.rows.map(r=>({id:r.id,exerciseId:r.exercise_id,mode:r.mode,kind:r.kind,result:r.result,
      title:catalog.find(e=>e.id===r.exercise_id&&e.mode===r.mode)?.title ?? r.exercise_id,
      studentName:r.name,studentEmail:r.email,createdAt:new Date(r.created_at).toISOString()})),
  };
}
