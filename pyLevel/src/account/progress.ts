import type { ActivityData, Mode } from './activity.ts';
import { todayInBogota } from './profile.ts';

export type CatalogEntry = { id: string; mode: Mode; title: string; difficulty: string; topics: string[]; href: string };
export function buildProgress(data: ActivityData, catalog: CatalogEntry[], today = todayInBogota()) {
  const exercises = data.exercises.flatMap(activity => {
    const item = catalog.find(q => q.id === activity.exerciseId && q.mode === activity.mode);
    return item ? [{ ...item, ...activity }] : [];
  });
  const worked = exercises.filter(e => e.attempts > 0);
  const completed = exercises.filter(e => e.completedAt);
  const attempts = worked.reduce((n, e) => n + e.attempts, 0);
  const tests = worked.reduce((n, e) => n + e.tests, 0);
  const passedTests = worked.reduce((n, e) => n + e.passedTests, 0);
  const hints = exercises.reduce((n, e) => n + e.hints, 0);
  const solutions = exercises.reduce((n, e) => n + e.solutions, 0);
  const technicalErrors = worked.reduce((n, e) => n + e.technicalErrors, 0);
  const recent = data.recent.flatMap(row => {
    const item = catalog.find(q => q.id === row.exerciseId && q.mode === row.mode);
    return item ? [{ ...item, ...row }] : [];
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 6 + i);
    const key = date.toISOString().slice(0, 10);
    return { key, label: new Intl.DateTimeFormat('es-CO', { weekday: 'short', timeZone: 'UTC' }).format(date), attempts: data.days.find(d => d.day === key)?.attempts ?? 0 };
  });
  const topics = [...new Set(catalog.flatMap(e => e.topics))].map(topic => ({
    name: topic, total: catalog.filter(e => e.topics.includes(topic)).length,
    completed: completed.filter(e => e.topics.includes(topic)).length,
  })).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name, 'es'));
  const feedback: { title: string; text: string; href: string; action: string; tone: string }[] = [];
  const next = catalog.find(e => !completed.some(c => c.id === e.id && c.mode === e.mode));
  if (!attempts) feedback.push({ title: 'Tu progreso empieza con una práctica', text: 'Ejecuta tu primera solución y utiliza «Probar». Aquí aparecerán tus resultados y recomendaciones a medida que practiques.', href: next?.href ?? '/ejercicios/', action: 'Comenzar a practicar', tone: 'blue' });
  else {
    const latestTest = recent.find(e => e.kind === 'test' && e.result === 'failed' && !completed.some(c => c.id === e.id && c.mode === e.mode));
    if (latestTest) feedback.push({ title: 'Un reto para seguir mejorando', text: `Tu última prueba pendiente en «${latestTest.title}» no pasó todos los casos. Revisa los errores de la terminal y prueba también los casos límite.`, href: latestTest.href, action: 'Retomar este ejercicio', tone: 'gold' });
    if (completed.length) feedback.push({ title: `${completed.length} ${completed.length === 1 ? 'ejercicio superado' : 'ejercicios superados'}`, text: 'Tus soluciones pasaron las pruebas públicas de estos ejercicios. Prueba ahora un reto diferente para seguir ampliando tu práctica.', href: next?.href ?? '/ejercicios/', action: next ? `Continuar con ${next.title}` : 'Repasar el catálogo', tone: 'green' });
    if (!tests) feedback.push({ title: 'Comprueba tus soluciones', text: 'Ya ejecutaste código. Usa «Probar» para comprobar distintos casos: ejecutar sin errores no basta para superar un ejercicio.', href: worked[0]?.href ?? '/ejercicios/', action: 'Probar mi solución', tone: 'blue' });
    else if (!completed.length && !latestTest) feedback.push({ title: 'Sigue con tu primera solución', text: 'Ya tienes intentos registrados. Revisa el resultado de las pruebas y continúa con el mismo reto para cerrar tu primera práctica.', href: worked[0]?.href ?? '/ejercicios/', action: 'Continuar practicando', tone: 'blue' });
    if (solutions) feedback.push({ title: 'Refuerza lo que acabas de consultar', text: `Consultaste la solución de referencia ${solutions} ${solutions === 1 ? 'vez' : 'veces'}. Vuelve a escribir una solución sin mirarla y compruébala con las pruebas.`, href: exercises.find(e => e.solutions > 0)?.href ?? '/ejercicios/', action: 'Practicar sin referencia', tone: 'gold' });
    else if (hints) feedback.push({ title: 'Convierte las pistas en aprendizaje', text: `Has consultado ${hints} ${hints === 1 ? 'pista' : 'pistas'}. Al terminar el reto, explica con tus palabras por qué funciona tu solución.`, href: exercises.find(e => e.hints > 0)?.href ?? '/ejercicios/', action: 'Revisar mi práctica', tone: 'blue' });
    if (technicalErrors) feedback.push({ title: 'Hay incidencias del ejecutor', text: `Se registraron ${technicalErrors} resultados técnicos sin evaluación. No reducen los ejercicios que ya superaste; puedes reintentar cuando el servicio esté disponible.`, href: '/ejercicios/', action: 'Volver a los ejercicios', tone: 'blue' });
  }
  return { exercises, worked, completed, attempts, tests, passedTests, hints, technicalErrors, recent, days, topics, feedback,
    total: catalog.length, inProgress: worked.filter(e => !e.completedAt).length, activeDays: days.filter(d => d.attempts > 0).length,
    percentage: catalog.length ? Math.round(completed.length / catalog.length * 100) : 0 };
}
