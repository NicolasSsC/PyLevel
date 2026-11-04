import { randomUUID } from 'node:crypto';
import { validateExercise } from './exercise-store.ts';
import { AdminError, type AdminExercise } from './types.ts';

export function generationInput(body: any) {
  if (!body || !['classic', 'contextual'].includes(body.mode)) throw new AdminError('Selecciona una modalidad válida.');
  if (typeof body.tema !== 'string' || !body.tema.trim() || body.tema.length > 500) throw new AdminError('Escribe un tema de hasta 500 caracteres.');
  if (!['Fácil', 'Medio', 'Difícil'].includes(body.difficulty)) throw new AdminError('Selecciona una dificultad válida.');
  return { mode: body.mode as AdminExercise['mode'], tema: body.tema.trim(), difficulty: body.difficulty as AdminExercise['difficulty'] };
}

function pythonJSON(value: unknown) { return `json.loads(${JSON.stringify(JSON.stringify(value))})`; }

// Convert the generator's existing Spanish payloads to the persisted catalog format.
// Generated Python is stored as text; it is never executed by the application server.
export function generatedDraft(result: any, input: ReturnType<typeof generationInput>): AdminExercise {
  if (!result?.success) throw new AdminError('No se pudo generar el borrador. Inténtalo nuevamente.', 502);
  const value = input.mode === 'classic' ? result.reto : result.proyecto;
  if (!value || typeof value !== 'object') throw new AdminError('El generador no devolvió un ejercicio válido. Inténtalo nuevamente.', 502);
  const base = {
    id: `ia_${randomUUID().replaceAll('-', '')}`, mode: input.mode,
    title: value.titulo || value.nombre, description: value.descripcion, statement: value.enunciado,
    difficulty: input.difficulty, level: input.difficulty === 'Fácil' ? 'Inicial' : input.difficulty === 'Medio' ? 'Intermedio' : 'Avanzado',
    topics: Array.isArray(value.temas) ? value.temas : [value.tema || input.tema],
    hints: Array.isArray(value.pistas) ? value.pistas : [], solution: typeof value.solucion === 'string' ? value.solucion : '',
    expected: '', is_active: true, isAI: true,
  };
  try {
    if (input.mode === 'classic') {
      if (typeof value.nombre_funcion !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.nombre_funcion) || !Array.isArray(value.casos_prueba)) throw new Error('Casos inválidos');
      const cases = value.casos_prueba.filter((item: any) => item?.visible !== false);
      if (!cases.length || cases.length > 100 || cases.some((item: any) => !Array.isArray(item?.entrada) || !Object.hasOwn(item, 'esperado'))) throw new Error('Casos inválidos');
      const tests = `import json\nimport unittest\nfrom main import ${value.nombre_funcion}\n\nclass TestCasosPublicos(unittest.TestCase):\n` + cases.map((item: any, i: number) =>
        `    def test_caso_${i + 1}(self):\n        argumentos, esperado = ${pythonJSON([item.entrada, item.esperado])}\n        self.assertEqual(${value.nombre_funcion}(*argumentos), esperado)\n`).join('\n');
      return validateExercise({ ...base, files: { 'main.py': value.codigo_inicial, 'tests/test_publico.py': tests }, testCasesCount: cases.length });
    }
    if (!value.archivos || typeof value.archivos !== 'object' || Array.isArray(value.archivos) || typeof value.test_runner !== 'string' || !value.test_runner.trim()) throw new Error('Archivos inválidos');
    const criteria = value.criterios_aceptacion;
    if (!Array.isArray(criteria) || !criteria.length || criteria.some(item => typeof item !== 'string')) throw new Error('Criterios inválidos');
    const tests = `import contextlib\nimport io\nimport json\nimport unittest\n\nclass TestCriteriosProyecto(unittest.TestCase):\n    def test_criterios(self):\n        salida = io.StringIO()\n        with contextlib.redirect_stdout(salida):\n            exec(${JSON.stringify(value.test_runner)}, {"__name__": "__main__"})\n        lineas = [linea for linea in salida.getvalue().splitlines() if linea.strip()]\n        self.assertTrue(lineas, "El evaluador no devolvió resultados")\n        resultado = json.loads(lineas[-1])\n        self.assertIs(resultado.get("exito"), True, json.dumps(resultado, ensure_ascii=False))\n`;
    const files = { ...value.archivos, 'tests/test_publico.py': tests };
    return validateExercise({ ...base, files, filesCount: Object.keys(value.archivos).length, criteriaCount: criteria.length,
      briefing: { situacion: value.descripcion, pregunta: value.enunciado, queSeTiene: Object.keys(value.archivos).map(path => ({ path, role: path === 'main.py' ? 'Punto de entrada' : 'Módulo del proyecto' })), queSeEspera: criteria, salidaResumen: '' } });
  } catch {
    throw new AdminError('El borrador recibido está incompleto o contiene archivos no admitidos. Intenta generar otro.', 502);
  }
}
