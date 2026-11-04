import type { AdminExercise } from './types';
import { adminRequest } from './client-api';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const initial: AdminExercise[] = JSON.parse(get('admin-exercise-data').textContent || '[]');
const tbody = get<HTMLTableSectionElement>('exercises-tbody');
const rowTemplate = document.getElementById('exercise-row-template') as HTMLTemplateElement;
const modal = get<HTMLDialogElement>('exercise-modal');
const viewModal = get<HTMLDialogElement>('view-modal');
const deleteModal = get<HTMLDialogElement>('delete-modal');
const form = get<HTMLFormElement>('exercise-form');
const input = (id: string) => get<HTMLInputElement>(`form-${id}`);
const modeInput = get<HTMLSelectElement>('form-mode');
const feedback = get('admin-feedback');
const error = get('form-error-msg');
const modeFilter = get<HTMLSelectElement>('filter-mode');
const statusFilter = get<HTMLSelectElement>('filter-status');
const search = get<HTMLInputElement>('search-input');
let exercises = initial;
let editingExercise: AdminExercise | undefined;
let pendingDeleteId: string | null = null;
let draft: AdminExercise | undefined;
let generation: AbortController | null = null;
const aiPanel = get('admin-ai-panel');
const aiStatus = get('ai-draft-status');
const generateButton = get<HTMLButtonElement>('ai-generate-btn');
const fields = get<HTMLFieldSetElement>('exercise-fields');

function generationBusy(busy: boolean) {
  fields.disabled = busy;
  get<HTMLButtonElement>('modal-save-btn').disabled = busy;
  generateButton.textContent = busy ? 'Generando borrador…' : 'Generar borrador con IA';
  aiPanel.setAttribute('aria-busy', String(busy));
}
function cancelGeneration() {
  generation?.abort();
  generation = null;
  generationBusy(false);
}
function additionalFiles(files: Record<string, string>) {
  const entries = Object.entries(files).filter(([path]) => path !== 'main.py' && path !== 'tests/test_publico.py');
  get('additional-files').textContent = entries.length ? 'Revisa también los módulos y archivos adicionales del proyecto.' : '';
  get('additional-file-editors').replaceChildren(...entries.map(([path, code], index) => {
    const group = document.createElement('div'); group.className = 'form-group';
    const label = document.createElement('label'); label.textContent = path;
    const area = document.createElement('textarea'); area.className = 'admin-input code-font';
    area.id = `extra-file-${index}`;
    label.htmlFor = area.id; area.dataset.extraFile = path; area.value = code; area.rows = 6; area.spellcheck = false;
    group.append(label, area); return group;
  }));
}

function text(root: HTMLElement, selector: string, value: string) {
  root.querySelector<HTMLElement>(selector)!.textContent = value;
}

function filters() {
  const query = search.value.trim().toLocaleLowerCase('es');
  let visible = 0;
  tbody.querySelectorAll<HTMLTableRowElement>('tr').forEach(row => {
    const matches = (modeFilter.value === 'all' || row.dataset.mode === modeFilter.value)
      && (statusFilter.value === 'all' || row.dataset.status === statusFilter.value)
      && (!query || `${row.dataset.title} ${row.dataset.id} ${row.dataset.topics}`.toLocaleLowerCase('es').includes(query));
    row.hidden = !matches;
    if (matches) visible++;
  });
  const empty = get('no-results-msg');
  empty.hidden = visible > 0;
  empty.style.display = visible ? 'none' : 'block';
  empty.querySelector('p')!.textContent = exercises.length
    ? 'No se encontraron ejercicios con los filtros seleccionados.'
    : 'El catálogo está vacío. Crea el primer ejercicio.';
}

