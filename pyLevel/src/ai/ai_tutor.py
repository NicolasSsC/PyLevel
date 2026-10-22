"""
Módulo de Inteligencia Artificial y Tutor Pedagógico para PyLevel
Soporta arquitectura híbrida:
- Conexión directa a Google Gemini API (cuando GEMINI_API_KEY esté presente)
- Motor pedagógico experto local offline con análisis sintáctico y de tracebacks
"""

import os
import sys
import json
import urllib.request
import urllib.error
import re
import concurrent.futures
from typing import Dict, Any, Optional, List

class AITutor:
    """Tutor pedagógico inteligente con soporte para Gemini API y motor local de respaldo"""
    
    def __init__(self):
        self.api_key = os.environ.get('GEMINI_API_KEY') or self._cargar_key_archivo()
        self.modelos_candidatos = [
            "gemini-flash-lite-latest",
            "gemini-3.5-flash-lite",
            "gemini-3-flash-preview",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-flash-latest"
        ]
        self.modelo = self.modelos_candidatos[0]
        self.timeout = 20.0

    def _cargar_key_archivo(self) -> Optional[str]:
        """Permite cargar la clave desde un archivo local .gemini_key o .env si existe"""
        base_dir = os.path.dirname(os.path.abspath(__file__))
        rutas = [
            '.gemini_key',
            '.env',
            os.path.join(base_dir, '.env'),
            os.path.join(base_dir, '.gemini_key'),
            os.path.join(base_dir, '..', '..', '.env'),
            os.path.join(base_dir, '..', '..', '.gemini_key'),
            os.path.join(base_dir, '..', '..', '..', '.env'),
            os.path.join(base_dir, '..', '..', '..', '.gemini_key'),
        ]
        for ruta in rutas:
            if os.path.exists(ruta):
                try:
                    with open(ruta, 'r', encoding='utf-8') as f:
                        for linea in f:
                            linea = linea.strip()
                            if linea.startswith('GEMINI_API_KEY='):
                                return linea.split('=', 1)[1].strip().strip('"').strip("'")
                            elif os.path.basename(ruta) == '.gemini_key' and linea and not linea.startswith('#'):
                                return linea
                except Exception:
                    pass
        return None

    def configurar_api_key(self, key: str):
        """Permite actualizar la clave en tiempo de ejecución"""
        self.api_key = key.strip() if key else None
        if self.api_key:
            os.environ['GEMINI_API_KEY'] = self.api_key
        else:
            os.environ.pop('GEMINI_API_KEY', None)

    def tiene_api_key(self) -> bool:
        # Si no hay clave cargada o es inválida, intentar recargar desde .env o variables de entorno
        if not (self.api_key and len(self.api_key) > 10):
            clave = self._cargar_key_archivo() or os.environ.get('GEMINI_API_KEY')
            if clave and len(clave) > 10:
                self.api_key = clave
        return bool(self.api_key and len(self.api_key) > 10)

    def consultar_gemini(self, prompt: str, system_instruction: str = "", max_tokens: int = 800, temperature: float = 0.4, timeout: Optional[float] = None) -> Optional[str]:
        """Realiza una petición HTTP a la API REST de Google Gemini"""
        if not self.tiene_api_key():
            return None

        effective_timeout = timeout if timeout is not None else self.timeout

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        headers = {"Content-Type": "application/json"}
        payload_bytes = json.dumps(payload).encode('utf-8')

        # Intentar con la lista de modelos compatibles en orden
        for modelo_candidato in self.modelos_candidatos:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_candidato}:generateContent?key={self.api_key}"
            try:
                req = urllib.request.Request(url, data=payload_bytes, headers=headers, method='POST')
                with urllib.request.urlopen(req, timeout=effective_timeout) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        candidates = data.get('candidates', [])
                        if candidates:
                            parts = candidates[0].get('content', {}).get('parts', [])
                            if parts:
                                self.modelo = modelo_candidato
                                return parts[0].get('text', '')
            except Exception as e:
                # Probar el siguiente modelo candidato si hay error 503 o 404
                continue

        return None

    # =========================================================================
    # EXPLICACIÓN INTELIGENTE DE ERRORES (RETOS Y PROYECTOS)
    # =========================================================================

    def explicar_error(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una explicación pedagógica basada en el error, código y casos de prueba"""
        tipo = datos.get('tipo', 'reto')
        titulo = datos.get('titulo', 'Ejercicio de Python')
        codigo = datos.get('codigo', '')
        error_msg = datos.get('error', '')
        casos = datos.get('casos', [])
        stdout = datos.get('stdout', '')

        # Si hay Gemini configurado, intentar generar respuesta con IA generativa
        if self.tiene_api_key():
            prompt = f"""
Actúa como un tutor pedagógico experto y amigable de Python en la plataforma PyLevel.
El estudiante está resolviendo el siguiente ejercicio: '{titulo}'.

Código escrito por el estudiante:
```python
{codigo}
```

Detalles del error o pruebas fallidas:
- Error / Traceback: {error_msg}
- Casos fallidos o resultados: {json.dumps(casos[:3], ensure_ascii=False) if casos else 'Sin casos'}
- Salida estándar (prints): {stdout}

Por favor proporciona una respuesta educativa en español estructurada en 3 secciones breves:
1.  **Diagnóstico**: Explica con claridad qué significa el error y qué está pasando en su código.
2.  **Pista Pedagógica**: Brinda una pista guiada para que el estudiante razone la solución por sí mismo (método socrático, ¡NO le escribas la solución completa!).
3.  **Concepto Clave**: Un recordatorio del concepto de Python involucrado (por ejemplo: indexación, tipos mutables, valor de retorno, etc.).
"""
            sys_inst = "Eres PyBot, el tutor pedagógico inteligente de PyLevel. Eres entusiasta, empático, claro y pedagógico. Nunca regales el código resuelto completo; guía al estudiante a descubrir la respuesta."
            resp = self.consultar_gemini(prompt, sys_inst)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.modelo,
                    'explicacion': resp
                }

        # Fallback: Motor Pedagógico Local Experto
        return self._analisis_pedagogico_local(datos)

    def _analisis_pedagogico_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Analizador heurístico y sintáctico local de errores en Python"""
        error_msg = datos.get('error', '') or ''
        casos = datos.get('casos', []) or []
        codigo = datos.get('codigo', '') or ''
        titulo = datos.get('titulo', 'el ejercicio')

        diagnostico = ""
        pista = ""
        concepto = "Fundamentos de Python"

        # 1. Errores de tiempo límite / bucles infinitos
        if "tiempo" in error_msg.lower() or "timeout" in error_msg.lower():
            diagnostico = "Tu código tardó más de 3.5 segundos en responder. Esto casi siempre ocurre cuando un bucle `while` nunca alcanza su condición de parada o cuando una función recursiva no tiene un caso base que la detenga."
            pista = "Verifica las variables que controlan tus ciclos `while`. Asegúrate de que se incrementen o modifiquen en cada vuelta para que la condición llegue a ser `False`."
            concepto = "Ciclos y Condiciones de Terminación"

        # 2. Tracebacks específicos de Python
        elif "IndexError" in error_msg:
            diagnostico = "Ocurrió un `IndexError: list index out of range`. Tu código intentó acceder a una posición de una lista que no existe (por ejemplo, acceder a `lista[5]` cuando la lista solo tiene 3 elementos)."
            pista = "Recuerda que en Python los índices comienzan en `0` y terminan en `len(lista) - 1`. Si usas un rango como `range(len(lista))`, ten cuidado al sumar `+ 1` al índice."
            concepto = "Indexación y Límites de Listas"

        elif "KeyError" in error_msg:
            diagnostico = "Ocurrió un `KeyError`. Tu código intentó buscar una clave en un diccionario que no ha sido creada o está mal escrita."
            pista = "Antes de acceder con `diccionario[clave]`, puedes verificar si existe con `if clave in diccionario:` o usar el método seguro `diccionario.get(clave, valor_por_defecto)`."
            concepto = "Manejo Seguro de Diccionarios"

        elif "TypeError" in error_msg:
            diagnostico = f"Ocurrió un error de tipos (`TypeError`): {error_msg}. Intentaste realizar una operación entre tipos de datos incompatibles o llamaste como función a un objeto que no es invocable."
            pista = "Revisa los tipos de las variables involucradas con `type(variable)` o asegúrate de no estar sobrescribiendo nombres de funciones nativas (como `list`, `str` o `sum`)."
            concepto = "Tipado Dinámico y Coerción de Tipos"

        elif "ZeroDivisionError" in error_msg:
            diagnostico = "Ocurrió un `ZeroDivisionError: division by zero`. Se intentó realizar una división (`/` o `//`) o módulo (`%`) entre cero."
            pista = "Antes de dividir o calcular el residuo, valida con un condicional que el divisor sea diferente de cero: `if divisor != 0:`."
            concepto = "Operadores Aritméticos y Casos Límite"

        elif "NameError" in error_msg:
            diagnostico = f"Ocurrió un `NameError`: {error_msg}. Python no reconoce el nombre de una variable, función o módulo."
            pista = "Verifica que el nombre esté bien escrito (Python distingue mayúsculas de minúsculas) y que la variable haya sido declarada antes de ser utilizada."
            concepto = "Ámbito de Variables (Scope)"

        elif "AttributeError" in error_msg:
            diagnostico = f"Ocurrió un `AttributeError`: {error_msg}. Intentaste usar un método que no pertenece a ese tipo de objeto (por ejemplo, usar `.append()` en un string o diccionario)."
            pista = "Verifica qué tipo de dato tiene tu variable. Recuerda que los strings son inmutables y no tienen `.append()`, sino que se concatenan con `+`."
            concepto = "Métodos de Objetos y Estructuras"

        elif "SyntaxError" in error_msg or "IndentationError" in error_msg:
            diagnostico = f"Hay un error de sintaxis o indentación: {error_msg}."
            pista = "Revisa que todas las sentencias `def`, `if`, `for` o `while` terminen con dos puntos (`:`), que no falten paréntesis por cerrar y que la sangría sea uniforme (4 espacios por nivel)."
            concepto = "Sintaxis Estricta y Guía de Estilo PEP 8"

        # 3. No hay traceback, pero fallaron casos de prueba
        elif casos:
            primer_fallo = next((c for c in casos if not c.get('aprobado')), None)
            if primer_fallo:
                esperado = primer_fallo.get('esperado')
                obtenido = primer_fallo.get('obtenido')
                entrada = primer_fallo.get('entrada')

                if obtenido is None or obtenido == 'None':
                    diagnostico = "Tu función retornó `None`. En Python, si una función no tiene una sentencia `return` explícita, devuelve automáticamente `None`."
                    pista = f"Asegúrate de agregar la instrucción `return resultado` al final de tu función en vez de solo imprimir con `print()`."
                    concepto = "Valores de Retorno con `return`"
                elif type(esperado) != type(obtenido) and esperado is not None:
                    diagnostico = f"El tipo de dato retornado no coincide con el esperado. Las pruebas esperan un resultado de tipo `{type(esperado).__name__}`, pero tu código devolvió un `{type(obtenido).__name__}`."
                    pista = f"Para la entrada `{entrada}`, se esperaba `{repr(esperado)}`, pero tu función entregó `{repr(obtenido)}`. Revisa la conversión de tipos."
                    concepto = "Firma de Función y Tipos de Retorno"
                else:
                    diagnostico = f"La función se ejecutó sin errores fatales, pero la lógica calculó un resultado diferente al esperado para el caso de prueba."
                    pista = f"Para la entrada `{entrada}`, se esperaba que devolviera `{repr(esperado)}`, pero tu solución produjo `{repr(obtenido)}`. Analiza paso a paso qué hace tu algoritmo con ese caso particular."
                    concepto = "Lógica Algorítmica y Casos de Prueba"
            else:
                diagnostico = "El código no cumplió todas las condiciones de prueba establecidas."
                pista = "Lee nuevamente la descripción del reto prestando especial atención a casos vacíos o valores especiales."
                concepto = "Validación de Requerimientos"
        else:
            diagnostico = f"Revisión pedagógica para {titulo}."
            pista = "Verifica que estés respetando exactamente el nombre de la función y los parámetros requeridos."
            concepto = "Estructura del Programa"

        texto_explicacion = f"""###  PyLevel AI • Tutor Pedagógico (Modo Local Experto)

 **Diagnóstico:**
{diagnostico}

 **Pista Pedagógica:**
{pista}

 **Concepto Clave:**
**{concepto}**: Revisa la teoría asociada a este tema en tus rutas de estudio para fortalecer tu comprensión.
"""
        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Motor Pedagógico PyLevel',
            'explicacion': texto_explicacion
        }

    # =========================================================================
    # CHAT INTERACTIVO CON PYBOT
    # =========================================================================

    def responder_chat(self, mensaje: str, historial: Optional[List[Dict]] = None, contexto: Optional[Dict] = None) -> Dict[str, Any]:
        """Responde preguntas libres sobre Python hechas por el estudiante"""
        mensaje_limpio = (mensaje or '').strip()
        if not mensaje_limpio:
            return {'success': False, 'error': 'El mensaje no puede estar vacío.'}

        # Intentar responder con Gemini si está configurado
        if self.tiene_api_key():
            historial_texto = ""
            if historial:
                for h in historial[-4:]:
                    rol = "Estudiante" if h.get('rol') == 'user' else "PyBot"
                    historial_texto += f"{rol}: {h.get('contenido', '')}\n"

            ctx_texto = ""
            if contexto:
                if contexto.get('tema'):
                    ctx_texto += f"Tema actual de trabajo: {contexto.get('tema')}.\n"
                if contexto.get('codigo_actual'):
                    ctx_texto += f"Código que el estudiante tiene en pantalla:\n```python\n{contexto.get('codigo_actual')[:600]}\n```\n"

            prompt = f"""
{ctx_texto}
{historial_texto}
Estudiante pregunta: "{mensaje_limpio}"

Por favor responde de forma concisa, cordial, pedagógica y con código Python formateado cuando sea relevante.
"""
            sys_inst = "Eres PyBot, el asistente inteligente y tutor amigable de Python en PyLevel. Explicas conceptos de programación de forma sencilla, usando analogías claras y snippets breves de código Python."
            resp = self.consultar_gemini(prompt, sys_inst)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.modelo,
                    'respuesta': resp
                }

        # Fallback local: Base de conocimientos conversacional de Python
        return self._responder_chat_local(mensaje_limpio)

    def _responder_chat_local(self, mensaje: str) -> Dict[str, Any]:
        """Base de conocimientos local para responder dudas frecuentes de Python sin internet"""
        m = mensaje.lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')

        if any(w in m for w in ['hola', 'buenos dias', 'buenas tardes', 'saludos', 'quien eres', 'que haces']):
            resp = """¡Hola! 👋 Soy **PyBot** 🤖, tu tutor pedagógico de Python en PyLevel.

Estoy aquí para ayudarte a:
- 🐍 Resolver dudas sobre sintaxis, estructuras de datos y POO.
- 💡 Explicarte por qué falla tu código y darte pistas.
- ⚡ Explicarte conceptos como decoradores, generadores, comprensión de listas y más.

¿En qué tema de Python te gustaría que profundicemos hoy? 🚀"""

        elif any(w in m for w in ['comprension', 'comprehension', 'list comprehension']):
            resp = """Las **List Comprehensions** (comprensión de listas) son una sintaxis concisa y elegante para construir nuevas listas a partir de iterables. 📦

🐍 **Sintaxis general:**
```python
nueva_lista = [expresion for elemento in iterable if condicion]
```

💡 **Ejemplo práctico:**
```python
# Obtener los cuadrados solo de los números pares:
numeros = [1, 2, 3, 4, 5, 6]
pares_cuadrados = [n**2 for n in numeros if n % 2 == 0]
print(pares_cuadrados)  # Salida: [4, 16, 36]
```
Es más rápida y legible que usar un bucle `for` tradicional con `.append()`. ✨"""

        elif any(w in m for w in ['is vs ==', 'diferencia entre is y ==', '== vs is', 'diferencia entre == y is']):
            resp = """En Python, `==` e `is` realizan comparaciones diferentes: 🔍

- **`==` (Igualdad de valor):** Comprueba si dos objetos tienen el **mismo contenido o valor**.
- **`is` (Identidad de memoria):** Comprueba si dos variables apuntan al **mismo objeto exacto en la memoria RAM** (`id(a) == id(b)`).

💡 **Ejemplo:**
```python
lista_a = [1, 2, 3]
lista_b = [1, 2, 3]

print(lista_a == lista_b)  # True (tienen el mismo contenido)
print(lista_a is lista_b)  # False (son dos listas distintas en memoria)
```
⚡ **Regla de oro:** Usa siempre `is` para comparar con `None` (`if x is None:`), y usa `==` para comparar números, textos y listas."""

        elif any(w in m for w in ['yield', 'generador', 'generators']):
            resp = """Un **generador** es una función especial que genera valores sobre la marcha usando la palabra clave `yield` en lugar de `return`. ⚡

A diferencia de una lista que guarda todos los elementos en memoria, el generador produce un elemento a la vez y pausa su ejecución.

🚀 **Ejemplo:**
```python
def contador_hasta(limite):
    n = 1
    while n <= limite:
        yield n  # Produce el valor y pausa la función
        n += 1

# No satura la memoria:
for numero in contador_hasta(3):
    print(numero)  # Imprime 1, luego 2, luego 3
```
Son ideales para procesar grandes volúmenes de datos o streams pesados. 📊"""

        elif any(w in m for w in ['decorador', 'decorator', 'decoradores', '@']):
            resp = """Un **decorador** es una función que toma otra función como argumento, le añade alguna funcionalidad extra (como medir el tiempo o validar permisos) y devuelve una función modificada, sin cambiar el código original. 🎨

✨ **Ejemplo básico:**
```python
def mi_decorador(funcion):
    def envoltura():
        print("Antes de ejecutar la función...")
        funcion()
        print("Después de ejecutar la función.")
    return envoltura

@mi_decorador
def saludar():
    print("¡Hola mundo!")

saludar()
```
El símbolo `@mi_decorador` equivale a escribir `saludar = mi_decorador(saludar)`. 💡"""

        elif any(w in m for w in ['poo', 'clase', 'objeto', 'self', '__init__']):
            resp = """En Python, la **Programación Orientada a Objetos (POO)** te permite modelar entidades de la vida real con atributos (datos) y métodos (comportamientos). 🏗️

- **`__init__`**: Es el constructor de la clase; se ejecuta automáticamente al crear un nuevo objeto.
- **`self`**: Representa la instancia específica del objeto que está ejecutando el método.

📦 **Ejemplo:**
```python
class Estudiante:
    def __init__(self, nombre: str, nivel: str):
        self.nombre = nombre
        self.nivel = nivel

    def presentarse(self):
        return f"Hola, soy {self.nombre} y mi nivel es {self.nivel}."

ana = Estudiante("Ana", "Avanzado")
print(ana.presentarse())
```"""

        elif any(w in m for w in ['diccionario', 'dict', 'diccionarios']):
            resp = """Los **diccionarios (`dict`)** almacenan pares de clave-valor (`clave: valor`). Son colecciones mutables y extremadamente rápidas para búsquedas (complejidad promedio O(1)). 🗂️

⚡ **Operaciones esenciales:**
```python
usuario = {"nombre": "Santiago", "nivel": "Intermedio"}

# Acceso seguro con .get() (no lanza KeyError si no existe):
edad = usuario.get("edad", 18)

# Agregar o modificar:
usuario["puntos"] = 100

# Iterar claves y valores:
for clave, valor in usuario.items():
    print(f"{clave}: {valor}")
```"""

        elif any(w in m for w in ['try', 'except', 'excepciones', 'errores']):
            resp = """El bloque `try / except` permite capturar y gestionar errores para evitar que tu aplicación se detenga abruptamente. 🛡️

⚙️ **Estructura recomendada:**
```python
try:
    numero = int(input("Ingresa un número: "))
    resultado = 10 / numero
except ValueError:
    print("Error: No ingresaste un número válido.")
except ZeroDivisionError:
    print("Error: No se puede dividir entre cero.")
else:
    print(f"Todo salió bien, resultado: {resultado}")
finally:
    print("Este bloque siempre se ejecuta.")
```"""

        else:
            resp = f"""He analizado tu consulta sobre **"{mensaje}"**. 🤖

Para resolverlo con buenas prácticas en Python:
1. Divide el problema en pasos lógicos pequeños: **Entrada -> Transformación -> Salida**. 📐
2. Verifica qué estructura de datos es la más adecuada (listas para orden, diccionarios para búsquedas por clave, conjuntos para valores únicos). 🗂️
3. Escribe pruebas o pequeños `print()` para validar el comportamiento intermedio. 🧪

🎯 *Consejo:* Si tienes una porción de código específica que esté fallando, puedes pegarla aquí o presionar el botón **"Explicar error con IA"** en tus retos o proyectos para recibir una guía detallada."""

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Base de Conocimientos PyBot',
            'respuesta': resp
        }

    # =========================================================================
    # GENERADOR DE RETOS DE CÓDIGO CON INTELIGENCIA ARTIFICIAL
    # =========================================================================

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
        if self.tiene_api_key():
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
            sys_inst = "Eres un diseñador experto de ejercicios técnicos de Python para plataformas como LeetCode y Codewars. Generas ejercicios originales, sin ambigüedades y con casos de prueba perfectamente congruentes en JSON."
            raw_resp = self.consultar_gemini(prompt, sys_inst, temperature=0.85)
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
                            'modelo': self.modelo
                        }
                except Exception as e:
                    print(f"[AITutor] Error al parsear reto generado por Gemini: {e}")

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

        # Filtrar o elegir la más adecuada
        compatibles = [p for p in banco_plantillas if p['dificultad'] == dificultad]
        if not compatibles:
            compatibles = banco_plantillas

        import random
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

    # =========================================================================
    # GENERADOR DE PROYECTOS MULTI-ARCHIVO CON INTELIGENCIA ARTIFICIAL
    # =========================================================================

    def generar_proyecto(self, tema: str = 'General', dificultad: str = 'media', proyectos_existentes: Optional[List[str]] = None) -> Dict[str, Any]:
        """Genera un proyecto práctico multi-archivo completo en Python con Gemini evitando repeticiones"""
        dificultad = dificultad.lower() if dificultad in ['facil', 'media', 'dificil', 'extrema'] else 'media'
        tema = tema.strip() if tema else 'Arquitectura y POO'

        instruccion_proj_dif = ""
        if dificultad == 'extrema':
            instruccion_proj_dif = "\nNIVEL EXTREMO: El proyecto debe tener de 3 a 4 archivos .py, arquitectura avanzada (ej. Event Bus reactivo, Middleware transaccional, Pipeline de procesamiento o Plugins desacoplados), clases con validación estricta y suite test_runner rigurosa."
        elif dificultad == 'dificil':
            instruccion_proj_dif = "\nNIVEL DIFÍCIL: 3 archivos .py con separación estricta de responsabilidades, lógica no trivial y validaciones exhaustivas."
        elif dificultad == 'facil':
            instruccion_proj_dif = "\nNIVEL FÁCIL: 2 o 3 archivos .py con lógica modular accesible para principiantes."

        # 1. Intentar generación con Google Gemini API
        if self.tiene_api_key():
            existentes_txt = ", ".join(f"'{p}'" for p in (proyectos_existentes or []))
            prompt = f"""Genera un proyecto práctico multi-archivo de programación en Python estructurado en formato JSON estricto.
Tema: {tema}
Dificultad: {dificultad}
{instruccion_proj_dif}

PROYECTOS Y TEMAS YA EXISTENTES EN EL SISTEMA (ESTRICTAMENTE PROHIBIDO REPETIR O CREAR ALGO CON NOMBRE O TEMÁTICA SIMILAR):
[{existentes_txt if existentes_txt else "Ninguno"}]

REGLA DE MÁXIMA ORIGINALIDAD:
Debes inventar un proyecto con una temática 100% fresca y original que NO se parezca a ninguna de las anteriores (PROHIBIDO repetir temáticas como 'Gestor de Flota' o 'Biblioteca' si ya existen).
Ejemplos de temáticas creativas sugeridas: Simulación de Ecosistema Espacial, Sistema de Reservas de Hotel, Plataforma de Streaming de Audio, Gestor de Mazmorra RPG, Analizador de Sensores IoT, Motor de Subastas Online, Simulador de Redes Sociales, etc.

Estructura obligatoria del JSON:
{{
  "nombre": "Nombre descriptivo y 100% original del proyecto",
  "dificultad": "{dificultad}",
  "temas": ["POO", "modularizacion", "algoritmos"],
  "descripcion": "Descripción concisa del proyecto en 1 o 2 oraciones.",
  "enunciado": "Explicación detallada de la arquitectura, qué módulos componen el proyecto y qué clases o funciones debe implementar el estudiante.",
  "reglas": [
    "Regla o restricción técnica 1",
    "Regla o restricción técnica 2",
    "Regla o restricción técnica 3"
  ],
  "criterios_aceptacion": [
    "Criterio de aceptación 1 evaluable",
    "Criterio de aceptación 2 evaluable",
    "Criterio de aceptación 3 evaluable",
    "Criterio de aceptación 4 evaluable"
  ],
  "archivo_entrada": "main.py",
  "archivos": {{
    "modulo1.py": "Código con definición de clases, tipos y métodos con docstrings y # TODO: Implementar... pass",
    "modulo2.py": "Código con controlador, servicio o lógica de negocio con # TODO: Implementar... pass",
    "main.py": "Código principal ejecutable que importa los módulos anteriores y ejecuta una demostración por consola"
  }},
  "test_runner": "import sys, json\\nresultados = []\\ndef reportar(c, ok, d=''):\\n    resultados.append({{'criterio': c, 'aprobado': ok, 'detalle': d}})\\n\\n# Bloques try/except para evaluar cada criterio importando los módulos...\\n\\ntodos_ok = all(r['aprobado'] for r in resultados)\\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\\nprint(json.dumps({{'exito': todos_ok, 'resumen': f'{{tot_pasados}}/{{len(resultados)}} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}}, ensure_ascii=False))\\n"
}}

REGLAS OBLIGATORIAS:
- El proyecto debe tener 2 o 3 archivos .py (o hasta 4 para dificultad extrema) (uno de ellos DEBE llamarse 'main.py' como archivo de entrada).
- Las clases y métodos en 'archivos' deben tener las firmas completas y código esqueleto con '# TODO: ...' y 'pass' o retorno por defecto para que el estudiante trabaje sobre ellos.
- 'test_runner' debe ser un script de Python 100% válido que evalúe los 'criterios_aceptacion' importando los módulos del proyecto y finalice imprimiendo el JSON con 'exito', 'resumen', 'total_pasados', 'total_criterios' y 'criterios'.
- REGLA CRÍTICA DE SINTAXIS EN test_runner: Asegúrate de que las cadenas dentro del script NO tengan comillas conflictivas sin escapar (por ejemplo, nunca uses reportar('El archivo 'main.py'...', False); utiliza comillas dobles exteriores o comillas triples para que no genere SyntaxError).
- Devuelve ÚNICAMENTE el objeto JSON sin bloques explicativos ni texto adicional fuera del JSON.
"""
            sys_inst = "Eres un arquitecto de software y diseñador pedagógico senior de proyectos en Python. Creas arquitecturas originales, limpias, modulares y con suites de pruebas automatizadas en test_runner libres de errores de sintaxis."
            raw_resp = self.consultar_gemini(prompt, sys_inst, max_tokens=3500, temperature=0.85)
            if raw_resp:
                try:
                    clean = raw_resp.strip()
                    if clean.startswith("```"):
                        lines = clean.split("\n")
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        clean = "\n".join(lines).strip()

                    data = json.loads(clean, strict=False)
                    if data.get('nombre') and data.get('archivos') and 'main.py' in data.get('archivos') and data.get('criterios_aceptacion'):
                        # Validar que el test_runner compile sin errores de sintaxis
                        test_runner_code = data.get('test_runner', '')
                        es_valido = False
                        try:
                            compile(test_runner_code, '<test_runner>', 'exec')
                            es_valido = True
                        except SyntaxError:
                            # Intentar reparar comillas anidadas en reportar('...')
                            fixed_runner = re.sub(r"reportar\('([^']*)'([^']*)'([^']*)',", r'reportar("""\1\2\3""",', test_runner_code)
                            try:
                                compile(fixed_runner, '<test_runner>', 'exec')
                                data['test_runner'] = fixed_runner
                                es_valido = True
                            except SyntaxError:
                                pass

                        if es_valido:
                            data['dificultad'] = dificultad
                            if not data.get('temas'):
                                data['temas'] = [tema]
                            data['es_ia'] = True
                            data['archivo_entrada'] = 'main.py'
                            return {
                                'success': True,
                                'proyecto': data,
                                'fuente': 'gemini',
                                'modelo': self.modelo
                            }
                except Exception as e:
                    print(f"[AITutor] Error al parsear proyecto generado por Gemini: {e}")

        # 2. Motor de respaldo offline con catálogo modular heurístico
        return self._generar_proyecto_local(tema, dificultad)

    def _generar_proyecto_local(self, tema: str, dificultad: str) -> Dict[str, Any]:
        """Generador heurístico de proyectos multi-archivo cuando Gemini está offline"""
        banco_proyectos = [
            {
                "nombre": "Gestor de Biblioteca Digital y Préstamos",
                "dificultad": "facil",
                "temas": ["POO", "modularizacion", "listas"],
                "descripcion": "Diseña un sistema modular para catalogar libros, registrar préstamos y verificar disponibilidad entre módulos independientes.",
                "enunciado": "Implementa una biblioteca modular dividida en tres módulos:\\n\\n1. `libro.py`: Clase `Libro` con atributos `titulo` (str), `autor` (str), `isbn` (str) y `prestado` (bool, False por defecto). Valida que el ISBN tenga al menos 5 caracteres; de lo contrario, lanza `ValueError`.\\n2. `biblioteca.py`: Clase `Biblioteca` para almacenar el catálogo en una lista y métodos para `agregar_libro`, `buscar_por_autor` y `prestar_libro(isbn)`.\\n3. `main.py`: Punto de entrada que inicializa libros de muestra y realiza operaciones de préstamo.",
                "reglas": [
                    "No alterar los nombres de las clases ni firmas de los métodos requeridos.",
                    "Si se intenta crear un Libro con ISBN menor a 5 caracteres, debe lanzar ValueError.",
                    "El método prestar_libro(isbn) cambia prestado = True y retorna True si el libro estaba disponible; si ya estaba prestado o no existe, retorna False."
                ],
                "criterios_aceptacion": [
                    "Clase Libro valida que el ISBN tenga al menos 5 caracteres y rechaza menores con ValueError.",
                    "Clase Libro inicializa con prestado = False por defecto.",
                    "Biblioteca.agregar_libro(libro) añade correctamente la instancia al catálogo.",
                    "Biblioteca.buscar_por_autor(autor) retorna la lista de libros de ese autor.",
                    "Biblioteca.prestar_libro(isbn) marca prestado = True y retorna True sólo si estaba disponible.",
                    "main.py importa libro y biblioteca sin errores de sintaxis o importación."
                ],
                "archivo_entrada": "main.py",
                "archivos": {
                    "libro.py": "class Libro:\\n    \"\"\"Representa un libro en la biblioteca digital.\"\"\"\\n    def __init__(self, titulo: str, autor: str, isbn: str):\\n        if not isbn or len(isbn.strip()) < 5:\\n            raise ValueError(\"El ISBN debe contener al menos 5 caracteres\")\\n        self.titulo = titulo.strip()\\n        self.autor = autor.strip()\\n        self.isbn = isbn.strip()\\n        self.prestado = False\\n\\n    def __repr__(self):\\n        estado = 'Prestado' if self.prestado else 'Disponible'\\n        return f'[{estado}] {self.titulo} - {self.autor} ({self.isbn})'\\n",
                    "biblioteca.py": "from typing import List, Optional\\nfrom libro import Libro\\n\\nclass Biblioteca:\\n    \"\"\"Administra el catálogo de libros y préstamos.\"\"\"\\n    def __init__(self, nombre: str):\\n        self.nombre = nombre\\n        self.catalogo: List[Libro] = []\\n\\n    def agregar_libro(self, libro: Libro) -> None:\\n        # TODO: Agrega el libro al catálogo\\n        pass\\n\\n    def buscar_por_autor(self, autor: str) -> List[Libro]:\\n        # TODO: Retorna una lista con los libros cuyo autor coincida (case-insensitive)\\n        return []\\n\\n    def prestar_libro(self, isbn: str) -> bool:\\n        # TODO: Busca el libro por ISBN. Si existe y no está prestado, marca prestado = True y retorna True.\\n        # Si ya está prestado o no existe, retorna False.\\n        return False\\n",
                    "main.py": "from libro import Libro\\nfrom biblioteca import Biblioteca\\n\\ndef main():\\n    print('=== BIBLIOTECA DIGITAL PYLEVEL ===')\\n    bib = Biblioteca('Biblioteca Central')\\n    l1 = Libro('Fluent Python', 'Luciano Ramalho', '978-1491957660')\\n    l2 = Libro('Clean Code', 'Robert C. Martin', '978-0132350884')\\n    bib.agregar_libro(l1)\\n    bib.agregar_libro(l2)\\n    print(f'Total libros: {len(bib.catalogo)}')\\n    ok = bib.prestar_libro('978-1491957660')\\n    print(f'Préstamo exitoso: {ok}')\\n\\nif __name__ == '__main__':\\n    main()\\n"
                },
                "test_runner": "import sys, json\\nresultados = []\\ndef reportar(c, ok, d=''):\\n    resultados.append({'criterio': c, 'aprobado': ok, 'detalle': d})\\n\\ntry:\\n    from libro import Libro\\n    # Criterio 1: Validar ISBN\\n    try:\\n        l = Libro('T', 'A', '12345')\\n        try:\\n            Libro('T', 'A', '12')\\n            err_ok = False\\n        except ValueError:\\n            err_ok = True\\n        reportar(\"Clase Libro valida que el ISBN tenga al menos 5 caracteres y rechaza menores con ValueError.\", err_ok)\\n    except Exception as e:\\n        reportar(\"Clase Libro valida que el ISBN tenga al menos 5 caracteres y rechaza menores con ValueError.\", False, str(e))\\n\\n    # Criterio 2: Prestado False por defecto\\n    try:\\n        l = Libro('T', 'A', '12345')\\n        reportar(\"Clase Libro inicializa con prestado = False por defecto.\", l.prestado is False)\\n    except Exception as e:\\n        reportar(\"Clase Libro inicializa con prestado = False por defecto.\", False, str(e))\\n\\n    from biblioteca import Biblioteca\\n    # Criterio 3: Agregar libro\\n    try:\\n        b = Biblioteca('Test')\\n        b.agregar_libro(Libro('L1', 'A1', '12345'))\\n        reportar(\"Biblioteca.agregar_libro(libro) añade correctamente la instancia al catálogo.\", len(b.catalogo) == 1)\\n    except Exception as e:\\n        reportar(\"Biblioteca.agregar_libro(libro) añade correctamente la instancia al catálogo.\", False, str(e))\\n\\n    # Criterio 4: Buscar por autor\\n    try:\\n        b = Biblioteca('Test')\\n        b.agregar_libro(Libro('L1', 'Guido', '12345'))\\n        b.agregar_libro(Libro('L2', 'Guido', '67890'))\\n        b.agregar_libro(Libro('L3', 'Otro', '11111'))\\n        res = b.buscar_por_autor('Guido')\\n        reportar(\"Biblioteca.buscar_por_autor(autor) retorna la lista de libros de ese autor.\", len(res) == 2)\\n    except Exception as e:\\n        reportar(\"Biblioteca.buscar_por_autor(autor) retorna la lista de libros de ese autor.\", False, str(e))\\n\\n    # Criterio 5: Prestar libro\\n    try:\\n        b = Biblioteca('Test')\\n        b.agregar_libro(Libro('L1', 'A1', '12345'))\\n        p1 = b.prestar_libro('12345')\\n        p2 = b.prestar_libro('12345')\\n        p3 = b.prestar_libro('99999')\\n        reportar(\"Biblioteca.prestar_libro(isbn) marca prestado = True y retorna True sólo si estaba disponible.\", p1 is True and p2 is False and p3 is False)\\n    except Exception as e:\\n        reportar(\"Biblioteca.prestar_libro(isbn) marca prestado = True y retorna True sólo si estaba disponible.\", False, str(e))\\n\\n    # Criterio 6: main.py ejecutable\\n    try:\\n        import main\\n        reportar(\"main.py importa libro y biblioteca sin errores de sintaxis o importación.\", True)\\n    except Exception as e:\\n        reportar(\"main.py importa libro y biblioteca sin errores de sintaxis o importación.\", False, str(e))\\n\\nexcept Exception as e:\\n    reportar(\"Importación de módulos base\", False, f\"Error general: {str(e)}\")\\n\\ntodos_ok = all(r['aprobado'] for r in resultados)\\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\\nprint(json.dumps({'exito': todos_ok, 'resumen': f'{tot_pasados}/{len(resultados)} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}, ensure_ascii=False))\\n"
            },
            {
                "nombre": "Simulador de Carrito de Compras con Descuentos",
                "dificultad": "media",
                "temas": ["POO", "modularizacion", "diccionarios"],
                "descripcion": "Construye una tienda en línea con validación de precios, cupones de descuento porcentuales y cálculo de totales con impuestos.",
                "enunciado": "Implementa un motor de carrito de compras en tres módulos:\\n\\n1. `producto.py`: Clase `Producto` con `sku` (str), `nombre` (str) y `precio` (float > 0, si es <= 0 lanza `ValueError`).\\n2. `carrito.py`: Clase `CarritoCompras` con métodos para `agregar_producto(prod, cant)`, `aplicar_cupon(codigo, porcentaje)` y `calcular_total(tasa_iva)`.\\n3. `main.py`: Simulación de compra con productos y cupón de descuento.",
                "reglas": [
                    "Precios <= 0 deben disparar ValueError en la clase Producto.",
                    "Los cupones descuentan sobre el subtotal antes de calcular el IVA.",
                    "Si se agrega dos veces el mismo producto por SKU, debe acumular la cantidad en lugar de duplicarlo."
                ],
                "criterios_aceptacion": [
                    "Clase Producto rechaza precios <= 0 con ValueError.",
                    "CarritoCompras.agregar_producto() añade productos e incrementa la cantidad si el SKU ya existe.",
                    "CarritoCompras.aplicar_cupon() descuenta el porcentaje correcto sobre el subtotal.",
                    "CarritoCompras.calcular_total() suma el IVA al subtotal con descuento.",
                    "main.py ejecuta el flujo demostrativo sin excepciones no controladas."
                ],
                "archivo_entrada": "main.py",
                "archivos": {
                    "producto.py": "class Producto:\\n    \"\"\"Representa un producto vendible con validación de precio.\"\"\"\\n    def __init__(self, sku: str, nombre: str, precio: float):\\n        if precio <= 0:\\n            raise ValueError(\"El precio debe ser estrictamente mayor a 0\")\\n        self.sku = sku.strip()\\n        self.nombre = nombre.strip()\\n        self.precio = float(precio)\\n\\n    def __repr__(self):\\n        return f'Producto({self.sku}, {self.nombre}, ${self.precio:.2f})'\\n",
                    "carrito.py": "from typing import Dict, Tuple\\nfrom producto import Producto\\n\\nclass CarritoCompras:\\n    def __init__(self):\\n        # Diccionario con sku -> (Producto, cantidad)\\n        self.items: Dict[str, Tuple[Producto, int]] = {}\\n        self.descuento_porcentaje: float = 0.0\\n\\n    def agregar_producto(self, prod: Producto, cantidad: int = 1) -> None:\\n        # TODO: Si prod.sku ya existe, suma cantidad; si no, regístralo con (prod, cantidad)\\n        pass\\n\\n    def aplicar_cupon(self, codigo: str, porcentaje: float) -> bool:\\n        # TODO: Si porcentaje está entre 1 y 100, asigna self.descuento_porcentaje y retorna True. Sino False.\\n        return False\\n\\n    def calcular_subtotal(self) -> float:\\n        # TODO: Calcula la suma de (precio * cantidad) de todos los items\\n        return 0.0\\n\\n    def calcular_total(self, tasa_iva: float = 0.19) -> float:\\n        # TODO: Aplica el descuento sobre el subtotal, suma el IVA (tasa_iva) y retorna el total redondeado a 2 decimales\\n        return 0.0\\n",
                    "main.py": "from producto import Producto\\nfrom carrito import CarritoCompras\\n\\ndef main():\\n    print('=== TIENDA ONLINE PYLEVEL ===')\\n    c = CarritoCompras()\\n    p1 = Producto('SKU-1', 'Teclado Mecánico', 120.0)\\n    p2 = Producto('SKU-2', 'Mouse Ergonómico', 60.0)\\n    c.agregar_producto(p1, 1)\\n    c.agregar_producto(p2, 2)\\n    c.aplicar_cupon('PROMO10', 10.0)\\n    print(f'Total con IVA: ${c.calcular_total():.2f}')\\n\\nif __name__ == '__main__':\\n    main()\\n"
                },
                "test_runner": "import sys, json\\nresultados = []\\ndef reportar(c, ok, d=''):\\n    resultados.append({'criterio': c, 'aprobado': ok, 'detalle': d})\\n\\ntry:\\n    from producto import Producto\\n    try:\\n        p = Producto('S1', 'P1', 10.0)\\n        try:\\n            Producto('S2', 'P2', 0.0)\\n            err_ok = False\\n        except ValueError:\\n            err_ok = True\\n        reportar(\"Clase Producto rechaza precios <= 0 con ValueError.\", err_ok and p.precio == 10.0)\\n    except Exception as e:\\n        reportar(\"Clase Producto rechaza precios <= 0 con ValueError.\", False, str(e))\\n\\n    from carrito import CarritoCompras\\n    try:\\n        c = CarritoCompras()\\n        c.agregar_producto(Producto('S1', 'P1', 10.0), 2)\\n        c.agregar_producto(Producto('S1', 'P1', 10.0), 3)\\n        item = c.items.get('S1')\\n        reportar(\"CarritoCompras.agregar_producto() añade productos e incrementa la cantidad si el SKU ya existe.\", item is not None and item[1] == 5)\\n    except Exception as e:\\n        reportar(\"CarritoCompras.agregar_producto() añade productos e incrementa la cantidad si el SKU ya existe.\", False, str(e))\\n\\n    try:\\n        c = CarritoCompras()\\n        ok1 = c.aplicar_cupon('DESCUENTO', 20.0)\\n        ok2 = c.aplicar_cupon('INVALIDO', 150.0)\\n        reportar(\"CarritoCompras.aplicar_cupon() descuenta el porcentaje correcto sobre el subtotal.\", ok1 is True and ok2 is False and c.descuento_porcentaje == 20.0)\\n    except Exception as e:\\n        reportar(\"CarritoCompras.aplicar_cupon() descuenta el porcentaje correcto sobre el subtotal.\", False, str(e))\\n\\n    try:\\n        c = CarritoCompras()\\n        c.agregar_producto(Producto('S1', 'P1', 100.0), 1)\\n        c.aplicar_cupon('D10', 10.0)\\n        tot = c.calcular_total(0.10)\\n        reportar(\"CarritoCompras.calcular_total() suma el IVA al subtotal con descuento.\", abs(tot - 99.0) < 0.01)\\n    except Exception as e:\\n        reportar(\"CarritoCompras.calcular_total() suma el IVA al subtotal con descuento.\", False, str(e))\\n\\n    try:\\n        import main\\n        reportar(\"main.py ejecuta el flujo demostrativo sin excepciones no controladas.\", True)\\n    except Exception as e:\\n        reportar(\"main.py ejecuta el flujo demostrativo sin excepciones no controladas.\", False, str(e))\\n\\nexcept Exception as e:\\n    reportar(\"Importación de módulos base\", False, f\"Error general: {str(e)}\")\\n\\ntodos_ok = all(r['aprobado'] for r in resultados)\\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\\nprint(json.dumps({'exito': todos_ok, 'resumen': f'{tot_pasados}/{len(resultados)} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}, ensure_ascii=False))\\n"
            },
            {
                "nombre": "Bus de Eventos y Middleware con Transacciones",
                "dificultad": "extrema",
                "temas": ["POO Avanzada", "Patrón Observador", "Middleware", "Manejo de Errores"],
                "descripcion": "Diseña un bus de eventos reactivo con registro de escuchadores, middleware de validación y cancelación controlada.",
                "enunciado": "Implementa un motor de eventos desacoplado en tres módulos:\\n\\n1. `evento.py`: Clase `Evento` con atributos `nombre` (str), `payload` (dict) y `cancelado` (bool, False por defecto). Si nombre está vacío, lanza `ValueError`.\\n2. `bus.py`: Clase `EventBus` con métodos `suscribir(nombre_evento, callback)`, `agregar_middleware(fn_middleware)` y `publicar(evento)`.\\n3. `main.py`: Demostración con eventos y middleware de auditoría.",
                "reglas": [
                    "Si Evento recibe un nombre vacío o con puros espacios, debe lanzar ValueError.",
                    "Los middlewares se ejecutan antes que los callbacks. Si un middleware marca evento.cancelado = True, ningún callback debe ejecutarse y publicar() retorna False.",
                    "Si el evento no es cancelado, publicar() invoca todos los callbacks suscritos y retorna True."
                ],
                "criterios_aceptacion": [
                    "Clase Evento valida que nombre no esté vacío y lanza ValueError.",
                    "Clase Evento inicializa cancelado = False por defecto.",
                    "EventBus.suscribir() registra múltiples escuchadores para un mismo evento.",
                    "EventBus.publicar() detiene la ejecución si un middleware marca cancelado = True.",
                    "EventBus.publicar() ejecuta todos los callbacks y retorna True cuando no hay cancelación.",
                    "main.py ejecuta el pipeline demostrativo sin errores de sintaxis."
                ],
                "archivo_entrada": "main.py",
                "archivos": {
                    "evento.py": "class Evento:\\n    \"\"\"Representa un mensaje inmutable transportado por el bus de eventos.\"\"\"\\n    def __init__(self, nombre: str, payload: dict = None):\\n        if not nombre or not nombre.strip():\\n            raise ValueError(\"El nombre del evento no puede estar vacío\")\\n        self.nombre = nombre.strip()\\n        self.payload = payload or {}\\n        self.cancelado = False\\n",
                    "bus.py": "from typing import Callable, Dict, List\\nfrom evento import Evento\\n\\nclass EventBus:\\n    def __init__(self):\\n        self.suscriptores: Dict[str, List[Callable]] = {}\\n        self.middlewares: List[Callable] = []\\n\\n    def suscribir(self, evento_nombre: str, callback: Callable) -> None:\\n        # TODO: Registra el callback en el diccionario de suscriptores para evento_nombre\\n        pass\\n\\n    def agregar_middleware(self, middleware: Callable) -> None:\\n        # TODO: Añade el middleware a la lista\\n        pass\\n\\n    def publicar(self, evento: Evento) -> bool:\\n        # TODO: Ejecuta cada middleware pasándole el evento. Si evento.cancelado es True, retorna False.\\n        # Si no fue cancelado, ejecuta cada callback suscrito y retorna True.\\n        return False\\n",
                    "main.py": "from evento import Evento\\nfrom bus import EventBus\\n\\ndef main():\\n    print('=== MOTOR DE EVENTOS REACTIVO ===')\\n    bus = EventBus()\\n    logs = []\\n    bus.suscribir('LOGIN', lambda e: logs.append(f'Usuario logueado: {e.payload.get(\"usuario\")}'))\\n    ev = Evento('LOGIN', {'usuario': 'santiago_dev'})\\n    bus.publicar(ev)\\n    print('Logs:', logs)\\n\\nif __name__ == '__main__':\\n    main()\\n"
                },
                "test_runner": "import sys, json\\nresultados = []\\ndef reportar(c, ok, d=''):\\n    resultados.append({'criterio': c, 'aprobado': ok, 'detalle': d})\\n\\ntry:\\n    from evento import Evento\\n    try:\\n        ev = Evento('TEST')\\n        try:\\n            Evento('')\\n            err_ok = False\\n        except ValueError:\\n            err_ok = True\\n        reportar(\"Clase Evento valida que nombre no esté vacío y lanza ValueError.\", err_ok)\\n    except Exception as e:\\n        reportar(\"Clase Evento valida que nombre no esté vacío y lanza ValueError.\", False, str(e))\\n\\n    try:\\n        ev = Evento('TEST')\\n        reportar(\"Clase Evento inicializa cancelado = False por defecto.\", ev.cancelado is False)\\n    except Exception as e:\\n        reportar(\"Clase Evento inicializa cancelado = False por defecto.\", False, str(e))\\n\\n    from bus import EventBus\\n    try:\\n        b = EventBus()\\n        b.suscribir('EV1', lambda e: None)\\n        b.suscribir('EV1', lambda e: None)\\n        reportar(\"EventBus.suscribir() registra múltiples escuchadores para un mismo evento.\", len(b.suscriptores.get('EV1', [])) == 2)\\n    except Exception as e:\\n        reportar(\"EventBus.suscribir() registra múltiples escuchadores para un mismo evento.\", False, str(e))\\n\\n    try:\\n        b = EventBus()\\n        ejecutado = [False]\\n        b.suscribir('ORDEN', lambda e: ejecutado.__setitem__(0, True))\\n        def mw_bloqueador(e):\\n            e.cancelado = True\\n        b.agregar_middleware(mw_bloqueador)\\n        res = b.publicar(Evento('ORDEN'))\\n        reportar(\"EventBus.publicar() detiene la ejecución si un middleware marca cancelado = True.\", res is False and not ejecutado[0])\\n    except Exception as e:\\n        reportar(\"EventBus.publicar() detiene la ejecución si un middleware marca cancelado = True.\", False, str(e))\\n\\n    try:\\n        b = EventBus()\\n        recibido = []\\n        b.suscribir('MSG', lambda e: recibido.append(e.payload.get('val')))\\n        res = b.publicar(Evento('MSG', {'val': 42}))\\n        reportar(\"EventBus.publicar() ejecuta todos los callbacks y retorna True cuando no hay cancelación.\", res is True and recibido == [42])\\n    except Exception as e:\\n        reportar(\"EventBus.publicar() ejecuta todos los callbacks y retorna True cuando no hay cancelación.\", False, str(e))\\n\\n    try:\\n        import main\\n        reportar(\"main.py ejecuta el pipeline demostrativo sin errores de sintaxis.\", True)\\n    except Exception as e:\\n        reportar(\"main.py ejecuta el pipeline demostrativo sin errores de sintaxis.\", False, str(e))\\n\\nexcept Exception as e:\\n    reportar(\"Importación base\", False, str(e))\\n\\ntodos_ok = all(r['aprobado'] for r in resultados)\\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\\nprint(json.dumps({'exito': todos_ok, 'resumen': f'{tot_pasados}/{len(resultados)} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}, ensure_ascii=False))\\n"
            }
        ]

        compatibles = [p for p in banco_proyectos if p['dificultad'] == dificultad]
        if not compatibles:
            compatibles = banco_proyectos

        import random
        seleccion = dict(random.choice(compatibles))
        seleccion['es_ia'] = True
        return {
            'success': True,
            'proyecto': seleccion,
            'fuente': 'motor_local',
            'modelo': 'Generador Modular Local'
        }

    # =========================================================================
    # ASISTENCIA INTELIGENTE DE PROYECTOS: PISTAS Y RESOLUCIÓN CON RETROALIMENTACIÓN
    # =========================================================================

    def generar_pista_proyecto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista pedagógica guiada para el archivo actual del proyecto sin revelar la solución"""
        titulo = datos.get('titulo', 'Proyecto Python')
        enunciado = datos.get('enunciado', '')
        criterios = datos.get('criterios', [])
        archivo_activo = datos.get('archivo_activo', 'main.py')
        codigo_actual = datos.get('codigo_actual', '')

        if self.tiene_api_key():
            prompt = f"""Actúa como PyBot, tutor pedagógico experto en Python en PyLevel.
