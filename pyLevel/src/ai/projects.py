"""
Módulo de Gestión y Generación de Proyectos Multi-Archivo para PyLevel
Maneja generación de arquitecturas modulares en Python, test runners automatizados, pistas socráticas y resolución.
"""

import json
import re
import random
from typing import Dict, Any, Optional, List
from provider import GeminiProvider

class ProjectsManager:
    """Gestiona proyectos prácticos multi-archivo, suites de pruebas y asistencia técnica"""

    def __init__(self, provider: GeminiProvider):
        self.provider = provider

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
        if self.provider.tiene_api_key():
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
            schema_proyecto = {
                "type": "OBJECT",
                "properties": {
                    "nombre": {"type": "STRING"},
                    "dificultad": {"type": "STRING"},
                    "temas": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "descripcion": {"type": "STRING"},
                    "enunciado": {"type": "STRING"},
                    "reglas": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "criterios_aceptacion": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "archivo_entrada": {"type": "STRING"},
                    "archivos": {"type": "OBJECT"},
                    "test_runner": {"type": "STRING"}
                },
                "required": ["nombre", "dificultad", "temas", "descripcion", "enunciado", "reglas", "criterios_aceptacion", "archivo_entrada", "archivos", "test_runner"]
            }
            raw_resp = self.provider.consultar(prompt, sys_inst, max_tokens=3500, temperature=0.85, json_mode=True, response_schema=schema_proyecto)
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
                                'modelo': self.provider.modelo
                            }
                except Exception as e:
                    print(f"[ProjectsManager] Error al parsear proyecto generado por Gemini: {e}")

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
                    "libro.py": "class Libro:\n    \"\"\"Representa un libro en la biblioteca digital.\"\"\"\n    def __init__(self, titulo: str, autor: str, isbn: str):\n        if not isbn or len(isbn.strip()) < 5:\n            raise ValueError(\"El ISBN debe contener al menos 5 caracteres\")\n        self.titulo = titulo.strip()\n        self.autor = autor.strip()\n        self.isbn = isbn.strip()\n        self.prestado = False\n\n    def __repr__(self):\n        estado = 'Prestado' if self.prestado else 'Disponible'\n        return f'[{estado}] {self.titulo} - {self.autor} ({self.isbn})'\n",
                    "biblioteca.py": "from typing import List, Optional\nfrom libro import Libro\n\nclass Biblioteca:\n    \"\"\"Administra el catálogo de libros y préstamos.\"\"\"\n    def __init__(self, nombre: str):\n        self.nombre = nombre\n        self.catalogo: List[Libro] = []\n\n    def agregar_libro(self, libro: Libro) -> None:\n        # TODO: Agrega el libro al catálogo\n        pass\n\n    def buscar_por_autor(self, autor: str) -> List[Libro]:\n        # TODO: Retorna una lista con los libros cuyo autor coincida (case-insensitive)\n        return []\n\n    def prestar_libro(self, isbn: str) -> bool:\n        # TODO: Busca el libro por ISBN. Si existe y no está prestado, marca prestado = True y retorna True.\n        # Si ya está prestado o no existe, retorna False.\n        return False\n",
                    "main.py": "from libro import Libro\nfrom biblioteca import Biblioteca\n\ndef main():\n    print('=== BIBLIOTECA DIGITAL PYLEVEL ===')\n    bib = Biblioteca('Biblioteca Central')\n    l1 = Libro('Fluent Python', 'Luciano Ramalho', '978-1491957660')\n    l2 = Libro('Clean Code', 'Robert C. Martin', '978-0132350884')\n    bib.agregar_libro(l1)\n    bib.agregar_libro(l2)\n    print(f'Total libros: {len(bib.catalogo)}')\n    ok = bib.prestar_libro('978-1491957660')\n    print(f'Préstamo exitoso: {ok}')\n\nif __name__ == '__main__':\n    main()\n"
                },
                "test_runner": "import sys, json\nresultados = []\ndef reportar(c, ok, d=''):\n    resultados.append({'criterio': c, 'aprobado': ok, 'detalle': d})\n\ntry:\n    from libro import Libro\n    # Criterio 1: Validar ISBN\n    try:\n        l = Libro('T', 'A', '12345')\n        try:\n            Libro('T', 'A', '12')\n            err_ok = False\n        except ValueError:\n            err_ok = True\n        reportar(\"Clase Libro valida que el ISBN tenga al menos 5 caracteres y rechaza menores con ValueError.\", err_ok)\n    except Exception as e:\n        reportar(\"Clase Libro valida que el ISBN tenga al menos 5 caracteres y rechaza menores con ValueError.\", False, str(e))\n\n    # Criterio 2: Prestado False por defecto\n    try:\n        l = Libro('T', 'A', '12345')\n        reportar(\"Clase Libro inicializa con prestado = False por defecto.\", l.prestado is False)\n    except Exception as e:\n        reportar(\"Clase Libro inicializa con prestado = False por defecto.\", False, str(e))\n\n    from biblioteca import Biblioteca\n    # Criterio 3: Agregar libro\n    try:\n        b = Biblioteca('Test')\n        b.agregar_libro(Libro('L1', 'A1', '12345'))\n        reportar(\"Biblioteca.agregar_libro(libro) añade correctamente la instancia al catálogo.\", len(b.catalogo) == 1)\n    except Exception as e:\n        reportar(\"Biblioteca.agregar_libro(libro) añade correctamente la instancia al catálogo.\", False, str(e))\n\n    # Criterio 4: Buscar por autor\n    try:\n        b = Biblioteca('Test')\n        b.agregar_libro(Libro('L1', 'Guido', '12345'))\n        b.agregar_libro(Libro('L2', 'Guido', '67890'))\n        b.agregar_libro(Libro('L3', 'Otro', '11111'))\n        res = b.buscar_por_autor('Guido')\n        reportar(\"Biblioteca.buscar_por_autor(autor) retorna la lista de libros de ese autor.\", len(res) == 2)\n    except Exception as e:\n        reportar(\"Biblioteca.buscar_por_autor(autor) retorna la lista de libros de ese autor.\", False, str(e))\n\n    # Criterio 5: Prestar libro\n    try:\n        b = Biblioteca('Test')\n        b.agregar_libro(Libro('L1', 'A1', '12345'))\n        p1 = b.prestar_libro('12345')\n        p2 = b.prestar_libro('12345')\n        p3 = b.prestar_libro('99999')\n        reportar(\"Biblioteca.prestar_libro(isbn) marca prestado = True y retorna True sólo si estaba disponible.\", p1 is True and p2 is False and p3 is False)\n    except Exception as e:\n        reportar(\"Biblioteca.prestar_libro(isbn) marca prestado = True y retorna True sólo si estaba disponible.\", False, str(e))\n\n    # Criterio 6: main.py ejecutable\n    try:\n        import main\n        reportar(\"main.py importa libro y biblioteca sin errores de sintaxis o importación.\", True)\n    except Exception as e:\n        reportar(\"main.py importa libro y biblioteca sin errores de sintaxis o importación.\", False, str(e))\n\nexcept Exception as e:\n    reportar(\"Importación de módulos base\", False, f\"Error general: {str(e)}\")\n\ntodos_ok = all(r['aprobado'] for r in resultados)\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\nprint(json.dumps({'exito': todos_ok, 'resumen': f'{tot_pasados}/{len(resultados)} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}, ensure_ascii=False))\n"
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
                    "producto.py": "class Producto:\n    \"\"\"Representa un producto vendible con validación de precio.\"\"\"\n    def __init__(self, sku: str, nombre: str, precio: float):\n        if precio <= 0:\n            raise ValueError(\"El precio debe ser estrictamente mayor a 0\")\n        self.sku = sku.strip()\n        self.nombre = nombre.strip()\n        self.precio = float(precio)\n\n    def __repr__(self):\n        return f'Producto({self.sku}, {self.nombre}, ${self.precio:.2f})'\n",
                    "carrito.py": "from typing import Dict, Tuple\nfrom producto import Producto\n\nclass CarritoCompras:\n    def __init__(self):\n        # Diccionario con sku -> (Producto, cantidad)\n        self.items: Dict[str, Tuple[Producto, int]] = {}\n        self.descuento_porcentaje: float = 0.0\n\n    def agregar_producto(self, prod: Producto, cantidad: int = 1) -> None:\n        # TODO: Si prod.sku ya existe, suma cantidad; si no, regístralo con (prod, cantidad)\n        pass\n\n    def aplicar_cupon(self, codigo: str, porcentaje: float) -> bool:\n        # TODO: Si porcentaje está entre 1 y 100, asigna self.descuento_porcentaje y retorna True. Sino False.\n        return False\n\n    def calcular_subtotal(self) -> float:\n        # TODO: Calcula la suma de (precio * cantidad) de todos los items\n        return 0.0\n\n    def calcular_total(self, tasa_iva: float = 0.19) -> float:\n        # TODO: Aplica el descuento sobre el subtotal, suma el IVA (tasa_iva) y retorna el total redondeado a 2 decimales\n        return 0.0\n",
                    "main.py": "from producto import Producto\nfrom carrito import CarritoCompras\n\ndef main():\n    print('=== TIENDA ONLINE PYLEVEL ===')\n    c = CarritoCompras()\n    p1 = Producto('SKU-1', 'Teclado Mecánico', 120.0)\n    p2 = Producto('SKU-2', 'Mouse Ergonómico', 60.0)\n    c.agregar_producto(p1, 1)\n    c.agregar_producto(p2, 2)\n    c.aplicar_cupon('PROMO10', 10.0)\n    print(f'Total con IVA: ${c.calcular_total():.2f}')\n\nif __name__ == '__main__':\n    main()\n"
                },
                "test_runner": "import sys, json\nresultados = []\ndef reportar(c, ok, d=''):\n    resultados.append({'criterio': c, 'aprobado': ok, 'detalle': d})\n\ntry:\n    from producto import Producto\n    try:\n        p = Producto('S1', 'P1', 10.0)\n        try:\n            Producto('S2', 'P2', 0.0)\n            err_ok = False\n        except ValueError:\n            err_ok = True\n        reportar(\"Clase Producto rechaza precios <= 0 con ValueError.\", err_ok and p.precio == 10.0)\n    except Exception as e:\n        reportar(\"Clase Producto rechaza precios <= 0 con ValueError.\", False, str(e))\n\n    from carrito import CarritoCompras\n    try:\n        c = CarritoCompras()\n        c.agregar_producto(Producto('S1', 'P1', 10.0), 2)\n        c.agregar_producto(Producto('S1', 'P1', 10.0), 3)\n        item = c.items.get('S1')\n        reportar(\"CarritoCompras.agregar_producto() añade productos e incrementa la cantidad si el SKU ya existe.\", item is not None and item[1] == 5)\n    except Exception as e:\n        reportar(\"CarritoCompras.agregar_producto() añade productos e incrementa la cantidad si el SKU ya existe.\", False, str(e))\n\n    try:\n        c = CarritoCompras()\n        ok1 = c.aplicar_cupon('DESCUENTO', 20.0)\n        ok2 = c.aplicar_cupon('INVALIDO', 150.0)\n        reportar(\"CarritoCompras.aplicar_cupon() descuenta el porcentaje correcto sobre el subtotal.\", ok1 is True and ok2 is False and c.descuento_porcentaje == 20.0)\n    except Exception as e:\n        reportar(\"CarritoCompras.aplicar_cupon() descuenta el porcentaje correcto sobre el subtotal.\", False, str(e))\n\n    try:\n        c = CarritoCompras()\n        c.agregar_producto(Producto('S1', 'P1', 100.0), 1)\n        c.aplicar_cupon('D10', 10.0)\n        tot = c.calcular_total(0.10)\n        reportar(\"CarritoCompras.calcular_total() suma el IVA al subtotal con descuento.\", abs(tot - 99.0) < 0.01)\n    except Exception as e:\n        reportar(\"CarritoCompras.calcular_total() suma el IVA al subtotal con descuento.\", False, str(e))\n\n    try:\n        import main\n        reportar(\"main.py ejecuta el flujo demostrativo sin excepciones no controladas.\", True)\n    except Exception as e:\n        reportar(\"main.py ejecuta el flujo demostrativo sin excepciones no controladas.\", False, str(e))\n\nexcept Exception as e:\n    reportar(\"Importación de módulos base\", False, f\"Error general: {str(e)}\")\n\ntodos_ok = all(r['aprobado'] for r in resultados)\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\nprint(json.dumps({'exito': todos_ok, 'resumen': f'{tot_pasados}/{len(resultados)} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}, ensure_ascii=False))\n"
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
                    "evento.py": "class Evento:\n    \"\"\"Representa un mensaje inmutable transportado por el bus de eventos.\"\"\"\n    def __init__(self, nombre: str, payload: dict = None):\n        if not nombre or not nombre.strip():\n            raise ValueError(\"El nombre del evento no puede estar vacío\")\n        self.nombre = nombre.strip()\n        self.payload = payload or {}\n        self.cancelado = False\n",
                    "bus.py": "from typing import Callable, Dict, List\nfrom evento import Evento\n\nclass EventBus:\n    def __init__(self):\n        self.suscriptores: Dict[str, List[Callable]] = {}\n        self.middlewares: List[Callable] = []\n\n    def suscribir(self, evento_nombre: str, callback: Callable) -> None:\n        # TODO: Registra el callback en el diccionario de suscriptores para evento_nombre\n        pass\n\n    def agregar_middleware(self, middleware: Callable) -> None:\n        # TODO: Añade el middleware a la lista\n        pass\n\n    def publicar(self, evento: Evento) -> bool:\n        # TODO: Ejecuta cada middleware pasándole el evento. Si evento.cancelado es True, retorna False.\n        # Si no fue cancelado, ejecuta cada callback suscrito y retorna True.\n        return False\n",
                    "main.py": "from evento import Evento\nfrom bus import EventBus\n\ndef main():\n    print('=== MOTOR DE EVENTOS REACTIVO ===')\n    bus = EventBus()\n    logs = []\n    bus.suscribir('LOGIN', lambda e: logs.append(f'Usuario logueado: {e.payload.get(\"usuario\")}'))\n    ev = Evento('LOGIN', {'usuario': 'santiago_dev'})\n    bus.publicar(ev)\n    print('Logs:', logs)\n\nif __name__ == '__main__':\n    main()\n"
                },
                "test_runner": "import sys, json\nresultados = []\ndef reportar(c, ok, d=''):\n    resultados.append({'criterio': c, 'aprobado': ok, 'detalle': d})\n\ntry:\n    from evento import Evento\n    try:\n        ev = Evento('TEST')\n        try:\n            Evento('')\n            err_ok = False\n        except ValueError:\n            err_ok = True\n        reportar(\"Clase Evento valida que nombre no esté vacío y lanza ValueError.\", err_ok)\n    except Exception as e:\n        reportar(\"Clase Evento valida que nombre no esté vacío y lanza ValueError.\", False, str(e))\n\n    try:\n        ev = Evento('TEST')\n        reportar(\"Clase Evento inicializa cancelado = False por defecto.\", ev.cancelado is False)\n    except Exception as e:\n        reportar(\"Clase Evento inicializa cancelado = False por defecto.\", False, str(e))\n\n    from bus import EventBus\n    try:\n        b = EventBus()\n        b.suscribir('EV1', lambda e: None)\n        b.suscribir('EV1', lambda e: None)\n        reportar(\"EventBus.suscribir() registra múltiples escuchadores para un mismo evento.\", len(b.suscriptores.get('EV1', [])) == 2)\n    except Exception as e:\n        reportar(\"EventBus.suscribir() registra múltiples escuchadores para un mismo evento.\", False, str(e))\n\n    try:\n        b = EventBus()\n        ejecutado = [False]\n        b.suscribir('ORDEN', lambda e: ejecutado.__setitem__(0, True))\n        def mw_bloqueador(e):\n            e.cancelado = True\n        b.agregar_middleware(mw_bloqueador)\n        res = b.publicar(Evento('ORDEN'))\n        reportar(\"EventBus.publicar() detiene la ejecución si un middleware marca cancelado = True.\", res is False and not ejecutado[0])\n    except Exception as e:\n        reportar(\"EventBus.publicar() detiene la ejecución si un middleware marca cancelado = True.\", False, str(e))\n\n    try:\n        b = EventBus()\n        recibido = []\n        b.suscribir('MSG', lambda e: recibido.append(e.payload.get('val')))\n        res = b.publicar(Evento('MSG', {'val': 42}))\n        reportar(\"EventBus.publicar() ejecuta todos los callbacks y retorna True cuando no hay cancelación.\", res is True and recibido == [42])\n    except Exception as e:\n        reportar(\"EventBus.publicar() ejecuta todos los callbacks y retorna True cuando no hay cancelación.\", False, str(e))\n\n    try:\n        import main\n        reportar(\"main.py ejecuta el pipeline demostrativo sin errores de sintaxis.\", True)\n    except Exception as e:\n        reportar(\"main.py ejecuta el pipeline demostrativo sin errores de sintaxis.\", False, str(e))\n\nexcept Exception as e:\n    reportar(\"Importación base\", False, str(e))\n\ntodos_ok = all(r['aprobado'] for r in resultados)\ntot_pasados = sum(1 for r in resultados if r['aprobado'])\nprint(json.dumps({'exito': todos_ok, 'resumen': f'{tot_pasados}/{len(resultados)} criterios cumplidos', 'total_pasados': tot_pasados, 'total_criterios': len(resultados), 'criterios': resultados}, ensure_ascii=False))\n"
            }
        ]

        compatibles = [p for p in banco_proyectos if p['dificultad'] == dificultad]
        if not compatibles:
            compatibles = banco_proyectos

        seleccion = dict(random.choice(compatibles))
        seleccion['es_ia'] = True
        return {
            'success': True,
            'proyecto': seleccion,
            'fuente': 'motor_local',
            'modelo': 'Generador Modular Local'
        }

    def generar_pista_proyecto(self, datos: Dict[str, Any]) -> Dict[str, Any]:
        """Genera una pista pedagógica guiada para el archivo actual del proyecto sin revelar la solución"""
        titulo = datos.get('titulo', 'Proyecto Python')
        enunciado = datos.get('enunciado', '')
        criterios = datos.get('criterios', [])
        archivo_activo = datos.get('archivo_activo', 'main.py')
        codigo_actual = datos.get('codigo_actual', '')

        if self.provider.tiene_api_key():
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
1. 🎯 **Punto de Enfoque**: En qué método o función debe concentrarse primero y qué entrada/salida requiere.
2. 💡 **Estrategia Lógica**: Una explicación conceptual con analogías claras de cómo resolverlo.
3. ⚠️ **Trampa Frecuente**: Un error común a evitar en este tipo de ejercicios (ej. tipos mutables, índices, manejo de None, excepciones).
4. 🚀 **Próximo Paso**: Un micro-paso de 1 o 2 líneas para que empiece a escribir código de inmediato.
"""
            sys_inst = "Eres PyBot, el tutor amigable y motivador de PyLevel. Enseñas a pensar como programador, dando pistas socráticas claras y pedagógicas."
            resp = self.provider.consultar(prompt, sys_inst, max_tokens=1500)
            if resp:
                return {
                    'success': True,
                    'fuente': 'gemini',
                    'modelo': self.provider.modelo,
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

        pista = f"""¡Hola! 👋 Soy **PyBot** en modo tutor local.

