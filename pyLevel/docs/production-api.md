# Contratos de producción

`GET /api/ready` comprueba PostgreSQL con una consulta `SELECT 1`. Devuelve
`200 {"status":"ok"}` o `503 {"status":"unavailable"}` sin detalles internos.
Railway consulta esta ruta antes de activar la nueva versión.

`POST /api/ai/chat` y `POST /api/ai/hint` requieren sesión y el encabezado
`Origin` del mismo sitio. Un invitado recibe `401` y otro origen recibe `403`.
La generación administrativa conserva además la comprobación de rol `admin`.

El chat acepta `mensaje` (1–4000 caracteres), `historial` (hasta seis mensajes
con `rol` user/bot/assistant y `contenido` de hasta 4000 caracteres), `contexto`
y `stream` opcional. `contexto.page` es una ruta local sin parámetros. En una
práctica incluye `exerciseId`, `mode` (classic/contextual), `selectedFile`,
`files` (hasta seis archivos Python), `truncated`, `running` y opcionalmente
`execution`: action, status, exitCode, output, files, createdAt, truncated,
changedSinceExecution. Los archivos del editor y de la última ejecución son
copias separadas; el navegador limita cada copia a 6000 bytes de código y la
terminal a los últimos 3000 bytes. Se omiten tests/ en estas copias porque
«Probar» usa los originales del servidor. El contexto se renueva por mensaje
y se descarta al cambiar de página. No se capturan formularios ni exámenes.

Railway verifica que los archivos correspondan a un ejercicio publicado y añade
su enunciado, un resumen del progreso de la sesión autenticada y hasta tres
recomendaciones del catálogo activo. Ignora identidades, progreso, recomendaciones
y campos del servidor enviados por el cliente. No adjunta soluciones de referencia,
datos personales ni credenciales. El historial del navegador se separa por cuenta.
Las respuestas JSON y SSE recorren el mismo proveedor y usan el mismo contexto.
`PYBOT_LOCAL_ONLY=true` fuerza las respuestas locales sin consultar Gemini;
se utiliza en las pruebas. El modo local recomienda y describe el resultado
capturado, pero no sustituye el razonamiento de Gemini para depurar código.

Con streaming conserva `text/event-stream`, eventos `data: {"token":"..."}`
y final `data: [DONE]`. Sin streaming conserva la respuesta JSON existente.

Las consultas tienen un máximo de 48000 bytes, incluso sin Content-Length.
Un cuerpo inválido recibe `400` y un exceso de tamaño recibe `413`.

PyBot comparte en PostgreSQL los contadores por usuario entre procesos y
despliegues. Valores iniciales: 10 solicitudes por minuto y 100 por día UTC,
configurables con `PYBOT_REQUESTS_PER_MINUTE` y `PYBOT_REQUESTS_PER_DAY`.
Incluyen chat, pistas y generación administrativa; cuentan solicitudes admitidas
al control de acceso, incluso si después fallan en la validación o el proveedor.
Los contadores se conservan siete días y no contienen texto del chat.

Al superar un límite devuelve `429` con `Retry-After: 60`; si el límite es diario,
volver a intentar después de ese tiempo puede seguir devolviendo `429` hasta el
siguiente día UTC. Los errores del proveedor devuelven `503` sin sus detalles.
Los límites del proveedor y sus facturas se gestionan también en Google AI Studio.

`POST /api/practice/execute` exige sesión y origen válido. Devuelve `401` para
invitados y `429` al superar la cuota de 20 solicitudes/minuto o 200/día UTC por
cuenta, configurable con `RUNNER_REQUESTS_PER_MINUTE`/`RUNNER_REQUESTS_PER_DAY`.
La credencial y el UUID para Azure se añaden únicamente en Railway. El plazo
de la solicitud es de 45 segundos y una desconexión cancela la petición al ejecutor.
Una respuesta técnica o cancelada no acredita progreso superado.
`GET /api/practice/health` publica solo `online`/`offline`, sin la credencial ni
las métricas internas de Azure. Más detalles en [el ejecutor](../../runner/production.md).
