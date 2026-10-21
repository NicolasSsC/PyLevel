# Ejecutor Python con gVisor

Prototipo local de ejecución: un contenedor desechable por envío, runtime
`runsc` obligatorio, sin fallback a `runc`. Este directorio contiene el supervisor
Python y la imagen de ejecución. El [núcleo](../pyLevel/src/core/README.md) aporta
un puente HTTP de desarrollo con cancelación desde la interfaz. No hay API de
producción autenticada, cola, cuotas por usuario ni pool de contenedores.

## Preparación

### Requisitos del host

Usar Linux con Python 3, Docker CLI y acceso a un daemon Docker que tenga registrado
el runtime `runsc`. El supervisor utiliza `selectors` sobre pipes y el puente
invoca `python3`; la ejecución nativa en Windows no está soportada por esta
implementación. Los comandos de esta guía usan Bash en Linux.

Instalar Docker y gVisor desde sus fuentes oficiales y registrar `runsc` según
la [guía de gVisor para Docker](https://gvisor.dev/docs/user_guide/quick_start/docker/).
No usar `--privileged`. Verificar el acceso al daemon y el registro del runtime:

```sh
python3 --version
docker info
docker info --format '{{json .Runtimes}}'
```

El último resultado debe incluir `runsc`. Instalar el binario sin registrarlo
en Docker no es suficiente. No sustituirlo por `runc` si falta.

Para producción, usar una máquina dedicada al ejecutor, separada de la web y de
los datos. Actualizar regularmente el runtime y la imagen base.
El acceso al daemon Docker concede privilegios elevados sobre ese host;
solo el supervisor confiable debe tenerlo, nunca los estudiantes ni la web pública.

### Construir la imagen y comprobarla

Desde la raíz del repositorio:

```sh
docker build -t pylevel-python:local runner
docker image inspect pylevel-python:local
printf '%s' '{"files":{"main.py":"print(42)"},"action":"run"}' | python3 runner/execute.py
```

El ejemplo debe devolver `status: "completed"`, `exit_code: 0` y `output: "42\n"`.
Revisar estos tres campos: `completed` también puede acompañar una ejecución que
terminó con error. Si Docker no responde, falta `runsc` o la imagen no existe,
corregir la preparación antes de iniciar el puente web.

La imagen base está fijada por digest. `PYLEVEL_IMAGE` es configuración exclusiva
del operador; nunca aceptar una imagen o argumentos Docker del cliente. Para usar
otra etiqueta, construirla y exportar `PYLEVEL_IMAGE` con ese mismo nombre en las
terminales del supervisor y del puente. Si se usa `DOCKER_CONFIG`, mantenerlo
coherente durante construcción, ejecución y arranque del puente.

### Ejecutar las pruebas del supervisor

Desde la raíz del repositorio, con Docker y `runsc` preparados:

```sh
python3 -m unittest discover -s runner -p 'test_runner.py' -v
```

La suite comprueba múltiples archivos, restricciones de red y escritura, límite
de tiempo, límite de salida, descubrimiento de pruebas públicas y rechazo de rutas
inválidas. Los casos válidos crean contenedores reales: la suite no funciona como
prueba completa sin Docker, la imagen y gVisor. Guardar el resultado de la ejecución
antes de considerar verificado el entorno.

## Contrato de entrada y salida

El supervisor lee un único objeto JSON por stdin y devuelve JSON por stdout:

```json
{"files":{"main.py":"print(42)"},"action":"run"}
```

- `files`: mapa de rutas relativas POSIX a contenido de texto UTF-8.
- `action: "run"`: ejecuta `main.py`, que debe existir. Es la acción predeterminada.
- `action: "test"`: ejecuta `python -B -u -m unittest discover -s tests -v`
  dentro del contenedor. Incluir las pruebas en el mapa de archivos enviado.
- No se permiten rutas absolutas, componentes `..`, barras invertidas, nombres
  de más de 200 caracteres ni rutas que requieran normalización.
- La entrada interactiva no está disponible: el proceso Python del estudiante
  recibe stdin cerrado.

Una respuesta de ejecución contiene `status`, `exit_code` y `output`:

```json
{"status":"completed","exit_code":0,"output":"42\n"}
```

| Estado | Significado |
| --- | --- |
| `completed` | Terminó la ejecución. Revisar `exit_code` y la salida para saber si hubo errores. |
| `timeout` | Se alcanzó el plazo de ejecución. Se interrumpe el proceso y se intenta eliminar el contenedor. |
| `output_limit` | Se excedió la salida permitida. La salida está truncada y se detiene la ejecución. |
| `cleanup_failed` | Docker no confirmó la eliminación. Revisar el host antes de aceptar más ejecuciones. |
| `invalid_request` | Entrada rechazada. La respuesta contiene `error`, sin los campos normales de ejecución. |

La acción `test` utiliza pruebas públicas aportadas en la solicitud. Un resultado
con cero pruebas no acredita que el ejercicio esté resuelto. El código enviado
puede alterar esas pruebas o su salida; no usar ese resultado como calificación
oficial.

## Límites y ciclo de vida

| Recurso | Configuración actual |
| --- | --- |
| Archivos | Entre 1 y 50 por solicitud. |
| Solicitud | Máximo 256 KiB de JSON. El supervisor también comprueba el tamaño al serializarlo. |
| Tiempo de ejecución | Plazo de 10 segundos, incluido el arranque de `docker run`. La limpieza ocurre después. |
| Memoria | 128 MiB y `memory-swap` configurado al mismo valor. |
| CPU | Cuota de 0.5 CPU. No mide tiempo CPU ni impone un límite acumulado de CPU. |
| Procesos | Máximo 32. |
| Salida | Máximo 64 KiB de stdout y stderr combinados. |
| Archivos abiertos | Límite de 64 descriptores. Core dumps deshabilitados. |
| Usuario | UID y GID 65534, sin capacidades y sin nuevos privilegios. |
| Red | Deshabilitada con `--network=none`. |
| Sistema de archivos | Raíz de solo lectura. `/workspace` y `/tmp` son tmpfs de 8 MiB cada uno. |

No se montan rutas del host, credenciales ni socket Docker dentro del contenedor.
La imagen contiene Python 3.12 y la biblioteca estándar; no hay instalación de
dependencias por envío. La red deshabilitada impide descargar paquetes durante
la ejecución.

Cada solicitud crea un contenedor con nombre único y la etiqueta
`pylevel.execution=true`. El supervisor usa `--rm` e intenta además `docker rm -f`
al terminar, exceder límites o salir por una interrupción que alcance su bloque
de limpieza. Esa limpieza espera hasta 15 segundos adicionales. Los 10 segundos
no son un plazo máximo garantizado para toda la respuesta HTTP.

Una caída del host o una terminación forzada del supervisor puede impedir la
limpieza. Para inspeccionar los contenedores etiquetados:

```sh
docker ps -a --filter label=pylevel.execution=true
```

## Integración y limitaciones pendientes

El supervisor no escucha HTTP ni administra usuarios. El puente
`pyLevel/src/core/server.mjs` lo invoca por stdin y admite una ejecución simultánea.
Detener desde la web aborta la solicitud y el puente envía SIGINT al supervisor.
Consultar el [README del núcleo](../pyLevel/src/core/README.md#desarrollo) para el
arranque y la verificación de esa integración.

Antes de exposición pública implementar: API autenticada, cola con concurrencia
acotada, cuotas por usuario, cancelación gestionada por el servicio de producción
y un reconciliador externo que elimine contenedores
huérfanos etiquetados `pylevel.execution=true` tras una caída del supervisor.
No ejecutar múltiples supervisores sin limitar la capacidad total del host.
Los resultados de código no confiable no acreditan calificaciones; una evaluación
oficial requiere su propio diseño de pruebas y validación.

Un pool futuro entrega cada contenedor una sola vez y lo destruye después;
no recicla un entorno que haya ejecutado código del estudiante.

## Problemas frecuentes

| Síntoma | Comprobación |
| --- | --- |
| Docker no responde o devuelve permiso denegado | Revisar el daemon, el contexto Docker y el acceso de la cuenta que ejecuta el supervisor. |
| `runsc` no aparece o Docker rechaza el runtime | Revisar su registro en el daemon siguiendo la guía oficial de gVisor. |
| No se encuentra `pylevel-python:local` | Construir la imagen y comprobar que `PYLEVEL_IMAGE` y el contexto Docker coincidan en ambos procesos. |
| Los botones de ejecución están deshabilitados | Verificar el puente en `127.0.0.1:8787`, `/api/health` y el proxy de desarrollo de Astro. |
| La salida indica cero pruebas | Incluir archivos de pruebas descubribles en `tests/`. No considerarlo una solución aprobada. |
| Se devuelve `cleanup_failed` | Inspeccionar los contenedores etiquetados y resolver el fallo de limpieza en el host. |