El estudiante está trabajando en el proyecto multi-archivo: '{titulo}'.
Enunciado: {enunciado}
Criterios de Aceptación: {json.dumps(criterios, ensure_ascii=False) if criterios else 'No especificados'}
Archivo que el estudiante tiene abierto en el editor: {archivo_activo}
Código actual que ha escrito el estudiante:
```python
{codigo_actual}
```

El estudiante solicita una PISTA PEDAGÓGICA porque está atascado.
REGLA CRUCIAL: NO le entregues el código resuelto completo; guía su razonamiento (método socrático).

Proporciona una respuesta en Markdown con esta estructura:
1.  **Punto de Enfoque**: En qué método o función debe concentrarse primero y qué entrada/salida requiere.
2.  **Estrategia Lógica**: Una explicación conceptual con analogías claras de cómo resolverlo.
3. ️ **Trampa Frecuente**: Un error común a evitar en este tipo de ejercicios (ej. tipos mutables, índices, manejo de None, excepciones).
4.  **Próximo Paso**: Un micro-paso de 1 o 2 líneas para que empiece a escribir código de inmediato.
"""
            sys_inst = "Eres PyBot, el tutor amigable y motivador de PyLevel. Enseñas a pensar como programador, dando pistas socráticas claras y pedagógicas."
            resp = self.consultar_gemini(prompt, sys_inst, max_tokens=1500)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.modelo,
                    'pista': resp
                }

        # Fallback local
        return self._generar_pista_proyecto_local(datos)

    def _generar_pista_proyecto_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Pistas pedagógicas locales si Gemini está offline"""
        archivo = datos.get('archivo_activo', 'archivo.py')
        codigo = datos.get('codigo_actual', '')
        todos = [line.strip() for line in codigo.splitlines() if '# TODO' in line or 'pass' in line]
        
        primer_todo = todos[0] if todos else "Revisa las funciones y clases que contengan 'pass'"

        pista = f"""¡Hola!  Soy **PyBot** en modo tutor local.

Aquí tienes una pista pedagógica para avanzar en **`{archivo}`**:

1.  **Punto de Enfoque**: Concéntrate en la primera tarea pendiente:
   `{primer_todo}`

2.  **Estrategia Lógica**:
   - Revisa los tipos de datos requeridos por los parámetros y el valor que debe retornar la función.
   - Si debes almacenar o buscar elementos, recuerda que una lista `self.lista.append(item)` preserva el orden, mientras que un diccionario `self.dict[clave] = valor` permite búsquedas instantáneas por clave.
   - Recuerda validar las entradas (si el valor es inválido, utiliza `raise ValueError(...)` como se indica en las reglas).

3. ️ **Trampa Frecuente**:
   - No olvides reemplazar la instrucción `pass` por tu lógica real o retorno de valor.
   - Ten cuidado de no mutar listas mientras las estás iterando; si necesitas filtrar, crea una lista nueva o usa list comprehension: `[x for x in self.items if condicion]`.

4.  **Próximo Paso**:
   - Implementa primero el constructor `__init__` asegurándote de inicializar todas las variables de instancia con `self.`. Luego prueba con el botón **▶️ Ejecutar Proyecto**."""

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Tutor Pedagógico Local',
            'pista': pista
        }

    def resolver_proyecto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Resuelve el archivo activo del proyecto con IA y entrega una retroalimentación detallada paso a paso"""
        titulo = datos.get('titulo', 'Proyecto Python')
        enunciado = datos.get('enunciado', '')
        reglas = datos.get('reglas', [])
        criterios = datos.get('criterios', [])
        archivo_activo = datos.get('archivo_activo', 'main.py')
        codigo_actual = datos.get('codigo_actual', '')
        archivos = datos.get('archivos', {})

        if self.tiene_api_key():
            prompt = f"""Actúa como PyBot, tutor pedagógico experto en Python en PyLevel.
