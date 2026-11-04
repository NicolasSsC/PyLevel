# Producción de PyLevel

Proyecto elegido: **calm-joy**, entorno **production**.
Servicio de base: **Postgres**, PostgreSQL 18, región `ams`, volumen persistente
de 5 GB. El servidor web se alojará en el mismo proyecto y entorno; el ejecutor
de Python se alojará en Azure. Esta configuración no importa datos de Render.

## Conexión del servidor

Configurar estas variables en el servicio web de PyLevel, no en el ejecutor:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` como referencia de Railway |
| `DB_POOL_MAX` | `5` por instancia web |
| `HOST` | `0.0.0.0` |
| `APP_ORIGIN` | URL HTTPS pública exacta de PyLevel, disponible al compilar |
| `PYLEVEL_RUNNER_URL` | URL HTTPS del ejecutor de Azure cuando esté preparado |
| `GEMINI_API_KEY` | Clave privada del proveedor, guardada únicamente en el servicio web |
| `PYBOT_REQUESTS_PER_MINUTE` | `10` inicialmente |
| `PYBOT_REQUESTS_PER_DAY` | `100` inicialmente, por día UTC |

Railway asigna `PORT`. `DATABASE_URL` tiene prioridad sobre los parámetros `PG*`
y `DB*`, por lo que se deben retirar del servicio web las variables antiguas que
apunten a Render. No copiar contraseñas al repositorio: usar la referencia.

Las conexiones a `*.railway.internal` usan TLS `require`, compatible con el
certificado autofirmado de la plantilla Postgres. Este modo cifra la conexión
sin verificar el certificado; la red privada de Railway también cifra el tráfico
entre servicios. Para una CA propia, configurar `DB_SSL_CA` y `DB_SSL=verify-full`.
Las conexiones públicas verifican el certificado por defecto. No hace falta
habilitar un proxy TCP público para que la web acceda a PostgreSQL.

## Crear y actualizar el esquema

Desde el directorio `pyLevel/`, en un proceso que tenga acceso a la base elegida:

```sh
npm run db:migrate
```

El comando aplica `migrations/*.sql` en orden. `000_users_profiles.sql` crea la
base de usuarios y perfiles; `001`–`004` completan sesiones, exámenes, cámara,
actividad, ejercicios y versiones. `005` agrega los contadores de consultas de
PyBot. No se crean usuarios ni contraseñas de prueba.

`pylevel_schema_migrations` registra nombre, checksum SHA-256 y fecha. El proceso
usa una transacción y un bloqueo de PostgreSQL; si un archivo falla, se revierte
toda esa ejecución. Repetir el comando no vuelve a ejecutar archivos registrados.
Los saltos de línea de Windows/Linux no alteran los checksums. No editar ni borrar
migraciones aplicadas: añadir un archivo nuevo para cada cambio posterior.

El hostname privado de Railway no resuelve desde el equipo local. Ejecutar las
migraciones desde el servicio web de Railway, mediante su paso previo al despliegue.
Si se necesita acceso administrativo externo, preparar por separado una conexión
autorizada; no sustituir silenciosamente la URL privada por una pública.

### Inicialización sin un servidor web desplegado

`npm run db:railway:prepare` genera `deploy/railway-db-migrate.mjs`: un script
autónomo para una Railway Function, con los mismos SQL, checksums y ejecutor de
migraciones del repositorio. No contiene contraseñas. Incluye únicamente el
proyecto `calm-joy` y su entorno `production` como destino permitido.

La tarea `pylevel-db-migrate` se configura con `DATABASE_URL` como referencia a
`${{Postgres.DATABASE_URL}}`, una sola conexión, región `ams` y política de reinicio
`NEVER`. No tiene dominio público, servidor HTTP ni programación periódica.
Primero se prepara como cambio pendiente; requiere aprobación antes de desplegar.

Inicialización verificada en `production` el 3 de noviembre de 2026 a las
18:57 (America/Bogota). Despliegue `3e3df40c-14cb-4ad4-b871-3456f28b871e`,
estado `SUCCESS`, evento `pylevel.database.ready` confirmado en los logs.
Las cinco migraciones `000`–`004` se aplicaron y sus checksums coinciden con
los archivos del repositorio. Se verificaron estas nueve tablas:

- `users` y `profiles`.
- `auth_sessions`.
- `exam_attempts` y `exam_events`.
- `practice_activity`.
- `exercises` y `exercise_versions`.
- `pylevel_schema_migrations`.

La inicialización terminó con cero cuentas y cero ejercicios. El servicio
Postgres y su volumen conservaron su configuración. El despliegue web posterior
aplica las migraciones nuevas y carga el catálogo únicamente con autorización.

Al ejecutarse rechaza una base con tablas previas sin historial de migraciones,
crea el esquema y registra en los logs únicamente tablas, checksums y cantidades
de cuentas/ejercicios. Después termina. Repetirla sobre el esquema registrado
es seguro. La preparación se prueba contra una base temporal con el protocolo
PostgreSQL y el mismo controlador `pg`; la ejecución en Bun 1.4.4/Railway también
se verificó con los logs del despliegue indicado arriba.

## Preparar el servicio web

El repositorio contiene la aplicación en `/pyLevel`. Servicio `pylevel-web`,
dominio `https://pylevel.site`. Al configurar el servicio:

- Directorio raíz: `/pyLevel`.
- Construcción: `Dockerfile` en ese directorio; incluye Node 24 y Python 3.
- Paso previo al despliegue: `npm run db:migrate && npm run db:seed:catalog`.
- Inicio: `npm start`.
- Puerto: `8080`, con `HOST=0.0.0.0`.
- Comprobación de salud: `/api/ready`, tiempo máximo 120 segundos.
- Reinicio: `ON_FAILURE`, máximo tres reintentos.

Los ajustes se guardan en la configuración del servicio de Railway. Railway ya
no acepta configurar `railway.json` mediante la integración; se usa la detección
del Dockerfile y los ajustes del servicio. La futura gestión mediante IaC debe
importar y revisar los recursos existentes antes de aplicar una definición.

Las migraciones se ejecutan en el paso previo, con variables y red privada
disponibles. Un fallo impide activar la nueva versión. El catálogo fue autorizado
por el usuario: 11 ejercicios clásicos y 9 contextualizados. La carga solo añade
identificadores ausentes; no sobrescribe ni reactiva ejercicios editados o retirados.

`APP_ORIGIN=https://pylevel.site` se inyecta como argumento de construcción y como
variable de ejecución para permitir el dominio público en las comprobaciones
de origen de Astro. La imagen excluye `.env`, `.gemini_key`, bases locales y
archivos de pruebas; corre como usuario sin privilegios. Las sesiones propias
de PyLevel permanecen en PostgreSQL; el almacenamiento de sesiones de Astro está
desactivado porque no se utiliza.

En Cloudflare, el dominio raíz debe apuntar mediante CNAME al destino entregado
por Railway y el TXT `_railway-verify` debe contener el valor indicado por Railway.
Validar DNS y certificado antes de declarar el sitio accesible. No cambiar
registros de correo. Los contratos de salud y PyBot están en
[production-api.md](docs/production-api.md).

## Primera cuenta administradora y catálogo

Registrar primero una cuenta real. En un proceso administrativo autorizado,
con la conexión de producción y desde `pyLevel/`, ejecutar:

```sh
node --experimental-strip-types scripts/setup-admin.mjs correo-de-la-cuenta
```

El comando exige una cuenta activa existente, concede el rol `admin` y carga el
catálogo inicial sin cambiar su contraseña. No usar las cuentas temporales de
`tests/local-db.mjs` en producción. El rol del desplegable del registro describe
la ocupación y no concede permisos administrativos.

## Ejecutor de Azure

La web llama al ejecutor mediante `PYLEVEL_RUNNER_URL`; PostgreSQL pertenece al
servidor web. No enviar `DATABASE_URL`, contraseñas SQL o credenciales Railway al
ejecutor ni al código de los estudiantes. La preparación del servicio de Azure
incluye HTTPS y autenticación entre servidores: el puente actual se documenta
como desarrollo local en [runner/README.md](../runner/README.md).

El despliegue del ejecutor de Azure y su autenticación no se incluyen en esta
preparación de base de datos. Las pruebas de navegador tampoco ejecutan Python real.

## Verificación

Las pruebas `tests/migrations.test.ts` crean una base vacía compatible con
PostgreSQL en PGlite y verifican esquema completo, repetición, conservación de
cuentas, detección de cambios y reversión ante un fallo. `tests/db-config.test.ts`
comprueba prioridad, credenciales codificadas, TLS y errores sin revelar secretos.
Playwright fija su propia `DATABASE_URL` antes de cargar `.env` y usa una base
temporal; no se conecta a producción.

Fuentes oficiales: [PostgreSQL en Railway](https://docs.railway.com/databases/postgresql),
[red privada](https://docs.railway.com/networking/private-networking),
[paso previo al despliegue](https://docs.railway.com/deployments/pre-deploy-command),
[TLS con node-postgres](https://node-postgres.com/features/ssl),
[servidor Node de Astro](https://docs.astro.build/en/guides/integrations-guide/node/).
