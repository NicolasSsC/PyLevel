# Núcleo de PyLevel

## Sección de ejercicios

- `/ejercicios/`: entrada con las dos modalidades; `/` muestra la misma sección provisionalmente.
- `/ejercicios/clasicos/`: listado con filtros combinables por dificultad y tema.
- `/ejercicios/contextualizados/`: listado de proyectos con filtro por dificultad.
- `/ejercicios/{modalidad}/{id}/`: editor del ejercicio seleccionado con enlace de regreso al listado.
- Ambos listados muestran Fácil, Medio y Difícil. Los temas se derivan del catálogo;
  los filtros aceptan cualquiera de los valores seleccionados dentro de un grupo
  y requieren coincidencia entre grupos. Incluyen contador, estado vacío y limpieza.
- `catalog.ts`: contrato común y catálogo por modalidad.
- `classic-exercises.ts`: cinco ejercicios (operadores lógicos, for, if, Bubble
  Sort y lambdas), cada uno con código inicial, ejemplos, pista y pruebas públicas.
- `ClassicWorkbench.astro`: pantalla clásica con enunciado, salida esperada,
  editor único con numeración y terminal. Las pistas se revelan a petición y su
  consulta se registra localmente, sin aplicar todavía descuentos de puntuación.
  La secuencia de ejecución tiene un botón deshabilitado marcado «Próximamente»;
  requiere un contrato de trazas reales del ejecutor antes de activarse.

Las modalidades tienen interfaces independientes y comparten el cliente del ejecutor. Los borradores se
guardan por identificador en el navegador. En contextualizados se pueden editar
todos los archivos existentes, incluidas las pruebas públicas. Añadir, eliminar y
renombrar archivos queda pendiente. Estas pruebas son de práctica; no acreditan
resolución ni puntuación. Las pruebas clásicas verifican comportamiento, no certifican
el uso de una técnica específica (por ejemplo, Bubble Sort frente a sorted).
La evaluación final, la penalización por pistas, las métricas de desempeño
y la persistencia SQL todavía requieren su implementación independiente.

- `exercises.json`: los tres proyectos originales del ZIP, con defectos intencionales.
- `workspace.ts`: recuperación y guardado local por ejercicio.
- `client.ts`: contrato HTTP de ejecución y cancelación.
- `Workbench.astro`: interfaz, editor y resultados; la salida se renderiza como texto.
- `server.mjs`: puente **solo para desarrollo**, limitado a una ejecución simultánea.

## Desarrollo

Preparar primero la imagen siguiendo `../../../runner/README.md`.
Desde la carpeta `pyLevel`:

```sh
node src/core/server.mjs
# En otra terminal:
ASTRO_TELEMETRY_DISABLED=1 pnpm astro dev --background
```

Astro reenvía `/api` al servicio local en el puerto 8787. Las ejecuciones usan
gVisor y un entorno nuevo; no se ejecuta Python en el proceso de la web.
Detener aborta la solicitud y envía SIGINT al supervisor, que elimina el contenedor.
Una ejecución tarda hasta 10 segundos más el tiempo de limpieza. La consola indica
el código de salida; cero pruebas no certifica que el ejercicio esté resuelto.
Las pruebas públicas de los ejercicios clásicos son de solo lectura en la interfaz,
no una barrera contra fraude. En contextualizados son editables.
El enunciado se muestra como texto Markdown, sin interpretar HTML del material.

## Despliegue

`pnpm build` genera una web estática. El proxy de Vite solo funciona en desarrollo;
producción requiere enrutar `/api` a una API autenticada con cola, cuotas, cancelación
y limpieza externa de huérfanos, en un host dedicado. No publicar este puente ni
exponer su socket Docker. No se implementa aquí evaluación oficial o pruebas ocultas.