El estudiante está trabajando en el proyecto multi-archivo: '{titulo}'.
Enunciado: {enunciado}
Reglas: {json.dumps(reglas, ensure_ascii=False) if reglas else 'Ninguna'}
Criterios de Aceptación: {json.dumps(criterios, ensure_ascii=False) if criterios else 'No especificados'}
Archivo activo que el estudiante no puede resolver y solicita completar: '{archivo_activo}'
Código actual de '{archivo_activo}':
```python
{codigo_actual}
```
Contexto de todos los archivos del proyecto:
{json.dumps(archivos, ensure_ascii=False)}

El estudiante solicita que resuelvas el archivo '{archivo_activo}' de forma completa, limpia y funcional, cumpliendo todos los criterios de aceptación, Y QUE LE DES UNA RETROALIMENTACIÓN DETALLADA DE CÓMO LO HICISTE.

Devuelve OBLIGATORIAMENTE un JSON estricto con la siguiente estructura:
{{
  "codigo_resuelto": "Código Python 100% completo, ejecutable y sin errores para '{archivo_activo}', reemplazando todos los TODOs con la lógica correcta, conservando nombres, imports y tipos.",
  "explicacion_paso_a_paso": "Explicación detallada en Markdown de cómo se resolvió cada método y función del archivo.",
  "buenas_practicas": "Buenas prácticas de Python aplicadas en esta solución (POO, tipado, manejo de excepciones, algoritmos).",
  "criterios_resueltos": "Resumen de cómo el código implementado cumple los criterios de aceptación del proyecto."
}}
Devuelve ÚNICAMENTE el objeto JSON sin bloques de código exteriores.
"""
            sys_inst = "Eres PyBot, un arquitecto de software y profesor senior de Python. Diseñas código limpio, elegante, perfectamente comentado y con explicaciones didácticas de nivel profesional."
            raw = self.consultar_gemini(prompt, sys_inst, max_tokens=3200, temperature=0.2)
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
                            'modelo': self.modelo,
                            'archivo_destino': archivo_activo,
                            'codigo_resuelto': data.get('codigo_resuelto'),
                            'explicacion_paso_a_paso': data.get('explicacion_paso_a_paso', ''),
                            'buenas_practicas': data.get('buenas_practicas', ''),
                            'criterios_resueltos': data.get('criterios_resueltos', '')
                        }
                except Exception as e:
                    print(f"[AITutor] Error al parsear solución de proyecto: {e}")

        # Fallback local
        return self._resolver_proyecto_local(datos)

    def _resolver_proyecto_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Resolución asistida local con explicaciones para proyectos base"""
        archivo_activo = datos.get('archivo_activo', 'main.py')
        codigo_actual = datos.get('codigo_actual', '')

        # Si el código tiene TODOs comunes, implementar soluciones típicas
        codigo_limpio = codigo_actual.replace("# TODO: Agrega la tarea recibida a la lista interna\n        pass", "self.tareas.append(tarea)")
        codigo_limpio = codigo_limpio.replace("# TODO: Retorna una lista con las tareas que coincidan con la prioridad indicada\n        return []", "return [t for t in self.tareas if t.prioridad == prioridad.strip().lower()]")
        codigo_limpio = codigo_limpio.replace("# TODO: Busca la tarea por título, márcala completada = True y retorna True.\n        # Si no existe, retorna False.\n        return False", """for t in self.tareas:
            if t.titulo.strip().lower() == titulo.strip().lower():
                t.completada = True
                return True
        return False""")

        explicacion = """###  Explicación Paso a Paso de la Solución:

1. **Gestión de Colecciones Internas**:
   - `agregar_tarea(tarea)`: Utiliza el método nativo `.append()` para añadir el objeto al final de la lista interna `self.tareas`.
   
2. **Filtrado Eficiente con List Comprehensions**:
   - `filtrar_por_prioridad(prioridad)`: Itera sobre las tareas comparando la propiedad normalizada `t.prioridad == prioridad.strip().lower()`. Retorna una nueva lista sin mutar la original.

3. **Búsqueda y Actualización de Estado**:
   - `completar_tarea(titulo)`: Recorre linealmente `self.tareas`. Al encontrar coincidencia por título, modifica `t.completada = True` y retorna `True` inmediatamente. Si el ciclo finaliza sin encontrarlo, retorna `False`."""

        buenas_practicas = """- **Normalización de Cadenas**: Se usa `.strip().lower()` para evitar errores por mayúsculas o espacios accidentales.
- **Inmutabilidad en Filtrado**: Al filtrar, se genera una nueva lista preservando la lista original intacta.
- **Retorno Anticipado**: Retornar `True` en cuanto se encuentra el elemento evita iteraciones innecesarias."""

        criterios = "Cumple la validación de prioridad, adición a colección interna, filtrado exacto y marcado booleano de completado."

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Solucionador Algorítmico Local',
            'archivo_destino': archivo_activo,
            'codigo_resuelto': codigo_limpio,
            'explicacion_paso_a_paso': explicacion,
            'buenas_practicas': buenas_practicas,
            'criterios_resueltos': criterios
        }

    # =========================================================================
    # ASISTENCIA INTELIGENTE PARA RETOS DE CÓDIGO (PISTAS Y RESOLUCIÓN CON IA)
    # =========================================================================

    def generar_pista_reto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista pedagógica guiada para el reto de código sin revelar la solución directa"""
        titulo = datos.get('titulo', 'Reto de Programación')
        descripcion = datos.get('descripcion') or datos.get('enunciado', '')
        nombre_funcion = datos.get('nombre_funcion', 'solucion')
        dificultad = datos.get('dificultad', 'media')
        tema = datos.get('tema', 'Algoritmos')
        codigo_actual = datos.get('codigo_actual', '')
        ejemplos = datos.get('ejemplos', [])

        if self.tiene_api_key():
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
1.  **Punto de Enfoque**: Identifica con claridad qué parámetros recibe la función `{nombre_funcion}`, qué tipo de dato debe retornar con `return` y cuál es el caso base o inicial.
2.  **Estrategia Algorítmica**: Explica conceptualmente la técnica recomendada (ej. acumulador, list comprehension, diccionarios para conteo O(1), ordenamiento, punteros, etc.).
3. ️ **Trampa o Caso Borde**: Un error común a tener en cuenta (ej. no imprimir con print() sino retornar con return, listas vacías, tipos de datos mutables, índices fuera de rango).
4.  **Próximo Paso Sugerido**: Un micro-paso de 1 o 2 líneas de código para que el estudiante comience de inmediato en el editor.
"""
            sys_inst = "Eres PyBot, el tutor amigable de PyLevel. Enseñas a pensar algoritmos paso a paso con entusiasmo, claridad y enfoque pedagógico."
            resp = self.consultar_gemini(prompt, sys_inst, max_tokens=1400)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.modelo,
                    'pista': resp
                }

        # Fallback local
        return self._generar_pista_reto_local(datos)

    def _generar_pista_reto_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Pistas pedagógicas locales para retos si Gemini no está conectado"""
        titulo = datos.get('titulo', 'Reto')
        nombre_func = datos.get('nombre_funcion', 'solucion')
        tema = datos.get('tema', 'python')
        codigo = datos.get('codigo_actual', '')
        ejemplos = datos.get('ejemplos', [])

        ejemplo_txt = ""
        if ejemplos:
            ej = ejemplos[0]
            ejemplo_txt = f"\n   - Para la entrada `{ej.get('entrada')}`, la función debe retornar `{ej.get('salida')}`."

        pista = f"""¡Hola!  Soy **PyBot** en modo tutor pedagógico local.

