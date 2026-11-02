export const prerender = false;
import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { json } from '../../../lib/http';
import { getDbExercises, createDbExercise } from '../../../lib/exercises-db';

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return json({ error: 'Acceso no autorizado. Se requieren permisos de administrador.' }, 403);
    }

    const mode = (url.searchParams.get('mode') as 'classic' | 'contextual') || undefined;
    const exercises = await getDbExercises({ mode, onlyActive: false });
    return json({ exercises });
  } catch (error) {
    return json({ error: (error as Error).message || 'Error al obtener los ejercicios.' }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return json({ error: 'Acceso no autorizado. Se requieren permisos de administrador.' }, 403);
    }

    const body = await request.json();
    if (!body.title || !body.description || !body.statement) {
      return json({ error: 'Los campos título, descripción y enunciado son obligatorios.' }, 400);
    }

    if (!['classic', 'contextual'].includes(body.mode)) {
      return json({ error: 'La modalidad debe ser classic (clásicos) o contextual (contextualizados).' }, 400);
    }

    if (!['Fácil', 'Medio', 'Difícil'].includes(body.difficulty)) {
      return json({ error: 'La dificultad debe ser Fácil, Medio o Difícil.' }, 400);
    }

    // Generar o sanitizar ID
    const rawId = body.id?.trim() || `${body.mode === 'classic' ? 'clasico' : 'proyecto'}_${Date.now()}`;
    const cleanId = rawId.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Asegurar estructura de files
    const files: Record<string, string> = body.files && typeof body.files === 'object' ? body.files : {};
    if (!files['main.py']) {
      files['main.py'] = '# Tu solución aquí\n';
    }
    if (!files['tests/test_publico.py']) {
      files['tests/test_publico.py'] = 'import unittest\nfrom main import *\n\nclass TestCasos(unittest.TestCase):\n    def test_basico(self):\n        pass\n';
    }

    const created = await createDbExercise({
      id: cleanId,
      mode: body.mode,
      title: body.title,
      level: body.level || 'Inicial',
      difficulty: body.difficulty,
      topics: Array.isArray(body.topics) ? body.topics : (body.topics ? String(body.topics).split(',').map((s: string) => s.trim()).filter(Boolean) : ['Python']),
      description: body.description,
      statement: body.statement,
      expected: body.expected || '',
      files,
      briefing: body.briefing || null,
      hints: Array.isArray(body.hints) ? body.hints : (body.hints ? [String(body.hints)] : []),
      solution: body.solution || '',
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
    });

    return json({ success: true, exercise: created }, 201);
  } catch (error) {
    return json({ error: (error as Error).message || 'No se pudo crear el ejercicio.' }, 400);
  }
};