function render() {
  const rows = exercises.map(ex => {
    const row = rowTemplate.content.firstElementChild!.cloneNode(true) as HTMLTableRowElement;
    row.dataset.id = ex.id;
    row.dataset.mode = ex.mode;
    row.dataset.status = ex.is_active ? 'active' : 'inactive';
    row.dataset.title = ex.title;
    row.dataset.topics = ex.topics.join(' ');
    text(row, '.ex-title-text', ex.title);
    text(row, '.ex-id-code', `ID: ${ex.id}`);
    text(row, '.ex-desc-excerpt', ex.description);
    const mode = row.querySelector<HTMLElement>('.badge-mode')!;
    mode.className = `badge-mode ${ex.mode === 'classic' ? 'badge-classic' : 'badge-contextual'}`;
    mode.textContent = ex.mode === 'classic' ? 'Clásico' : 'Proyecto';
    const difficulty = row.querySelector<HTMLElement>('.pill-diff')!;
    difficulty.className = `pill-diff ${ex.difficulty === 'Fácil' ? 'diff-easy' : ex.difficulty === 'Medio' ? 'diff-medium' : 'diff-hard'}`;
    difficulty.textContent = ex.difficulty;
    row.querySelector('.topics-wrap')!.replaceChildren(...ex.topics.map(topic => {
      const chip = document.createElement('span');
      chip.className = 'topic-chip';
      chip.textContent = `#${topic}`;
      return chip;
    }));
    const toggle = row.querySelector<HTMLButtonElement>('.btn-toggle-status')!;
    toggle.className = `btn-toggle-status ${ex.is_active ? 'status-active' : 'status-inactive'}`;
    toggle.setAttribute('aria-pressed', String(ex.is_active));
    toggle.title = `${ex.is_active ? 'Desactivar' : 'Activar'} en el catálogo`;
    text(toggle, '.status-text', ex.is_active ? 'Activo' : 'Desactivado');
    row.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
      button.dataset.id = ex.id;
      const action = button.classList.contains('btn-view') ? 'Ver'
        : button.classList.contains('btn-edit') ? 'Editar'
        : button.classList.contains('btn-delete') ? 'Quitar' : ex.is_active ? 'Desactivar' : 'Activar';
      button.setAttribute('aria-label', `${action}: ${ex.title}`);
    });
    return row;
  });
  tbody.replaceChildren(...rows);
  get('stat-total').textContent = String(exercises.length);
  get('stat-classic').textContent = String(exercises.filter(e => e.mode === 'classic').length);
  get('stat-contextual').textContent = String(exercises.filter(e => e.mode === 'contextual').length);
  get('stat-active').textContent = String(exercises.filter(e => e.is_active).length);
  get('stat-inactive').textContent = String(exercises.filter(e => !e.is_active).length);
  filters();
}

function extras() {
  get('classic-extras').hidden = modeInput.value !== 'classic';
}

function edit(exercise?: AdminExercise) {
  cancelGeneration();
  draft = undefined;
  aiStatus.textContent = '';
  aiPanel.hidden = !!exercise;
  editingExercise = exercise;
  form.reset();
  error.textContent = '';
  get('modal-title').textContent = exercise ? `Editar Ejercicio: ${exercise.title}` : 'Crear Nuevo Ejercicio';
  input('id').value = exercise?.id ?? '';
  input('id').disabled = !!exercise;
  modeInput.value = exercise?.mode ?? 'classic';
  modeInput.disabled = !!exercise;
  input('title').value = exercise?.title ?? '';
  input('difficulty').value = exercise?.difficulty ?? 'Fácil';
  input('level').value = exercise?.level ?? 'Inicial';
  input('topics').value = exercise?.topics.join(', ') ?? '';
  input('desc').value = exercise?.description ?? '';
  input('statement').value = exercise?.statement ?? '';
  input('expected').value = exercise?.expected ?? '';
  input('main-py').value = exercise?.files['main.py'] ?? 'def resolver_problema():\n    # Escribe tu solución aquí\n    pass\n';
  input('test-py').value = exercise?.files['tests/test_publico.py'] ?? 'import unittest\nfrom main import resolver_problema\n\nclass TestCasos(unittest.TestCase):\n    def test_ejemplo(self):\n        self.assertEqual(resolver_problema(), 42)\n';
  input('hint').value = exercise?.hints[0] ?? '';
  input('solution').value = exercise?.solution ?? '';
  input('is-active').checked = exercise?.is_active ?? true;
  additionalFiles(exercise?.files ?? {});
  extras();
  modal.showModal();
}

