# Pruebas de PyLevel

Ejecuta los comandos dentro de `pyLevel/`, donde está el `package.json` de la aplicación.
Se requiere Node.js >= 22.12.0 y pnpm (o npm).

## Instalar y ejecutar Playwright

Primera instalación, desde PowerShell en la raíz del repositorio:

```powershell
cd C:\programming\pyLevel\pyLevel
pnpm install
pnpm exec playwright install chromium
pnpm test:e2e
```

En Linux/CI instala también las dependencias del navegador con
`pnpm exec playwright install --with-deps chromium`.
Si usas npm, los equivalentes son `npm ci`, `npx playwright install chromium` y `npm run test:e2e`.

| Comando | Acción |
| --- | --- |
| `pnpm test` | Ejecutar las pruebas unitarias existentes |
| `pnpm check` | Comprobar tipos y componentes Astro |
| `pnpm test:e2e` | Ejecutar Playwright en Chromium |
| `pnpm test:e2e:ui` | Abrir la interfaz interactiva de pruebas |
| `pnpm test:e2e:headed` | Ejecutar mostrando el navegador |
| `pnpm test:e2e:report` | Abrir el último reporte HTML |

## Entorno aislado

No necesitas iniciar Astro, PostgreSQL ni el ejecutor de Python para esta suite.
`playwright.config.ts` ejecuta `tests/e2e/server.mjs`, que:

1. Crea una base PostgreSQL compatible en memoria con PGlite y aplica las migraciones.
2. Prepara los archivos de cámara y compila la aplicación.
3. Inicia el servidor compilado en `http://127.0.0.1:4341`.
4. Se detiene junto con la base al finalizar Playwright.

Los puertos `4341` (web) y `55441` (base temporal) deben estar libres.
La suite fija la conexión a la base temporal antes de cargar la aplicación, sin usar
las credenciales de tu base habitual. Cada caso crea sus propias cuentas cuando
lo necesita; los datos se descartan al detener el servidor. No se reutiliza un
servidor que ya esté abierto en el puerto de pruebas.
Se fija `DB_POOL_MAX=1` en este entorno porque PGlite utiliza una sola sesión
PostgreSQL. La aplicación mantiene un máximo de 5 conexiones por defecto.

## Casos y nuevos tests

Los casos están en `tests/e2e/*.spec.ts` y cubren:

- Inicio, salto de introducción, navegación y vista móvil.
- Rutas privadas, contraseña incorrecta, registro, sesión y cierre de sesión.
- Edición y persistencia de los datos personales.
- Progreso y feedback inicial de una cuenta nueva.
- Consentimiento, alternativa sin cámara, guardado en servidor y entrega de examen.

Esta suite inicial no ejecuta código Python ni verifica la detección de rostros
con una cámara real. Las reglas de incidencias de cámara conservan sus pruebas
unitarias en `tests/camera-policy.test.ts`.

Para ejecutar un solo archivo o filtrar un caso:

```powershell
pnpm test:e2e tests/e2e/exam.spec.ts
pnpm test:e2e -g "datos personales"
```

Los selectores usan etiquetas y roles accesibles. Para agregar un caso, crea un
archivo `*.spec.ts` en esa carpeta, importa `test` y `expect` de `@playwright/test`
y utiliza rutas relativas, por ejemplo `await page.goto('/login')`.
`helpers.ts` contiene el registro por interfaz de una cuenta temporal.

## Reportes y GitHub Actions

El reporte queda en `playwright-report/`. Si falla un caso, `test-results/` guarda
captura, vídeo y traza para diagnosticarlo. Estas carpetas se excluyen de Git.

El workflow [Playwright E2E](../.github/workflows/playwright.yml) ejecuta la suite
en pushes y pull requests hacia `main`, y permite ejecución manual desde Actions.
Adjunta los reportes durante 14 días y no necesita secretos de base de datos.
El análisis de SonarQube existente continúa en su propio workflow.

Referencias: [instalación de Playwright](https://playwright.dev/docs/intro),
[servidor de pruebas](https://playwright.dev/docs/test-webserver) y
[GitHub Actions](https://playwright.dev/docs/ci-intro).
