export const prerender = false;

import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/session';
import { createDbExercise, getDbExercises } from '../../../lib/exercises-db';

interface ClassicDef {
  idSuffix: string;
  title: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  level: string;
  topics: string[];
  description: string;
  statement: string;
  expected: string;
  fnName: string;
  starter: string;
  examples: string[];
  cases: string;
  hints: string[];
  solution: string;
}

interface ProjectDef {
  id: string;
  title: string;
  difficulty: 'Fácil' | 'Medio' | 'Difícil';
  level: string;
  topics: string[];
  description: string;
  statement: string;
  expected: string;
  files: Record<string, string>;
  briefing: {
    situacion: string;
    pregunta: string;
    queSeTiene: Array<{ path: string; role: string; isMain?: boolean }>;
    queSeEspera: string[];
    salidaResumen: string;
  };
}

const CLASSIC_BATCH_DEFINITIONS: ClassicDef[] = [
  {
    idSuffix: 'subcadenas',
    title: 'Contador de Ocurrencias de Subcadena',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['Cadenas', 'Búsqueda', 'Métodos'],
    description: 'Escribe una función que cuente cuántas veces aparece una subcadena en un texto, sin solapamiento.',
    statement: 'Completa `contar_subcadenas(texto, sub)`. Recibe dos cadenas de texto y retorna la cantidad de veces que `sub` aparece dentro de `texto` de forma no solapada.\n\nSi la subcadena está vacía, debe retornar 0.\n\nEjemplos:\n• "banana", "an" → 2\n• "pylevel python", "py" → 2\n• "casa", "z" → 0',
    expected: '2\n2\n0\n',
    fnName: 'contar_subcadenas',
    starter: 'def contar_subcadenas(texto: str, sub: str) -> int:\n    # Tu código aquí\n    pass',
    examples: ['contar_subcadenas("banana", "an")', 'contar_subcadenas("pylevel python", "py")', 'contar_subcadenas("casa", "z")'],
    cases: '[(("banana", "an"), 2), (("pylevel python", "py"), 2), (("casa", "z"), 0), (("aaaa", "aa"), 2), (("", "a"), 0)]',
    hints: ['Puedes utilizar el método nativo de cadenas `.count()` o recorrer la cadena verificando rebanadas (slicing).'],
    solution: 'def contar_subcadenas(texto: str, sub: str) -> int:\n    if not sub:\n        return 0\n    return texto.count(sub)\n',
  },
  {
    idSuffix: 'rotar_lista',
    title: 'Rotación Circular de Lista por K Posiciones',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['Listas', 'Slicing', 'Algoritmos'],
    description: 'Escribe una función que rote una lista hacia la derecha un número k de posiciones.',
    statement: 'Completa `rotar_lista(elementos, k)`. Recibe una lista y un entero positivo `k`, y retorna una nueva lista rotada `k` posiciones a la derecha.\n\nNo modifiques la lista original. Maneja listas vacías y valores de `k` mayores que la longitud de la lista mediante el operador módulo `%`.\n\nEjemplos:\n• [1, 2, 3, 4, 5], 2 → [4, 5, 1, 2, 3]\n• ["a", "b", "c"], 1 → ["c", "a", "b"]\n• [10], 5 → [10]',
    expected: '[4, 5, 1, 2, 3]\n[\'c\', \'a\', \'b\']\n[10]\n',
    fnName: 'rotar_lista',
    starter: 'def rotar_lista(elementos: list, k: int) -> list:\n    # Tu código aquí\n    pass',
    examples: ['rotar_lista([1, 2, 3, 4, 5], 2)', 'rotar_lista(["a", "b", "c"], 1)', 'rotar_lista([10], 5)'],
    cases: '[(([1, 2, 3, 4, 5], 2), [4, 5, 1, 2, 3]), ((["a", "b", "c"], 1), ["c", "a", "b"]), (([10], 5), [10]), (([], 3), []), (([1, 2], 0), [1, 2])]',
    hints: ['Calcula la posición efectiva de corte usando `k % len(elementos)`. Luego combina las rebanadas `[-k:]` y `[:-k]`.'],
    solution: 'def rotar_lista(elementos: list, k: int) -> list:\n    if not elementos:\n        return []\n    paso = k % len(elementos)\n    if paso == 0:\n        return list(elementos)\n    return elementos[-paso:] + elementos[:-paso]\n',
  },
  {
    idSuffix: 'frecuencia_palabras',
    title: 'Analizador de Frecuencia de Palabras',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['Diccionarios', 'Cadenas', 'Conteo'],
    description: 'Cuenta la frecuencia de cada palabra en un texto, ignorando mayúsculas y minúsculas.',
    statement: 'Completa `contar_palabras(texto)`. Recibe una cadena de texto y retorna un diccionario donde las claves sean las palabras en minúsculas y los valores la cantidad de apariciones.\n\nSepara las palabras por espacios en blanco con `.split()`. Si la cadena está vacía, devuelve un diccionario vacío.\n\nEjemplos:\n• "hola mundo hola" → {"hola": 2, "mundo": 1}\n• "Python es genial" → {"python": 1, "es": 1, "genial": 1}',
    expected: "{'hola': 2, 'mundo': 1}\n{'python': 1, 'es': 1, 'genial': 1}\n",
    fnName: 'contar_palabras',
    starter: 'def contar_palabras(texto: str) -> dict:\n    # Tu código aquí\n    pass',
    examples: ['contar_palabras("hola mundo hola")', 'contar_palabras("Python es genial")'],
    cases: '[(("hola mundo hola",), {"hola": 2, "mundo": 1}), (("Python es genial",), {"python": 1, "es": 1, "genial": 1}), (("",), {}), (("test test test",), {"test": 3})]',
    hints: ['Pasa el texto a minúsculas con `.lower()`, divídelo en palabras con `.split()` y acumula en un diccionario o `collections.defaultdict`.'],
    solution: 'def contar_palabras(texto: str) -> dict:\n    frecuencias = {}\n    for palabra in texto.lower().split():\n        frecuencias[palabra] = frecuencias.get(palabra, 0) + 1\n    return frecuencias\n',
  },
  {
    idSuffix: 'es_primo',
    title: 'Verificador de Números Primos',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['Matemáticas', 'Condicionales', 'Bucles'],
    description: 'Determina si un número entero positivo es un número primo.',
    statement: 'Completa `es_primo(n)`. Recibe un número entero `n` y retorna `True` si es primo o `False` en caso contrario.\n\nRecuerda que los números menores o iguales a 1 no son primos. El 2 es el único primo par.\n\nEjemplos:\n• 7 → True\n• 4 → False\n• 1 → False\n• 2 → True',
    expected: 'True\nFalse\nFalse\nTrue\n',
    fnName: 'es_primo',
    starter: 'def es_primo(n: int) -> bool:\n    # Tu código aquí\n    pass',
    examples: ['es_primo(7)', 'es_primo(4)', 'es_primo(1)', 'es_primo(2)'],
    cases: '[((7,), True), ((4,), False), ((1,), False), ((2,), True), ((17,), True), ((25,), False), ((-5,), False)]',
    hints: ['Para optimizar, solo necesitas probar divisores impares desde 3 hasta la raíz cuadrada de n (`int(n**0.5) + 1`).'],
    solution: 'def es_primo(n: int) -> bool:\n    if n <= 1:\n        return False\n    if n == 2:\n        return True\n    if n % 2 == 0:\n        return False\n    for d in range(3, int(n**0.5) + 1, 2):\n        if n % d == 0:\n            return False\n    return True\n',
  },
  {
    idSuffix: 'eliminar_duplicados',
    title: 'Deduplicación Preservando el Orden',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['Conjuntos', 'Listas', 'Eficiencia'],
    description: 'Elimina los elementos duplicados de una lista conservando el orden de su primera aparición.',
    statement: 'Completa `eliminar_duplicados(elementos)`. Recibe una lista y retorna una nueva lista con los mismos elementos sin repeticiones, manteniendo el orden original.\n\nNo utilices únicamente `list(set(elementos))` ya que los conjuntos no garantizan el orden en versiones anteriores.\n\nEjemplos:\n• [1, 2, 2, 3, 1, 4] → [1, 2, 3, 4]\n• ["a", "b", "a"] → ["a", "b"]\n• [] → []',
    expected: '[1, 2, 3, 4]\n[\'a\', \'b\']\n[]\n',
    fnName: 'eliminar_duplicados',
    starter: 'def eliminar_duplicados(elementos: list) -> list:\n    # Tu código aquí\n    pass',
    examples: ['eliminar_duplicados([1, 2, 2, 3, 1, 4])', 'eliminar_duplicados(["a", "b", "a"])', 'eliminar_duplicados([])'],
    cases: '[(([1, 2, 2, 3, 1, 4],), [1, 2, 3, 4]), ((["a", "b", "a"],), ["a", "b"]), (([],), []), (([5, 5, 5],), [5])]',
    hints: ['Utiliza un conjunto auxiliar `vistos = set()` para comprobar en tiempo O(1) si un elemento ya fue agregado a la lista resultante.'],
    solution: 'def eliminar_duplicados(elementos: list) -> list:\n    vistos = set()\n    resultado = []\n    for item in elementos:\n        if item not in vistos:\n            vistos.add(item)\n            resultado.append(item)\n    return resultado\n',
  },
  {
    idSuffix: 'busqueda_binaria',
    title: 'Búsqueda Binaria en Arreglo Ordenado',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['Algoritmos', 'Búsqueda', 'Complejidad'],
    description: 'Implementa el algoritmo de búsqueda binaria para localizar el índice de un elemento en O(log n).',
    statement: 'Completa `busqueda_binaria(arreglo, objetivo)`. Recibe una lista ordenada de enteros y un valor `objetivo` a buscar. Debe retornar el índice donde se encuentra el elemento, o `-1` si no existe en la lista.\n\nEjemplos:\n• [1, 3, 5, 7, 9, 11], 7 → 3\n• [1, 3, 5, 7, 9, 11], 2 → -1\n• [], 5 → -1',
    expected: '3\n-1\n-1\n',
    fnName: 'busqueda_binaria',
    starter: 'def busqueda_binaria(arreglo: list, objetivo: int) -> int:\n    # Tu código aquí\n    pass',
    examples: ['busqueda_binaria([1, 3, 5, 7, 9, 11], 7)', 'busqueda_binaria([1, 3, 5, 7, 9, 11], 2)', 'busqueda_binaria([], 5)'],
    cases: '[(([1, 3, 5, 7, 9, 11], 7), 3), (([1, 3, 5, 7, 9, 11], 2), -1), (([], 5), -1), (([10], 10), 0), (([2, 4, 6, 8], 8), 3)]',
    hints: ['Mantén dos punteros `inicio = 0` y `fin = len(arreglo) - 1`. En cada iteración calcula el punto medio `medio = (inicio + fin) // 2`.'],
    solution: 'def busqueda_binaria(arreglo: list, objetivo: int) -> int:\n    inicio, fin = 0, len(arreglo) - 1\n    while inicio <= fin:\n        medio = (inicio + fin) // 2\n        if arreglo[medio] == objetivo:\n            return medio\n        elif arreglo[medio] < objetivo:\n            inicio = medio + 1\n        else:\n            fin = medio - 1\n    return -1\n',
  },
  {
    idSuffix: 'parentesis_balanceados',
    title: 'Validador de Paréntesis Balanceados',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['Pilas', 'Estructuras de Datos', 'Validación'],
    description: 'Verifica si una cadena que contiene (), [], {} está correctamente balanceada utilizando una pila.',
    statement: 'Completa `parentesis_validos(cadena)`. Recibe una cadena compuesta únicamente por los caracteres `(`, `)`, `[`, `]`, `{`, `}` y retorna `True` si los pares de apertura y cierre coinciden y se anidan debidamente, o `False` en caso contrario.\n\nEjemplos:\n• "()[]{}" → True\n• "([{}])" → True\n• "(]" → False\n• "([)]" → False',
    expected: 'True\nTrue\nFalse\nFalse\n',
    fnName: 'parentesis_validos',
    starter: 'def parentesis_validos(cadena: str) -> bool:\n    # Tu código aquí\n    pass',
    examples: ['parentesis_validos("()[]{}")', 'parentesis_validos("([{}])")', 'parentesis_validos("(]")', 'parentesis_validos("([)]")'],
    cases: '[(("()[]{}",), True), (("([{}])",), True), (("(]",), False), (("([)]",), False), (("",), True), (("((((",), False), (("))",), False)]',
    hints: ['Utiliza una lista como pila (LIFO). Inserta los caracteres de apertura y cuando encuentres uno de cierre verifica que coincida con el tope.'],
    solution: 'def parentesis_validos(cadena: str) -> bool:\n    pila = []\n    parejas = {")": "(", "]": "[", "}": "{"}\n    for caracter in cadena:\n        if caracter in parejas.values():\n            pila.append(caracter)\n        elif caracter in parejas:\n            if not pila or pila.pop() != parejas[caracter]:\n                return False\n    return len(pila) == 0\n',
  },
  {
    idSuffix: 'transponer_matriz',
    title: 'Transposición de Matriz Bidimensional',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['Matrices', 'List Comprehensions', 'Algoritmos'],
    description: 'Calcula la matriz transpuesta intercambiando filas por columnas en una matriz rectangular.',
    statement: 'Completa `transponer_matriz(matriz)`. Recibe una lista de listas que representa una matriz de dimensiones M x N y retorna una nueva matriz N x M con las filas convertidas en columnas.\n\nEjemplos:\n• [[1, 2, 3], [4, 5, 6]] → [[1, 4], [2, 5], [3, 6]]\n• [[1]] → [[1]]\n• [] → []',
    expected: '[[1, 4], [2, 5], [3, 6]]\n[[1]]\n[]\n',
    fnName: 'transponer_matriz',
    starter: 'def transponer_matriz(matriz: list) -> list:\n    # Tu código aquí\n    pass',
    examples: ['transponer_matriz([[1, 2, 3], [4, 5, 6]])', 'transponer_matriz([[1]])', 'transponer_matriz([])'],
    cases: '[(([[1, 2, 3], [4, 5, 6]],), [[1, 4], [2, 5], [3, 6]]), (([[1]],), [[1]]), (([],), []), (([[1, 2], [3, 4]],), [[1, 3], [2, 4]])]',
    hints: ['Puedes resolverlo con un list comprehension anidado `[[fila[col] for fila in matriz] for col in range(len(matriz[0]))]` o con `zip(*matriz)`.'],
    solution: 'def transponer_matriz(matriz: list) -> list:\n    if not matriz or not matriz[0]:\n        return []\n    return [list(columna) for columna in zip(*matriz)]\n',
  },
  {
    idSuffix: 'aplanar_lista',
    title: 'Aplanamiento Recursivo de Listas Anidadas',
    difficulty: 'Difícil',
    level: 'Avanzado',
    topics: ['Recursión', 'Listas', 'Estructuras'],
    description: 'Transforma una lista con múltiples niveles de anidación arbitraria en una lista unidimensional.',
    statement: 'Completa `aplanar_lista(anidada)`. Recibe una lista que puede contener enteros u otras sublistas anidadas a cualquier profundidad, y retorna una lista unidimensional continua con todos los elementos en orden.\n\nEjemplos:\n• [1, [2, [3, 4], 5], 6] → [1, 2, 3, 4, 5, 6]\n• [[1], [2], [3]] → [1, 2, 3]\n• [] → []',
    expected: '[1, 2, 3, 4, 5, 6]\n[1, 2, 3]\n[]\n',
    fnName: 'aplanar_lista',
    starter: 'def aplanar_lista(anidada: list) -> list:\n    # Tu código aquí\n    pass',
    examples: ['aplanar_lista([1, [2, [3, 4], 5], 6])', 'aplanar_lista([[1], [2], [3]])', 'aplanar_lista([])'],
    cases: '[(([1, [2, [3, 4], 5], 6],), [1, 2, 3, 4, 5, 6]), (([[1], [2], [3]],), [1, 2, 3]), (([],), []), (([1, 2, 3],), [1, 2, 3]), (([[[]]],), [])]',
    hints: ['Itera sobre cada elemento: si `isinstance(elemento, list)`, llama recursivamente a la función; de lo contrario agrégalo a la lista plana.'],
    solution: 'def aplanar_lista(anidada: list) -> list:\n    resultado = []\n    for item in anidada:\n        if isinstance(item, list):\n            resultado.extend(aplanar_lista(item))\n        else:\n            resultado.append(item)\n    return resultado\n',
  },
  {
    idSuffix: 'potencia_rapida',
    title: 'Exponenciación Binaria Rápida O(log b)',
    difficulty: 'Difícil',
    level: 'Avanzado',
    topics: ['Algoritmos', 'Matemáticas', 'Recursión'],
    description: 'Calcula la potencia a^b en tiempo logarítmico dividiendo el exponente sucesivamente entre 2.',
    statement: 'Completa `potencia_rapida(base, exponente)`. Calcula `base` elevado a la potencia `exponente` (entero no negativo) en tiempo $O(\\log n)$.\n\nNo utilices el operador de lenguaje `**` ni la función nativa `pow()` dentro de la lógica principal.\n\nEjemplos:\n• 2, 10 → 1024\n• 3, 5 → 243\n• 5, 0 → 1',
    expected: '1024\n243\n1\n',
    fnName: 'potencia_rapida',
    starter: 'def potencia_rapida(base: int, exponente: int) -> int:\n    # Tu código aquí (sin usar ** ni pow)\n    pass',
    examples: ['potencia_rapida(2, 10)', 'potencia_rapida(3, 5)', 'potencia_rapida(5, 0)'],
    cases: '[((2, 10), 1024), ((3, 5), 243), ((5, 0), 1), ((7, 2), 49), ((1, 100), 1)]',
    hints: ['Si el exponente es par, `a^b = (a^(b/2))^2`. Si es impar, `a^b = a * a^(b-1)`. Esto reduce la complejidad a logarítmica.'],
    solution: 'def potencia_rapida(base: int, exponente: int) -> int:\n    if exponente == 0:\n        return 1\n    resultado = 1\n    b = base\n    exp = exponente\n    while exp > 0:\n        if exp % 2 == 1:\n            resultado *= b\n        b *= b\n        exp //= 2\n    return resultado\n',
  },
];

