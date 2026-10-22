"""
Módulo de Exámenes de Certificación y Banco de Preguntas para PyLevel
Maneja generación paralela de exámenes con IA, tolerancia a JSON imperfectos y bancos de preguntas locales.
"""

import json
import re
import random
import concurrent.futures
from typing import Dict, Any, Optional, List
from provider import GeminiProvider

class ExamsManager:
    """Gestiona la generación de exámenes de certificación y bancos de preguntas diagnósticas"""

    def __init__(self, provider: GeminiProvider):
        self.provider = provider

    def _parse_json_array_robust(self, raw_str: str) -> List[Dict[str, Any]]:
        """Limpia y parsea con alta tolerancia arrays JSON generados por LLMs"""
        if not raw_str:
            return []
        cleaned = raw_str.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # Intento 1: Parseo directo con strict=False (tolera saltos de línea sin escapar)
        try:
            data = json.loads(cleaned, strict=False)
            if isinstance(data, list):
                return data
        except Exception:
            pass

        # Intento 2: Reparar escapes inválidos de barras invertidas comunes en código Python
        try:
            fixed = re.sub(r'\\(?![/"\\bfnrtu]|u[0-9a-fA-F]{4})', r'\\\\', cleaned)
            data = json.loads(fixed, strict=False)
            if isinstance(data, list):
                return data
        except Exception:
            pass

        # Intento 3: Extracción regex de objetos individuales
        try:
            objs = []
            matches = re.findall(r'(\{(?:[^{}]|(?:\{[^{}]*\}))*\})', cleaned)
            for m in matches:
                try:
                    fixed_item = re.sub(r'\\(?![/"\\bfnrtu]|u[0-9a-fA-F]{4})', r'\\\\', m)
                    obj = json.loads(fixed_item, strict=False)
                    if isinstance(obj, dict) and obj.get('enunciado') and obj.get('opciones'):
                        objs.append(obj)
                except Exception:
                    continue
            if objs:
                return objs
        except Exception:
            pass

        return []

    def generar_examen_certificacion(self, num_preguntas: int = 25) -> Dict[str, Any]:
        """Genera un examen completo de certificación con preguntas únicas de alta dificultad"""
        preguntas_totales = []

        if self.provider.tiene_api_key():
            # Dividir en 2 lotes (13 + 12 = 25) ejecutados en paralelo para máxima velocidad y evitar truncamiento
            lotes = [
                {
                    "idx": 0,
                    "cantidad": 13,
                    "temas": "Sintaxis Avanzada, Mutabilidad, Slicing con paso, Desempaquetado, Diccionarios, Sets y List Comprehensions complejas."
                },
                {
                    "idx": 1,
                    "cantidad": 12,
                    "temas": "POO Avanzada, MRO (Method Resolution Order), Dunder methods (__new__, __init__, __call__), Generadores (yield), Decoradores, Excepciones y Context Managers."
                }
            ]

            def procesar_lote(lote):
                prompt = f"""
Actúa como un profesor universitario y examinador oficial de certificación en Python.
Genera exactamente {lote['cantidad']} preguntas de opción múltiple de nivel ALTO / EXIGENTE con fragmentos de código reales y trampas comunes de Python.

Temas obligatorios para este lote:
{lote['temas']}

REGLAS DE ORO:
- Cada pregunta debe ser desafiante: evalúa mutabilidad, scope, orden de ejecución, casos borde o complejidades de Python.
- Los distractores deben ser errores típicos y creíbles que un programador junior o descuidado cometería.
- La pregunta debe incluir un fragmento de código relevante con sangría y sintaxis Python válida.
- La justificación conceptual (explicacion) debe ser concisa (máximo 1 oración).
- Si usas barras invertidas en cadenas, escápala como doble barra (\\\\).
- Devuelve ÚNICAMENTE un array JSON válido con la estructura solicitada, sin ningún texto antes ni después.

Estructura JSON por cada pregunta:
{{
  "id": {1 + (lote['idx'] * 13)},
  "area": "Nombre del Área Temática",
  "enunciado": "Enunciado claro con fragmento de código:\\n\\n```python\\n# código\\n```",
  "opciones": [
    "Opción A",
    "Opción B",
    "Opción C",
    "Opción D"
  ],
  "respuesta_correcta": "Texto exacto de la opción correcta",
  "explicacion": "Explicación concisa de 1 oración."
}}
"""
                sys_inst = "Eres un examinador de certificaciones oficiales de Python. Devuelve estrictamente el array JSON con las preguntas sin markdown ni texto conversacional."
                schema_lote = {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "id": {"type": "INTEGER"},
                            "area": {"type": "STRING"},
                            "enunciado": {"type": "STRING"},
                            "opciones": {"type": "ARRAY", "items": {"type": "STRING"}},
                            "respuesta_correcta": {"type": "STRING"},
                            "explicacion": {"type": "STRING"}
                        },
                        "required": ["id", "area", "enunciado", "opciones", "respuesta_correcta", "explicacion"]
                    }
                }
                resp = self.provider.consultar(prompt, sys_inst, max_tokens=4000, temperature=0.35, timeout=35.0, json_mode=True, response_schema=schema_lote)
                resultado = []
                if resp:
                    preguntas_lote = self._parse_json_array_robust(resp)
                    for p in preguntas_lote:
                        if isinstance(p, dict) and p.get('enunciado') and p.get('opciones') and p.get('respuesta_correcta'):
                            resultado.append(p)
                    if not resultado:
                        print(f"[ExamsManager] No se pudieron extraer preguntas válidas del lote {lote['idx'] + 1}")
                return resultado

            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                    futuros = [executor.submit(procesar_lote, lote) for lote in lotes]
                    for fut in concurrent.futures.as_completed(futuros, timeout=40.0):
                        try:
                            lote_res = fut.result()
                            if lote_res:
                                preguntas_totales.extend(lote_res)
                        except Exception as e:
                            print(f"[ExamsManager] Error en hilo de lote: {e}")
            except Exception as e:
                print(f"[ExamsManager] Error en ejecución paralela de lotes: {e}")

        # Si no se completaron las preguntas con IA, completar o usar el banco local experto
        if len(preguntas_totales) < num_preguntas:
            preguntas_locales = self._generar_examen_certificacion_local(num_preguntas)
            if not preguntas_totales:
                preguntas_totales = preguntas_locales
            else:
                # Combinar preguntas IA con preguntas locales para completar las 25
                ids_existentes = {p.get('enunciado') for p in preguntas_totales}
                for pl in preguntas_locales:
                    if pl.get('enunciado') not in ids_existentes and len(preguntas_totales) < num_preguntas:
                        preguntas_totales.append(pl)

        # Numerar ordenadamente del 1 al N
        for idx, p in enumerate(preguntas_totales):
            p['id'] = idx + 1

        return {
            'success': True,
            'total': len(preguntas_totales),
            'preguntas': preguntas_totales,
            'fuente': 'gemini' if self.provider.tiene_api_key() and len(preguntas_totales) >= num_preguntas else 'hibrido_local',
            'modelo': self.provider.modelo if self.provider.tiene_api_key() else 'Banco Certificación Local'
        }

    def _generar_examen_certificacion_local(self, num_preguntas: int = 25) -> List[Dict[str, Any]]:
        """Banco exhaustivo de preguntas de certificación de alta dificultad offline"""
        banco = [
            {
                "area": "Sintaxis Avanzada y Mutabilidad",
                "enunciado": "¿Qué imprime el siguiente código en Python 3?\n\n```python\ndef fn(val, lista=[]):\n    lista.append(val)\n    return lista\n\nprint(fn(1), fn(2))\n```",
                "opciones": ["[1] [2]", "[1, 2] [1, 2]", "[1] [1, 2]", "TypeError: mutable default"],
                "respuesta_correcta": "[1, 2] [1, 2]",
                "explicacion": "Los argumentos por defecto mutables (como listas o dicts) se evalúan una sola vez al cargar la definición de la función, por lo que ambas llamadas comparten la misma lista."
            },
            {
                "area": "Closures y Late Binding",
                "enunciado": "¿Cuál es la salida de este código debido al comportamiento de closures en Python?\n\n```python\nfunciones = [lambda: i for i in range(3)]\nprint([f() for f in funciones])\n```",
                "opciones": ["[0, 1, 2]", "[2, 2, 2]", "[0, 0, 0]", "IndexError"],
                "respuesta_correcta": "[2, 2, 2]",
                "explicacion": "Python usa 'late binding' en closures: la variable `i` se busca en el ámbito superior en el momento en que se ejecuta la función lambda, cuando el bucle ya finalizó con `i = 2`."
            },
            {
                "area": "Tuplas y Mutabilidad In-Place",
                "enunciado": "¿Qué sucede al ejecutar este código?\n\n```python\nt = (1, 2, [3, 4])\nt[2] += [5]\n```",
                "opciones": [
                    "La tupla se actualiza a (1, 2, [3, 4, 5]) sin ningún error",
                    "Se lanza TypeError y la lista dentro de la tupla NO se modifica",
                    "Se lanza TypeError, pero la lista dentro de la tupla SÍ se modifica a [3, 4, 5]",
                    "Se lanza ValueError: tuple is immutable"
                ],
                "respuesta_correcta": "Se lanza TypeError, pero la lista dentro de la tupla SÍ se modifica a [3, 4, 5]",
                "explicacion": "El operador `+=` ejecuta `extend()` en la lista mutable in-place (mutándola con éxito), pero luego intenta reasignar el resultado a `t[2]`, lo cual lanza `TypeError` porque las tuplas no permiten asignación de items."
            },
            {
                "area": "Identidad vs Igualdad (is vs ==)",
                "enunciado": "¿Cuál es el resultado de la siguiente comparación en CPython?\n\n```python\na = 256\nb = 256\nc = 257\nd = 257\nprint(a is b, c is d)\n```",
                "opciones": ["True True", "False False", "True False", "False True"],
                "respuesta_correcta": "True False",
                "explicacion": "CPython pre-asigna e interna enteros pequeños en el rango [-5, 256] para optimizar memoria, por lo que `a` y `b` comparten el mismo objeto en memoria, mientras que 257 crea objetos separados."
            },
            {
                "area": "POO y Method Resolution Order (MRO)",
                "enunciado": "Dada la siguiente jerarquía de clases, ¿qué método se ejecuta al llamar `D().saludar()`?\n\n```python\nclass A:\n    def saludar(self): return 'A'\nclass B(A):\n    def saludar(self): return 'B'\nclass C(A):\n    def saludar(self): return 'C'\nclass D(B, C):\n    pass\n```",
                "opciones": ["'A'", "'B'", "'C'", "TypeError: Cannot create a consistent MRO"],
                "respuesta_correcta": "'B'",
                "explicacion": "El algoritmo C3 Linearization resuelve el MRO de `D` como: D -> B -> C -> A -> object. Como `B` define `saludar`, se ejecuta primero antes que `C` o `A`."
            },
            {
                "area": "POO y Metaclases (__new__ vs __init__)",
                "enunciado": "¿Cuál es la diferencia fundamental entre los métodos mágicos `__new__` y `__init__`?",
                "opciones": [
                    "`__new__` es el verdadero constructor que crea la instancia; `__init__` es el inicializador que recibe la instancia ya creada",
                    "`__init__` se ejecuta antes que `__new__` en el ciclo de vida del objeto",
                    "`__new__` solo puede usarse en clases abstractas",
                    "No hay diferencia, son sinónimos desde Python 3.5"
                ],
                "respuesta_correcta": "`__new__` es el verdadero constructor que crea la instancia; `__init__` es el inicializador que recibe la instancia ya creada",
                "explicacion": "`__new__` es un método estático responsable de crear y retornar la nueva instancia (`cls`), mientras que `__init__` se invoca inmediatamente después para inicializar los atributos de `self`."
            },
            {
                "area": "Generadores e Iteradores",
                "enunciado": "¿Qué imprime este código al consumir un generador?\n\n```python\ngen = (x**2 for x in [1, 2, 3])\nprint(list(gen))\nprint(list(gen))\n```",
                "opciones": ["[1, 4, 9] [1, 4, 9]", "[1, 4, 9] []", "[] []", "StopIteration"],
                "respuesta_correcta": "[1, 4, 9] []",
                "explicacion": "Los generadores son iteradores de un solo uso; una vez que han sido agotados (consumidos por completo), subsiguientes llamadas retornan una secuencia vacía sin relanzar elementos."
            },
            {
                "area": "Diccionarios y Hashability",
                "enunciado": "¿Cuál de los siguientes objetos PUEDE usarse válidamente como clave de un diccionario en Python?",
                "opciones": [
                    "([1, 2], 'admin')",
                    "frozenset([1, 2, 3])",
                    "{'id': 1}",
                    "list((1, 2))"
                ],
                "respuesta_correcta": "frozenset([1, 2, 3])",
                "explicacion": "Para ser clave de un diccionario, el objeto debe ser inmutable y 'hashable' (implementar `__hash__`). `frozenset` es inmutable y hashable, a diferencia de listas, diccionarios o tuplas que contengan listas."
            },
            {
                "area": "Context Managers (__exit__ y supresión)",
                "enunciado": "¿Qué valor debe retornar el método `__exit__(self, exc_type, exc_val, exc_tb)` de un Context Manager para SUPRIMIR una excepción ocurrida dentro del bloque `with`?",
                "opciones": ["None", "False", "True", "raise exc_val"],
                "respuesta_correcta": "True",
                "explicacion": "Si `__exit__` retorna un valor de verdad equivalente a `True`, Python suprime la excepción ocurrida dentro del bloque `with` y continúa la ejecución normal."
            },
            {
                "area": "Manejo de Excepciones",
                "enunciado": "¿Qué bloque se ejecuta si el código dentro de un `try` NO produce ningún error?\n\n```python\ntry:\n    x = 10 / 2\nexcept ZeroDivisionError:\n    print('error')\nelse:\n    print('exito')\nfinally:\n    print('fin')\n```",
                "opciones": ["Solo 'fin'", "'error' y 'fin'", "'exito' y 'fin'", "Solo 'exito'"],
                "respuesta_correcta": "'exito' y 'fin'",
                "explicacion": "La cláusula `else` de un bloque `try` se ejecuta única y exclusivamente cuando no se produjo ninguna excepción. Posteriormente, `finally` se ejecuta siempre."
            },
            {
                "area": "Ámbitos y Palabras Clave (global vs nonlocal)",
                "enunciado": "¿Qué imprime este código sobre ámbitos anidados?\n\n```python\ndef exterior():\n    x = 'A'\n    def interior():\n        nonlocal x\n        x = 'B'\n    interior()\n    return x\nprint(exterior())\n```",
                "opciones": ["'A'", "'B'", "UnboundLocalError", "NameError: x is not defined"],
                "respuesta_correcta": "'B'",
                "explicacion": "La palabra clave `nonlocal` vincula la variable al ámbito envolvente más cercano no global (`exterior`), modificando su valor directamente."
            },
            {
                "area": "Slicing y Asignación con Paso",
                "enunciado": "¿Qué ocurre al intentar asignar un slice con paso (step) en una lista?\n\n```python\nnums = [1, 2, 3, 4, 5, 6]\nnums[::2] = [10, 30]\n```",
                "opciones": [
                    "nums queda como [10, 2, 30, 4, 5, 6]",
                    "nums queda como [10, 30, 3, 4, 5, 6]",
                    "ValueError: attempt to assign sequence of size 2 to extended slice of size 3",
                    "IndexError: list assignment index out of range"
                ],
                "respuesta_correcta": "ValueError: attempt to assign sequence of size 2 to extended slice of size 3",
                "explicacion": "En asignaciones a slices extendidos (con `step != 1`), la secuencia asignada debe tener EXACTAMENTE la misma longitud que el slice a reemplazar (3 elementos en este caso: índices 0, 2, 4)."
            },
            {
                "area": "Comparaciones y NaN",
                "enunciado": "¿Cuál es el valor booleano de la siguiente expresión en Python?\n\n```python\nimport math\nnan = float('nan')\nprint(nan == nan, math.isnan(nan))\n```",
                "opciones": ["True True", "False True", "True False", "False False"],
                "respuesta_correcta": "False True",
                "explicacion": "De acuerdo con el estándar IEEE 754 de punto flotante, `NaN` nunca es igual a ningún valor, ni siquiera a sí mismo (`nan == nan` es `False`). Para verificarlo se debe usar `math.isnan()`."
            },
            {
                "area": "Desempaquetado y Operador Splat (*)",
                "enunciado": "¿Qué valores toman `a`, `b` y `c` en la siguiente asignación?\n\n```python\na, *b, c = [10, 20, 30, 40, 50]\n```",
                "opciones": [
                    "a=10, b=[20, 30, 40], c=50",
                    "a=10, b=(20, 30, 40), c=50",
                    "a=10, b=20, c=[30, 40, 50]",
                    "SyntaxError: multiple assignment not allowed"
                ],
                "respuesta_correcta": "a=10, b=[20, 30, 40], c=50",
                "explicacion": "El operador `*` en asignaciones por desempaquetado captura todos los elementos intermedios como una lista (`list`), asignando el primero a `a` y el último a `c`."
            },
            {
                "area": "Decoradores y Preservación de Metadatos",
                "enunciado": "¿Qué utilidad tiene `@functools.wraps` al crear un decorador en Python?",
                "opciones": [
                    "Aumenta la velocidad de ejecución compilando el decorador a C",
                    "Preserva los metadatos de la función original como `__name__` y `__doc__`",
                    "Permite que el decorador acepte argumentos obligatorios",
                    "Evita recursión infinita en funciones generadoras"
                ],
                "respuesta_correcta": "Preserva los metadatos de la función original como `__name__` y `__doc__`",
                "explicacion": "Sin `@wraps`, la función decorada tomaría el nombre (`__name__`) y docstring de la función envoltura interna (wrapper), dificultando la depuración y documentación."
            },
            {
                "area": "Clases y __slots__",
                "enunciado": "¿Cuál es la principal ventaja técnica de declarar `__slots__ = ('x', 'y')` en una clase?",
                "opciones": [
                    "Convierte todos los atributos en privados automáticamente",
                    "Evita la creación del diccionario `__dict__` por instancia, ahorrando memoria y acelerando el acceso",
                    "Permite herencia múltiple sin restricciones de MRO",
                    "Hace que la clase sea serializable en JSON nativamente"
                ],
                "respuesta_correcta": "Evita la creación del diccionario `__dict__` por instancia, ahorrando memoria y acelerando el acceso",
                "explicacion": "`__slots__` asigna espacio estático para los atributos declarados en lugar de crear un `__dict__` por cada instancia, logrando ahorros masivos de memoria en miles o millones de objetos."
            },
            {
                "area": "Estructuras de Datos: Copias Superficiales vs Profundas",
                "enunciado": "¿Qué imprime este código sobre copias de listas anidadas?\n\n```python\nimport copy\noriginal = [[1, 2], [3, 4]]\ncopia = copy.copy(original)\ncopia[0].append(99)\nprint(original[0])\n```",
                "opciones": ["[1, 2]", "[1, 2, 99]", "[[1, 2, 99]]", "AttributeError"],
                "respuesta_correcta": "[1, 2, 99]",
                "explicacion": "`copy.copy` realiza una copia superficial (shallow copy): duplica la lista externa, pero los elementos anidados siguen siendo referencias a los mismos objetos de la lista original. Se requeriría `deepcopy` para duplicar objetos anidados."
            },
            {
                "area": "Comportamiento Booleano y Short-Circuiting",
                "enunciado": "¿Cuál es el valor retornado por la siguiente expresión lógica?\n\n```python\nresultado = [] or ('Python' and 0) or [42]\nprint(resultado)\n```",
                "opciones": ["True", "0", "[42]", "'Python'"],
                "respuesta_correcta": "[42]",
                "explicacion": "`[]` es falsy, por lo que evalúa el siguiente término. `('Python' and 0)` evalúa a `0` (falsy porque `and` retorna el último valor si es falso). Finalmente, `0 or [42]` evalúa a `[42]`."
            },
            {
                "area": "Generadores y Delegación (yield from)",
                "enunciado": "¿Qué realiza la sentencia `yield from subgenerador()` en Python?",
                "opciones": [
                    "Detiene el generador padre hasta que termine el hilo secundario",
                    "Delega la iteración directamente al subgenerador y establece un canal bidireccional para send() y throw()",
                    "Crea una copia en memoria de todos los valores del subgenerador",
                    "Lanza una excepción si el subgenerador no es una lista"
                ],
                "respuesta_correcta": "Delega la iteración directamente al subgenerador y establece un canal bidireccional para send() y throw()",
                "explicacion": "`yield from` no solo itera sobre el iterable produciendo sus valores, sino que establece una conexión directa para reenviar llamadas a `.send()`, `.throw()` y `.close()` hacia el subgenerador."
            },
            {
                "area": "Manejo de Memoria y Garbage Collection",
                "enunciado": "¿Cuál es el mecanismo principal de recolección de basura en CPython?",
                "opciones": [
                    "Mark and Sweep periódico exclusivamente",
                    "Conteo de referencias (Reference Counting) asistido por un recolector de ciclos cíclicos",
                    "Gestión manual con punteros libres",
                    "Generational Coping Collector de Java"
                ],
                "respuesta_correcta": "Conteo de referencias (Reference Counting) asistido por un recolector de ciclos cíclicos",
                "explicacion": "CPython destruye los objetos inmediatamente cuando su conteo de referencias llega a 0 (`sys.getrefcount`). Además, tiene un detector de ciclos para limpiar referencias circulares aisladas."
            },
            {
                "area": "Diccionarios: Fusión Moderna en Python 3.9+",
                "enunciado": "¿Cuál es el operador introducido en Python 3.9 para fusionar dos diccionarios?\n\n```python\nd1 = {'a': 1, 'b': 2}\nd2 = {'b': 99, 'c': 3}\n# ¿Cómo fusionarlos en un nuevo diccionario?\n```",
                "opciones": ["d1 + d2", "d1 | d2", "d1 & d2", "d1.merge(d2)"],
                "respuesta_correcta": "d1 | d2",
                "explicacion": "PEP 584 introdujo el operador de unión `|` (y `|=` para actualización in-place) para diccionarios en Python 3.9+, donde los valores del operando derecho sobrescriben los del izquierdo."
            },
            {
                "area": "Funciones Built-in: all() y any() con Secuencias Vacías",
                "enunciado": "¿Cuál es el resultado de evaluar `all([])` y `any([])` en Python?",
                "opciones": ["False False", "True False", "True True", "False True"],
                "respuesta_correcta": "True False",
                "explicacion": "`all([])` es `True` por verdad vacía (vacuous truth: no existe ningún elemento falso que invalide la condición). `any([])` es `False` porque no existe ningún elemento verdadero."
            },
            {
                "area": "Propiedades y Descriptores",
                "enunciado": "¿Qué protocolo debe implementar una clase para comportarse como un Descriptor en Python?",
                "opciones": [
                    "Solo `__call__`",
                    "Al menos uno entre `__get__`, `__set__` o `__delete__`",
                    "`__enter__` y `__exit__`",
                    "`__iter__` y `__next__`"
                ],
                "respuesta_correcta": "Al menos uno entre `__get__`, `__set__` o `__delete__`",
                "explicacion": "El protocolo de descriptores en Python se activa definiendo cualquiera de los métodos mágicos `__get__`, `__set__` o `__delete__`, permitiendo interceptar el acceso a atributos (base de `@property`)."
            },
            {
                "area": "Ámbitos: Comprensiones en Python 3",
                "enunciado": "¿Qué imprime este código en Python 3 respecto al alcance de variables en comprensiones?\n\n```python\ni = 100\ncuadrados = [i * 2 for i in range(5)]\nprint(i)\n```",
                "opciones": ["4", "100", "8", "NameError: name 'i' is not defined"],
                "respuesta_correcta": "100",
                "explicacion": "En Python 3, las comprensiones de listas tienen su propio ámbito de función local y NO filtran (leak) sus variables de iteración al ámbito exterior, preservando `i = 100`."
            },
            {
                "area": "Tipos y Comparación de Subclases con isinstance() vs type()",
                "enunciado": "¿Cuál es la diferencia crítica entre `isinstance(obj, Clase)` y `type(obj) is Clase`?",
                "opciones": [
                    "No hay diferencia, son idénticos",
                    "`isinstance` tiene en cuenta la herencia (retorna True para subclases), mientras que `type() is` verifica igualdad exacta de tipo",
                    "`type() is` evalúa subclases automáticamente",
                    "`isinstance` solo funciona con tipos primitivos"
                ],
                "respuesta_correcta": "`isinstance` tiene en cuenta la herencia (retorna True para subclases), mientras que `type() is` verifica igualdad exacta de tipo",
                "explicacion": "`isinstance` respeta el polimorfismo y la jerarquía de herencia (Liskov Substitution Principle), mientras que comparar `type(obj) is Clase` rompe con subclases legítimas."
            }
        ]

        copia = list(banco)
        random.shuffle(copia)
        return copia[:num_preguntas]

    def generar_pregunta_banco(self, area: str = 'sintaxis', dificultad: str = 'media', tema: str = '') -> Dict[str, Any]:
        """Genera una pregunta individual de alta calidad pedagógica para el banco administrativo con dificultad seleccionable"""
        dificultad = dificultad.lower() if dificultad in ['facil', 'media', 'dificil', 'extrema'] else 'media'
        nombres_areas = {
            'sintaxis': 'Sintaxis básica y estructuras de control en Python',
            'poo': 'Programación Orientada a Objetos en Python (clases, herencia, encapsulamiento, polimorfismo)',
            'algoritmos': 'Algoritmos y Estructuras de Datos en Python (listas, dicts, recursión, ordenamiento, complejidad)'
        }
        area_nombre = nombres_areas.get(area, area)

        instruccion_dif = ""
        if dificultad == 'extrema':
            instruccion_dif = "\nNIVEL EXTREMO: Pregunta sobre arquitectura interna de CPython (GIL, optimización de bytecode peephole, MRO C3 linearization, late binding en closures, descriptors __get__/__set__, slots de memoria __slots__, o decoradores con metadatos preservados)."
        elif dificultad == 'dificil':
            instruccion_dif = "\nNIVEL DIFÍCIL: Pregunta analítica sobre casos borde, propagación de excepciones o estructuras avanzadas."
        elif dificultad == 'facil':
            instruccion_dif = "\nNIVEL FÁCIL: Pregunta directa y accesible para validar comprensión de conceptos fundamentales."

        if self.provider.tiene_api_key():
            prompt = f"""Actúa como un profesor senior y diseñador de evaluaciones técnicas de Python en PyLevel.
Genera UNA (1) pregunta inédita y de alta calidad para la evaluación diagnóstica.

Área temática: {area_nombre} ({area})
Nivel de dificultad: {dificultad.upper()}
{instruccion_dif}
{f'Sub-tema enfocado: {tema}' if tema else ''}

REGLAS:
- Pregunta de opción múltiple con exactamente 4 opciones de respuesta realistas y bien diferenciadas.
- Incluye un fragmento de código si es pertinente para evaluar el tema.
- La justificación pedagógica (explicacion) debe ser clara y educativa (1 o 2 oraciones).
- Devuelve ÚNICAMENTE un objeto JSON estricto sin bloques de texto conversacional.

Estructura JSON requerida:
{{
  "enunciado": "Texto claro del enunciado de la pregunta (puede incluir fragmento de código Python si aplica)",
  "tipo": "opcion_multiple",
  "dificultad": "{dificultad}",
  "tema": "{tema or 'general'}",
  "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
  "respuesta_correcta": "Texto exacto de la opción correcta que coincide con una de las opciones",
  "explicacion": "Explicación pedagógica que sustenta la respuesta correcta."
}}
"""
            sys_inst = "Eres un autor de exámenes técnicos de Python. Devuelve estrictamente el JSON sin explicaciones adicionales."
            schema_pregunta = {
                "type": "OBJECT",
                "properties": {
                    "enunciado": {"type": "STRING"},
                    "tipo": {"type": "STRING"},
                    "dificultad": {"type": "STRING"},
                    "tema": {"type": "STRING"},
                    "opciones": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "respuesta_correcta": {"type": "STRING"},
                    "explicacion": {"type": "STRING"}
                },
                "required": ["enunciado", "tipo", "dificultad", "tema", "opciones", "respuesta_correcta", "explicacion"]
            }
            resp = self.provider.consultar(prompt, sys_inst, max_tokens=1200, temperature=0.4, json_mode=True, response_schema=schema_pregunta)
            if resp:
                try:
                    clean = resp.strip()
                    if clean.startswith("```"):
                        lines = clean.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        clean = "\n".join(lines).strip()
                    data = json.loads(clean, strict=False)
                    if data.get('enunciado') and data.get('opciones') and data.get('respuesta_correcta'):
                        data['dificultad'] = dificultad
                        return {
                            'success': True,
                            'fuente': 'gemini',
                            'modelo': self.provider.modelo,
                            'pregunta': data
                        }
                except Exception as e:
                    print(f"[ExamsManager] Error al parsear pregunta generada con IA: {e}")

        # Fallback local
        return self._generar_pregunta_banco_local(area, dificultad, tema)

    def _generar_pregunta_banco_local(self, area: str, dificultad: str, tema: str) -> Dict[str, Any]:
        """Generador local de preguntas para el banco con soporte para dificultad extrema"""
        banco_respaldo = {
            'sintaxis': [
                {
                    "enunciado": "¿Qué resultado produce la expresión `[x for x in range(10) if x % 3 == 0]`?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "comprensiones",
                    "opciones": ["[0, 3, 6, 9]", "[3, 6, 9]", "[0, 3, 6]", "[1, 3, 6, 9]"],
                    "respuesta_correcta": "[0, 3, 6, 9]",
                    "explicacion": "range(10) va del 0 al 9. Los números múltiplos de 3 donde x % 3 == 0 son exactamente 0, 3, 6 y 9."
                },
                {
                    "enunciado": "¿Cuál es la forma correcta de desempaquetar el primer elemento y el resto en una lista en Python 3?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "desempaquetado",
                    "opciones": ["primero, *resto = lista", "*primero, resto = lista", "primero, resto* = lista", "primero, &resto = lista"],
                    "respuesta_correcta": "primero, *resto = lista",
                    "explicacion": "El operador estrella (*) en asignación extendida captura los elementos restantes en una nueva lista."
                },
                {
                    "enunciado": "¿Qué ocurre al evaluar este código debido al fenómeno de 'Late Binding' en closures?\n\n```python\nfuncs = [lambda: i for i in range(3)]\nprint([f() for f in funcs])\n```",
                    "tipo": "opcion_multiple",
                    "dificultad": "extrema",
                    "tema": "closures_late_binding",
                    "opciones": ["[2, 2, 2]", "[0, 1, 2]", "[0, 0, 0]", "IndexError"],
                    "respuesta_correcta": "[2, 2, 2]",
                    "explicacion": "Las lambdas buscan `i` en tiempo de invocación (late binding), momento en el cual el bucle ya terminó con `i = 2`."
                }
            ],
            'poo': [
                {
                    "enunciado": "¿Qué decorador nativo permite definir un método de clase que recibe `cls` en lugar de `self`?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "decoradores_poo",
                    "opciones": ["@classmethod", "@staticmethod", "@property", "@classmethod_only"],
                    "respuesta_correcta": "@classmethod",
                    "explicacion": "@classmethod enlaza el método a la clase en sí, recibiendo `cls` como primer argumento implícito."
                },
                {
                    "enunciado": "En la herencia múltiple de Python, ¿qué atributo o método permite inspeccionar el orden de resolución de métodos?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "mro",
                    "opciones": ["Clase.mro()", "Clase.__order__", "Clase.resolve_order()", "Clase.__hierarchy__"],
                    "respuesta_correcta": "Clase.mro()",
                    "explicacion": "El método `.mro()` (Method Resolution Order) o el atributo `__mro__` devuelven la tupla con el orden C3 de búsqueda de métodos."
                },
                {
                    "enunciado": "Al implementar el protocolo de Descriptores en Python, ¿cuál es la diferencia crucial entre un 'Data Descriptor' y un 'Non-Data Descriptor'?",
                    "tipo": "opcion_multiple",
                    "dificultad": "extrema",
                    "tema": "descriptores",
                    "opciones": [
                        "Data Descriptor implementa `__set__` o `__delete__` y tiene mayor precedencia que el `__dict__` de la instancia",
                        "Non-Data Descriptor no permite llamar a funciones",
                        "Data Descriptor solo acepta números flotantes y enteros",
                        "No existe diferencia en la prioridad de resolución de atributos"
                    ],
                    "respuesta_correcta": "Data Descriptor implementa `__set__` o `__delete__` y tiene mayor precedencia que el `__dict__` de la instancia",
                    "explicacion": "Los descriptores de datos que definen `__set__` anulan la búsqueda en el diccionario de la instancia, mientras que los descriptores sin datos (`__get__` únicamente) ceden prioridad al `__dict__` local."
                }
            ],
            'algoritmos': [
                {
                    "enunciado": "¿Cuál es la complejidad temporal promedio de buscar un elemento por clave en un diccionario de Python (`dict`)?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "complejidad",
                    "opciones": ["O(1) constante", "O(n) lineal", "O(log n) logarítmica", "O(n log n)"],
                    "respuesta_correcta": "O(1) constante",
                    "explicacion": "Los diccionarios en Python están implementados sobre tablas hash, lo que ofrece acceso en tiempo promedio O(1)."
                },
                {
                    "enunciado": "Al implementar una cola (FIFO) eficiente en Python, ¿cuál estructura del módulo `collections` se recomienda?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "estructuras_datos",
                    "opciones": ["collections.deque", "collections.Counter", "collections.OrderedDict", "collections.defaultdict"],
                    "respuesta_correcta": "collections.deque",
                    "explicacion": "`collections.deque` permite operaciones de inserción y extracción en ambos extremos (append/popleft) en O(1) estricto."
                },
                {
                    "enunciado": "¿Cómo garantiza el algoritmo Timsort de Python (usado en `list.sort()`) su estabilidad y su complejidad de O(n log n) en el peor caso?",
                    "tipo": "opcion_multiple",
                    "dificultad": "extrema",
                    "tema": "timsort",
                    "opciones": [
                        "Divide la lista en secuencias ordenadas naturales ('runs') y las fusiona manteniendo invariantes de tamaño en una pila",
                        "Aplica QuickSort con pivote aleatorio y fallback a BubbleSort",
                        "Convierte la lista a un árbol AVL binario temporalmente",
                        "Utiliza Radix Sort en base 256 para cualquier tipo de dato"
                    ],
                    "respuesta_correcta": "Divide la lista en secuencias ordenadas naturales ('runs') y las fusiona manteniendo invariantes de tamaño en una pila",
                    "explicacion": "Timsort identifica secuencias naturales crecientes o decrecientes ('runs'), usa inserción binaria para secuencias cortas y las combina con una pila respetando invariantes O(n log n)."
                }
            ]
        }

        candidatos_area = banco_respaldo.get(area, banco_respaldo['sintaxis'])
        compatibles = [p for p in candidatos_area if p.get('dificultad') == dificultad]
        if not compatibles:
            compatibles = candidatos_area

        pregunta = dict(random.choice(compatibles))
        pregunta['dificultad'] = dificultad
        if tema:
            pregunta['tema'] = tema

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Generador Pedagógico Local',
            'pregunta': pregunta
        }

    def generar_banco_completo(self, num_preguntas: int = 20, perfil_dificultad: str = 'balanceado') -> Dict[str, Any]:
        """Genera un banco de 20 preguntas inéditas según el perfil de dificultad elegido por el usuario"""
        perfil_dificultad = (perfil_dificultad or 'balanceado').lower()

        perfiles_instruccion = {
            'extrema': "PERFIL EXTREMO OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'extrema' enfocadas en temas profundos de CPython, GIL, MRO C3, metaclasses, descriptores, bytecodes y algoritmos de alta complejidad.",
            'dificil': "PERFIL DIFÍCIL OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'dificil' con desafíos analíticos, código con edge cases y patrones avanzados.",
            'media': "PERFIL MEDIO OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'media' con preguntas técnicas balanceadas de nivel intermedio.",
            'facil': "PERFIL FÁCIL OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'facil' orientadas a principiantes, sintaxis limpia y conceptos directos.",
            'balanceado': "PERFIL BALANCEADO: Diversifica las dificultades, incluyendo preguntas fáciles (~30%), medias (~40%) y difíciles/extremas (~30%)."
        }
        instruccion_perfil = perfiles_instruccion.get(perfil_dificultad, perfiles_instruccion['balanceado'])

        if self.provider.tiene_api_key():
            prompt = f"""Actúa como el evaluador principal de Python en PyLevel Academy.
Genera un BANCO COMPLETO Y TOTALMENTE NUEVO de exactamente 20 preguntas de evaluación técnica en Python.

CONFIGURACIÓN DE DIFICULTAD:
{instruccion_perfil}

Distribución obligatoria:
- 7 preguntas para el área 'sintaxis' (variables, operadores, bucles, funciones, slicing, excepciones, comprensiones).
- 7 preguntas para el área 'poo' (clases, __init__, herencia, polimorfismo, decoradores @property/@classmethod, encapsulamiento, MRO).
- 6 preguntas para el área 'algoritmos' (búsqueda binaria, ordenamiento, complejidad Big-O, diccionarios/sets, pilas/colas, recursión).

REGLAS ESTRICTAS:
- Cada pregunta debe ser de opción múltiple con 4 opciones.
- Incluye fragmentos de código breves y limpios cuando aplique.
- Devuelve ÚNICAMENTE un objeto JSON válido con las 3 claves: "sintaxis", "poo" y "algoritmos".
- NO agregues texto antes ni después.

Estructura JSON requerida:
{{
  "sintaxis": [
    {{
      "enunciado": "...",
      "tipo": "opcion_multiple",
      "dificultad": "{perfil_dificultad if perfil_dificultad in ['facil', 'media', 'dificil', 'extrema'] else 'media'}",
      "tema": "nombre_subtema",
      "opciones": ["A", "B", "C", "D"],
      "respuesta_correcta": "A",
      "explicacion": "Explicación breve y didáctica."
    }}
  ],
  "poo": [...],
  "algoritmos": [...]
}}
"""
            sys_inst = "Eres un examinador senior de Python. Devuelve únicamente el objeto JSON con las 20 preguntas del banco sin formato markdown adicional."
            item_schema = {
                "type": "OBJECT",
                "properties": {
                    "enunciado": {"type": "STRING"},
                    "tipo": {"type": "STRING"},
                    "dificultad": {"type": "STRING"},
                    "tema": {"type": "STRING"},
                    "opciones": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "respuesta_correcta": {"type": "STRING"},
                    "explicacion": {"type": "STRING"}
                },
                "required": ["enunciado", "tipo", "dificultad", "tema", "opciones", "respuesta_correcta", "explicacion"]
            }
            schema_banco = {
                "type": "OBJECT",
                "properties": {
                    "sintaxis": {"type": "ARRAY", "items": item_schema},
                    "poo": {"type": "ARRAY", "items": item_schema},
                    "algoritmos": {"type": "ARRAY", "items": item_schema}
                },
                "required": ["sintaxis", "poo", "algoritmos"]
            }
            resp = self.provider.consultar(prompt, sys_inst, max_tokens=4000, temperature=0.35, timeout=40.0, json_mode=True, response_schema=schema_banco)
            if resp:
                try:
                    clean = resp.strip()
                    if clean.startswith("```"):
                        lines = clean.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        clean = "\n".join(lines).strip()
                    data = json.loads(clean, strict=False)
                    if isinstance(data, dict) and 'sintaxis' in data and 'poo' in data and 'algoritmos' in data:
                        banco_limpio = {'sintaxis': [], 'poo': [], 'algoritmos': []}
                        for area in ['sintaxis', 'poo', 'algoritmos']:
                            for p in data[area]:
                                if isinstance(p, dict) and p.get('enunciado') and p.get('opciones') and p.get('respuesta_correcta'):
                                    p['tipo'] = 'opcion_multiple'
                                    banco_limpio[area].append(p)
                        
                        total = sum(len(l) for l in banco_limpio.values())
                        if total >= 15:
                            return {
                                'success': True,
                                'fuente': 'gemini',
                                'modelo': self.provider.modelo,
                                'banco': banco_limpio
                            }
                except Exception as e:
                    print(f"[ExamsManager] Error al parsear banco completo de IA: {e}")

        # Fallback local garantizado de 20 preguntas completas
        banco_local = self._generar_banco_completo_local(num_preguntas)
        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Generador Algorítmico Local',
            'banco': banco_local
        }

    def _generar_banco_completo_local(self, num_preguntas: int = 20) -> Dict[str, List[Dict[str, Any]]]:
        """Banco local garantizado de 20 preguntas inéditas de alta calidad"""
        return {
            "sintaxis": [
                {
                    "enunciado": "¿Cuál es el valor final de `resultado` tras ejecutar este código?\n\n```python\nvalores = [1, 2, 3, 4]\nresultado = [x * 2 for x in valores if x % 2 == 0]\n```",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "comprensiones",
                    "opciones": ["[4, 8]", "[2, 4, 6, 8]", "[4]", "[2, 4]"],
                    "respuesta_correcta": "[4, 8]",
                    "explicacion": "El filtro `x % 2 == 0` selecciona solo 2 y 4. Al multiplicarlos por 2, obtenemos `[4, 8]`."
                },
                {
                    "enunciado": "¿Qué palabra clave se utiliza para capturar y manejar excepciones en Python?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "excepciones",
                    "opciones": ["except", "catch", "handle", "rescue"],
                    "respuesta_correcta": "except",
                    "explicacion": "En Python, la captura de errores se realiza con los bloques `try` y `except`."
                },
                {
                    "enunciado": "¿Cuál es la salida de `print('Python'[1:4])`?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "slicing",
                    "opciones": ["yth", "ytho", "Pyt", "y"],
                    "respuesta_correcta": "yth",
                    "explicacion": "El rebanado `[1:4]` toma los índices 1, 2 y 3 ('y', 't', 'h'), excluyendo el índice de parada 4."
                },
                {
                    "enunciado": "¿Qué estructura crea la expresión `{x: x**2 for x in (1, 2, 3)}`?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "diccionarios",
                    "opciones": ["Un diccionario (dict)", "Un conjunto (set)", "Una tupla", "Un generador"],
                    "respuesta_correcta": "Un diccionario (dict)",
                    "explicacion": "La sintaxis con llaves `{clave: valor}` corresponde a una comprensión de diccionario (dict comprehension)."
                },
                {
                    "enunciado": "¿Qué operador lógico evalúa a `True` únicamente si ambos operandos son verdaderos?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "operadores",
                    "opciones": ["and", "or", "not", "xor"],
                    "respuesta_correcta": "and",
                    "explicacion": "El operador `and` aplica conjunción lógica y exige que ambos lados sean verdaderos."
                },
                {
                    "enunciado": "¿Cómo se define un parámetro de función con número arbitrario de argumentos posicionales?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "funciones",
                    "opciones": ["*args", "**kwargs", "&args", "...args"],
                    "respuesta_correcta": "*args",
                    "explicacion": "El prefijo asterisco `*args` agrupa los argumentos posicionales adicionales en una tupla."
                },
                {
                    "enunciado": "¿Qué imprime la instrucción `bool([])` en Python?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "tipos_datos",
                    "opciones": ["False", "True", "None", "TypeError"],
                    "respuesta_correcta": "False",
                    "explicacion": "En Python, las colecciones vacías (como listas `[]`, tuplas `()` o dicts `{}`) evalúan a `False` (*falsy*)."
                }
            ],
            "poo": [
                {
                    "enunciado": "¿Cuál es el propósito principal del método especial `__init__` en una clase?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "constructores",
                    "opciones": [
                        "Inicializar los atributos de la instancia recién creada",
                        "Asignar la memoria física del objeto en C",
                        "Eliminar el objeto de la memoria",
                        "Importar los módulos de la clase"
                    ],
                    "respuesta_correcta": "Inicializar los atributos de la instancia recién creada",
                    "explicacion": "`__init__` es el inicializador de instancia que recibe `self` para configurar los atributos iniciales del objeto."
                },
                {
                    "enunciado": "¿Cómo se invoca el método de la clase padre en una subclase respetando la cadena de herencia?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "herencia",
                    "opciones": ["super().metodo()", "parent.metodo()", "base.metodo()", "this.super()"],
                    "respuesta_correcta": "super().metodo()",
                    "explicacion": "La función `super()` devuelve un objeto proxy que delega las llamadas a métodos de la clase base según el MRO."
                },
                {
                    "enunciado": "¿Qué convención de nombrado sugiere que un atributo está previsto para uso interno (protegido)?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "encapsulamiento",
                    "opciones": [
                        "Un guion bajo inicial (ej. `_variable`)",
                        "La palabra clave `private`",
                        "Signo de dólar (ej. `$variable`)",
                        "Mayúsculas sostenidas (ej. `VARIABLE`)"
                    ],
                    "respuesta_correcta": "Un guion bajo inicial (ej. `_variable`)",
                    "explicacion": "PEP 8 establece un guion bajo inicial `_nombre` como convención de uso interno o protegido."
                },
                {
                    "enunciado": "¿Qué decorador se utiliza para acceder a un método como si fuera un atributo de solo lectura?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "propiedades",
                    "opciones": ["@property", "@getter", "@attribute", "@readonly"],
                    "respuesta_correcta": "@property",
                    "explicacion": "El decorador nativo `@property` permite definir getters que se consumen con sintaxis de atributo `obj.propiedad`."
                },
                {
                    "enunciado": "¿Cuál método dunder define la representación en cadena legible para el usuario final al usar `print(obj)`?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "metodos_magicos",
                    "opciones": ["__str__", "__repr__", "__print__", "__format__"],
                    "respuesta_correcta": "__str__",
                    "explicacion": "`__str__` retorna una representación amigable en texto destinada a usuarios (`print` y `str()`)."
                },
                {
                    "enunciado": "¿Qué ocurre si una clase define `__slots__ = ('nombre', 'edad')`?",
                    "tipo": "opcion_multiple",
                    "dificultad": "dificil",
                    "tema": "optimizacion_poo",
                    "opciones": [
                        "Optimiza el uso de memoria eliminando el diccionario interno `__dict__`",
                        "Impide crear instancias de la clase",
                        "Obliga a que todos los atributos sean privados",
                        "Convierte la clase en una interfaz abstracta"
                    ],
                    "respuesta_correcta": "Optimiza el uso de memoria eliminando el diccionario interno `__dict__`",
                    "explicacion": "`__slots__` asigna espacio estático para atributos, reduciendo drásticamente la memoria al prescindir de `__dict__`."
                },
                {
                    "enunciado": "¿Qué permite el polimorfismo en Python mediante el concepto de *Duck Typing*?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "polimorfismo",
                    "opciones": [
                        "Usar objetos según sus métodos disponibles sin importar su clase explícita",
                        "Obligar a heredar de la clase base `Duck`",
                        "Compilar código en tiempo de ejecución",
                        "Duplicar objetos automáticamente en memoria"
                    ],
                    "respuesta_correcta": "Usar objetos según sus métodos disponibles sin importar su clase explícita",
                    "explicacion": "Duck typing ('si camina como pato y grazna como pato') se enfoca en las capacidades del objeto más que en su tipo estático."
                }
            ],
            "algoritmos": [
                {
                    "enunciado": "¿Cuál es la complejidad temporal de la Búsqueda Binaria (*Binary Search*) sobre una lista ordenada de tamaño $n$?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "busqueda",
                    "opciones": ["O(log n)", "O(n)", "O(1)", "O(n^2)"],
                    "respuesta_correcta": "O(log n)",
                    "explicacion": "Al dividir el espacio de búsqueda a la mitad en cada paso, el algoritmo opera en tiempo logarítmico O(log n)."
                },
                {
                    "enunciado": "¿Qué estructura de datos opera bajo el principio LIFO (Last In, First Out)?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "estructuras",
                    "opciones": ["Pila (Stack)", "Cola (Queue)", "Árbol Binario", "Grafo"],
                    "respuesta_correcta": "Pila (Stack)",
                    "explicacion": "Una pila o stack procesa el último elemento insertado primero (LIFO)."
                },
                {
                    "enunciado": "¿Cuál es la complejidad temporal promedio del algoritmo Timsort (`lista.sort()`) en Python?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "ordenamiento",
                    "opciones": ["O(n log n)", "O(n^2)", "O(n)", "O(log n)"],
                    "respuesta_correcta": "O(n log n)",
                    "explicacion": "Timsort (algoritmo híbrido nativo de CPython) tiene una complejidad de O(n log n) en el caso promedio y peor caso."
                },
                {
                    "enunciado": "En una función recursiva, ¿qué elemento es indispensable para evitar un error de recursión infinita (*RecursionError*)?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "recursion",
                    "opciones": ["Un caso base que termine la recursión", "Un bucle while exterior", "Una instrucción try/except", "Un decorador @lru_cache"],
                    "respuesta_correcta": "Un caso base que termine la recursión",
                    "explicacion": "El caso base detiene las llamadas recursivas sucesivas cuando se alcanza la condición de parada."
                },
                {
                    "enunciado": "¿Qué método nativo de listas permite eliminar y retornar el último elemento en tiempo O(1)?",
                    "tipo": "opcion_multiple",
                    "dificultad": "facil",
                    "tema": "listas",
                    "opciones": ["pop()", "remove()", "delete()", "shift()"],
                    "respuesta_correcta": "pop()",
                    "explicacion": "`.pop()` sin argumentos elimina y devuelve el elemento del extremo final de la lista en O(1)."
                },
                {
                    "enunciado": "¿Qué técnica algorítmica almacena resultados de subproblemas ya resueltos para evitar cómputos redundantes?",
                    "tipo": "opcion_multiple",
                    "dificultad": "media",
                    "tema": "programacion_dinamica",
                    "opciones": [
                        "Programación Dinámica / Memoización",
                        "Fuerza Bruta",
                        "Búsqueda Exhaustiva",
                        "Backtracking sin poda"
                    ],
                    "respuesta_correcta": "Programación Dinámica / Memoización",
                    "explicacion": "La memoización y programación dinámica reutilizan soluciones previas para optimizar algoritmos recursivos costosos."
                }
            ]
        }