function view(ex: AdminExercise) {
  get('view-title').textContent = ex.title;
  get('view-meta').textContent = `${ex.mode === 'classic' ? 'Desafío clásico' : 'Proyecto multi-archivo'} · ${ex.difficulty} · ${ex.level}`;
  get('view-description').textContent = ex.description;
  get('view-statement').textContent = ex.statement;
  get('view-expected').textContent = ex.expected || 'Sin salida de ejemplo.';
  get('view-files').replaceChildren(...Object.entries(ex.files).map(([name, source]) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const code = document.createElement('pre');
    summary.textContent = name;
    code.className = 'preview-code';
    code.textContent = source;
    details.append(summary, code);
    return details;
  }));
  viewModal.showModal();
}

get('btn-create-exercise').addEventListener('click', () => edit());
modal.addEventListener('close', cancelGeneration);
generateButton.addEventListener('click', async () => {
  if (editingExercise || generation) return;
  const topic = get<HTMLInputElement>('ai-draft-topic');
  const tema = topic.value.trim();
  if (!tema) { aiStatus.textContent = 'Escribe el tema del ejercicio que quieres generar.'; topic.focus(); return; }
  const controller = new AbortController();
  generation = controller;
  generationBusy(true);
  error.textContent = '';
  aiStatus.textContent = 'PyBot está preparando el borrador. Puedes cancelar cerrando este formulario.';
  const timer = window.setTimeout(() => controller.abort(), 45000);
  let prepared = false;
  try {
    const data = await adminRequest('/api/admin/exercises/generate', 'POST', {
      mode: modeInput.value, tema, difficulty: input('difficulty').value,
    }, controller.signal);
    if (generation !== controller || !modal.open) return;
    const exercise = data.exercise as AdminExercise;
    draft = exercise;
    input('id').value = exercise.id;
    input('title').value = exercise.title;
    input('desc').value = exercise.description;
    input('statement').value = exercise.statement;
    input('expected').value = exercise.expected || '';
    input('level').value = exercise.level;
    input('topics').value = exercise.topics.join(', ');
    input('main-py').value = exercise.files['main.py'];
    input('test-py').value = exercise.files['tests/test_publico.py'];
    input('hint').value = exercise.hints[0] || '';
    input('solution').value = exercise.solution || '';
    additionalFiles(exercise.files);
    aiStatus.textContent = (data.source === 'motor_local' ? 'Borrador preparado con el motor local de PyBot.' : 'Borrador preparado.') + ' Revisa el contenido y las pruebas; se publicará solo al guardar según el estado elegido.';
    prepared = true;
  } catch (problem) {
    if (generation === controller && modal.open) aiStatus.textContent = controller.signal.aborted ? 'Se agotó el tiempo de espera. Puedes volver a intentarlo.' : (problem as Error).message;
  } finally {
    window.clearTimeout(timer);
    if (generation === controller) { generation = null; generationBusy(false); if (prepared) input('title').focus(); }
  }
});
get('modal-close-btn').addEventListener('click', () => modal.close());
get('modal-cancel-btn').addEventListener('click', () => modal.close());
get('view-close').addEventListener('click', () => viewModal.close());
modeInput.addEventListener('change', extras);
modeFilter.addEventListener('change', filters);
statusFilter.addEventListener('change', filters);
search.addEventListener('input', filters);

