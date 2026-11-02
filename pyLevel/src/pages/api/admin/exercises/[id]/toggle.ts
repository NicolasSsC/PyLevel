export const prerender = false;
import type { APIRoute } from 'astro';
import { currentUser } from '../../../../../lib/session';
import { json } from '../../../../../lib/http';
import { toggleDbExercise } from '../../../../../lib/exercises-db';

export const POST: APIRoute = async ({ params, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return json({ error: 'Acceso no autorizado. Se requieren permisos de administrador.' }, 403);
    }

    const { id } = params;
    if (!id) return json({ error: 'ID de ejercicio no proporcionado.' }, 400);

    const updated = await toggleDbExercise(id);
    return json({
      success: true,
      id: updated.id,
      is_active: updated.is_active,
      message: updated.is_active ? 'Ejercicio activado con éxito.' : 'Ejercicio desactivado con éxito.'
    });
  } catch (error) {
    return json({ error: (error as Error).message || 'Error al cambiar estado del ejercicio.' }, 400);
  }
};