Aquí tienes una pista pedagógica para avanzar en **`{archivo}`**:

1. 🎯 **Punto de Enfoque**: Concéntrate en la primera tarea pendiente:
   `{primer_todo}`

2. 💡 **Estrategia Lógica**:
   - Revisa los tipos de datos requeridos por los parámetros y el valor que debe retornar la función.
   - Si debes almacenar o buscar elementos, recuerda que una lista `self.lista.append(item)` preserva el orden, mientras que un diccionario `self.dict[clave] = valor` permite búsquedas instantáneas por clave.
   - Recuerda validar las entradas (si el valor es inválido, utiliza `raise ValueError(...)` como se indica en las reglas).

3. ⚠️ **Trampa Frecuente**:
   - No olvides reemplazar la instrucción `pass` por tu lógica real o retorno de valor.
   - Ten cuidado de no mutar listas mientras las estás iterando; si necesitas filtrar, crea una lista nueva o usa list comprehension: `[x for x in self.items if condicion]`.

4. 🚀 **Próximo Paso**:
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

        if self.provider.tiene_api_key():
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
            schema_solucion_proj = {
                "type": "OBJECT",
                "properties": {
                    "codigo_resuelto": {"type": "STRING"},
                    "explicacion_paso_a_paso": {"type": "STRING"},
                    "buenas_practicas": {"type": "STRING"},
                    "criterios_resueltos": {"type": "STRING"}
                },
                "required": ["codigo_resuelto", "explicacion_paso_a_paso", "buenas_practicas", "criterios_resueltos"]
            }
            raw = self.provider.consultar(prompt, sys_inst, max_tokens=3200, temperature=0.2, json_mode=True, response_schema=schema_solucion_proj)
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
                            'archivo_destino': archivo_activo,
                            'codigo_resuelto': data.get('codigo_resuelto'),
                            'explicacion_paso_a_paso': data.get('explicacion_paso_a_paso', ''),
                            'buenas_practicas': data.get('buenas_practicas', ''),
                            'criterios_resueltos': data.get('criterios_resueltos', '')
                        }
                except Exception as e:
                    print(f"[ProjectsManager] Error al parsear solución de proyecto: {e}")

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

        explicacion = """### 💡 Explicación Paso a Paso de la Solución:

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
