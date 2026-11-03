# Administración PyLevel

Diseño adaptado de la PR #6 de Santi234wa/PyLevel, commit ee150cff08815b634c09f048df919f2a58b8aaaf.

Las cuatro rutas /admin/, /admin/metricas/, /admin/accesos/ y /admin/manual/ son
dinámicas y requieren una sesión de una cuenta activa con users.role = admin.
El servidor vuelve a comprobar el permiso en cada solicitud. Las respuestas
privadas usan Cache-Control: no-store. El login mantiene destinos locales permitidos.

## Instalación

Con las variables PostgreSQL habituales del proyecto, ejecutar:

    node --experimental-strip-types scripts/setup-admin.mjs correo-existente

La operación es transaccional: aplica 004_admin.sql, carga los ejercicios
estáticos que aún no existen y habilita la cuenta indicada si existe y está
activa. No crea cuentas ni cambia contraseñas. Se puede repetir sin reemplazar
ediciones ni recuperar ejercicios retirados. El correo inicial no queda fijado
en una migración ni en el código de la aplicación.

## Datos y operaciones

- exercises identifica cada reto por slug y controla su estado y retirada.
- exercise_versions conserva el contenido completo en config y un número de versión.
- Guardar requiere la versión leída y devuelve 409 si otro administrador guardó antes.
- Editar conserva los módulos adicionales. Retirar conserva versiones y actividad.
- Las páginas públicas, el ejecutor de práctica y el progreso usan el mismo catálogo.
- Los administradores habilitan cuentas existentes desde Accesos, sin cambiar contraseñas.
- Retirar acceso devuelve la cuenta a estudiante; no permite retirar el propio acceso.
- Las métricas agregan practice_activity de cuentas de estudiante. Las tasas usan
  pruebas aprobadas con tests_run > 0 y pruebas fallidas; excluyen ejecuciones,
  aperturas, pistas, incidencias y administradores del denominador.
- Los días se calculan en America/Bogota. No se inventan cifras cuando faltan datos.

Contrato HTTP: ../../docs/admin.openapi.json. Las mutaciones requieren Origin exacto.
Pruebas: tests/admin.test.ts y tests/e2e/admin.spec.ts, con PostgreSQL desechable.
