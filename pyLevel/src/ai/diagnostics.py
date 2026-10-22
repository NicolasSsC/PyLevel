"""
Módulo de Diagnóstico de Errores y Análisis Pedagógico de Tracebacks para PyLevel
"""

import json
from typing import Dict, Any, Optional, List
from provider import GeminiProvider

class DiagnosticsManager:
    """Analiza excepciones de Python, tracebacks y fallos de aserción guiando al estudiante socráticamente"""

    def __init__(self, provider: GeminiProvider):
        self.provider = provider

    def explicar_error(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una explicación pedagógica basada en el error, código y casos de prueba"""
        tipo = datos.get('tipo', 'reto')
        titulo = datos.get('titulo', 'Ejercicio de Python')
        codigo = datos.get('codigo', '')
        error_msg = datos.get('error', '')
        casos = datos.get('casos', [])
        stdout = datos.get('stdout', '')

        # 1. Si hay Gemini configurado, generar explicación pedagógica con IA
        if self.provider.tiene_api_key():
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
            resp = self.provider.consultar(prompt, sys_inst)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.provider.modelo,
                    'explicacion': resp
                }

        # 2. Fallback: Motor Pedagógico Local Experto
        return self._analisis_local(datos)

    def _analisis_local(self, datos: Dict[str, Any]) -> Dict[str, Any]:
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
                    pista = "Asegúrate de agregar la instrucción `return resultado` al final de tu función en vez de solo imprimir con `print()`."
                    concepto = "Valores de Retorno con `return`"
                elif type(esperado) != type(obtenido) and esperado is not None:
                    diagnostico = f"El tipo de dato retornado no coincide con el esperado. Las pruebas esperan un resultado de tipo `{type(esperado).__name__}`, pero tu código devolvió un `{type(obtenido).__name__}`."
                    pista = f"Para la entrada `{entrada}`, se esperaba `{repr(esperado)}`, pero tu función entregó `{repr(obtenido)}`. Revisa la conversión de tipos."
                    concepto = "Firma de Función y Tipos de Retorno"
                else:
                    diagnostico = "La función se ejecutó sin errores fatales, pero la lógica calculó un resultado diferente al esperado para el caso de prueba."
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

        texto_explicacion = f"""### 💡 PyLevel AI • Tutor Pedagógico (Modo Local Experto)

🔍 **Diagnóstico:**
{diagnostico}

🎯 **Pista Pedagógica:**
{pista}

📚 **Concepto Clave:**
**{concepto}**: Revisa la teoría asociada a este tema en tus rutas de estudio para fortalecer tu comprensión."""

        return {
            'success': True,
            'fuente': 'motor_local',
            'modelo': 'Motor Pedagógico PyLevel',
            'explicacion': texto_explicacion
        }
