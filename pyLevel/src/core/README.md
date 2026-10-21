# Núcleo de PyLevel

El módulo `/examen/` y las sesiones de servidor se documentan en
[Sesiones y exámenes](../../EXAMS.md), incluida su migración SQL y las pruebas.
El perfil, el progreso y el feedback se describen en [Mi cuenta](../../ACCOUNT.md).

## Sección de ejercicios

- `/`: portada de Python con hero, ventajas, IA, robótica, datos y desarrollo; animaciones de scroll con movimiento reducido.
- `/ejercicios/`: entrada con las dos modalidades de práctica.
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
  consulta se registra localmente y en la cuenta autenticada, sin descontar puntos.
  Bubble Sort incluye una animación didáctica de un ejemplo fijo, implementada
  en `bubble-sort.ts` y `../components/BubbleSortAnimation.astro`.
  La secuencia de ejecución tiene un botón deshabilitado marcado «Próximamente»;
  requiere un contrato de trazas reales del ejecutor antes de activarse.

Las modalidades tienen interfaces independientes y comparten el cliente del ejecutor. Los borradores se
guardan por identificador en el navegador. En contextualizados se pueden editar
todos los archivos existentes, incluidas las pruebas públicas. Añadir, eliminar y
renombrar archivos queda pendiente. Estas pruebas son de práctica; no acreditan
resolución ni puntuación. Las pruebas clásicas verifican comportamiento, no certifican
el uso de una técnica específica (por ejemplo, Bubble Sort frente a sorted).
La evaluación oficial y la penalización por pistas requieren su implementación
independiente. Los intentos de práctica se registran en PostgreSQL mediante
`/api/practice/execute`; el perfil y `/progreso/` muestran datos de la cuenta,
ejercicios superados y recomendaciones, sin métricas simuladas.

- `exercises.json`: los tres proyectos originales del ZIP, con defectos intencionales.
- `workspace.ts`: recuperación y guardado local por ejercicio.
- `client.ts`: contrato HTTP de ejecución y cancelación.
- `Workbench.astro`: interfaz, editor y resultados; la salida se renderiza como texto.
- `server.mjs`: puente **solo para desarrollo**, limitado a una ejecución simultánea.

## Desarrollo

### Requisitos

- Node.js >= 22.12.0, según `pyLevel/package.json`, y pnpm.
- Python 3 disponible como `python3` para el puente de desarrollo.
- Host Linux con Docker, runtime `runsc` registrado e imagen del ejecutor
  preparada según el [README del ejecutor](../../../runner/README.md).
- PostgreSQL con las tablas de usuarios y perfiles para probar autenticación.
  Los editores guardan borradores en el navegador y no necesitan SQL para eso.

Los comandos siguientes usan una terminal Bash en el host Linux de desarrollo.
La interfaz se puede abrir desde el navegador de Windows, pero el supervisor
actual depende del entorno Linux descrito en el README del ejecutor.

### Instalar y configurar

Desde la raíz del repositorio:

```sh
cd pyLevel
pnpm install --frozen-lockfile
# Crear el archivo solo si todavía no existe; no sobrescribe una configuración previa.
test -f .env || cp .env.example .env
```

Editar `.env` con los parámetros reales de la base de datos. Los clientes actuales
usan `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` y `PGDATABASE`, o sus alternativas
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. Las variables `PG*`
tienen prioridad: si se conservan ambos grupos del ejemplo, mantenerlos coherentes.
No publicar credenciales ni versionar `.env`.

`DATABASE_URL` aparece en el ejemplo, pero los clientes actuales no la utilizan.
El cliente web acepta `DB_SSL=false` para hosts loopback de desarrollo; para
otros hosts mantiene SSL con `rejectUnauthorized: false`. El cliente legado del
puente sigue habilitando SSL en el código.

La migración `pnpm db:migrate` crea las tablas de sesiones, exámenes y actividad,
y agrega ocupación y cumpleaños a perfiles. El código
de autenticación espera `users` con `id`, `email`, `password_hash`, `is_active`,
`created_at` y `updated_at`, y `profiles` con `user_id`, `display_name`,
`avatar_url`, `bio` y `updated_at`. Preparar y verificar esas tablas de usuarios
y perfiles antes de probar registro o login; la migración no las crea.

### Arrancar los servicios

Preparar primero Docker y la imagen siguiendo el README del ejecutor. Después,
desde la carpeta `pyLevel`, arrancar el puente en una terminal:

```sh
node --experimental-strip-types src/core/server.mjs
```

El flag permite cargar el módulo `db.ts` directamente en las versiones de Node
22 que requieren activar la eliminación de tipos. El puente comprueba al arrancar
que Docker responda, que exista `runsc` y que la imagen esté construida.

En otra terminal, también desde `pyLevel`, iniciar Astro:

```sh
ASTRO_TELEMETRY_DISABLED=1 pnpm astro dev --background
pnpm astro dev status
pnpm astro dev logs
```

Abrir la URL indicada por Astro. Para detenerlo, ejecutar `pnpm astro dev stop`.
El puente permanece en su terminal y se detiene con Ctrl+C.

Los editores utilizan `/api/practice/execute` y `/api/practice/health`, atendidos
por Astro. El servidor llama al ejecutor configurado en `PYLEVEL_RUNNER_URL`
(por defecto `http://127.0.0.1:8787`) y vincula resultados con la sesión. La
configuración conserva el proxy de desarrollo antiguo para `/api/execute` y
`/api/health`. Autenticación, perfil y examen también usan endpoints de Astro.
El puente define `/api/user` y `/api/users`, sin proxy ni uso desde la navegación.

### Verificar el funcionamiento

Con ambos servicios iniciados:

```sh
curl --fail http://127.0.0.1:8787/api/health
curl --fail -H 'Content-Type: application/json' \
  -d '{"files":{"main.py":"print(42)"},"action":"run"}' \
  http://127.0.0.1:8787/api/execute
```

La comprobación de salud debe devolver `status: "online"`. La ejecución de ejemplo
debe devolver `status: "completed"`, `exit_code: 0` y la salida `42` seguida de un
salto de línea. La salud del puente por sí sola no comprueba que un programa Python
pueda ejecutarse ni que PostgreSQL esté disponible.

En la web, comprobar los filtros de ambas modalidades, editar y recargar un
borrador, ejecutar, probar y detener un ejercicio. Probar registro, login, perfil
y logout contra la base configurada. Registrar los resultados: la presencia de
código o de pruebas en el repositorio no acredita que estas comprobaciones pasen.

## Límites técnicos

- Las ejecuciones usan un contenedor nuevo con gVisor. Python no se ejecuta dentro
  del proceso de Astro. Los límites de archivos, recursos y tiempo están en el
  [README del ejecutor](../../../runner/README.md#límites-y-ciclo-de-vida).
- El puente escucha solo en `127.0.0.1:8787` y admite una ejecución simultánea.
  Una segunda solicitud recibe HTTP 429. No hay cola ni cuotas por usuario.
- Detener aborta la solicitud HTTP. El puente envía SIGINT al supervisor y este
  intenta eliminar el contenedor. El plazo de ejecución es de 10 segundos más
  el tiempo de limpieza. Una cancelación en la interfaz no acredita por sí sola
  que la limpieza haya terminado.
- Los borradores se guardan por ejercicio en `localStorage`, sin separación por
  cuenta. No se sincronizan entre dispositivos y pueden perderse al borrar los
  datos del navegador. Los intentos de práctica se guardan por cuenta en SQL;
  los borradores anteriores no se importan ni se atribuyen automáticamente.
  Los intentos y respuestas del módulo de examen también se guardan en PostgreSQL.
- Las pruebas clásicas son de solo lectura en la interfaz. En contextualizados
  son editables, pero el servidor usa sus versiones originales al pulsar Probar.
  Ambas son pruebas públicas de práctica. Cero pruebas ejecutadas
  o `status: "completed"` no certifican que el ejercicio esté resuelto.
- La animación de Bubble Sort no muestra la ejecución del código del estudiante.
  La evaluación oficial, las pruebas ocultas y el descuento de puntos por pistas
  siguen pendientes.
- La autenticación usa un token aleatorio en una cookie HttpOnly, SameSite=Lax
  y Secure en producción. Su hash y vencimiento se validan en PostgreSQL; logout
  revoca la sesión. Las cookies antiguas con JSON dejan de ser válidas.
  Aplicar la migración y usar HTTPS en producción. El puente de ejecución
  de desarrollo todavía no exige autenticación.
- El enunciado se muestra como texto Markdown y la salida como texto, sin
  interpretar HTML del material ni del programa enviado.

## Despliegue

Ejecutar `pnpm build` desde `pyLevel` para generar la compilación. La configuración
combina `output: 'static'` con el adaptador Node en modo `standalone`; los endpoints
de autenticación declaran `prerender = false`. Publicar solo archivos estáticos
no basta para atender esas rutas: el destino necesita ejecutar la parte de servidor.

El proxy antiguo de Vite solo funciona en desarrollo. Los editores usan endpoints
de Astro también en producción y requieren `PYLEVEL_RUNNER_URL` accesible desde
el servidor. La infraestructura de ejecución debe incorporar cola, cuotas,
autenticación del servicio y cancelación para exposición pública. El supervisor debe
estar en un host dedicado, separado de la web y de los datos, con limpieza externa
de contenedores huérfanos. No publicar el puente de desarrollo ni exponer el socket
Docker. Verificar por separado la configuración de PostgreSQL, SSL y sesiones.
