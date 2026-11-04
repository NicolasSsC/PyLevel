import { exerciseStore } from '../admin/exercise-store.ts';
import type { AdminDatabase } from '../admin/database.ts';
import { activityStore, type ActivityData } from '../account/activity.ts';
import { modePaths } from '../core/catalog.ts';
import type { AdminExercise } from '../admin/types.ts';
import type { PageContext } from './page-context.ts';
import { clipText } from './page-context.ts';
import { AiRequestError } from './access.ts';
import guide from './tutor-guide.json' with { type: 'json' };

const sections = [
  { title: 'Inicio', href: '/' }, { title: 'Ejercicios clásicos', href: '/ejercicios/clasicos/' },
  { title: 'Ejercicios contextualizados', href: '/ejercicios/contextualizados/' },
  { title: 'Progreso', href: '/progreso/' }, { title: 'Exámenes', href: '/examen/' }, { title: 'Mi perfil', href: '/perfil' },
];
const href = (exercise: AdminExercise) => `/ejercicios/${modePaths[exercise.mode]}/${encodeURIComponent(exercise.id)}/`;
export function learningContext(catalog: AdminExercise[], activity: ActivityData) {
  const completed = catalog.filter(item => activity.exercises.some(row => row.exerciseId === item.id && row.mode === item.mode && row.completedAt));
  const pending = catalog.filter(item => !completed.includes(item));
  const recent = activity.recent.flatMap(row => {
    const item = catalog.find(item => item.id === row.exerciseId && item.mode === row.mode);
    return item ? [{ title: item.title, href: href(item), action: row.kind, result: row.result }] : [];
  }).slice(0, 5);
  const rank = { 'Fácil': 0, 'Medio': 1, 'Difícil': 2 };
  const ceiling = completed.length ? Math.min(2, Math.max(...completed.map(item => rank[item.difficulty])) + 1) : 0;
  const resumed = pending.filter(item => activity.exercises.some(row => row.exerciseId === item.id && row.mode === item.mode && row.attempts > 0));
  const ordered = [...resumed, ...pending.filter(item => !resumed.includes(item)).sort((a, b) => rank[a.difficulty] - rank[b.difficulty])];
  const recommendations = ordered.filter(item => resumed.includes(item) || rank[item.difficulty] <= ceiling).slice(0, 3).map(item => ({
    id: item.id, title: item.title, mode: item.mode, difficulty: item.difficulty, topics: item.topics, href: href(item),
    reason: resumed.includes(item) ? 'Ya lo intentaste y todavía no has superado sus pruebas públicas.'
      : completed.length ? 'Es un ejercicio pendiente para continuar tu práctica.' : 'Es un ejercicio de dificultad fácil para empezar.',
  }));
  return { progress: { completed: completed.length, total: catalog.length, attempted: activity.exercises.filter(row => row.attempts > 0 && catalog.some(item => item.id === row.exerciseId && item.mode === row.mode)).length, recent }, recommendations };
}

export async function loadTutorContext(db: AdminDatabase, userId: string, input: PageContext) {
  const catalog = await exerciseStore(db).list({ publicOnly: true });
  const activity = await activityStore(db).read(userId);
  const exercise = input.exerciseId ? catalog.find(item => item.id === input.exerciseId && item.mode === input.mode) : undefined;
  if (input.exerciseId && !exercise) throw new AiRequestError('El ejercicio no está disponible.', 404);
  if (exercise && [input.selectedFile, ...Object.keys(input.files ?? {}), ...Object.keys(input.execution?.files ?? {})].some(path => path && !Object.hasOwn(exercise.files, path))) {
    throw new AiRequestError('El contexto contiene archivos ajenos al ejercicio.');
  }
  const page = sections.find(section => section.href.replace(/\/$/, '') === input.page.replace(/\/$/, ''));
  return {
    platform: guide.platform, sections, page: { title: page?.title ?? (exercise ? 'Práctica de Python' : 'PyLevel'), path: page?.href ?? (exercise ? href(exercise) : '/') },
    ...learningContext(catalog, activity),
    ...(exercise ? {
      exercise: { id: exercise.id, title: exercise.title, mode: exercise.mode, difficulty: exercise.difficulty, topics: exercise.topics,
        statement: clipText(exercise.statement, 9000), expected: clipText(exercise.expected, 2000), files: Object.keys(exercise.files),
        ...(exercise.briefing ? { briefing: { situation: clipText(exercise.briefing.situacion, 2000), question: clipText(exercise.briefing.pregunta, 1500), requirements: exercise.briefing.queSeEspera.map(text => clipText(text, 1000)).slice(0, 8) } } : {}),
      },
      workspace: { selectedFile: input.selectedFile, files: input.files ?? {}, truncated: !!input.truncated },
      running: !!input.running, ...(input.execution ? { execution: input.execution } : {}),
    } : {}),
  };
}
export type TutorContext = Awaited<ReturnType<typeof loadTutorContext>>;

export function localContextReply(message: string, context: TutorContext) {
  const query = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/recom|que ejercicio|que practico|por donde empiezo|siguiente ejercicio/.test(query)) {
    return context.recommendations.length ? `Según tu progreso, has superado ${context.progress.completed} de ${context.progress.total} ejercicios. Puedes continuar con:\n\n${context.recommendations.map(item => `- [${item.title}](${item.href}) · ${item.difficulty}. ${item.reason}`).join('\n')}`
      : 'Has superado todos los ejercicios publicados. Puedes repasar tus resultados en [Progreso](/progreso/).';
  }
  if (context.exercise && /error|falla|ocurr|terminal|salida|resultado/.test(query)) {
    if (context.running) return 'La ejecución sigue en curso. Espera el resultado para revisar juntos la terminal.';
    if (!context.execution) return 'Todavía no tengo una ejecución de este ejercicio. Pulsa «Ejecutar» o «Probar» y vuelve a consultar el resultado.';
    const run = context.execution;
    const changed = run.changedSinceExecution ? '\n\nModificaste el código después de ejecutar. El resultado corresponde a la versión anterior; vuelve a ejecutar para comprobar los cambios.' : '';
    if (run.status !== 'completed') return `La última ejecución terminó con estado «${run.status}». Esto no confirma un error de lógica en tu solución.${changed}`;
    return `La última ${run.action === 'test' ? 'prueba' : 'ejecución'} de «${context.exercise.title}» terminó con código ${run.exitCode}.\n\nTerminal:\n\`\`\`text\n${clipText(run.output, 1800, true)}\n\`\`\`\n\n${run.exitCode === 0 ? 'Revisa «Probar» para confirmar los casos del ejercicio.' : 'Busca el nombre del error y el archivo señalado al final de la terminal. Esa es la información que debemos contrastar con el código ejecutado.'}${changed}`;
  }
  if (context.exercise && /que (debo|tengo que) hacer|enunciado|objetivo/.test(query)) return `Estás trabajando en «${context.exercise.title}».\n\n${context.exercise.statement}\n\nPuedes usar «Ejecutar» para observar el programa y «Probar» para revisar los casos públicos.`;
  if (/pylevel|donde.*progreso|como.*(ejecutar|probar)/.test(query)) return `${guide.platform}\n\n[Ejercicios clásicos](/ejercicios/clasicos/) · [Contextualizados](/ejercicios/contextualizados/) · [Progreso](/progreso/)`;
  return null;
}
