# Ejecutor Python con gVisor

Prototipo local de ejecución: un contenedor desechable por envío, runtime
`runsc` obligatorio, sin fallback a `runc`. No incluye todavía API, cola,
autenticación, cancelación desde la web ni pool de contenedores.

## Preparación

Usar una máquina Linux dedicada al ejecutor, separada de la web y de los datos.
Instalar Docker y gVisor desde sus fuentes oficiales y registrar `runsc` siguiendo
https://gvisor.dev/docs/user_guide/quick_start/docker/ . No usar `--privileged`.
Verificar `docker info` y actualizar regularmente el runtime y la imagen base.
El acceso al daemon Docker concede privilegios elevados sobre ese host;
solo el supervisor confiable debe tenerlo, nunca los estudiantes ni la web pública.

Desde `/workspace/PyLevel` (o la raíz de este checkout):

```sh
DOCKER_CONFIG=/tmp/pylevel-docker docker build -t pylevel-python:local runner
python3 -m unittest discover -s runner -p 'test_runner.py' -v
printf '%s' '{"files":{"main.py":"print(42)"},"action":"run"}' | python3 runner/execute.py
```

La imagen base está fijada por digest. `PYLEVEL_IMAGE` es configuración exclusiva
del operador; nunca aceptar una imagen o argumentos Docker del cliente.
La acción `test` ejecuta `unittest discover -s tests -v` sobre pruebas públicas.
Un resultado con cero pruebas no acredita que el ejercicio esté resuelto.

## Límites y ciclo de vida

Máximo 50 archivos y 256 KiB de JSON, 10 segundos de tiempo total (incluido
arranque), 128 MiB de memoria, media CPU, 32 procesos y 64 KiB de salida combinada.
Usuario 65534, sin capacidades, sin red, raíz de solo lectura y dos tmpfs de
8 MiB. No se montan rutas del host, credenciales ni socket Docker.
El supervisor fuerza la eliminación al terminar, exceder límites o interrumpirse.
`completed` indica fin de ejecución, no éxito: revisar también `exit_code`.
La cuota CPU no es una medición de tiempo CPU ni un límite acumulado de CPU.

Antes de exposición pública implementar: cola con concurrencia acotada, cuotas
por usuario, cancelación y un reconciliador externo que elimine contenedores
huérfanos etiquetados `pylevel.execution=true` tras una caída del supervisor.
No ejecutar múltiples supervisores sin limitar la capacidad total del host.
Los resultados de código no confiable no acreditan calificaciones; una evaluación
oficial requiere su propio diseño de pruebas y validación.

Un pool futuro entrega cada contenedor una sola vez y lo destruye después;
no recicla un entorno que haya ejecutado código del estudiante.
