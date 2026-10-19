# PyLevel

Plataforma de práctica de Python con ejercicios clásicos y proyectos
contextualizados. Incluye editores en el navegador, borradores locales, una
animación didáctica de Bubble Sort y código de registro, login y perfiles con
PostgreSQL. El ejecutor de desarrollo utiliza contenedores desechables con gVisor.

## Preparación y documentación técnica

- [Núcleo de la aplicación](pyLevel/src/core/README.md): requisitos, instalación
  con pnpm, configuración de PostgreSQL, arranque de Astro y del puente HTTP,
  verificación y limitaciones de la interfaz y la autenticación.
- [Ejecutor Python](runner/README.md): preparación de Linux, Docker y `runsc`,
  construcción de la imagen, contrato JSON, pruebas, límites de recursos y
  limpieza de contenedores.

Para levantar el prototipo completo, preparar primero el ejecutor y después
seguir los pasos del núcleo. Los comandos de ejecución documentados usan Bash
en Linux. La aplicación web está en `pyLevel/`; el supervisor está en `runner/`.

## Estado del desarrollo

La implementación actual permite practicar con pruebas públicas y guardar
borradores en el navegador. La evaluación oficial, la puntuación, el historial
de intentos en PostgreSQL y el servicio de ejecución para producción siguen
pendientes. Las guías detallan qué está implementado y qué falta verificar.
