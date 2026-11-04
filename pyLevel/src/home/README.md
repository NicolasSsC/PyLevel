# Portada de Python

`PythonHome.astro` compone el hero, la presentación de PyLevel, las ventajas de Python, cuatro usos y el cierre
con acceso al catálogo. La ruta `/ejercicios/` conserva las modalidades de práctica.

Los accesos Ejercicios y Examen, junto al asistente flotante PyBot, permanecen
ocultos hasta confirmar una sesión activa. Incluye las modalidades del submenú y los accesos del menú
móvil. Se vuelve a comprobar la sesión al recuperar el foco o volver a una página
desde la caché del navegador para mantener el estado tras cerrar sesión.
Los botones «Empieza a crear» y «Dale forma a tu primera idea», que llevan al login,
se ocultan al confirmar una sesión activa y vuelven a mostrarse al cerrarla.
Inicio y el catálogo se renderizan por solicitud. El middleware verifica la cookie
y comparte el usuario con la barra superior, el menú móvil, PyBot y los botones
de acceso. El HTML ya incluye el nombre y la visibilidad correctos, sin esperar
a `/api/auth/me` ni guardar identidades en el navegador. Las respuestas personalizadas
llevan `Cache-Control: no-store` y `Vary: Cookie`. La comprobación del cliente
sigue actualizando la sesión al recuperar el foco o volver atrás, sin ocultar
primero la barra ni PyBot. Al salir, los controles se ocultan antes de redirigir.
`navigation.css` añade un fundido de 160 ms entre documentos del mismo origen,
manteniendo la barra y PyBot fuera del fundido. Se respeta movimiento reducido;
los navegadores sin esta función mantienen la navegación normal. Los scripts de
cada página siguen inicializándose con cada navegación completa.

`AboutPyLevel.astro` aparece inmediatamente después del hero. Explica qué es la
plataforma y desarrolla cuatro conceptos: Ejercicios, Asistente PyBot, Exámenes
y Progreso. Ejercicios reúne retos clásicos, proyectos, editor y pruebas.
El bloque es informativo: no incluye CTAs ni indicaciones de seguir bajando.
`feature-journey.ts` mantiene juntos el título y el panel durante el scroll de la página,
amplía el concepto activo y actualiza su avance. Los cuatro botones permiten
elegir un concepto sin interceptar la rueda ni bloquear el desplazamiento.
En móvil, pantallas bajas, movimiento reducido o sin JavaScript, los cuatro
artículos se leen en el flujo normal. Si el contenido no cabe (por ejemplo, con
zoom), también se conserva esa lectura vertical. «Sigue explorando» lleva al bloque.
Los capítulos de Inicio tienen como mínimo la altura disponible de la pantalla.
En escritorio, el scroll se ajusta suavemente al comienzo de cada vista y a cada
concepto del recorrido. Las transiciones usan opacidad sin interceptar la rueda.
En móvil y con movimiento reducido se conserva el desplazamiento libre; el título
de PyLevel también permanece visible mientras se leen los cuatro artículos.

La portada se recorre por desplazamiento y anclajes, sin menú lateral ni enlace
«Ver intro». En la primera entrada, `PythonIntroAnimation.astro` conserva la
precarga de partículas con el logo de PyLevel, controlada por `preload.ts`.
Al terminar (o saltarla), `entry.ts` libera la portada y su barra superior.
La animación del login no se incluye en Inicio: se abre únicamente desde
«Iniciar sesión», en `/login`, con opción de volver a la portada.
`/prelogin/` redirige al mismo acceso y conserva sus parámetros.
`ProgrammingPrelogin.astro` presenta una consola y el formulario:
un ejemplo de Python con NiceGUI (`login.py`) construye
progresivamente Correo, Clave, Iniciar sesión, Crear cuenta y Olvidé la contraseña.
NiceGUI se muestra solo como código ilustrativo; no se instala ni ejecuta.
El acceso no muestra la barra superior y sustituye el formulario anterior.
El formulario envía correo y clave a `POST /api/auth/login`, utiliza la cookie
de sesión existente y muestra los estados de espera y error. Tras entrar, abre
el destino interno pendiente (Perfil, Ejercicios, Examen o Progreso) o Perfil.
Crear cuenta abre `/registro`, que comparte la consola y los controles del login
con el modo `register` de `ProgrammingPrelogin.astro`. `registro.py` construye
Nombre completo, Correo, Clave y el selector opcional «¿Cuál es tu perfil?».
La selección (Estudiante, Docente, Programador/a, Investigador/a u Otro) se envía
como `occupation` al registro y se guarda en los datos personales. No cambia
los permisos de la cuenta. El registro inicia la sesión y abre Mi perfil.
Su animación se recuerda por separado con `pylevel_register_built`.
La recuperación informa de que aún
no está disponible; no existe un servicio de recuperación conectado.
Saltar animación o Escape completa el formulario. `sessionStorage` recuerda por
separado la precarga de Inicio y el formulario terminado durante la sesión
de esa pestaña. `?intro=1` repite la animación de la página visitada.
Con movimiento reducido, Inicio omite la precarga y el acceso muestra el
formulario terminado. Sin JavaScript se conserva la portada normal y el
acceso muestra los campos, el enlace de registro y un aviso para activar JavaScript.

`UseCaseVisual.astro` dibuja las ilustraciones de IA, robótica, datos y aplicaciones
con SVG, HTML y CSS locales. Son ejemplos visuales decorativos, sin servicios
externos ni resultados de ejecución simulados como actividad de usuario.

`scroll.ts` usa IntersectionObserver para revelar bloques y actualizar el capítulo
activo, y un listener pasivo con requestAnimationFrame para el avance de lectura
y el movimiento leve del hero. El contenido es visible sin JavaScript. La preferencia
`prefers-reduced-motion` desactiva las animaciones y el scroll suave. Los anclajes
mantienen el foco de teclado en la sección alcanzada y respetan la barra superior.

La marca de PyLevel usa el SVG aportado por el usuario en `public/pylevel-logo.svg`,
compartido por el encabezado, el pie y la precarga, y por el botón flotante y el
avatar del panel de PyBot. Se ajustó únicamente el lienzo
transparente y la escritura de coordenadas, conservando las formas y los colores.
`favicon.svg` usa la misma marca; `favicon.ico` contiene tamaños de 16 a 256 px.
Las partículas de la precarga siguen el contorno del emblema de PyLevel.

El logo oficial de Python de la ilustración se sirve desde `public/python-logo.svg`, sin modificar
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