Aquí tienes una pista orientativa para resolver **{titulo}**:

1.  **Punto de Enfoque**:
   - Tu función `def {nombre_func}(...)` debe procesar los argumentos de entrada y **retornar** el resultado final con la palabra clave `return` (¡no uses `print()`).{ejemplo_txt}

2.  **Estrategia Lógica ({tema.replace('_', ' ').title()})**:
   - Revisa si necesitas inicializar una variable acumuladora (ej. `contador = 0`, `acumulador = []` o `resultado = ""`) antes de iterar.
   - Si debes filtrar elementos de una lista, utiliza una estructura condicional `if condicion:` dentro de un bucle `for` o una *list comprehension*: `[x for x in lista if condicion]`.
   - Si debes contar frecuencias o buscar elementos únicos, considera usar un diccionario `dict` o un conjunto `set`.

3. ️ **Trampa Frecuente**:
   - Recuerda eliminar o reemplazar la instrucción `pass` por tu lógica real.
   - Verifica los casos límite: ¿qué ocurre si la lista está vacía `[]` o el string no contiene elementos válidos? Asegúrate de que el tipo devuelto sea exactamente el esperado (entero, booleano, lista, etc.).

4.  **Próximo Paso**:
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

        if self.tiene_api_key():
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
                pista = self.consultar_gemini(
                    prompt=prompt,
                    system_instruction="Eres PyBot, tutor pedagógico experto de CPython y arquitecto de software.",
                    max_tokens=650,
                    temperature=0.3
                )
                if pista and len(pista) > 40:
                    return {
                        'success': True,
                        'fuente': 'gemini_ia',
                        'modelo': self.modelo,
                        'pista': pista
                    }
            except Exception as e:
                print(f"[AITutor] Error al consultar Gemini para pista de mundos: {e}")

        # Fallback local
        return self._generar_pista_pregunta_duo_local(datos)

    def _generar_pista_pregunta_duo_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Pista pedagógica heurística local para preguntas de dificultad extrema"""
        enunciado = datos.get('enunciado', '')
        opciones = datos.get('opciones', [])
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

        pista = f"""¡Hola!  Soy **PyBot** en modo tutor experto de Python.