tbody.addEventListener('click', async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-id]');
  const ex = exercises.find(e => e.id === button?.dataset.id);
  if (!button || !ex) return;
  if (button.classList.contains('btn-edit')) {
    try { const data=await adminRequest(`/api/admin/exercises/${ex.id}`); edit(data.exercise); } catch(error) { feedback.textContent=(error as Error).message; }
  }
  else if (button.classList.contains('btn-view')) view(ex);
  else if (button.classList.contains('btn-toggle-status')) {
    button.disabled=true;
    try {
      const data=await adminRequest(`/api/admin/exercises/${ex.id}`,'PUT',{version:ex.version,is_active:!ex.is_active});
      exercises=exercises.map(e=>e.id===ex.id?data.exercise:e);
      feedback.textContent=`«${ex.title}» ${data.exercise.is_active?'activado':'desactivado'}.`;
      render();
    } catch(error) { feedback.textContent=(error as Error).message; button.disabled=false; }
  } else if (button.classList.contains('btn-delete')) {
    pendingDeleteId = ex.id;
    get('delete-target-text').textContent = `«${ex.title}» se retirará del catálogo. Se conservarán sus versiones y la actividad registrada.`;
    deleteModal.showModal();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (generation) return;
  const existing = editingExercise;
  const id = existing?.id ?? input('id').value.trim();
  const title = input('title').value.trim();
  const description = input('desc').value.trim();
  const statement = input('statement').value.trim();
  if (!title || !description || !statement) {
    error.textContent = 'Completa el título, la descripción y el enunciado.';
    return;
  }
  if (!existing && exercises.some(e => e.id === id)) {
    error.textContent = 'Ya existe un ejercicio con ese identificador.';
    return;
  }
  const hint = input('hint').value.trim();
  const updated: AdminExercise = {
    ...draft,
    ...existing,
    id, title, description, statement, version: existing?.version ?? 0,
    mode: modeInput.value as AdminExercise['mode'],
    difficulty: input('difficulty').value as AdminExercise['difficulty'],
    level: input('level').value,
    topics: input('topics').value.split(',').map(t => t.trim()).filter(Boolean),
    expected: input('expected').value,
    files: { ...(existing?.files ?? draft?.files), ...Object.fromEntries([...document.querySelectorAll<HTMLTextAreaElement>('[data-extra-file]')].map(area => [area.dataset.extraFile!, area.value])), 'main.py': input('main-py').value, 'tests/test_publico.py': input('test-py').value },
    hints: [...(hint ? [hint] : []), ...((existing ?? draft)?.hints.slice(1) ?? [])],
    solution: input('solution').value,
    is_active: input('is-active').checked,
  };
  const save=get<HTMLButtonElement>('modal-save-btn');
  save.disabled=true;
  try {
    const data=await adminRequest(existing?`/api/admin/exercises/${existing.id}`:'/api/admin/exercises',existing?'PUT':'POST',updated);
    exercises=existing?exercises.map(e=>e.id===existing.id?data.exercise:e):[...exercises,data.exercise];
    feedback.textContent=`«${title}» guardado.`;
    render();modal.close();
  } catch(problem) { error.textContent=(problem as Error).message; }
  finally {save.disabled=false;}

});

get('btn-cancel-delete').addEventListener('click', () => deleteModal.close());
get('btn-confirm-delete').addEventListener('click', async () => {
  const button=get<HTMLButtonElement>('btn-confirm-delete');button.disabled=true;
  try {
    await adminRequest(`/api/admin/exercises/${pendingDeleteId}`,'DELETE');
    exercises=exercises.filter(e=>e.id!==pendingDeleteId);pendingDeleteId=null;
    feedback.textContent='Ejercicio retirado del catálogo.';render();deleteModal.close();
  } catch(error) { feedback.textContent=(error as Error).message;deleteModal.close(); }
  finally {button.disabled=false;}
});
const requestedExercise = new URLSearchParams(window.location.search).get('exercise');
if (requestedExercise && exercises.some(e => e.id === requestedExercise)) search.value = requestedExercise;
render();
