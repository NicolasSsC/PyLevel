"""
Módulo de Chat Conversacional y Base de Conocimientos Pedagógica para PyBot
"""

from typing import Dict, Any, Optional, List
from provider import GeminiProvider

class ChatManager:
    """Gestiona el chat interactivo con PyBot y la base de conocimientos pedagógica local"""

    def __init__(self, provider: GeminiProvider):
        self.provider = provider

    def responder(self, mensaje: str, historial: Optional[List[Dict]] = None, contexto: Optional[Dict] = None) -> Dict[str, Any]:
        """Responde preguntas libres sobre Python hechas por el estudiante"""
        mensaje_limpio = (mensaje or '').strip()
        if not mensaje_limpio:
            return {'success': False, 'error': 'El mensaje no puede estar vacío.'}

        # 1. Intentar responder con Gemini si está configurado
        if self.provider.tiene_api_key():
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
            resp = self.provider.consultar(prompt, sys_inst)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.provider.modelo,
                    'respuesta': resp
                }

        # 2. Fallback local: Base de conocimientos conversacional de Python
        return self._responder_local(mensaje_limpio)

    def _responder_local(self, mensaje: str) -> Dict[str, Any]:
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
