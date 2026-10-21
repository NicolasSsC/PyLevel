# Portada de Python

`PythonHome.astro` compone el hero, las ventajas de Python, cuatro usos y el cierre
con acceso al catálogo. La ruta `/ejercicios/` conserva las modalidades de práctica.

`UseCaseVisual.astro` dibuja las ilustraciones de IA, robótica, datos y aplicaciones
con SVG, HTML y CSS locales. Son ejemplos visuales decorativos, sin servicios
externos ni resultados de ejecución simulados como actividad de usuario.

`scroll.ts` usa IntersectionObserver para revelar bloques y actualizar el capítulo
activo, y un listener pasivo con requestAnimationFrame para el avance de lectura
y el movimiento leve del hero. El contenido es visible sin JavaScript. La preferencia
`prefers-reduced-motion` desactiva las animaciones y el scroll suave. Los anclajes
mantienen el foco de teclado en la sección alcanzada y respetan la barra superior.

El logo oficial se sirve localmente desde `public/python-logo.svg`, sin modificar
sus formas ni colores. Fuente de la Python Software Foundation:
https://www.python.org/community/logos/
Archivo original:
https://s3.dualstack.us-east-2.amazonaws.com/pythondotorg-assets/media/files/python-logo-only.svg

Referencias para los usos y herramientas enlazadas:
- https://www.python.org/about/apps/
- https://pytorch.org/
- https://micropython.org/
- https://pandas.pydata.org/
- https://www.djangoproject.com/
