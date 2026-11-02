export const prerender = false;
import type { APIRoute } from 'astro';
import { currentUser } from '../../../../lib/session';
import { json } from '../../../../lib/http';
import { getDbExerciseById, updateDbExercise, deleteDbExercise } from '../../../../lib/exercises-db';

export const GET: APIRoute = async ({ params, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return json({ error: 'Acceso no autorizado. Se requieren permisos de administrador.' }, 403);
    }

    const { id } = params;
    if (!id) return json({ error: 'ID de ejercicio no proporcionado.' }, 400);

    const exercise = await getDbExerciseById(id);
    if (!exercise) return json({ error: 'Ejercicio no encontrado.' }, 404);

    return json({ exercise });
  } catch (error) {
    return json({ error: (error as Error).message || 'Error al obtener el ejercicio.' }, 500);
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return json({ error: 'Acceso no autorizado. Se requieren permisos de administrador.' }, 403);
    }

    const { id } = params;
    if (!id) return json({ error: 'ID de ejercicio no proporcionado.' }, 400);

    const body = await request.json();

    const updated = await updateDbExercise(id, {
      title: body.title,
      level: body.level,
      difficulty: body.difficulty,
      topics: Array.isArray(body.topics) ? body.topics : (body.topics ? String(body.topics).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined),
      description: body.description,
      statement: body.statement,
      expected: body.expected,
      files: body.files,
      briefing: body.briefing,
      hints: Array.isArray(body.hints) ? body.hints : (body.hints ? [String(body.hints)] : undefined),
      solution: body.solution,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : undefined,
    });

    return json({ success: true, exercise: updated });
  } catch (error) {
    return json({ error: (error as Error).message || 'Error al actualizar el ejercicio.' }, 400);
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return json({ error: 'Acceso no autorizado. Se requieren permisos de administrador.' }, 403);
    }

    const { id } = params;
    if (!id) return json({ error: 'ID de ejercicio no proporcionado.' }, 400);

    const deleted = await deleteDbExercise(id);
    if (!deleted) return json({ error: 'No se encontró el ejercicio a eliminar.' }, 404);

    return json({ success: true, message: `Ejercicio ${id} eliminado correctamente.` });
  } catch (error) {
    return json({ error: (error as Error).message || 'Error al eliminar el ejercicio.' }, 500);
  }
};

