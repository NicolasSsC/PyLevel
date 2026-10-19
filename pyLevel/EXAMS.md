# Sesiones y módulo de examen

## Preparación

Desde `pyLevel/`, con Node >= 22.12 y las variables PostgreSQL del proyecto:

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm astro dev --background
```

La migración es aditiva e idempotente: crea `auth_sessions`, `exam_attempts` y
`exam_events`. No modifica `users` ni `profiles`, que deben existir previamente.
No se ejecuta automáticamente al arrancar ni al compilar. Aplicarla antes de
publicar esta versión; los accesos necesitan la nueva tabla de sesiones.

## Sesiones

- La cookie `pylevel_session` contiene un token aleatorio de 256 bits. PostgreSQL
  conserva únicamente su hash SHA-256, la cuenta y el vencimiento de siete días.
- Cookie `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` en producción o HTTPS.
  El despliegue de producción requiere HTTPS; desarrollo permite HTTP local.
- Login y registro generan un token nuevo y revocan el token previo del navegador.
  Logout elimina la sesión del servidor antes de borrar la cookie.
- Las cookies antiguas que contenían JSON dejan de ser válidas: los usuarios
  existentes deben volver a iniciar sesión.
- Se comprueba que la cuenta continúe activa. Perfil y examen exigen sesión del
  servidor. La navegación estática usa un invitado y consulta `/api/auth/me`, sin
  consultar ni incrustar el primer usuario de la base durante la compilación.
- Las mutaciones de `/api/auth/*` y `/api/exam/*` requieren un encabezado `Origin`
  igual al origen de la petición. Los clientes HTTP de pruebas deben enviarlo.
  Configurar correctamente el origen/host público en el proxy de producción.
  Antes de compilar, definir `APP_ORIGIN=https://tu-dominio` en el entorno de
  compilación o `.env`; configura el host permitido por Astro. Por defecto solo
  están permitidos localhost y 127.0.0.1. El proxy debe transmitir el host público
  y el protocolo HTTPS correctos. No se aceptan comodines para dominios externos.
- Respuestas privadas con `Cache-Control: no-store`. `localStorage` no acredita
  identidad y ya no se utiliza para guardar perfiles autenticados.
- Para mantenimiento, se pueden eliminar sesiones con `expires_at <= now()`.

## Examen

Abrir `/examen/` o «Examen» en la barra de navegación. Sin sesión redirige al
login, que devuelve al examen después de autenticar.

La primera versión contiene tres retos de código Python y dura 30 minutos.
La definición está en `src/exam/definition.ts`. El ID identifica una versión
inmutable: cambiarlo para publicar otra evaluación sin mezclar intentos previos.
Hay un intento por cuenta y versión; volver a entrar nunca reinicia el tiempo.

`GET /api/exam/attempt` consulta el intento de la cuenta autenticada.
`POST /api/exam/attempt` admite `start`, `sync` y `submit`. El usuario se obtiene
siempre de la sesión, nunca del cuerpo de la solicitud. Guardado y entrega se
realizan en transacciones, con bloqueo de fila y revisión optimista para evitar
sobrescrituras entre pestañas. El cliente solicita elegir una versión si hay
conflicto. No se aceptan respuestas después de vencer el plazo del servidor.
El vencimiento se materializa en la siguiente consulta o sincronización, incluso
si el estudiante vuelve después de haber cerrado el navegador.

El cliente guarda después de editar y sincroniza cada cinco segundos. Conserva
una copia de recuperación en `localStorage`, separada por usuario e intento;
no se usa como evaluación oficial. Si vence el plazo sin conexión, los cambios
que no llegaron a PostgreSQL no forman parte de la entrega. La copia pendiente
se conserva para recuperación y se informa de ello al estudiante.

Se monitorean `visibilitychange`, `blur/focus` y `pagehide`, agrupando las señales
de una misma salida. Los eventos tienen UUID para que los reenvíos y beacons no
dupliquen incidencias. El registro usa la hora de recepción del servidor. Los
avisos se muestran al volver. `beforeunload` solicita la confirmación de salida
estándar del navegador mientras el intento está activo. No es posible garantizar
el aviso o el registro al cerrar abruptamente el proceso, especialmente en móvil.

`last_seen_at` permite consultar la última comunicación; su ausencia no demuestra
un cierre ni una infracción. Las señales del navegador son informativas, pueden
producir falsos positivos y no son prueba de fraude. Esta versión no incluye
panel docente en vivo, penalización automática, pruebas ocultas ni calificación:
la entrega y las incidencias quedan pendientes de revisión. El resumen permite
al estudiante consultar sus respuestas y los últimos 100 eventos.

## Verificación

```powershell
pnpm test
pnpm exec astro check
pnpm build
```

Las pruebas de SQL usan PostgreSQL embebido PGlite en memoria, sin leer `.env` ni
modificar la base configurada. Cubren falsificación, revocación y vencimiento de
sesiones, origen, autorización por cuenta, persistencia, conflicto de versiones,
reenvíos de incidencias, entrega inmutable y rechazo de respuestas fuera de plazo.

También se prueba la agrupación de señales de foco/visibilidad y la recuperación
de una salida pendiente sin duplicarla. Para verificar HTTP sin usar datos reales:

1. Ejecutar `node tests/local-db.mjs` en una terminal (base efímera local).
2. En otra terminal PowerShell, iniciar Astro con estas variables solo de proceso:

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '55439'
$env:PGUSER = 'postgres'
$env:PGPASSWORD = 'local-test-only'
$env:PGDATABASE = 'postgres'
$env:DB_SSL = 'false'
pnpm astro dev --background --host 127.0.0.1 --port 4335
node tests/http-smoke.mjs
```

El cliente SQL permite `DB_SSL=false` únicamente si el host es loopback. La base
efímera incluye la cuenta `demo@pylevel.test`, contraseña `PruebaLocal2026!`, para
revisar la interfaz; esta cuenta no se crea en la base del proyecto. Detener Astro
con `pnpm astro dev stop` y la base temporal con Ctrl+C al terminar.

Prueba manual: iniciar sesión, entrar al examen, aceptar las condiciones, editar,
cambiar de pestaña, regresar, recargar para comprobar guardado y tiempo, y entregar.
Después de cerrar sesión, perfil y examen deben redirigir a login. Al usar dos
pestañas, un guardado desactualizado debe pedir elegir qué versión conservar.
