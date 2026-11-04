import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatedDraft, generationInput } from '../src/admin/ai-draft.ts';

const classicInput = generationInput({ mode: 'classic', tema: 'Sumas', difficulty: 'Medio' });
const challenge = { success: true, reto: { titulo: 'Sumar valores', descripcion: 'Practica sumas.', enunciado: 'Implementa sumar(a, b).', nombre_funcion: 'sumar', codigo_inicial: 'def sumar(a, b):\n    pass\n', casos_prueba: [
  { entrada: [1, 2], esperado: 3, visible: true },
  { entrada: ['no público'], esperado: 'NO_PUBLICAR', visible: false },
] } };
const projectInput = generationInput({ mode: 'contextual', tema: 'Reservas', difficulty: 'Fácil' });
const project = { success: true, proyecto: { nombre: 'Reservas modulares', descripcion: 'Practica módulos.', enunciado: 'Implementa una reserva.', temas: ['POO'], criterios_aceptacion: ['La reserva devuelve 42.'], archivos: { 'main.py': 'from model import valor\nprint(valor)\n', 'model.py': 'valor = 42\n' }, test_runner: 'import json\nprint(json.dumps({"exito": True}))\n' } };

test('generation validates modality, topic and difficulty before invoking the provider', () => {
  assert.deepEqual(classicInput, { mode: 'classic', tema: 'Sumas', difficulty: 'Medio' });
  for (const body of [{ mode: 'other', tema: 'Python', difficulty: 'Medio' }, { ...classicInput, tema: '' }, { ...classicInput, tema: 'x'.repeat(501) }, { ...classicInput, difficulty: 'extrema' }]) {
    assert.throws(() => generationInput(body), { status: 400 });
  }
});
test('classic drafts preserve code and convert only public cases to unittest files', () => {
  const draft = generatedDraft(challenge, classicInput);
  assert.equal(draft.mode, 'classic');
  assert.equal(draft.title, challenge.reto.titulo);
  assert.equal(draft.files['main.py'], challenge.reto.codigo_inicial);
  assert.equal(draft.isAI, true);
  assert.equal(draft.testCasesCount, 1);
  assert.ok(draft.files['tests/test_publico.py'].includes('from main import sumar'));
  assert.ok(!draft.files['tests/test_publico.py'].includes('NO_PUBLICAR'));
  assert.match(draft.id, /^ia_[a-z0-9]+$/);
});
test('project drafts retain every module, acceptance criterion and evaluator', () => {
  const draft = generatedDraft(project, projectInput);
  assert.equal(draft.files['model.py'], project.proyecto.archivos['model.py']);
  assert.equal(draft.files['main.py'], project.proyecto.archivos['main.py']);
  assert.deepEqual(draft.briefing?.queSeEspera, project.proyecto.criterios_aceptacion);
  assert.equal(draft.filesCount, 2);
  assert.equal(draft.criteriaCount, 1);
  assert.ok(draft.files['tests/test_publico.py'].includes('self.assertIs(resultado.get("exito"), True'));
});
test('incomplete or unsafe generated content is rejected instead of published', () => {
  assert.throws(() => generatedDraft({ success: false }, classicInput), { status: 502 });
  assert.throws(() => generatedDraft({ success: true, reto: {} }, classicInput), { status: 502 });
  assert.throws(() => generatedDraft({ success: true, proyecto: { ...project.proyecto, archivos: { ...project.proyecto.archivos, '../escape.py': 'pass' } } }, projectInput), { status: 502 });
  assert.throws(() => generatedDraft({ success: true, proyecto: { ...project.proyecto, test_runner: '' } }, projectInput), { status: 502 });
});
