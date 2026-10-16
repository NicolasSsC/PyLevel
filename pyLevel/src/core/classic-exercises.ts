import type { Exercise } from './catalog';

export type ClassicExercise = Exercise & { hints: string[]; solution: string };

function practiceFiles(name: string, starter: string, examples: string[], cases: string, extra = '') {
  return {
    'main.py': `${starter}\n\n\nif __name__ == "__main__":\n${examples.map(example => `    print(${example})`).join('\n')}\n`,
    'tests/test_publico.py': `import unittest\nfrom main import ${name}\n\n\nclass PruebasEjercicio(unittest.TestCase):\n    def test_casos(self):\n        casos = ${cases}\n        for argumentos, esperado in casos:\n            with self.subTest(argumentos=argumentos):\n                self.assertEqual(${name}(*argumentos), esperado)\n${extra}`,
  };
}

export const classic: ClassicExercise[] = [
  {
    id: 'clasico_operadores_logicos', title: '¿Puede acceder?', level: 'Inicial', difficulty: 'Fácil',
    solution: 'def puede_acceder(tiene_entrada, es_invitado, esta_bloqueado):\n    return (tiene_entrada or es_invitado) and not esta_bloqueado\n',
    topics: ['Operadores lógicos', 'Booleanos'],
    description: 'Combina and, or y not para decidir si una persona puede acceder.',
    statement: 'Completa puede_acceder(tiene_entrada, es_invitado, esta_bloqueado). Los tres argumentos son booleanos.\n\nUna persona puede acceder si tiene entrada o es invitada, siempre que no esté bloqueada. Devuelve True o False usando operadores lógicos.\n\nEjemplos:\n• Entrada válida y sin bloqueo → True.\n• Invitación y sin bloqueo → True.\n• Con bloqueo, aunque tenga entrada → False.',
    expected: 'True\nTrue\nFalse\n',
    hints: ['Agrupa primero las dos formas de obtener permiso: tener entrada o ser invitado. Después combina ese resultado con la ausencia de bloqueo.'],
    files: practiceFiles('puede_acceder', 'def puede_acceder(tiene_entrada, es_invitado, esta_bloqueado):\n    # Completa la expresión lógica.\n    pass', ['puede_acceder(True, False, False)', 'puede_acceder(False, True, False)', 'puede_acceder(True, True, True)'], '[((a, b, c), (a or b) and not c) for a in (False, True) for b in (False, True) for c in (False, True)]'),
  },
  {
    id: 'clasico_sumar_pares', title: 'Sumar números pares', level: 'Inicial', difficulty: 'Fácil',
    solution: 'def sumar_pares(numeros):\n    total = 0\n    for numero in numeros:\n        if numero % 2 == 0:\n            total += numero\n    return total\n',
    topics: ['Bucles', 'For', 'Listas'],
    description: 'Utiliza un bucle for para sumar los números pares de una lista.',
    statement: 'Completa sumar_pares(numeros). Recibe una lista de enteros y devuelve la suma de los números pares utilizando un bucle for.\n\nIncluye los pares negativos. Si la lista está vacía o no contiene pares, devuelve 0. No modifiques la lista original.\n\nEjemplos:\n• [1, 2, 3, 4, 5, 6] → 12\n• [-4, -1, 2] → -2\n• [] → 0',
    expected: '12\n-2\n0\n',
    hints: ['Crea un acumulador que comience en 0. En cada vuelta del for, comprueba si el resto de dividir el número entre 2 es cero antes de sumarlo.'],
    files: practiceFiles('sumar_pares', 'def sumar_pares(numeros):\n    # Recorre la lista con un bucle for.\n    pass', ['sumar_pares([1, 2, 3, 4, 5, 6])', 'sumar_pares([-4, -1, 2])', 'sumar_pares([])'], '[(([1, 2, 3, 4, 5, 6],), 12), (([-4, -1, 2],), -2), (([],), 0), (([1, 3, 5],), 0), (([2, 2, 0],), 4)]', '\n    def test_conserva_lista(self):\n        numeros = [4, 1, 2]\n        sumar_pares(numeros)\n        self.assertEqual(numeros, [4, 1, 2])\n'),
  },
  {
    id: 'clasico_condicional_if', title: 'Positivo, negativo o cero', level: 'Inicial', difficulty: 'Fácil',
    solution: 'def clasificar_numero(numero):\n    if numero > 0:\n        return "positivo"\n    elif numero < 0:\n        return "negativo"\n    else:\n        return "cero"\n',
    topics: ['Condicionales', 'If'],
    description: 'Clasifica un número utilizando if, elif y else.',
    statement: 'Completa clasificar_numero(numero). Recibe un número entero y devuelve una de estas cadenas exactas: "positivo", "negativo" o "cero".\n\nUtiliza if, elif y else para distinguir los tres casos. Devuelve la cadena desde la función; las llamadas de ejemplo se encargan de imprimirla.\n\nEjemplos:\n• 8 → "positivo"\n• -3 → "negativo"\n• 0 → "cero"',
    expected: 'positivo\nnegativo\ncero\n',
    hints: ['Compara el número con 0. Si no es mayor ni menor que cero, ya conoces el tercer caso. Recuerda devolver el resultado con return.'],
    files: practiceFiles('clasificar_numero', 'def clasificar_numero(numero):\n    # Distingue los tres casos con if, elif y else.\n    pass', ['clasificar_numero(8)', 'clasificar_numero(-3)', 'clasificar_numero(0)'], '[((8,), "positivo"), ((-3,), "negativo"), ((0,), "cero"), ((1,), "positivo"), ((-1,), "negativo")]'),
  },
  {
    id: 'clasico_bubble_sort', title: 'Ordenar con Bubble Sort', level: 'Intermedio', difficulty: 'Medio',
    solution: 'def bubble_sort(numeros):\n    resultado = numeros.copy()\n    for pasada in range(len(resultado) - 1):\n        hubo_cambios = False\n        for j in range(len(resultado) - 1 - pasada):\n            if resultado[j] > resultado[j + 1]:\n                resultado[j], resultado[j + 1] = resultado[j + 1], resultado[j]\n                hubo_cambios = True\n        if not hubo_cambios:\n            break\n    return resultado\n',
    topics: ['Bucles', 'Listas', 'Ordenamiento', 'Bubble Sort'],
    description: 'Ordena una lista comparando e intercambiando elementos vecinos.',
    statement: 'Completa bubble_sort(numeros). Devuelve una nueva lista con los enteros ordenados de menor a mayor mediante el algoritmo Bubble Sort.\n\nCompara elementos vecinos e intercámbialos si están en el orden incorrecto. Repite las pasadas hasta ordenar la lista. No utilices sorted() ni list.sort(). Conserva la lista original.\n\nDebe funcionar con listas vacías, números negativos y valores repetidos.\n\nEjemplos:\n• [5, 1, 4, 2, 8] → [1, 2, 4, 5, 8]\n• [3, -1, 3] → [-1, 3, 3]\n• [] → []',
    expected: '[1, 2, 4, 5, 8]\n[-1, 3, 3]\n[]\n',
    hints: ['Trabaja sobre una copia de la lista. En cada pasada compara la posición j con j + 1. Después de una pasada completa, el mayor elemento pendiente queda al final.'],
    files: practiceFiles('bubble_sort', 'def bubble_sort(numeros):\n    # Ordena una copia mediante intercambios de vecinos.\n    pass', ['bubble_sort([5, 1, 4, 2, 8])', 'bubble_sort([3, -1, 3])', 'bubble_sort([])'], '[(([5, 1, 4, 2, 8],), [1, 2, 4, 5, 8]), (([3, -1, 3],), [-1, 3, 3]), (([],), []), (([7],), [7]), (([1, 2, 3],), [1, 2, 3]), (([4, 3, 2, 1],), [1, 2, 3, 4])]', '\n    def test_conserva_lista(self):\n        numeros = [3, 1, 2]\n        resultado = bubble_sort(numeros)\n        self.assertEqual(numeros, [3, 1, 2])\n        self.assertIsNot(resultado, numeros)\n'),
  },
  {
    id: 'clasico_lambda', title: 'Transformar con una lambda', level: 'Intermedio', difficulty: 'Medio',
    solution: 'def cuadrados(numeros):\n    return list(map(lambda numero: numero ** 2, numeros))\n',
    topics: ['Lambdas', 'Funciones', 'Listas'],
    description: 'Combina una función lambda y map para calcular cuadrados.',
    statement: 'Completa cuadrados(numeros). Recibe una lista de enteros y devuelve una nueva lista con el cuadrado de cada valor, respetando el orden original.\n\nUtiliza una expresión lambda junto con map y convierte el resultado en una lista. En Python, lambda permite definir una función anónima de una sola expresión.\n\nNo modifiques la lista recibida. Para una lista vacía, devuelve [].\n\nEjemplos:\n• [1, 2, 3] → [1, 4, 9]\n• [-3, 0, 2] → [9, 0, 4]\n• [] → []',
    expected: '[1, 4, 9]\n[9, 0, 4]\n[]\n',
    hints: ['Una lambda tiene la forma lambda valor: expresión. map aplica esa función a cada elemento; list convierte su resultado en la lista que debes devolver.'],
    files: practiceFiles('cuadrados', 'def cuadrados(numeros):\n    # Usa una lambda con map y devuelve una lista.\n    pass', ['cuadrados([1, 2, 3])', 'cuadrados([-3, 0, 2])', 'cuadrados([])'], '[(([1, 2, 3],), [1, 4, 9]), (([-3, 0, 2],), [9, 0, 4]), (([],), []), (([2, 2],), [4, 4])]', '\n    def test_conserva_lista(self):\n        numeros = [-2, 3]\n        resultado = cuadrados(numeros)\n        self.assertEqual(numeros, [-2, 3])\n        self.assertIsInstance(resultado, list)\n'),
  },
];
