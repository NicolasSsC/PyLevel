# Perfil, progreso y feedback

## Preparar

Ejecutar `pnpm db:migrate` desde `pyLevel/` antes de usar esta versión. El comando
aplica, en orden y dentro de una transacción, las migraciones SQL idempotentes
de `migrations/`. `002_profile_progress.sql` agrega `occupation` y `birthday` a
`profiles` y crea `practice_activity`, sin borrar datos existentes.

## Mi perfil

`/perfil` requiere sesión y muestra nombre, ocupación, cumpleaños, correo,
antigüedad de la cuenta, historial de exámenes y cierre de sesión. La cuenta se
obtiene de la sesión del servidor, nunca de IDs enviados desde el navegador.

`POST /api/account/profile` actualiza los datos en una transacción. El cumpleaños
es opcional, valida fechas reales y compara con la fecha actual de Colombia.
El cambio de correo exige la contraseña actual, evita correos duplicados y
revoca las otras sesiones de la cuenta. La sesión utilizada se conserva porque
está vinculada al ID del usuario. El sistema no envía correos de verificación.

El historial consulta todos los intentos de la cuenta; finaliza los vencidos al
leerlos. Las entregas no tienen todavía calificación automática: se muestran
como pendientes de revisión. Se pueden retomar los intentos en curso de la
versión actual del examen.

## Progreso y métricas

`/progreso/` reemplaza los contadores de demostración. Muestra ejercicios
superados y pendientes, número de intentos, actividad de siete días en Colombia,
avance por temas, últimos 20 resultados y recomendaciones calculadas en servidor.
Los gráficos y contadores se basan exclusivamente en la cuenta autenticada.
Una cuenta nueva tiene ceros y una invitación a comenzar, sin datos ficticios.

Los editores llaman `/api/practice/execute` e incluyen el ID y la modalidad del
ejercicio. Astro obtiene el usuario de la cookie y registra el intento en
PostgreSQL antes de contactar al ejecutor. El resultado del ejecutor determina
si pasó, falló, se canceló o tuvo un error técnico. El navegador no puede declarar
un ejercicio superado mediante el endpoint de actividad.

Para contar un ejercicio como superado, la acción debe ser `test`, el ejecutor
debe responder `completed`, código 0 y un resumen unittest con al menos una
prueba y `OK`. Los tests se sustituyen por los originales del catálogo en el
servidor, tanto en clásicos como en contextualizados. Ejecutar un programa,
editar un borrador o ejecutar cero pruebas no completa ejercicios. Repetir una
prueba no duplica ejercicios superados, y un fallo posterior no borra el avance.
Esta es evidencia de práctica con pruebas públicas, no una acreditación ni una
calificación oficial: el código del estudiante puede manipular su propio entorno.

`POST /api/practice/activity` registra aperturas, pistas y consultas de solución
con UUID para evitar reenvíos duplicados. No acepta resultados ni identidades
de usuario. Los borradores antiguos de localStorage no se importan porque no
permiten acreditar a qué cuenta pertenecían.

Las recomendaciones son reglas propias de PyLevel: retomar una prueba fallida,
usar «Probar» cuando solo se ejecuta código, avanzar al siguiente reto, practicar
sin la solución consultada y reintentar ante problemas técnicos. No se envían
datos personales a servicios de IA externos ni se infieren capacidades no medidas.

El ejecutor debe estar disponible en `PYLEVEL_RUNNER_URL` (por defecto
`http://127.0.0.1:8787`). `/api/practice/health` comprueba su estado. Esta dirección
solo la configura el servidor; no se obtiene del cuerpo de una solicitud.
La ejecución sigue usando el supervisor gVisor existente; no hay ejecución nativa
de Python ni un reemplazo que simule resultados en la aplicación.

Los visitantes pueden practicar, pero sin sesión no se guarda progreso. Si falla
el guardado de un resultado, el editor lo informa y no lo presenta como avance
confirmado. Los endpoints privados validan origen y no permiten almacenamiento
en caché.

## Pruebas

`pnpm test`, `pnpm check` y `pnpm build` comprueban lógica SQL, validaciones y
compilación. Las pruebas de SQL usan PGlite en memoria y no leen datos reales.

Para probar HTTP y la interfaz con datos temporales, iniciar
`node tests/local-db.mjs` y `node tests/local-runner.mjs` en terminales separadas.
El segundo es un ejecutor HTTP simulado de pruebas; **no ejecuta Python** y nunca
debe utilizarse como servicio de la aplicación. Iniciar Astro con las variables
temporales descritas en `EXAMS.md`, agregando
`$env:PYLEVEL_RUNNER_URL = 'http://127.0.0.1:8788'`. Luego ejecutar:

```powershell
node tests/account-http.mjs
node tests/http-smoke.mjs
```

Los mismos scripts aceptan `--production` para verificar la compilación servida
en `127.0.0.1:4340`, incluyendo cookies Secure. Detener el servidor de desarrollo
al usar esa modalidad, porque la base temporal limita las conexiones simultáneas.
Las pruebas cubren perfil, cambio de correo, aislamiento por cuenta, historial de
exámenes, pruebas originales, actividad, feedback y cierre de sesión.
