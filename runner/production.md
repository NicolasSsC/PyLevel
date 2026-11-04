# Ejecutor de Azure

La web de Railway llama a `https://runner.pylevel.site`. Caddy termina HTTPS
en el puerto 443 y redirige internamente a aiohttp en `127.0.0.1:8787`.
El ejecutor no recibe variables de PostgreSQL ni la clave de Gemini.

## Contrato

Ambas rutas exigen `Authorization: Bearer <credencial>`. Se compara en tiempo
constante; una credencial ausente o incorrecta devuelve `401`. No hay CORS ni
credenciales en la URL. Los parámetros de consulta son rechazados.

- `GET /api/health`: `200` con `status: online`, capacidad y contadores activos/en
  espera; `503` si Docker, gVisor o la imagen no están disponibles.
- `POST /api/execute`: JSON `{files: {ruta: contenido}, action: run|test}` y
  `X-Pylevel-User-Id` con el UUID de la cuenta autenticada por Railway.
  Devuelve el contrato existente `{status, exit_code, output}`.
- Tamaño máximo: 262144 bytes; hasta 50 archivos; rutas relativas seguras.
- `400`: proyecto o identificador inválido; `413`: exceso de tamaño;
  `415`: tipo de contenido incorrecto; `429`: capacidad ocupada o espera vencida;
  `503`: problema técnico. `429` incluye `Retry-After: 3`.

El gateway permite dos ejecuciones y ocho solicitudes adicionales esperando,
con cinco segundos máximos de espera y una sola solicitud por cuenta a la vez.
La solicitud no incluye imagen Docker, argumentos de proceso ni rutas del host.
`execute.py` exige una imagen local (`--pull=never`) y conserva los límites de
gVisor, red deshabilitada, usuario 65534, raíz de solo lectura y tmpfs por envío.

## Cancelación y limpieza

aiohttp cancela el handler al desconectarse el cliente. La API envía SIGINT al
supervisor y espera su bloque de limpieza antes de liberar el puesto. El plazo
del supervisor es de 10 segundos más hasta 15 segundos para limpiar. El gateway
limita el proceso a 35 segundos y Railway a 45 segundos para la petición completa.

El temporizador `pylevel-runner-cleanup.timer` revisa cada 30 segundos únicamente
contenedores con etiqueta `pylevel.execution=true`, nombre `/pylevel-...` y edad
superior a 90 segundos. No elimina imágenes ni otros contenedores. No existe
almacenamiento persistente de los archivos ni logs del contenido enviado.

## Configuración

En Azure, `/etc/pylevel-runner/runner.env` pertenece a root y tiene permisos 600.
systemd entrega sus variables al servicio sin permitir al usuario del servicio
editar el código de `/opt/pylevel-runner`. El servicio usa la cuenta de sistema
`pylevel-runner`, sin login, con acceso al socket Docker mediante su grupo.
Este acceso sigue otorgando privilegios elevados sobre la VM; no se entrega al
código del estudiante ni se monta en sus contenedores.

Variables del gateway: `PYLEVEL_RUNNER_TOKEN`, `PYLEVEL_IMAGE`,
`RUNNER_MAX_CONCURRENCY=2`, `RUNNER_MAX_QUEUE=8`, `RUNNER_QUEUE_TIMEOUT=5`.
La credencial nunca se incluye en Git; el archivo temporal local está excluido.

En el servicio web de Railway:

| Variable | Valor |
| --- | --- |
| `PYLEVEL_RUNNER_URL` | `https://runner.pylevel.site` |
| `PYLEVEL_RUNNER_TOKEN` | La misma credencial privada de Azure |
| `RUNNER_REQUESTS_PER_MINUTE` | `20` por defecto |
| `RUNNER_REQUESTS_PER_DAY` | `200` por día UTC por defecto |

`POST /api/practice/execute` exige sesión y origen válido, aplica cuotas
compartidas en PostgreSQL mediante la migración `006_runner_request_limits.sql`,
restaura las pruebas públicas del ejercicio y añade el identificador de la cuenta
en el servidor. El navegador no conoce la URL privada de autorización ni su token.
El cliente rechaza HTTP fuera de loopback, credenciales en URL y redirecciones.
Los contadores no contienen código y se conservan siete días. El progreso no
considera una ejecución fallida o con cero pruebas como ejercicio superado.

## Instalación y mantenimiento

`deploy/install-api.sh` instala el gateway, un entorno Python independiente y
Caddy desde su repositorio oficial firmado. Requiere la carpeta de archivos ya
preparada en la VM y un archivo privado `runner.env`; no genera cuentas de PyLevel.
Los archivos de servicio y Caddy están en `deploy/` para revisión.

DNS: registro A `runner` a la IP de la VM, con solo DNS. Azure permite TCP 443;
no se expone 8787 ni el socket de Docker. La configuración de Caddy utiliza
TLS-ALPN para emitir/renovar el certificado por 443 y desactiva el redirect HTTP.
Mantener la entrada A sin proxy para que el desafío TLS llegue a la VM.

Para actualizar: probar los archivos, copiar los cambios a `/opt/pylevel-runner`
como root, reiniciar `pylevel-runner`, comprobar el estado HTTPS y después publicar
la versión compatible de la web. Para rotar la credencial, actualizarla en Azure
y Railway coordinadamente; no enviarla por el chat ni copiarla a código fuente.

## Verificación

- `python -m unittest test_api -v`: autenticación, validación, espera y concurrencia
  acotadas y liberación al desconectarse. Usa HTTP real y un supervisor controlado.
- `test_runner.py`: contenedores reales con Docker/gVisor y pruebas de aislamiento.
- `verify_api.py <archivo-privado> <base-url>`: llamadas reales de salud, ejecución,
  pruebas públicas, aislamiento de red/credenciales y cancelación. Solo imprime
  los resultados de las comprobaciones.
- Las pruebas de la web verifican la formación de cabeceras, las cuotas SQL y el
  rechazo de ejecuciones sin sesión. La salud de práctica publicada comprueba
  el enlace autenticado Railway → Azure.

Fuentes: [aiohttp y cancelación](https://docs.aiohttp.org/en/stable/web_advanced.html),
[Caddy HTTPS](https://caddyserver.com/docs/automatic-https),
[Caddy TLS](https://caddyserver.com/docs/caddyfile/directives/tls).