Aquí tienes mi análisis técnico para desarmar esta pregunta de dificultad extrema:

1.  **Concepto Central de CPython**:
   - {analisis_clave}

2. ️ **La Trampa Habitual**:
   - Muchos programadores asumen el comportamiento de lenguajes como C++ o Java. En Python, la resolución sigue reglas muy concretas dictadas por el modelo de datos (Data Model) y la máquina virtual.

3.  **Pista de Deducción**:
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

        if self.tiene_api_key():
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
            raw = self.consultar_gemini(prompt, sys_inst, max_tokens=2800, temperature=0.2)
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
                            'modelo': self.modelo,
                            'codigo_resuelto': data.get('codigo_resuelto'),
                            'explicacion_paso_a_paso': data.get('explicacion_paso_a_paso', ''),
                            'complejidad': data.get('complejidad', ''),
                            'buenas_practicas': data.get('buenas_practicas', '')
                        }
                except Exception as e:
                    print(f"[AITutor] Error al parsear solución de reto: {e}")

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

        if self.tiene_api_key():
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
                resp = self.consultar_gemini(prompt, sys_inst, max_tokens=4000, temperature=0.35, timeout=35.0)
                resultado = []
                if resp:
                    preguntas_lote = self._parse_json_array_robust(resp)
                    for p in preguntas_lote:
                        if isinstance(p, dict) and p.get('enunciado') and p.get('opciones') and p.get('respuesta_correcta'):
                            resultado.append(p)
                    if not resultado:
                        print(f"[AITutor] No se pudieron extraer preguntas válidas del lote {lote['idx'] + 1}")
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
                            print(f"[AITutor] Error en hilo de lote: {e}")
            except Exception as e:
                print(f"[AITutor] Error en ejecución paralela de lotes: {e}")

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
            'fuente': 'gemini' if self.tiene_api_key() and len(preguntas_totales) >= num_preguntas else 'hibrido_local',
            'modelo': self.modelo if self.tiene_api_key() else 'Banco Certificación Local'
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

        import random
        # Si se piden 25, tomar exactamente 25 desordenadas
        copia = list(banco)
        random.shuffle(copia)
        return copia[:num_preguntas]

    # =========================================================================
    # GENERACIÓN Y REGENERACIÓN DEL BANCO DE PREGUNTAS ADMINISTRATIVO
    # =========================================================================

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

        if self.tiene_api_key():
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
            resp = self.consultar_gemini(prompt, sys_inst, max_tokens=1200, temperature=0.4)
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
                            'modelo': self.modelo,
                            'pregunta': data
                        }
                except Exception as e:
                    print(f"[AITutor] Error al parsear pregunta generada con IA: {e}")

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

        import random
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
        cant_sintaxis = 7
        cant_poo = 7
        cant_algoritmos = 6

        perfiles_instruccion = {
            'extrema': "PERFIL EXTREMO OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'extrema' enfocadas en temas profundos de CPython, GIL, MRO C3, metaclasses, descriptores, bytecodes y algoritmos de alta complejidad.",
            'dificil': "PERFIL DIFÍCIL OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'dificil' con desafíos analíticos, código con edge cases y patrones avanzados.",
            'media': "PERFIL MEDIO OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'media' con preguntas técnicas balanceadas de nivel intermedio.",
            'facil': "PERFIL FÁCIL OBLIGATORIO: TODAS las 20 preguntas deben tener 'dificultad': 'facil' orientadas a principiantes, sintaxis limpia y conceptos directos.",
            'balanceado': "PERFIL BALANCEADO: Diversifica las dificultades, incluyendo preguntas fáciles (~30%), medias (~40%) y difíciles/extremas (~30%)."
        }
        instruccion_perfil = perfiles_instruccion.get(perfil_dificultad, perfiles_instruccion['balanceado'])

        if self.tiene_api_key():
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
            resp = self.consultar_gemini(prompt, sys_inst, max_tokens=4000, temperature=0.35, timeout=40.0)
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
                                'modelo': self.modelo,
                                'banco': banco_limpio
                            }
                except Exception as e:
                    print(f"[AITutor] Error al parsear banco completo de IA: {e}")

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

# Instancia global
ai_tutor = AITutor()
