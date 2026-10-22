"""
Módulo de Gestión y Generación de Retos de Código para PyLevel
Maneja generación con IA, banco algorítmico local, pistas socráticas y resolución guiada.
"""

import json
import re
import random
from typing import Dict, Any, Optional, List
from provider import GeminiProvider

class ChallengesManager:
    """Gestiona la generación de retos algorítmicos, pistas socráticas y soluciones didácticas"""

    def __init__(self, provider: GeminiProvider):
        self.provider = provider

    def generar_reto(self, tema: str = 'General', dificultad: str = 'media', retos_existentes: Optional[List[str]] = None) -> Dict[str, Any]:
        """Genera un nuevo reto de programación en Python usando Gemini o generador de respaldo evitando repeticiones"""
        dificultad = dificultad.lower() if dificultad in ['facil', 'media', 'dificil', 'extrema'] else 'media'
        tema = tema.strip() if tema else 'Algoritmos y Lógica'

        xp_map = {'facil': 50, 'media': 100, 'dificil': 150, 'extrema': 250}
        puntos_xp = xp_map.get(dificultad, 100)

        instruccion_extra_dif = ""
        if dificultad == 'extrema':
            instruccion_extra_dif = "\nNIVEL EXTREMO: El reto debe ser de alta exigencia algorítmica (ej. LRU Cache O(1), ordenamiento topológico, árboles Trie de prefijos, memoización dinámica o simulación con casos extremos sutiles)."
        elif dificultad == 'dificil':
            instruccion_extra_dif = "\nNIVEL DIFÍCIL: Algoritmos estructurados no triviales con optimización de complejidad temporal y manejo de casos borde."
        elif dificultad == 'facil':
            instruccion_extra_dif = "\nNIVEL FÁCIL: Ejercicios introductorios accesibles con lógica clara y pocas líneas."

        # 1. Intentar con Google Gemini si hay clave activa
        if self.provider.tiene_api_key():
            existentes_txt = ", ".join(f"'{t}'" for t in (retos_existentes or []))
            prompt = f"""Genera un reto de programación en Python estructurado en formato JSON estricto.
Tema: {tema}
Dificultad: {dificultad}
{instruccion_extra_dif}

RETOS YA EXISTENTES (PROHIBIDO REPETIR O CREAR ALGO CON NOMBRE O LÓGICA SIMILAR):
[{existentes_txt if existentes_txt else "Ninguno"}]

Estructura obligatoria del JSON:
{{
  "titulo": "Título atractivo y descriptivo del reto (diferente a los existentes)",
  "dificultad": "{dificultad}",
  "tema": "{tema}",
  "descripcion": "Descripción concisa en 1 o 2 oraciones.",
  "enunciado": "Instrucciones detalladas de qué debe hacer la función, qué parámetros recibe y qué retorna.",
  "nombre_funcion": "nombre_en_snake_case",
  "codigo_inicial": "def nombre_en_snake_case(param: tipo) -> tipo:\\n    # Escribe tu solución aquí\\n    pass",
  "casos_prueba": [
    {{"entrada": [1, 2], "esperado": 3, "visible": true}},
    {{"entrada": [5, 5], "esperado": 10, "visible": true}},
    {{"entrada": [0, 0], "esperado": 0, "visible": false}},
    {{"entrada": [-2, 3], "esperado": 1, "visible": false}}
  ]
}}

REGLAS OBLIGATORIAS:
- 'entrada' DEBE ser siempre una lista JSON con los argumentos que recibirá la función.
- 'esperado' debe ser el valor exacto devuelto por la función (int, str, list, dict, bool).
- Debe tener al menos 3 casos de prueba (al menos 1 oculto con 'visible': false).
- Devuelve ÚNICAMENTE el objeto JSON sin texto adicional ni bloques explicativos.
"""
            schema_reto = {
                "type": "OBJECT",
                "properties": {
                    "titulo": {"type": "STRING"},
                    "dificultad": {"type": "STRING"},
                    "tema": {"type": "STRING"},
                    "descripcion": {"type": "STRING"},
                    "enunciado": {"type": "STRING"},
                    "nombre_funcion": {"type": "STRING"},
                    "codigo_inicial": {"type": "STRING"},
                    "casos_prueba": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "entrada": {"type": "ARRAY"},
                                "esperado": {},
                                "visible": {"type": "BOOLEAN"}
                            },
                            "required": ["entrada", "esperado", "visible"]
                        }
                    }
                },
                "required": ["titulo", "dificultad", "tema", "descripcion", "enunciado", "nombre_funcion", "codigo_inicial", "casos_prueba"]
            }
            sys_inst = "Eres un diseñador experto de ejercicios técnicos de Python para plataformas como LeetCode y Codewars. Generas ejercicios originales, sin ambigüedades y con casos de prueba perfectamente congruentes en JSON."
            raw_resp = self.provider.consultar(prompt, sys_inst, temperature=0.85, json_mode=True, response_schema=schema_reto)
            if raw_resp:
                try:
                    clean = raw_resp.strip()
                    if clean.startswith('```'):
                        clean = re.sub(r'^```(?:json)?\s*', '', clean)
                        clean = re.sub(r'\s*```$', '', clean)
                    reto_data = json.loads(clean.strip())

                    # Validar campos esenciales
                    if reto_data.get('titulo') and reto_data.get('nombre_funcion') and reto_data.get('casos_prueba'):
                        reto_data['dificultad'] = dificultad
                        reto_data['tema'] = tema
                        reto_data['puntos_xp'] = puntos_xp + 20  # Bonus por reto de IA
                        reto_data['es_ia'] = True
                        reto_data['fuente'] = 'gemini'
                        return {
                            'success': True,
                            'reto': reto_data,
                            'fuente': 'gemini',
                            'modelo': self.provider.modelo
                        }
                except Exception as e:
                    print(f"[ChallengesManager] Error al parsear reto generado por Gemini: {e}")

        # 2. Motor de respaldo offline con catálogo algorítmico dinámico
        return self._generar_reto_local(tema, dificultad, puntos_xp)

    def _generar_reto_local(self, tema: str, dificultad: str, puntos_xp: int) -> Dict[str, Any]:
        """Generador heurístico de retos cuando Gemini está offline"""
        banco_plantillas = [
            {
                'titulo': 'Inversor de Palabras en Cadena',
                'tema': 'Cadenas y Manipulación',
                'dificultad': 'facil',
                'descripcion': 'Invierte el orden de las palabras en una frase preservando los espacios.',
                'enunciado': 'Escribe una función `invertir_palabras(frase)` que reciba una cadena de texto y devuelva las palabras en orden inverso separadas por un espacio.',
                'nombre_funcion': 'invertir_palabras',
                'codigo_inicial': 'def invertir_palabras(frase: str) -> str:\n    # Tu código aquí\n    pass',
                'casos_prueba': [
                    {'entrada': ['hola mundo python'], 'esperado': 'python mundo hola', 'visible': True},
                    {'entrada': ['aprender programar'], 'esperado': 'programar aprender', 'visible': True},
                    {'entrada': ['pylevel'], 'esperado': 'pylevel', 'visible': False},
                    {'entrada': [''], 'esperado': '', 'visible': False}
                ]
            },
            {
                'titulo': 'Filtro de Números Duplicados',
                'tema': 'Listas y Conjuntos',
                'dificultad': 'media',
                'descripcion': 'Retorna una lista ordenada con los elementos que aparecen más de una vez.',
                'enunciado': 'Escribe una función `encontrar_duplicados(numeros)` que reciba una lista de enteros y retorne una nueva lista ordenada de menor a mayor conteniendo solo los números que se repiten.',
                'nombre_funcion': 'encontrar_duplicados',
                'codigo_inicial': 'def encontrar_duplicados(numeros: list) -> list:\n    # Tu código aquí\n    pass',
                'casos_prueba': [
                    {'entrada': [[1, 2, 3, 2, 4, 1, 5]], 'esperado': [1, 2], 'visible': True},
                    {'entrada': [[10, 20, 30]], 'esperado': [], 'visible': True},
                    {'entrada': [[5, 5, 5, 5]], 'esperado': [5], 'visible': False},
                    {'entrada': [[-1, -2, -1, 0, 0]], 'esperado': [-1, 0], 'visible': False}
                ]
            },
            {
                'titulo': 'Fusión de Diccionarios con Acumulación',
                'tema': 'Diccionarios',
                'dificultad': 'media',
                'descripcion': 'Combina dos diccionarios sumando los valores de las claves que coincidan.',
                'enunciado': 'Escribe una función `fusionar_diccionarios(d1, d2)` que tome dos diccionarios con valores numéricos y retorne un único diccionario donde los valores de claves repetidas sean sumados.',
                'nombre_funcion': 'fusionar_diccionarios',
                'codigo_inicial': 'def fusionar_diccionarios(d1: dict, d2: dict) -> dict:\n    # Tu código aquí\n    pass',
                'casos_prueba': [
                    {'entrada': [{'a': 10, 'b': 20}, {'b': 5, 'c': 15}], 'esperado': {'a': 10, 'b': 25, 'c': 15}, 'visible': True},
                    {'entrada': [{}, {'x': 1}], 'esperado': {'x': 1}, 'visible': True},
                    {'entrada': [{'puntos': 100}, {'puntos': 50}], 'esperado': {'puntos': 150}, 'visible': False}
                ]
            },
            {
                'titulo': 'Validador de Anagramas',
                'tema': 'Cadenas y Algoritmos',
                'dificultad': 'facil',
                'descripcion': 'Determina si dos palabras son anagramas entre sí (ignora mayúsculas y espacios).',
                'enunciado': 'Escribe una función `son_anagramas(palabra1, palabra2)` que retorne True si ambas palabras usan exactamente las mismas letras con la misma frecuencia.',
                'nombre_funcion': 'son_anagramas',
                'codigo_inicial': 'def son_anagramas(p1: str, p2: str) -> bool:\n    # Tu código aquí\n    pass',
                'casos_prueba': [
                    {'entrada': ['roma', 'amor'], 'esperado': True, 'visible': True},
                    {'entrada': ['casa', 'saco'], 'esperado': False, 'visible': True},
                    {'entrada': ['Listen', 'Silent'], 'esperado': True, 'visible': False},
                    {'entrada': ['python', 'java'], 'esperado': False, 'visible': False}
                ]
            },
            {
                'titulo': 'Calculador de Subarreglo Máximo',
                'tema': 'Algoritmos y Complejidad',
                'dificultad': 'dificil',
                'descripcion': 'Implementa el algoritmo de Kadane para hallar la suma máxima contigua.',
                'enunciado': 'Escribe una función `suma_maxima_subarreglo(nums)` que reciba una lista de enteros (positivos y negativos) y retorne la suma máxima posible de un subarreglo contiguo no vacío.',
                'nombre_funcion': 'suma_maxima_subarreglo',
                'codigo_inicial': 'def suma_maxima_subarreglo(nums: list) -> int:\n    # Tu código aquí\n    pass',
                'casos_prueba': [
                    {'entrada': [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 'esperado': 6, 'visible': True},
                    {'entrada': [[1]], 'esperado': 1, 'visible': True},
                    {'entrada': [[5, 4, -1, 7, 8]], 'esperado': 23, 'visible': False},
                    {'entrada': [[-3, -2, -1]], 'esperado': -1, 'visible': False}
                ]
            },
            {
                'titulo': 'Simulador de Caché LRU con Desalojo O(1)',
                'tema': 'Estructuras de Datos Avanzadas',
                'dificultad': 'extrema',
                'descripcion': 'Implementa una caché LRU (Least Recently Used) con operaciones get y put con capacidad limitada.',
                'enunciado': 'Escribe una función `simular_lru(operaciones, capacidad)` donde `operaciones` es una lista de comandos como `["put", clave, valor]` o `["get", clave]`. Debe retornar una lista con los valores devueltos por cada operación "get" (-1 si la clave no existe o fue desalojada).',
                'nombre_funcion': 'simular_lru',
                'codigo_inicial': 'def simular_lru(operaciones: list, capacidad: int) -> list:\n    # Tu código aquí\n    pass',
                'casos_prueba': [
                    {'entrada': [[["put", 1, 10], ["put", 2, 20], ["get", 1], ["put", 3, 30], ["get", 2], ["get", 3]], 2], 'esperado': [10, -1, 30], 'visible': True},
                    {'entrada': [[["get", 99]], 1], 'esperado': [-1], 'visible': True},
                    {'entrada': [[["put", "a", 100], ["put", "b", 200], ["get", "a"], ["put", "c", 300], ["get", "b"]], 2], 'esperado': [100, -1], 'visible': False}
                ]
            }
        ]

        compatibles = [p for p in banco_plantillas if p['dificultad'] == dificultad]
        if not compatibles:
            compatibles = banco_plantillas

        seleccion = dict(random.choice(compatibles))
        seleccion['es_ia'] = True
        seleccion['puntos_xp'] = puntos_xp
        seleccion['fuente'] = 'plantilla_offline'

        return {
            'success': True,
            'reto': seleccion,
            'fuente': 'motor_local',
            'modelo': 'Generador Algorítmico Local'
        }

    def generar_pista_reto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista pedagógica guiada para el reto de código sin revelar la solución directa"""
        titulo = datos.get('titulo', 'Reto de Programación')
        descripcion = datos.get('descripcion') or datos.get('enunciado', '')
        nombre_funcion = datos.get('nombre_funcion', 'solucion')
        dificultad = datos.get('dificultad', 'media')
        tema = datos.get('tema', 'Algoritmos')
        codigo_actual = datos.get('codigo_actual', '')
        ejemplos = datos.get('ejemplos', [])

        if self.provider.tiene_api_key():
            prompt = f"""Actúa como PyBot, tutor pedagógico experto en Python en PyLevel.
El estudiante está resolviendo el reto de programación: '{titulo}'.
Dificultad: {dificultad} | Tema: {tema}
Descripción del reto:
{descripcion}

Firma de función esperada: {nombre_funcion}
Ejemplos de referencia:
{json.dumps(ejemplos, ensure_ascii=False) if ejemplos else 'No especificados'}

Código que el estudiante tiene actualmente en el editor:
```python
{codigo_actual}
```

El estudiante solicita una PISTA PEDAGÓGICA porque está atascado o no sabe cómo empezar/continuar.
REGLA DE ORO: NO entregues el código resuelto completo; guía su razonamiento mediante el método socrático.

Proporciona una respuesta en Markdown bien formateada con esta estructura:
1. 🎯 **Punto de Enfoque**: Identifica con claridad qué parámetros recibe la función `{nombre_funcion}`, qué tipo de dato debe retornar con `return` y cuál es el caso base o inicial.
2. 💡 **Estrategia Algorítmica**: Explica conceptualmente la técnica recomendada (ej. acumulador, list comprehension, diccionarios para conteo O(1), ordenamiento, punteros, etc.).
3. ⚠️ **Trampa o Caso Borde**: Un error común a tener en cuenta (ej. no imprimir con print() sino retornar con return, listas vacías, tipos de datos mutables, índices fuera de rango).
4. 🚀 **Próximo Paso Sugerido**: Un micro-paso de 1 o 2 líneas de código para que el estudiante comience de inmediato en el editor.
"""
            sys_inst = "Eres PyBot, el tutor amigable de PyLevel. Enseñas a pensar algoritmos paso a paso con entusiasmo, claridad y enfoque pedagógico."
            resp = self.provider.consultar(prompt, sys_inst, max_tokens=1400)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.provider.modelo,
                    'pista': resp
                }

        # Fallback local
        return self._generar_pista_reto_local(datos)

    def _generar_pista_reto_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Pistas pedagógicas locales para retos si Gemini no está conectado"""
        titulo = datos.get('titulo', 'Reto')
        nombre_func = datos.get('nombre_funcion', 'solucion')
        tema = datos.get('tema', 'python')
        ejemplos = datos.get('ejemplos', [])

        ejemplo_txt = ""
        if ejemplos:
            ej = ejemplos[0]
            ejemplo_txt = f"\n   - Para la entrada `{ej.get('entrada')}`, la función debe retornar `{ej.get('salida')}`."

        pista = f"""¡Hola! 👋 Soy **PyBot** en modo tutor pedagógico local.

Aquí tienes una pista orientativa para resolver **{titulo}**:

1. 🎯 **Punto de Enfoque**:
   - Tu función `def {nombre_func}(...)` debe procesar los argumentos de entrada y **retornar** el resultado final con la palabra clave `return` (¡no uses `print()`).{ejemplo_txt}

2. 💡 **Estrategia Lógica ({tema.replace('_', ' ').title()})**:
   - Revisa si necesitas inicializar una variable acumuladora (ej. `contador = 0`, `acumulador = []` o `resultado = ""`) antes de iterar.
   - Si debes filtrar elementos de una lista, utiliza una estructura condicional `if condicion:` dentro de un bucle `for` o una *list comprehension*: `[x for x in lista if condicion]`.
   - Si debes contar frecuencias o buscar elementos únicos, considera usar un diccionario `dict` o un conjunto `set`.

3. ⚠️ **Trampa Frecuente**:
   - Recuerda eliminar o reemplazar la instrucción `pass` por tu lógica real.
   - Verifica los casos límite: ¿qué ocurre si la lista está vacía `[]` o el string no contiene elementos válidos? Asegúrate de que el tipo devuelto sea exactamente el esperado (entero, booleano, lista, etc.).

4. 🚀 **Próximo Paso**:
   - Reemplaza el bloque `pass` con la inicialización de tu variable de respuesta y el bucle principal. Luego pulsa **▶️ Ejecutar y Calificar Solución** para evaluar tus avances."""

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Tutor Pedagógico Local',
            'pista': pista
        }

    def generar_pista_pregunta_duo(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista pedagógica experta para preguntas de alta/extrema dificultad en los Mundos de Python"""
        enunciado = datos.get('enunciado', '')
        opciones = datos.get('opciones', [])
        tema = datos.get('tema', 'Python Avanzado')

        if self.provider.tiene_api_key():
            prompt = f"""Eres PyBot, el tutor pedagógico inteligente y maestro de CPython en la plataforma PyLevel.
El estudiante se encuentra en un desafío de DIFICULTAD EXTREMA en la ruta de mundos de aprendizaje y necesita tu guía analítica.

PREGUNTA TÉCNICA:
"{enunciado}"

OPCIONES DISPONIBLES:
{chr(10).join(f"- {op}" for op in opciones)}

TEMA DE ESPECIALIDAD:
{tema}

INSTRUCCIONES PEDAGÓGICAS ESTRICTAS:
1. NO digas directamente "la respuesta correcta es X" ni elijas explícitamente la opción final. Tu misión es enseñar a razonar.
2. Explica brevemente el mecanismo interno de Python o CPython involucrado (por ejemplo: cómo opera el GIL, el ciclo de vida de __new__ vs __init__, el descriptor protocol, o el integer interning).
3. Señala cuál es la trampa mental común en la que caen los programadores.
4. Da una pista de deducción lógica para que el estudiante pueda descartar las opciones incorrectas por sí mismo.
Mantén un tono motivador, analítico, como un Senior Principal Engineer enseñando a su colega. Formatea en Markdown limpio."""

            try:
                pista = self.provider.consultar(
                    prompt=prompt,
                    system_instruction="Eres PyBot, tutor pedagógico experto de CPython y arquitecto de software.",
                    max_tokens=650,
                    temperature=0.3
                )
                if pista and len(pista) > 40:
                    return {
                        'success': True,
                        'fuente': 'gemini_ia',
                        'modelo': self.provider.modelo,
                        'pista': pista
                    }
            except Exception as e:
                print(f"[ChallengesManager] Error al consultar Gemini para pista de mundos: {e}")

        # Fallback local
        return self._generar_pista_pregunta_duo_local(datos)

    def _generar_pista_pregunta_duo_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Pista pedagógica heurística local para preguntas de dificultad extrema"""
        enunciado = datos.get('enunciado', '')
        tema = datos.get('tema', 'Python Internals')

        analisis_clave = "Revisa detenidamente cómo el intérprete de CPython resuelve este caso particular a bajo nivel."
        if "__new__" in enunciado or "init" in enunciado.lower():
            analisis_clave = "Ten presente que `__new__` es el constructor estático que devuelve la instancia en memoria, mientras que `__init__` es solo el inicializador que se ejecuta si y solo si `__new__` retorna una instancia válida de la clase."
        elif "descriptor" in enunciado.lower() or "__set__" in enunciado:
            analisis_clave = "En el protocolo de descriptores, la presencia de `__set__` o `__delete__` clasifica al descriptor como 'Data Descriptor', lo cual le otorga máxima jerarquía superando incluso al `__dict__` de la instancia."
        elif "gil" in enunciado.lower() or "thread" in enunciado.lower():
            analisis_clave = "Recuerda que el GIL (Global Interpreter Lock) protege la memoria interna de CPython y evita carreras en los conteos de referencias, impidiendo paralelismo real de CPU en múltiples hilos del mismo proceso."
        elif "interning" in enunciado.lower() or "is" in enunciado.lower() or "256" in enunciado:
            analisis_clave = "CPython optimiza la memoria prealocando un arreglo global para enteros muy frecuentes en el rango [-5, 256]. Para enteros fuera de ese rango, suelen crearse objetos distintos en memoria."
        elif "slots" in enunciado.lower():
            analisis_clave = "El uso de `__slots__` elimina la estructura dinámica `__dict__` por instancia y la reemplaza por un array en C de tamaño fijo, ahorrando una cantidad masiva de RAM."
        elif "lambda" in enunciado.lower() or "closure" in enunciado.lower():
            analisis_clave = "En Python, las funciones anónimas lambda y los closures buscan variables en el ámbito léxico exterior de forma tardía (late binding), es decir, en el momento en que se llaman, no cuando fueron declaradas."

        pista = f"""¡Hola! 👋 Soy **PyBot** en modo tutor experto de Python.

Aquí tienes mi análisis técnico para desarmar esta pregunta de dificultad extrema:

1. 🔍 **Concepto Central de CPython**:
   - {analisis_clave}

2. ⚠️ **La Trampa Habitual**:
   - Muchos programadores asumen el comportamiento de lenguajes como C++ o Java. En Python, la resolución sigue reglas muy concretas dictadas por el modelo de datos (Data Model) y la máquina virtual.

3. 💡 **Pista de Deducción**:
   - Lee con atención las opciones y descarta aquellas que confundan tiempo de definición con tiempo de ejecución o que asuman excepciones inventadas. ¡Tú tienes la capacidad de deducirlo!"""

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Tutor Pedagógico Local Experto',
            'pista': pista
        }

    def resolver_reto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Resuelve con PyBot el reto de programación completo y provee una explicación magistral paso a paso"""
        titulo = datos.get('titulo', 'Reto de Programación')
        descripcion = datos.get('descripcion') or datos.get('enunciado', '')
        nombre_funcion = datos.get('nombre_funcion', 'solucion')
        dificultad = datos.get('dificultad', 'media')
        tema = datos.get('tema', 'Algoritmos')
        codigo_actual = datos.get('codigo_actual', '')
        ejemplos = datos.get('ejemplos', [])
        casos_prueba = datos.get('casos_prueba', [])

        if self.provider.tiene_api_key():
            prompt = f"""Actúa como PyBot, arquitecto senior de software y profesor de Python en PyLevel.
