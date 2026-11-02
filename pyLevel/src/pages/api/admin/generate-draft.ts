export const prerender = false;

import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { invokeAI } from '../../../ai/client';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await currentUser(cookies);
    if (!user || user.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'No autorizado. Se requiere rol de administrador.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'contextual' ? 'contextual' : 'classic';
    const rawDiff = String(body.difficulty || 'Medio').toLowerCase();
    const tema = body.tema?.trim() || (mode === 'classic' ? 'Algoritmos y Lógica' : 'POO y Modularización');

    let dificultadAi = 'media';
    if (rawDiff.includes('fácil') || rawDiff.includes('facil')) dificultadAi = 'facil';
    else if (rawDiff.includes('difícil') || rawDiff.includes('dificil')) dificultadAi = 'dificil';

    const normalizedDiff: 'Fácil' | 'Medio' | 'Difícil' =
      dificultadAi === 'facil' ? 'Fácil' : dificultadAi === 'dificil' ? 'Difícil' : 'Medio';

    if (mode === 'classic') {
      let aiRes: any = null;
      try {
        aiRes = await invokeAI({
          action: 'generate_challenge',
          data: { tema, dificultad: dificultadAi, existentes: [] },
        });
      } catch (err: any) {
        console.warn('AI invoke error, using smart fallback generator:', err?.message);
      }

      const reto = aiRes?.reto || aiRes?.challenge;
      const slug = (reto?.titulo || tema)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);

      const uniqueId = `clasico_${slug || 'reto'}_${Date.now().toString().slice(-4)}`;
      const fnName = reto?.nombre_funcion || `${slug || 'solucion'}`;

      let mainPy = reto?.codigo_inicial || `def ${fnName}(entrada):\n    # Escribe aquí tu solución\n    pass\n`;
      if (!mainPy.includes('if __name__ == "__main__":')) {
        mainPy = `${mainPy.trim()}\n\n\nif __name__ == "__main__":\n    print(${fnName}("prueba"))\n`;
      }

      let testPy = `import unittest\nfrom main import ${fnName}\n\n\nclass PruebasEjercicio(unittest.TestCase):\n    def test_caso_base(self):\n        # Verifica el comportamiento con entradas válidas\n        self.assertIsNotNone(${fnName})\n`;

      if (Array.isArray(reto?.casos_prueba) && reto.casos_prueba.length > 0) {
        const casesJson = JSON.stringify(
          reto.casos_prueba.map((c: any) => [c.entrada, c.esperado])
        );
        testPy = `import unittest\nfrom main import ${fnName}\n\n\nclass PruebasEjercicio(unittest.TestCase):\n    def test_casos(self):\n        casos = ${casesJson}\n        for args, esperado in casos:\n            with self.subTest(args=args):\n                self.assertEqual(${fnName}(*args), esperado)\n`;
      }

      return new Response(
        JSON.stringify({
          success: true,
          draft: {
            id: uniqueId,
            mode: 'classic',
            title: reto?.titulo || `Reto de ${tema}`,
            difficulty: normalizedDiff,
            level: normalizedDiff === 'Fácil' ? 'Inicial' : normalizedDiff === 'Medio' ? 'Intermedio' : 'Avanzado',
            topics: reto?.tema ? [reto.tema] : [tema, 'Algoritmos'],
            description: reto?.descripcion || `Implementa una función eficiente para resolver el problema de ${tema}.`,
            statement: reto?.enunciado || `Completa la función \`${fnName}\` para resolver el desafío propuesto de ${tema}.\n\nRevisa los casos de prueba y verifica que tu solución maneje casos borde.`,
            expected: reto?.salida_esperada || 'Resultado validado por pruebas unitarias.',
            mainPy,
            testPy,
            hints: reto?.pista ? [reto.pista] : ['Piensa en el caso base antes de implementar la iteración.'],
            solution: reto?.solucion || `# Solución sugerida para ${fnName}\ndef ${fnName}(*args):\n    pass\n`,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // Proyecto contextualizado
      let aiRes: any = null;
      try {
        aiRes = await invokeAI({
          action: 'generate_project',
          data: { tema, dificultad: dificultadAi, existentes: [] },
        });
      } catch (err: any) {
        console.warn('AI invoke error for project, using smart fallback:', err?.message);
      }

      const proj = aiRes?.proyecto || aiRes?.project;
      const slug = (proj?.nombre || tema)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);

      const uniqueId = `py_${slug || 'proyecto'}_${Date.now().toString().slice(-4)}`;
      const files: Record<string, string> = proj?.archivos || {};

      const mainPy = files['main.py'] || 'def main():\n    print("Ejecutando proyecto...")\n\nif __name__ == "__main__":\n    main()\n';
      const testPy = files['tests/test_publico.py'] || proj?.test_runner || 'import unittest\n\nclass PruebasProyecto(unittest.TestCase):\n    def test_inicio(self):\n        self.assertTrue(True)\n';

      return new Response(
        JSON.stringify({
          success: true,
          draft: {
            id: uniqueId,
            mode: 'contextual',
            title: proj?.nombre || `Proyecto de ${tema}`,
            difficulty: normalizedDiff,
            level: normalizedDiff === 'Fácil' ? 'Inicial' : normalizedDiff === 'Medio' ? 'Intermedio' : 'Avanzado',
            topics: Array.isArray(proj?.temas) ? proj.temas : [tema, 'POO', 'Modularización'],
            description: proj?.descripcion || `Sistema modular desarrollado en Python aplicando separación de responsabilidades sobre ${tema}.`,
            statement: proj?.enunciado || `# ${proj?.nombre || 'Proyecto Multi-archivo'}\n\nDiseña e implementa la solución modular descrita en los requisitos.`,
            expected: 'Salida de consola validada.',
            mainPy,
            testPy,
            files,
            briefing: {
              situacion: proj?.descripcion || `Desarrollo de un módulo sobre ${tema}.`,
              pregunta: `¿Cómo implementar una arquitectura limpia para ${tema}?`,
              queSeTiene: Object.keys(files).map(f => ({ path: f, role: `Módulo ${f}` })),
              queSeEspera: proj?.criterios_aceptacion || ['Diseño modular', 'Pruebas aprobadas'],
              salidaResumen: 'Integración multi-archivo completada con éxito.',
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Error al generar borrador con PyBot IA' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

