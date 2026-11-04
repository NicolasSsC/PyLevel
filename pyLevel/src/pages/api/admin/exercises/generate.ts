export const prerender = false;
import type { APIRoute } from 'astro';
import { invokeAI } from '../../../../ai/client';
import { getDbPool } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { adminBody, adminError } from '../../../../admin/api';
import { exerciseStore } from '../../../../admin/exercise-store';
import { generatedDraft, generationInput } from '../../../../admin/ai-draft';

// Authentication, administrator access, and same-origin mutations are enforced by middleware.
export const POST: APIRoute = async ({ request }) => {
  try {
    const input = generationInput(await adminBody(request));
    const existing = await exerciseStore(getDbPool()).list({ mode: input.mode });
    const difficulty = { 'Fácil': 'facil', 'Medio': 'media', 'Difícil': 'dificil' }[input.difficulty];
    const result = await invokeAI({ action: input.mode === 'classic' ? 'generate_challenge' : 'generate_project',
      data: { tema: input.tema, dificultad: difficulty, existentes: existing.map(exercise => exercise.title) } });
    return json({ exercise: generatedDraft(result, input), source: result.fuente || 'pybot' });
  } catch (error) { return adminError(error); }
};