const CONTEXTUAL_BATCH_DEFINITIONS: ProjectDef[] = [
  {
    id: '10_sistema_inventario',
    title: 'Sistema Modular de Inventario de Tienda',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['POO', 'Modularización', 'Inventarios'],
    description: 'Diseña una arquitectura modular con clases Producto e Inventario para registrar artículos, controlar stock y calcular valor total.',
    statement: '# Proyecto 10 — Sistema Modular de Inventario de Tienda\n\nConstruye un sistema orientado a objetos compuesto por `producto.py` y `inventario.py`. Permite agregar existencias, actualizar precios y calcular el valor del stock.',
    expected: '=== INVENTARIO CENTRAL ===\nTotal productos: 3\nValor total inventario: $145.00\nStock de Teclado: 10\n',
    briefing: {
      situacion: 'Una tienda de suministros necesita migrar su control manual de artículos a un módulo Python desacoplado y seguro.',
      pregunta: '¿Cómo modularizar la entidad Producto y el controlador Inventario garantizando encapsulación y pruebas automáticas?',
      queSeTiene: [
        { path: 'producto.py', role: 'Clase Producto con atributos id, nombre, precio y stock' },
        { path: 'inventario.py', role: 'Clase Inventario con métodos agregar, buscar y calcular_total' },
        { path: 'main.py', role: 'Punto de entrada de prueba de integración', isMain: true },
      ],
      queSeEspera: ['Control de existencias no negativas', 'Cálculo de valor total acumulado', 'Pruebas unitarias aprobadas'],
      salidaResumen: '3 productos registrados y valor total de $145.00.',
    },
    files: {
      'producto.py': `class Producto:
    """Entidad que representa un artículo comercial."""
    def __init__(self, sku: str, nombre: str, precio: float, stock: int = 0):
        if precio < 0 or stock < 0:
            raise ValueError("Precio y stock deben ser no negativos")
        self.sku = sku.strip()
        self.nombre = nombre.strip()
        self.precio = float(precio)
        self.stock = int(stock)

    def valor_total(self) -> float:
        return self.precio * self.stock
`,
      'inventario.py': `from typing import Dict, Optional
from producto import Producto

class Inventario:
    """Administra la colección de productos en almacén."""
    def __init__(self):
        self.productos: Dict[str, Producto] = {}

    def agregar_producto(self, p: Producto) -> None:
        self.productos[p.sku] = p

    def consultar_stock(self, sku: str) -> Optional[int]:
        if sku in self.productos:
            return self.productos[sku].stock
        return None

    def calcular_valor_total(self) -> float:
        return sum(p.valor_total() for p in self.productos.values())
`,
      'main.py': `from producto import Producto
from inventario import Inventario

def main():
    print("=== INVENTARIO CENTRAL ===")
    inv = Inventario()
    inv.agregar_producto(Producto("P-01", "Mouse Óptico", 15.0, 5))
    inv.agregar_producto(Producto("P-02", "Teclado Mecánico", 50.0, 10))
    inv.agregar_producto(Producto("P-03", "Alfombrilla", 20.0, 1))
    print(f"Total productos: {len(inv.productos)}")
    print(f"Valor total inventario: \${inv.calcular_valor_total():.2f}")
    print(f"Stock de Teclado: {inv.consultar_stock('P-02')}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from producto import Producto
from inventario import Inventario

class PruebasInventario(unittest.TestCase):
    def test_creacion_producto(self):
        p = Producto("A1", "Cable", 5.0, 10)
        self.assertEqual(p.valor_total(), 50.0)

    def test_precio_negativo_falla(self):
        with self.assertRaises(ValueError):
            Producto("A2", "Fallo", -10.0, 5)

    def test_gestion_inventario(self):
        inv = Inventario()
        inv.agregar_producto(Producto("A1", "Cable", 5.0, 10))
        inv.agregar_producto(Producto("A2", "Hub", 20.0, 2))
        self.assertEqual(inv.calcular_valor_total(), 90.0)
        self.assertEqual(inv.consultar_stock("A1"), 10)
        self.assertIsNone(inv.consultar_stock("NO_EXISTE"))
`,
    },
  },
  {
    id: '11_autenticacion_usuarios',
    title: 'Servicio de Gestión y Autenticación de Usuarios',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['POO', 'Seguridad', 'Excepciones'],
    description: 'Implementa un gestor de usuarios con contraseñas cifradas con hash SHA-256 y bloqueo por intentos fallidos.',
    statement: '# Proyecto 11 — Servicio de Gestión y Autenticación de Usuarios\n\nDesarrolla `usuario.py` y `auth.py`. Aplica hashing unidireccional SHA-256 para almacenamiento de credenciales y bloquea temporalmente al exceder 3 intentos incorrectos.',
    expected: '=== SERVICIO AUTH ===\nRegistro: Exitoso\nInicio sesión 1: True\nInicio sesión incorrecto: False\n',
    briefing: {
      situacion: 'Una API educativa requiere autenticar estudiantes sin almacenar contraseñas en texto plano.',
      pregunta: '¿Cómo implementar un flujo seguro de autenticación desacoplado en modelos y servicios?',
      queSeTiene: [
        { path: 'usuario.py', role: 'Clase Usuario con hash seguro' },
        { path: 'auth.py', role: 'Servicio AuthService con registro y validación' },
        { path: 'main.py', role: 'Script principal de simulación', isMain: true },
      ],
      queSeEspera: ['Cifrado con hashlib SHA-256', 'Bloqueo tras intentos fallidos', 'Pruebas de seguridad'],
      salidaResumen: 'Autenticación correcta y rechazo de contraseñas incorrectas.',
    },
    files: {
      'usuario.py': `import hashlib

class Usuario:
    def __init__(self, username: str, password_plana: str):
        self.username = username.strip().lower()
        self.salt = "py_salt_"
        self.password_hash = self._hashear(password_plana)
        self.intentos_fallidos = 0
        self.bloqueado = False

    def _hashear(self, password: str) -> str:
        return hashlib.sha256((self.salt + password).encode()).hexdigest()

    def verificar_password(self, password_candidata: str) -> bool:
        if self.bloqueado:
            return False
        es_valida = self._hashear(password_candidata) == self.password_hash
        if not es_valida:
            self.intentos_fallidos += 1
            if self.intentos_fallidos >= 3:
                self.bloqueado = True
        else:
            self.intentos_fallidos = 0
        return es_valida
`,
      'auth.py': `from typing import Dict, Optional
from usuario import Usuario

class AuthService:
    def __init__(self):
        self.usuarios: Dict[str, Usuario] = {}

    def registrar(self, username: str, password: str) -> bool:
        u = username.strip().lower()
        if u in self.usuarios or len(password) < 4:
            return False
        self.usuarios[u] = Usuario(u, password)
        return True

    def autenticar(self, username: str, password: str) -> bool:
        u = username.strip().lower()
        if u not in self.usuarios:
            return False
        return self.usuarios[u].verificar_password(password)
`,
      'main.py': `from auth import AuthService

def main():
    print("=== SERVICIO AUTH ===")
    auth = AuthService()
    reg = auth.registrar("admin_pylevel", "Secreto123")
    print(f"Registro: {'Exitoso' if reg else 'Fallido'}")
    ok1 = auth.autenticar("admin_pylevel", "Secreto123")
    print(f"Inicio sesión 1: {ok1}")
    ok2 = auth.autenticar("admin_pylevel", "ClaveErronea")
    print(f"Inicio sesión incorrecto: {ok2}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from auth import AuthService

class PruebasAuth(unittest.TestCase):
    def test_registro_y_login_exitoso(self):
        s = AuthService()
        self.assertTrue(s.registrar("carlos", "claveSegura1"))
        self.assertTrue(s.autenticar("carlos", "claveSegura1"))

    def test_bloqueo_tres_intentos(self):
        s = AuthService()
        s.registrar("elena", "pass123")
        self.assertFalse(s.autenticar("elena", "malo1"))
        self.assertFalse(s.autenticar("elena", "malo2"))
        self.assertFalse(s.autenticar("elena", "malo3"))
        # Cuarto intento con clave correcta debe fallar por cuenta bloqueada
        self.assertFalse(s.autenticar("elena", "pass123"))
`,
    },
  },
  {
    id: '12_procesador_pagos',
    title: 'Pasarela de Pagos y Facturación Electrónica',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['POO', 'Finanzas', 'Transacciones'],
    description: 'Construye un sistema de facturación con desglose de IVA, descuentos promocionales y emisión de comprobantes.',
    statement: '# Proyecto 12 — Pasarela de Pagos y Facturación Electrónica\n\nDesarrolla `factura.py` y `pasarela.py`. Modela líneas de compra, calcula base imponible con 19% de IVA y procesa el pago debitando un saldo.',
    expected: '=== FACTURACIÓN ELECTRÓNICA ===\nBase: $100.00\nIVA 19%: $19.00\nTotal Factura: $119.00\nPago procesado: True\n',
    briefing: {
      situacion: 'Un e-commerce nacional debe emitir facturas legales calculando impuestos y controlando pagos.',
      pregunta: '¿Cómo separar la lógica tributaria del mecanismo de débito de fondos?',
      queSeTiene: [
        { path: 'factura.py', role: 'Clase Factura y LineaFactura' },
        { path: 'pasarela.py', role: 'Procesador de pagos con validación de saldo' },
        { path: 'main.py', role: 'Punto de entrada de simulación', isMain: true },
      ],
      queSeEspera: ['Cálculo de impuestos exacto', 'Estado de factura pagada', 'Pruebas de cobro'],
      salidaResumen: 'Factura emitida por \$119.00 con pago liquidado.',
    },
    files: {
      'factura.py': `class Factura:
    def __init__(self, numero: str, tasa_iva: float = 0.19):
        self.numero = numero
        self.tasa_iva = tasa_iva
        self.items = []
        self.pagada = False

    def agregar_item(self, descripcion: str, precio: float, cantidad: int = 1):
        self.items.append((descripcion, float(precio), int(cantidad)))

    def subtotal(self) -> float:
        return sum(p * c for _, p, c in self.items)

    def total_iva(self) -> float:
        return self.subtotal() * self.tasa_iva

    def total(self) -> float:
        return self.subtotal() + self.total_iva()
`,
      'pasarela.py': `from factura import Factura

class PasarelaPagos:
    def __init__(self, saldo_disponible: float):
        self.saldo = float(saldo_disponible)

    def cobrar_factura(self, f: Factura) -> bool:
        monto = f.total()
        if self.saldo >= monto:
            self.saldo -= monto
            f.pagada = True
            return True
        return False
`,
      'main.py': `from factura import Factura
from pasarela import PasarelaPagos

def main():
    print("=== FACTURACIÓN ELECTRÓNICA ===")
    f = Factura("FAC-2026-001")
    f.agregar_item("Curso Python Pro", 100.0, 1)
    print(f"Base: \${f.subtotal():.2f}")
    print(f"IVA 19%: \${f.total_iva():.2f}")
    print(f"Total Factura: \${f.total():.2f}")
    p = PasarelaPagos(200.0)
    ok = p.cobrar_factura(f)
    print(f"Pago procesado: {ok}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from factura import Factura
from pasarela import PasarelaPagos

class PruebasFacturacion(unittest.TestCase):
    def test_calculo_totales(self):
        f = Factura("F1", tasa_iva=0.19)
        f.agregar_item("Item 1", 50.0, 2)
        self.assertAlmostEqual(f.subtotal(), 100.0)
        self.assertAlmostEqual(f.total_iva(), 19.0)
        self.assertAlmostEqual(f.total(), 119.0)

    def test_pago_saldo_insuficiente(self):
        f = Factura("F2")
        f.agregar_item("Servidor", 500.0, 1)
        p = PasarelaPagos(100.0)
        self.assertFalse(p.cobrar_factura(f))
        self.assertFalse(f.pagada)
`,
    },
  },
  {
    id: '13_registro_estudiantes',
    title: 'Sistema de Registro de Notas y Estudiantes',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['POO', 'Listas', 'Promedios'],
    description: 'Administra cohortes escolares con cálculo de promedios ponderados y estados de aprobación.',
    statement: '# Proyecto 13 — Sistema de Registro de Notas y Estudiantes\n\nDesarrolla `estudiante.py` y `curso.py`. Registra calificaciones numéricas, determina si un estudiante aprueba (nota >= 3.0) y calcula el promedio grupal.',
    expected: '=== CONTROL ACADÉMICO ===\nEstudiantes registrados: 2\nPromedio Ana: 4.2\nPromedio Carlos: 2.8\nPromedio curso: 3.5\n',
    briefing: {
      situacion: 'Una institución educativa necesita centralizar las calificaciones de sus asignaturas.',
      pregunta: '¿Cómo estructurar las notas individuales y agregadas manteniendo integridad?',
      queSeTiene: [
        { path: 'estudiante.py', role: 'Clase Estudiante con notas y promedio' },
        { path: 'curso.py', role: 'Clase Curso con métricas generales' },
        { path: 'main.py', role: 'Simulación académica', isMain: true },
      ],
      queSeEspera: ['Cálculo de promedio aritmético', 'Identificación de aprobados', 'Pruebas unitarias'],
      salidaResumen: 'Control de 2 estudiantes con promedios de 4.2 y 2.8.',
    },
    files: {
      'estudiante.py': `class Estudiante:
    def __init__(self, matricula: str, nombre: str):
        self.matricula = matricula.strip()
        self.nombre = nombre.strip()
        self.notas = []

    def agregar_nota(self, nota: float):
        if not (0.0 <= nota <= 5.0):
            raise ValueError("La nota debe estar entre 0.0 y 5.0")
        self.notas.append(float(nota))

    def promedio(self) -> float:
        if not self.notas:
            return 0.0
        return round(sum(self.notas) / len(self.notas), 2)

    def aprobado(self) -> bool:
        return self.promedio() >= 3.0
`,
      'curso.py': `from typing import List
from estudiante import Estudiante

class Curso:
    def __init__(self, nombre: str):
        self.nombre = nombre
        self.estudiantes: List[Estudiante] = []

    def inscribir(self, e: Estudiante):
        self.estudiantes.append(e)

    def promedio_general(self) -> float:
        if not self.estudiantes:
            return 0.0
        proms = [e.promedio() for e in self.estudiantes if e.notas]
        return round(sum(proms) / len(proms), 2) if proms else 0.0
`,
      'main.py': `from estudiante import Estudiante
from curso import Curso

def main():
    print("=== CONTROL ACADÉMICO ===")
    c = Curso("Algoritmos I")
    e1 = Estudiante("E01", "Ana")
    e1.agregar_nota(4.5)
    e1.agregar_nota(3.9)
    e2 = Estudiante("E02", "Carlos")
    e2.agregar_nota(2.6)
    e2.agregar_nota(3.0)
    c.inscribir(e1)
    c.inscribir(e2)
    print(f"Estudiantes registrados: {len(c.estudiantes)}")
    print(f"Promedio Ana: {e1.promedio()}")
    print(f"Promedio Carlos: {e2.promedio()}")
    print(f"Promedio curso: {c.promedio_general()}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from estudiante import Estudiante
from curso import Curso

class PruebasCurso(unittest.TestCase):
    def test_promedio_y_aprobacion(self):
        e = Estudiante("1", "David")
        e.agregar_nota(4.0)
        e.agregar_nota(3.0)
        self.assertEqual(e.promedio(), 3.5)
        self.assertTrue(e.aprobado())

    def test_nota_invalida(self):
        e = Estudiante("2", "Eva")
        with self.assertRaises(ValueError):
            e.agregar_nota(6.0)
`,
    },
  },
  {
    id: '14_cola_notificaciones',
    title: 'Distribuidor de Notificaciones Multi-canal',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['POO', 'Colas', 'Patrones de Diseño'],
    description: 'Construye un despachador que encole y distribuya mensajes por Email, SMS o Push según prioridad.',
    statement: '# Proyecto 14 — Distribuidor de Notificaciones Multi-canal\n\nImplementa `mensaje.py` y `despachador.py`. Maneja colas de despacho y simula el envío ordenado por niveles de urgencia.',
    expected: '=== DISTRIBUIDOR NOTIFICACIONES ===\nEncolados: 2\nDespachado: URGENTE: Alerta de servidor\nRestantes: 1\n',
    briefing: {
      situacion: 'Una plataforma web requiere enviar notificaciones masivas sin saturar APIs externas.',
      pregunta: '¿Cómo diseñar un despachador con prioridades para entregar primero alertas críticas?',
      queSeTiene: [
        { path: 'mensaje.py', role: 'Clase Notificacion' },
        { path: 'despachador.py', role: 'Despachador con cola de prioridad' },
        { path: 'main.py', role: 'Simulación del canal', isMain: true },
      ],
      queSeEspera: ['Ordenamiento por urgencia', 'Consumo seguro de mensajes', 'Pruebas'],
      salidaResumen: 'Notificación de urgencia despachada en primer lugar.',
    },
    files: {
      'mensaje.py': `class Notificacion:
    def __init__(self, canal: str, destino: str, contenido: str, prioridad: int = 1):
        self.canal = canal.lower()
        self.destino = destino.strip()
        self.contenido = contenido.strip()
        self.prioridad = int(prioridad)
        self.enviado = False
`,
      'despachador.py': `from typing import List, Optional
from mensaje import Notificacion

class DespachadorNotificaciones:
    def __init__(self):
        self.cola: List[Notificacion] = []

    def encolar(self, n: Notificacion):
        self.cola.append(n)
        self.cola.sort(key=lambda x: x.prioridad, reverse=True)

    def despachar_siguiente(self) -> Optional[Notificacion]:
        if not self.cola:
            return None
        n = self.cola.pop(0)
        n.enviado = True
        return n
`,
      'main.py': `from mensaje import Notificacion
from despachador import DespachadorNotificaciones

def main():
    print("=== DISTRIBUIDOR NOTIFICACIONES ===")
    d = DespachadorNotificaciones()
    d.encolar(Notificacion("email", "user@test.com", "Boletín semanal", prioridad=1))
    d.encolar(Notificacion("sms", "+57300", "URGENTE: Alerta de servidor", prioridad=5))
    print(f"Encolados: {len(d.cola)}")
    primero = d.despachar_siguiente()
    print(f"Despachado: {primero.contenido if primero else 'Ninguno'}")
    print(f"Restantes: {len(d.cola)}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from mensaje import Notificacion
from despachador import DespachadorNotificaciones

class PruebasDespacho(unittest.TestCase):
    def test_orden_prioridad(self):
        d = DespachadorNotificaciones()
        d.encolar(Notificacion("email", "a", "Baja", 1))
        d.encolar(Notificacion("sms", "b", "Alta", 10))
        n = d.despachar_siguiente()
        self.assertEqual(n.contenido, "Alta")
        self.assertTrue(n.enviado)
`,
    },
  },
  {
    id: '15_analizador_logs',
    title: 'Analizador de Registros y Métricas de Servidor',
    difficulty: 'Difícil',
    level: 'Avanzado',
    topics: ['Parsing', 'Expresiones Regulares', 'Archivos'],
    description: 'Parsea y procesa eventos de logs en formato estructurado, calculando tasa de errores HTTP 4xx y 5xx.',
    statement: '# Proyecto 15 — Analizador de Registros y Métricas de Servidor\n\nDesarrolla `evento.py` y `analizador.py`. Extrae código de estado HTTP, método y latencia, generando estadísticas de salud del sistema.',
    expected: '=== ANALIZADOR DE LOGS ===\nTotal eventos: 4\nErrores 5xx: 1\nLatencia media: 145.0 ms\n',
    briefing: {
      situacion: 'El equipo de operaciones necesita diagnosticar caídas analizando archivos de log en tiempo real.',
      pregunta: '¿Cómo procesar líneas de texto no homogéneas y calcular métricas agregadas?',
      queSeTiene: [
        { path: 'evento.py', role: 'Clase EventoLog con atributos parseados' },
        { path: 'analizador.py', role: 'Calculador de tasas de error y latencia' },
        { path: 'main.py', role: 'Simulación con logs de prueba', isMain: true },
      ],
      queSeEspera: ['Detección de códigos de error', 'Cálculo de latencia promedio', 'Pruebas automatizadas'],
      salidaResumen: '4 eventos analizados con 1 error 5xx detectado.',
    },
    files: {
      'evento.py': `class EventoLog:
    def __init__(self, linea: str):
        partes = linea.strip().split()
        if len(partes) < 4:
            raise ValueError("Formato de línea de log inválido")
        self.timestamp = partes[0]
        self.metodo = partes[1].upper()
        self.status_code = int(partes[2])
        self.latencia_ms = float(partes[3])
`,
      'analizador.py': `from typing import List
from evento import EventoLog

class AnalizadorLogs:
    def __init__(self):
        self.eventos: List[EventoLog] = []

    def registrar_linea(self, linea: str):
        self.eventos.append(EventoLog(linea))

    def contar_errores_servidor(self) -> int:
        return sum(1 for e in self.eventos if e.status_code >= 500)

    def latencia_promedio(self) -> float:
        if not self.eventos:
            return 0.0
        return round(sum(e.latencia_ms for e in self.eventos) / len(self.eventos), 1)
`,
      'main.py': `from analizador import AnalizadorLogs

def main():
    print("=== ANALIZADOR DE LOGS ===")
    a = AnalizadorLogs()
    a.registrar_linea("2026-11-01T10:00:00 GET 200 120.0")
    a.registrar_linea("2026-11-01T10:00:01 POST 201 180.0")
    a.registrar_linea("2026-11-01T10:00:02 GET 500 230.0")
    a.registrar_linea("2026-11-01T10:00:03 GET 200 50.0")
    print(f"Total eventos: {len(a.eventos)}")
    print(f"Errores 5xx: {a.contar_errores_servidor()}")
    print(f"Latencia media: {a.latencia_promedio()} ms")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from analizador import AnalizadorLogs

class PruebasLogs(unittest.TestCase):
    def test_analisis_estadisticas(self):
        a = AnalizadorLogs()
        a.registrar_linea("T1 GET 200 100")
        a.registrar_linea("T2 GET 503 300")
        self.assertEqual(a.contar_errores_servidor(), 1)
        self.assertEqual(a.latencia_promedio(), 200.0)
`,
    },
  },
  {
    id: '16_reservas_hotel',
    title: 'Motor de Reservaciones y Habitaciones de Hotel',
    difficulty: 'Medio',
    level: 'Intermedio',
    topics: ['POO', 'Disponibilidad', 'Fechas'],
    description: 'Coordina la disponibilidad de habitaciones sencillas, dobles y suites, evitando solapamiento de fechas.',
    statement: '# Proyecto 16 — Motor de Reservaciones y Habitaciones de Hotel\n\nDesarrolla `habitacion.py` y `hotel.py`. Asigna huéspedes a cuartos disponibles y calcula el costo total de la estadía.',
    expected: '=== HOTEL CENTRAL ===\nHabitación asignada: 101\nCosto 3 noches: $240.00\nOcupación: 1 de 2\n',
    briefing: {
      situacion: 'Una cadena hotelera requiere evitar overbooking en su temporada alta.',
      pregunta: '¿Cómo modelar el estado ocupado/disponible de cada habitación?',
      queSeTiene: [
        { path: 'habitacion.py', role: 'Clase Habitacion' },
        { path: 'hotel.py', role: 'Gestor del hotel y reservas' },
        { path: 'main.py', role: 'Simulación de reserva', isMain: true },
      ],
      queSeEspera: ['Validación de disponibilidad', 'Cobro según tarifa por noche', 'Tests unitarios'],
      salidaResumen: 'Reserva confirmada en habitación 101 por $240.00.',
    },
    files: {
      'habitacion.py': `class Habitacion:
    def __init__(self, numero: str, tipo: str, precio_noche: float):
        self.numero = str(numero)
        self.tipo = tipo.lower()
        self.precio_noche = float(precio_noche)
        self.ocupada = False

    def calcular_estadia(self, noches: int) -> float:
        return self.precio_noche * int(noches)
`,
      'hotel.py': `from typing import Dict, Optional
from habitacion import Habitacion

class Hotel:
    def __init__(self, nombre: str):
        self.nombre = nombre
        self.habitaciones: Dict[str, Habitacion] = {}

    def registrar_habitacion(self, h: Habitacion):
        self.habitaciones[h.numero] = h

    def reservar(self, numero: str) -> bool:
        if numero in self.habitaciones and not self.habitaciones[numero].ocupada:
            self.habitaciones[numero].ocupada = True
            return True
        return False
`,
      'main.py': `from habitacion import Habitacion
from hotel import Hotel

def main():
    print("=== HOTEL CENTRAL ===")
    h = Hotel("Gran Pirámide")
    h1 = Habitacion("101", "sencilla", 80.0)
    h2 = Habitacion("102", "suite", 180.0)
    h.registrar_habitacion(h1)
    h.registrar_habitacion(h2)
    h.reservar("101")
    ocupadas = sum(1 for hab in h.habitaciones.values() if hab.ocupada)
    print("Habitación asignada: 101")
    print(f"Costo 3 noches: \${h1.calcular_estadia(3):.2f}")
    print(f"Ocupación: {ocupadas} de {len(h.habitaciones)}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from habitacion import Habitacion
from hotel import Hotel

class PruebasHotel(unittest.TestCase):
    def test_reserva_unica(self):
        hot = Hotel("Test")
        hot.registrar_habitacion(Habitacion("201", "doble", 100))
        self.assertTrue(hot.reservar("201"))
        self.assertFalse(hot.reservar("201"))
`,
    },
  },
  {
    id: '17_gestor_tickets',
    title: 'Centro de Soporte y Tickets de Incidencias',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['POO', 'Diccionarios', 'Estados'],
    description: 'Gestiona el ciclo de vida de tickets de soporte técnico: abierto, en progreso y resuelto.',
    statement: '# Proyecto 17 — Centro de Soporte y Tickets de Incidencias\n\nDesarrolla `ticket.py` y `mesa_ayuda.py`. Permite abrir solicitudes, asignar agentes y cerrar tickets con su respectiva resolución.',
    expected: '=== MESA DE AYUDA ===\nTickets abiertos: 2\nTicket T-01 asignado: Agente Juan\nTicket T-01 estado: cerrado\n',
    briefing: {
      situacion: 'El área de TI requiere registrar problemas de software de manera trazable.',
      pregunta: '¿Cómo modelar el cambio de estados asegurando que no se cierre un ticket sin solución?',
      queSeTiene: [
        { path: 'ticket.py', role: 'Clase Ticket' },
        { path: 'mesa_ayuda.py', role: 'Mesa de ayuda central' },
        { path: 'main.py', role: 'Simulación del soporte', isMain: true },
      ],
      queSeEspera: ['Transición ordenada de estados', 'Validación de resolución', 'Tests'],
      salidaResumen: 'Ticket T-01 resuelto y cerrado exitosamente.',
    },
    files: {
      'ticket.py': `class Ticket:
    def __init__(self, id_ticket: str, asunto: str):
        self.id = id_ticket
        self.asunto = asunto
        self.agente = None
        self.estado = "abierto"
        self.resolucion = ""

    def asignar(self, agente: str):
        self.agente = agente
        self.estado = "en_progreso"

    def cerrar(self, resolucion: str):
        if not resolucion.strip():
            raise ValueError("Debe documentar la resolución")
        self.resolucion = resolucion
        self.estado = "cerrado"
`,
      'mesa_ayuda.py': `from typing import Dict
from ticket import Ticket

class MesaAyuda:
    def __init__(self):
        self.tickets: Dict[str, Ticket] = {}

    def crear_ticket(self, id_t: str, asunto: str) -> Ticket:
        t = Ticket(id_t, asunto)
        self.tickets[id_t] = t
        return t
`,
      'main.py': `from mesa_ayuda import MesaAyuda

def main():
    print("=== MESA DE AYUDA ===")
    m = MesaAyuda()
    t1 = m.crear_ticket("T-01", "Error de conexión BD")
    m.crear_ticket("T-02", "Reinicio de contraseña")
    print(f"Tickets abiertos: {len(m.tickets)}")
    t1.asignar("Agente Juan")
    print(f"Ticket T-01 asignado: {t1.agente}")
    t1.cerrar("Se reinició el servicio de base de datos")
    print(f"Ticket T-01 estado: {t1.estado}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from ticket import Ticket

class PruebasTickets(unittest.TestCase):
    def test_flujo_completo(self):
        t = Ticket("T1", "Bug")
        t.asignar("Ana")
        self.assertEqual(t.estado, "en_progreso")
        t.cerrar("Arreglado")
        self.assertEqual(t.estado, "cerrado")

    def test_cierre_sin_resolucion_falla(self):
        t = Ticket("T2", "Bug 2")
        with self.assertRaises(ValueError):
            t.cerrar("")
`,
    },
  },
  {
    id: '18_conversor_monedas',
    title: 'Calculadora de Tasas de Cambio y Divisas',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['POO', 'Matemáticas', 'Finanzas'],
    description: 'Convierte montos monetarios entre múltiples divisas (COP, USD, EUR) utilizando una tabla de paridades.',
    statement: '# Proyecto 18 — Calculadora de Tasas de Cambio y Divisas\n\nDesarrolla `tasas.py` y `conversor.py`. Administra tipos de cambio base y realiza conversiones bidireccionales con comisión configurable.',
    expected: '=== CONVERSOR DE DIVISAS ===\n100 USD a COP: $410000.00 COP\n50 EUR a USD: $55.00 USD\n',
    briefing: {
      situacion: 'Una agencia de viajes cotiza paquetes turísticos en monedas internacionales.',
      pregunta: '¿Cómo centralizar las tasas relativas respecto al dólar estadounidense?',
      queSeTiene: [
        { path: 'tasas.py', role: 'Gestor de tasas de cambio' },
        { path: 'conversor.py', role: 'Motor de cálculo y comisiones' },
        { path: 'main.py', role: 'Simulación de operaciones', isMain: true },
      ],
      queSeEspera: ['Conversión precisa', 'Manejo de comisiones bancarias', 'Pruebas'],
      salidaResumen: 'Conversiones exitosas de USD a COP y de EUR a USD.',
    },
    files: {
      'tasas.py': `class TablaTasas:
    def __init__(self):
        # Tasas relativas respecto a 1 USD
        self.tasas = {
            "USD": 1.0,
            "COP": 4100.0,
            "EUR": 0.91,
        }

    def obtener_tasa(self, divisa: str) -> float:
        d = divisa.upper()
        if d not in self.tasas:
            raise KeyError(f"Divisa no soportada: {divisa}")
        return self.tasas[d]
`,
      'conversor.py': `from tasas import TablaTasas

class ConversorMoneda:
    def __init__(self, tabla: TablaTasas):
        self.tabla = tabla

    def convertir(self, monto: float, origen: str, destino: str) -> float:
        m = float(monto)
        tasa_origen = self.tabla.obtener_tasa(origen)
        tasa_destino = self.tabla.obtener_tasa(destino)
        # Convertir a USD y luego a destino
        en_usd = m / tasa_origen
        return round(en_usd * tasa_destino, 2)
`,
      'main.py': `from tasas import TablaTasas
from conversor import ConversorMoneda

def main():
    print("=== CONVERSOR DE DIVISAS ===")
    t = TablaTasas()
    c = ConversorMoneda(t)
    en_cop = c.convertir(100.0, "USD", "COP")
    en_usd = c.convertir(50.0, "EUR", "USD")
    print(f"100 USD a COP: \${en_cop:.2f} COP")
    print(f"50 EUR a USD: \${en_usd:.2f} USD")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from tasas import TablaTasas
from conversor import ConversorMoneda

class PruebasConversor(unittest.TestCase):
    def test_conversion_usd_a_cop(self):
        c = ConversorMoneda(TablaTasas())
        self.assertEqual(c.convertir(10, "USD", "COP"), 41000.0)

    def test_divisa_inexistente(self):
        c = ConversorMoneda(TablaTasas())
        with self.assertRaises(KeyError):
            c.convertir(10, "XYZ", "USD")
`,
    },
  },
  {
    id: '19_biblioteca_digital',
    title: 'Catálogo de Biblioteca y Préstamo de Libros',
    difficulty: 'Fácil',
    level: 'Inicial',
    topics: ['POO', 'Colecciones', 'Modelado'],
    description: 'Gestiona préstamos y devoluciones de ejemplares bibliográficos con límite de libros prestados por usuario.',
    statement: '# Proyecto 19 — Catálogo de Biblioteca y Préstamo de Libros\n\nDesarrolla `libro.py` y `biblioteca.py`. Controla la disponibilidad de ejemplares y valida que un usuario no exceda 3 préstamos activos.',
    expected: '=== BIBLIOTECA DIGITAL ===\nTotal libros: 3\nPréstamo de Clean Code: Exitoso\nDisponibles: 2\n',
    briefing: {
      situacion: 'Una biblioteca comunitaria busca informatizar el registro de sus préstamos.',
      pregunta: '¿Cómo garantizar que un libro ya prestado no pueda ser solicitado nuevamente?',
      queSeTiene: [
        { path: 'libro.py', role: 'Clase Libro con estado de préstamo' },
        { path: 'biblioteca.py', role: 'Gestor del fondo bibliográfico' },
        { path: 'main.py', role: 'Simulación del servicio', isMain: true },
      ],
      queSeEspera: ['Control de disponibilidad booleano', 'Búsqueda por título o autor', 'Pruebas'],
      salidaResumen: '3 libros registrados y 1 préstamo exitoso.',
    },
    files: {
      'libro.py': `class Libro:
    def __init__(self, isbn: str, titulo: str, autor: str):
        self.isbn = isbn.strip()
        self.titulo = titulo.strip()
        self.autor = autor.strip()
        self.prestado = False

    def prestar(self) -> bool:
        if not self.prestado:
            self.prestado = True
            return True
        return False

    def devolver(self) -> bool:
        if self.prestado:
            self.prestado = False
            return True
        return False
`,
      'biblioteca.py': `from typing import Dict, List
from libro import Libro

class Biblioteca:
    def __init__(self):
        self.libros: Dict[str, Libro] = {}

    def agregar_libro(self, l: Libro):
        self.libros[l.isbn] = l

    def prestar_libro(self, isbn: str) -> bool:
        if isbn in self.libros:
            return self.libros[isbn].prestar()
        return False

    def listar_disponibles(self) -> List[Libro]:
        return [l for l in self.libros.values() if not l.prestado]
`,
      'main.py': `from libro import Libro
from biblioteca import Biblioteca

def main():
    print("=== BIBLIOTECA DIGITAL ===")
    b = Biblioteca()
    b.agregar_libro(Libro("978-01", "Clean Code", "Robert C. Martin"))
    b.agregar_libro(Libro("978-02", "Python Fluent", "Luciano Ramalho"))
    b.agregar_libro(Libro("978-03", "Design Patterns", "GoF"))
    print(f"Total libros: {len(b.libros)}")
    ok = b.prestar_libro("978-01")
    print(f"Préstamo de Clean Code: {'Exitoso' if ok else 'Fallido'}")
    print(f"Disponibles: {len(b.listar_disponibles())}")

if __name__ == "__main__":
    main()
`,
      'tests/test_publico.py': `import unittest
from libro import Libro
from biblioteca import Biblioteca

class PruebasBiblioteca(unittest.TestCase):
    def test_prestamo_y_devolucion(self):
        b = Biblioteca()
        l = Libro("1", "Python 101", "Autor")
        b.agregar_libro(l)
        self.assertTrue(b.prestar_libro("1"))
        self.assertFalse(b.prestar_libro("1"))
        self.assertTrue(l.devolver())
        self.assertTrue(b.prestar_libro("1"))
`,
    },
  },
];

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
    const mode = body.mode || 'both'; // 'classic' | 'contextual' | 'both'
    const count = typeof body.count === 'number' ? Math.min(Math.max(body.count, 1), 20) : 10;

    const existingExercises = await getDbExercises({ onlyActive: false });
    const existingIds = new Set(existingExercises.map(e => e.id));

    const createdList: any[] = [];

    // 1. Generar lote de Desafíos Clásicos
    if (mode === 'classic' || mode === 'both') {
      const candidates = CLASSIC_BATCH_DEFINITIONS.slice(0, count);
      for (let i = 0; i < candidates.length; i++) {
        const def = candidates[i];
        let exerciseId = `clasico_pybot_${def.idSuffix}`;
        if (existingIds.has(exerciseId)) {
          exerciseId = `${exerciseId}_${Date.now().toString().slice(-4)}_${i}`;
        }

        const files = {
          'main.py': `${def.starter}\n\n\nif __name__ == "__main__":\n${def.examples.map(ex => `    print(${ex})`).join('\n')}\n`,
          'tests/test_publico.py': `import unittest\nfrom main import ${def.fnName}\n\n\nclass PruebasEjercicio(unittest.TestCase):\n    def test_casos(self):\n        casos = ${def.cases}\n        for argumentos, esperado in casos:\n            with self.subTest(argumentos=argumentos):\n                self.assertEqual(${def.fnName}(*argumentos), esperado)\n`,
        };

        const created = await createDbExercise({
          id: exerciseId,
          mode: 'classic',
          title: `${def.title}`,
          difficulty: def.difficulty,
          level: def.level,
          topics: def.topics,
          description: def.description,
          statement: def.statement,
          expected: def.expected,
          files,
          hints: def.hints,
          solution: def.solution,
          is_active: true,
        });

        existingIds.add(created.id);
        createdList.push({ id: created.id, title: created.title, mode: 'classic' });
      }
    }

    // 2. Generar lote de Proyectos Multi-archivo
    if (mode === 'contextual' || mode === 'both') {
      const candidates = CONTEXTUAL_BATCH_DEFINITIONS.slice(0, count);
      for (let i = 0; i < candidates.length; i++) {
        const def = candidates[i];
        let exerciseId = def.id;
        if (existingIds.has(exerciseId)) {
          exerciseId = `${def.id}_pybot_${Date.now().toString().slice(-4)}_${i}`;
        }

        const created = await createDbExercise({
          id: exerciseId,
          mode: 'contextual',
          title: def.title,
          difficulty: def.difficulty,
          level: def.level,
          topics: def.topics,
          description: def.description,
          statement: def.statement,
          expected: def.expected,
          files: def.files,
          briefing: def.briefing,
          hints: ['Examina los métodos requeridos en cada módulo antes de ejecutar las pruebas.'],
          is_active: true,
        });

        existingIds.add(created.id);
        createdList.push({ id: created.id, title: created.title, mode: 'contextual' });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Se crearon con éxito ${createdList.length} ejercicios con PyBot IA.`,
        count: createdList.length,
        created: createdList,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Error interno al generar lote de ejercicios',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