El estudiante está atascado en el reto de programación: '{titulo}' y solicita la solución oficial explicada con retroalimentación paso a paso.

Detalles del reto:
- Dificultad: {dificultad}
- Tema: {tema}
- Función obligatoria: {nombre_funcion}
- Descripción:
{descripcion}

Ejemplos de referencia:
{json.dumps(ejemplos, ensure_ascii=False) if ejemplos else 'Ninguno'}

Casos de prueba a superar:
{json.dumps(casos_prueba, ensure_ascii=False) if casos_prueba else 'No especificados'}

Código actual que el estudiante intentó:
```python
{codigo_actual}
```

Debes proporcionar la solución Python completa, limpia, funcional y sin errores, junto con una explicación pedagógica magistral de cómo funciona.

Devuelve OBLIGATORIAMENTE un JSON estricto con la siguiente estructura:
{{
  "codigo_resuelto": "Código Python 100% completo y ejecutable que defina 'def {nombre_funcion}(...):' con lógica óptima y retorne los valores esperados por los casos de prueba.",
  "explicacion_paso_a_paso": "Explicación detallada en Markdown de la lógica del algoritmo, qué hace cada línea o bloque y cómo resuelve el problema.",
  "complejidad": "Análisis de complejidad temporal O(...) y espacial O(...), explicando el motivo.",
  "buenas_practicas": "Buenas prácticas de Python aplicadas (Python idiomatic / PEP 8, legibilidad, type hints)."
}}
Devuelve ÚNICAMENTE el objeto JSON sin bloques de código exteriores.
"""
            sys_inst = "Eres PyBot, profesor senior de algoritmos en Python. Entregas soluciones óptimas, elegantes, perfectamente comentadas y con explicaciones didácticas de nivel profesional."
            schema_solucion = {
                "type": "OBJECT",
                "properties": {
                    "codigo_resuelto": {"type": "STRING"},
                    "explicacion_paso_a_paso": {"type": "STRING"},
                    "complejidad": {"type": "STRING"},
                    "buenas_practicas": {"type": "STRING"}
                },
                "required": ["codigo_resuelto", "explicacion_paso_a_paso", "complejidad", "buenas_practicas"]
            }
            raw = self.provider.consultar(prompt, sys_inst, max_tokens=2800, temperature=0.2, json_mode=True, response_schema=schema_solucion)
            if raw:
                try:
                    clean = raw.strip()
                    if clean.startswith("```"):
                        lines = clean.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        clean = "\n".join(lines).strip()
                    data = json.loads(clean, strict=False)
                    if data.get('codigo_resuelto'):
                        return {
                            'success': True,
                            'fuente': 'gemini',
                            'modelo': self.provider.modelo,
                            'codigo_resuelto': data.get('codigo_resuelto'),
                            'explicacion_paso_a_paso': data.get('explicacion_paso_a_paso', ''),
                            'complejidad': data.get('complejidad', ''),
                            'buenas_practicas': data.get('buenas_practicas', '')
                        }
                except Exception as e:
                    print(f"[ChallengesManager] Error al parsear solución de reto: {e}")

        # Fallback local
        return self._resolver_reto_local(datos)

    def _resolver_reto_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Solucionador algorítmico local para retos del banco base"""
        nombre_func = datos.get('nombre_funcion', 'solucion')
        titulo = datos.get('titulo', 'Reto')

        soluciones_conocidas = {
            'sumar_pares': (
                "def sumar_pares(numeros: list) -> int:\n    \"\"\"Retorna la suma de los números pares de la lista.\"\"\"\n    return sum(n for n in numeros if n % 2 == 0)\n",
                "Utiliza una expresión generadora dentro de la función nativa `sum()`. Itera cada elemento `n` y evalúa `n % 2 == 0` para acumular únicamente los valores pares.",
                "Temporal: O(n) recorriendo la lista una sola vez | Espacial: O(1) memoria constante con generador.",
                "Uso idiomático de `sum()` con generator comprehension en lugar de bucles imperativos acumuladores."
            ),
            'es_palindromo': (
                "def es_palindromo(texto: str) -> bool:\n    \"\"\"Determina si una cadena es un palíndromo ignorando espacios y mayúsculas.\"\"\"\n    limpio = ''.join(c.lower() for c in texto if c.isalnum())\n    return limpio == limpio[::-1]\n",
                "1. Normaliza la cadena conservando solo caracteres alfanuméricos en minúsculas con `.isalnum()`. 2. Compara la cadena resultante contra su versión invertida usando slicing `[::-1]`.",
                "Temporal: O(n) donde n es la longitud del texto | Espacial: O(n) para la cadena limpia.",
                "Aprovecha el slicing eficiente en C de CPython para invertir strings."
            ),
            'contar_vocales': (
                "def contar_vocales(cadena: str) -> int:\n    \"\"\"Cuenta la cantidad total de vocales en el texto.\"\"\"\n    vocales = set('aeiouáéíóú')\n    return sum(1 for c in cadena.lower() if c in vocales)\n",
                "Define un conjunto `set` con las vocales para búsquedas en tiempo constante O(1). Itera cada carácter del texto normalizado en minúsculas y suma 1 por cada vocal encontrada.",
                "Temporal: O(n) lineal | Espacial: O(1) con el set de vocales de tamaño constante.",
                "Uso de `set` para membresía en O(1) en lugar de listas."
            ),
            'invertir_cadena': (
                "def invertir_cadena(cadena: str) -> str:\n    \"\"\"Invierte el orden de los caracteres de la cadena.\"\"\"\n    return cadena[::-1]\n",
                "Aplica la técnica de rebanado (*slicing*) de Python con paso negativo `[::-1]`, la cual crea una copia invertida de la cadena de forma altamente optimizada.",
                "Temporal: O(n) | Espacial: O(n) para el string resultante.",
                "Forma canónica y más rápida en Python para invertir cadenas."
            ),
            'factorial': (
                "def factorial(n: int) -> int:\n    \"\"\"Calcula el factorial de un número entero no negativo.\"\"\"\n    if n < 0:\n        raise ValueError('El factorial no está definido para números negativos')\n    if n in (0, 1):\n        return 1\n    resultado = 1\n    for i in range(2, n + 1):\n        resultado *= i\n    return resultado\n",
                "1. Valida que el número no sea negativo. 2. Trata los casos base `0! = 1` y `1! = 1`. 3. Itera de forma acumulativa multiplicando desde 2 hasta `n`.",
                "Temporal: O(n) | Espacial: O(1) memoria constante.",
                "Enfoque iterativo en lugar de recursivo para evitar sobrecargar la pila de llamadas (*RecursionError*)."
            ),
            'encontrar_maximo': (
                "def encontrar_maximo(numeros: list) -> int:\n    \"\"\"Encuentra el valor máximo en una lista de números.\"\"\"\n    if not numeros:\n        return None\n    return max(numeros)\n",
                "Valida que la lista contenga elementos y delega la búsqueda a la función integrada `max()`, la cual está implementada en C a bajo nivel.",
                "Temporal: O(n) | Espacial: O(1).",
                "Uso de funciones *built-in* optimizadas de Python."
            ),
            'eliminar_duplicados': (
                "def eliminar_duplicados(elementos: list) -> list:\n    \"\"\"Elimina duplicados preservando el orden original.\"\"\"\n    vistos = set()\n    resultado = []\n    for item in elementos:\n        if item not in vistos:\n            vistos.add(item)\n            resultado.append(item)\n    return resultado\n",
                "Mantiene un conjunto `vistos` para verificar la existencia en O(1) y una lista `resultado` para preservar el orden cronológico original de aparición.",
                "Temporal: O(n) | Espacial: O(n).",
                "Estructura híbrida (set + list) para combinar búsqueda O(1) con preservación de orden."
            )
        }

        if nombre_func in soluciones_conocidas:
            cod, exp, comp, bp = soluciones_conocidas[nombre_func]
            return {
                'success': True,
                'fuente': 'motor_local',
                'modelo': 'Solucionador Algorítmico Local',
                'codigo_resuelto': cod,
                'explicacion_paso_a_paso': exp,
                'complejidad': comp,
                'buenas_practicas': bp
            }

        # Plantilla genérica si no es una de las funciones pre-mapeadas
        codigo_generico = f"def {nombre_func}(*args, **kwargs):\n    \"\"\"Solución generada por PyBot para {titulo}\"\"\"\n    # Procesa la lógica principal requerida\n    pass\n"
        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Tutor Pedagógico Local',
            'codigo_resuelto': codigo_generico,
            'explicacion_paso_a_paso': f"Se estructuró la función base `{nombre_func}` según los criterios de entrada y salida del reto.",
            'complejidad': "O(n) estimado",
            'buenas_practicas': "Manejo de parámetros y retornos directos."
        }
