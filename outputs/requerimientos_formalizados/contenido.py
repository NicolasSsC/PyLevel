"""Contenido formal del complemento de requisitos de PyLevel."""

groups = []

def group(code, title, source, story, need, kind='nuevo'):
    g = dict(code=code, title=title, source=source, story=story, need=need, kind=kind, requirements=[])
    groups.append(g)
    return g

def rf(g, suffix, title, summary, inputs, results):
    g['requirements'].append(dict(code=f"RF-{g['code']:02d}.{suffix}", title=title, summary=summary, inputs=inputs, results=results))

g = group(16, 'Práctica libre y catálogo de ejercicios', 'Observación',
    'Como estudiante, quiero elegir ejercicios clásicos o contextualizados desde un catálogo, para practicar contenidos de Python según mis intereses y la dificultad que deseo trabajar.',
    'Disponer de una modalidad de práctica que permita seleccionar y repetir ejercicios sin iniciar un examen completo.')
rf(g, 1, 'Selección de la modalidad de práctica',
   'El sistema deberá presentar las modalidades de ejercicios clásicos y contextualizados y permitir acceder al catálogo correspondiente a la modalidad seleccionada.',
   'Solicitud de acceso a ejercicios y modalidad seleccionada.',
   'Catálogo de la modalidad elegida, con acceso a la otra modalidad.')
rf(g, 2, 'Consulta y apertura de ejercicios del catálogo',
   'El sistema deberá mostrar el título, descripción y dificultad de cada ejercicio disponible y permitir abrir su espacio de trabajo con el enunciado, los resultados esperados y el código inicial.',
   'Modalidad, catálogo disponible e identificador del ejercicio seleccionado.',
   'Ejercicio seleccionado abierto con su información y archivos iniciales.')
rf(g, 3, 'Filtrado de ejercicios',
   'El sistema deberá filtrar ambas modalidades por dificultad y los ejercicios clásicos por tema. Los valores seleccionados dentro de un mismo grupo se combinarán como alternativas y los grupos de dificultad y tema deberán cumplirse simultáneamente.',
   'Modalidad y valores de dificultad y tema seleccionados.',
   'Lista de ejercicios que cumplen los filtros y cantidad de coincidencias.')
rf(g, 4, 'Limpieza de filtros y ausencia de coincidencias',
   'El sistema deberá permitir limpiar los filtros aplicados y mostrar un mensaje cuando ningún ejercicio coincida con ellos, sin presentar el catálogo como un error del servicio.',
   'Filtros activos y acción de limpieza, cuando corresponda.',
   'Catálogo completo al limpiar los filtros o mensaje de ausencia de coincidencias.')

g = group(17, 'Resolución de proyectos contextualizados', 'Observación',
    'Como estudiante, quiero comprender un problema de un proyecto y trabajar con sus archivos relacionados, para corregir defectos y aplicar Python en situaciones concretas.',
    'Practicar el análisis y la modificación de proyectos compuestos por varios archivos, con una situación, un objetivo y criterios de comportamiento definidos.')
rf(g, 1, 'Presentación del contexto y de los criterios del proyecto',
   'El sistema deberá presentar el enunciado del proyecto contextualizado y, cuando estén definidos, la situación, la pregunta orientadora, la función de sus archivos y los comportamientos esperados de la solución.',
   'Proyecto seleccionado y descripción disponible en el catálogo.',
   'Contexto del problema y criterios esperados visibles junto al espacio de trabajo.')
rf(g, 2, 'Navegación y edición de archivos existentes',
   'El sistema deberá listar los archivos existentes del proyecto, permitir seleccionar uno para editarlo y conservar los cambios de los demás archivos al alternar entre ellos.',
   'Archivos del proyecto, archivo seleccionado y modificaciones del estudiante.',
   'Archivo seleccionado visible en el editor y modificaciones conservadas en el espacio de trabajo.')
rf(g, 3, 'Ejecución conjunta de los archivos del proyecto',
   'El sistema deberá enviar al ejecutor el conjunto de archivos del proyecto al ejecutar el programa. Al solicitar pruebas públicas, utilizará las pruebas originales del catálogo para comprobar el código del estudiante.',
   'Archivos editados, identificador del proyecto y acción Ejecutar o Probar.',
   'Proyecto enviado como una unidad y resultado de ejecución o de pruebas mostrado en la terminal.')

g = group(18, 'Conservación de borradores de práctica', 'Observación',
    'Como estudiante, quiero recuperar el código que estaba editando al volver a un ejercicio, para continuar mi práctica sin copiar manualmente mis cambios en cada visita.',
    'Conservar borradores por ejercicio en el mismo navegador e informar cuando el almacenamiento local no esté disponible.')
rf(g, 1, 'Guardado local del borrador',
   'El sistema deberá guardar los cambios del espacio de trabajo en el almacenamiento del navegador, asociados al ejercicio, e indicar si el guardado se completó o falló.',
   'Identificador del ejercicio, contenido de sus archivos y disponibilidad del almacenamiento local.',
   'Borrador actualizado en el navegador o aviso que permita al estudiante copiar sus cambios.')
rf(g, 2, 'Recuperación del borrador del ejercicio',
   'El sistema deberá recuperar el borrador local válido al abrir de nuevo el ejercicio en el mismo navegador. Si no existe o no puede recuperarse, deberá cargar los archivos iniciales del catálogo.',
   'Identificador del ejercicio, borrador local y archivos iniciales.',
   'Editor con el borrador recuperado o con los archivos iniciales. El borrador local no se atribuye como actividad de una cuenta.')
rf(g, 3, 'Restablecimiento del proyecto contextualizado',
   'El sistema deberá permitir restablecer un proyecto contextualizado a sus archivos iniciales después de solicitar confirmación. Si se cancela la operación, deberá conservar los cambios actuales.',
   'Proyecto abierto y confirmación o cancelación del restablecimiento.',
   'Archivos y borrador local restablecidos, o cambios actuales conservados.')

g = group(19, 'Ejecución interactiva de código de práctica', 'Observación',
    'Como estudiante, quiero ejecutar mi programa, comprobarlo con pruebas públicas y consultar su salida, para identificar errores y mejorar mi solución durante la práctica.',
    'Contar con un ciclo de edición, ejecución y comprobación independiente de la entrega de un examen.')
rf(g, 1, 'Ejecución del programa de práctica',
   'El sistema deberá permitir ejecutar el programa del ejercicio en el entorno aislado, utilizando el archivo principal y los archivos relacionados del espacio de trabajo.',
   'Archivos del ejercicio y acción Ejecutar.',
   'Estado de ejecución, salida del programa y código de terminación, cuando el ejecutor los produzca.')
rf(g, 2, 'Comprobación con pruebas públicas originales',
   'El sistema deberá permitir ejecutar las pruebas públicas originales del catálogo sobre la solución. Deberá distinguir las pruebas superadas de una ejecución sin errores o de una ejecución que no haya descubierto pruebas.',
   'Código del estudiante, ejercicio identificado y acción Probar.',
   'Resumen de pruebas y resultado de comprobación. Ejecutar cero pruebas no marca el ejercicio como superado.')
rf(g, 3, 'Presentación de salida y fallos de ejecución',
   'El sistema deberá mostrar la salida y los errores como texto y diferenciar los fallos del código de los límites de ejecución y de los problemas técnicos del servicio.',
   'Respuesta del ejecutor o error de comunicación.',
   'Terminal actualizada con el estado y la información disponible del resultado, sin interpretar la salida como HTML.')
rf(g, 4, 'Solicitud de cancelación y disponibilidad del ejecutor',
   'El sistema deberá permitir solicitar la cancelación de la ejecución activa e informar cuando el ejecutor no esté disponible. Mientras exista una solicitud activa deberá impedir envíos incompatibles desde el mismo editor.',
   'Estado del servicio, solicitud activa y acción Detener.',
   'Solicitud de cancelación enviada y estado informado. La interfaz no confirma la eliminación del entorno sin evidencia del servicio.')

g = group(20, 'Ayudas para resolver ejercicios clásicos', 'Observación',
    'Como estudiante, quiero consultar una pista y después una solución de referencia, para recibir ayuda cuando me atasque y contrastar mi razonamiento.',
    'Ofrecer ayuda voluntaria y registrar su consulta sin alterar automáticamente el avance obtenido en la práctica.')
rf(g, 1, 'Consulta voluntaria de la pista',
   'El sistema deberá mantener oculta la pista del ejercicio clásico hasta que el estudiante solicite verla y permitir volver a ocultarla.',
   'Ejercicio clásico y acción Ver pista u Ocultar pista.',
   'Pista visible u oculta e indicación de su consulta, cuando pueda guardarse.')
rf(g, 2, 'Desbloqueo y consulta de la solución de referencia',
   'El sistema deberá habilitar la solución de referencia después de consultar la pista y permitir abrirla y cerrarla sin sustituir automáticamente el código escrito por el estudiante.',
   'Ejercicio, consulta de pista y solicitud de solución.',
   'Solución de referencia mostrada en una ventana de consulta y código del estudiante conservado.')
rf(g, 3, 'Registro de las ayudas consultadas',
   'El sistema deberá registrar las consultas de pistas y soluciones en la cuenta autenticada, evitando duplicados por reenvío de un mismo evento. La consulta de ayudas no descontará puntos ni eliminará ejercicios ya superados.',
   'Sesión, ejercicio, tipo de ayuda e identificador del evento.',
   'Consulta asociada a la cuenta para el seguimiento y las recomendaciones de práctica.')

g = group(21, 'Asistencia conversacional con PyBot', 'Observación',
    'Como estudiante, quiero consultar a PyBot mientras practico Python, para aclarar conceptos y recibir orientación relacionada con mi ejercicio.',
    'Disponer de asistencia conversacional que utilice el contexto disponible del trabajo y responda a consultas de programación.')
rf(g, 1, 'Envío de consultas al tutor',
   'El sistema deberá permitir escribir y enviar consultas no vacías a PyBot desde el widget de conversación y mostrar los mensajes del estudiante y las respuestas recibidas.',
   'Mensaje del estudiante y acción de envío.',
   'Consulta incorporada a la conversación y respuesta del tutor o aviso de error.')
rf(g, 2, 'Uso del contexto de la práctica',
   'El sistema deberá adjuntar a la consulta el contexto disponible de la página, el tema y el fragmento de código detectado, junto con los mensajes recientes necesarios para mantener la continuidad de la conversación.',
   'Mensaje, contexto disponible y conversación reciente.',
   'Solicitud contextualizada al servicio de IA. La ausencia de contexto no impedirá enviar una consulta general de Python.')
rf(g, 3, 'Presentación progresiva y manejo de fallos del tutor',
   'El sistema deberá indicar que PyBot está respondiendo, presentar progresivamente el contenido cuando el servicio lo permita e informar las fallas sin mostrar una respuesta como completada si no se recibió.',
   'Flujo de respuesta, estado de espera o error del servicio de IA.',
   'Respuesta visible o aviso de fallo, con posibilidad de continuar la conversación.')

g = group(22, 'Generación de ejercicios mediante inteligencia artificial', 'Observación',
    'Como estudiante, quiero solicitar retos o proyectos sobre un tema y una dificultad, para disponer de nuevas oportunidades de práctica acordes con lo que deseo estudiar.',
    'Ampliar la práctica mediante contenido generado bajo demanda, identificándolo como contenido de IA y diferenciándolo del catálogo original.')
rf(g, 1, 'Definición de la solicitud de generación',
   'El sistema deberá permitir elegir la modalidad, ingresar un tema y seleccionar la dificultad del ejercicio que se solicitará al servicio de IA.',
   'Modalidad clásica o contextualizada, tema y dificultad.',
   'Solicitud de generación enviada con los parámetros seleccionados e indicador de espera.')
rf(g, 2, 'Obtención y presentación del ejercicio generado',
   'El sistema deberá recibir el reto o proyecto generado y mostrar una tarjeta identificada como contenido de IA, con título, descripción y dificultad, conservando los datos recibidos en el navegador cuando el almacenamiento esté disponible.',
   'Respuesta satisfactoria del servicio y disponibilidad de almacenamiento local.',
   'Tarjeta del contenido generado y datos locales asociados a su identificador.')
rf(g, 3, 'Tratamiento de errores de generación',
   'El sistema deberá informar cuando falle la generación y permitir una nueva solicitud sin eliminar los ejercicios ya disponibles ni presentar contenido incompleto como una generación satisfactoria.',
   'Error HTTP, fallo del servicio o respuesta de generación no satisfactoria.',
   'Mensaje de error y formulario habilitado para reintentar.')

g = group(23, 'Consulta y actualización del perfil personal', 'Observación',
    'Como estudiante con una cuenta, quiero consultar y actualizar mis datos personales, para mantener mi información correcta dentro de PyLevel.',
    'Permitir el mantenimiento de los datos del titular con validaciones y controles adicionales al cambiar el correo de acceso.')
rf(g, 1, 'Consulta del perfil de la cuenta',
   'El sistema deberá mostrar al usuario autenticado su nombre, correo, ocupación, cumpleaños cuando esté registrado y antigüedad de la cuenta. Los datos deberán obtenerse de la identidad validada en el servidor.',
   'Sesión activa y solicitud de acceso al perfil.',
   'Perfil de la cuenta autenticada o redirección al inicio de sesión.')
rf(g, 2, 'Actualización de datos personales',
   'El sistema deberá permitir actualizar el nombre, la ocupación y el cumpleaños opcional, validar las fechas reales y rechazar una fecha de nacimiento posterior a la fecha actual en Colombia.',
   'Sesión y datos personales modificados.',
   'Datos válidos guardados o mensajes de validación sin aplicar una actualización parcial.')
rf(g, 3, 'Cambio de correo con verificación de contraseña',
   'El sistema deberá exigir la contraseña actual para cambiar el correo, comprobar que el nuevo correo no esté registrado y revocar las otras sesiones después del cambio, conservando la sesión que efectuó la operación.',
   'Sesión, nuevo correo y contraseña actual.',
   'Correo actualizado y otras sesiones revocadas, o rechazo con los datos originales conservados.')

g = group(24, 'Realización de exámenes con tiempo límite', 'Propuesta de la docente',
    'Como docente, quiero que los estudiantes realicen el examen con un tiempo límite y un intento por cuenta y versión, para disponer de entregas realizadas bajo condiciones uniformes.',
    'Administrar el inicio, la continuidad y el cierre del examen mediante reglas verificadas por el servidor.')
rf(g, 1, 'Inicio de un único intento por versión',
   'El sistema deberá exigir una sesión activa para iniciar el examen y crear un único intento por cuenta y versión, después de cumplir las condiciones de seguimiento. Si ya existe un intento, deberá devolver su estado sin crear otro.',
   'Sesión, versión del examen, solicitud de inicio y condiciones de seguimiento aceptadas.',
   'Intento creado o existente con sus preguntas, respuestas y estado.')
rf(g, 2, 'Control del plazo del examen',
   'El sistema deberá fijar el inicio y vencimiento del intento con la hora del servidor y mostrar el tiempo restante. La versión inicial tendrá una duración de 30 minutos, que no se reiniciará al recargar o reingresar.',
   'Intento, duración de la versión y hora del servidor.',
   'Plazo persistido y tiempo restante visible. Las interrupciones técnicas no reinician el plazo.')
rf(g, 3, 'Entrega voluntaria del examen',
   'El sistema deberá permitir entregar las respuestas antes del vencimiento, confirmar el cierre del intento y rechazar modificaciones posteriores a la entrega.',
   'Intento vigente, respuestas válidas y solicitud de entrega.',
   'Intento entregado con fecha de cierre y respuestas conservadas para su revisión.')
rf(g, 4, 'Cierre del intento por vencimiento',
   'El sistema deberá rechazar cambios recibidos después del vencimiento y cerrar el intento con las respuestas persistidas. El vencimiento deberá materializarse al consultar o sincronizar el intento, aunque el navegador haya estado cerrado.',
   'Plazo del servidor, intento y última versión de las respuestas guardadas.',
   'Intento con tiempo finalizado y respuestas del servidor conservadas.')
rf(g, 5, 'Consulta de intentos y del resumen del examen',
   'El sistema deberá permitir consultar los intentos de la cuenta con su fecha y estado, retomar los vigentes y abrir el resumen de respuestas e incidencias de los cerrados. Las entregas sin calificación deberán identificarse como pendientes de revisión.',
   'Sesión, historial de intentos y selección de un intento propio.',
   'Historial, reanudación o resumen del intento, sin inventar una calificación.')

g = group(25, 'Guardado y recuperación de respuestas del examen', 'Propuesta de la docente',
    'Como docente, quiero que las respuestas de los estudiantes se guarden durante el examen y puedan recuperarse ante interrupciones, para conservar el trabajo recibido dentro del plazo y evitar sobrescrituras entre versiones.',
    'Conservar respuestas durante el intento, distinguir el guardado confirmado de la copia local y resolver ediciones concurrentes.')
rf(g, 1, 'Sincronización automática de respuestas',
   'El sistema deberá guardar las respuestas después de la edición y sincronizar el intento cada cinco segundos mientras esté activo. Deberá mostrar si el guardado fue confirmado o permanece pendiente.',
   'Sesión, intento activo, respuestas y revisión conocida.',
   'Respuestas persistidas y revisión actualizada, o aviso de sincronización pendiente.')
rf(g, 2, 'Recuperación local por cuenta e intento',
   'El sistema deberá conservar una copia de recuperación separada por usuario e intento y detectar cambios pendientes al volver. Deberá permitir recuperarlos dentro del plazo; si este venció, conservará la copia sin incorporarla a la entrega.',
   'Identidad autenticada, intento, copia local y plazo vigente.',
   'Trabajo recuperable y estado informado. Solo las respuestas recibidas a tiempo por el servidor integran la entrega.')
rf(g, 3, 'Resolución de conflictos entre versiones',
   'El sistema deberá detectar cuando una respuesta se envíe con una revisión anterior a la guardada y solicitar al estudiante elegir qué versión conservar antes de continuar con la sincronización.',
   'Revisión enviada, revisión persistida y contenido de ambas versiones.',
   'Conflicto informado y versión elegida conservada sin sobrescritura silenciosa.')
rf(g, 4, 'Validación y aislamiento de las respuestas',
   'El sistema deberá verificar que el intento pertenezca a la cuenta autenticada, que las respuestas correspondan a preguntas de la versión y que respeten el tamaño permitido. Deberá rechazar respuestas inválidas, ajenas o recibidas en un intento cerrado.',
   'Sesión, identificador del intento, respuestas, revisión y estado del intento.',
   'Actualización autorizada o solicitud rechazada sin alterar respuestas de otra cuenta ni una entrega cerrada.')

g = group(26, 'Registro de incidencias de navegación durante el examen', 'Propuesta de la docente',
    'Como docente, quiero que se registren las salidas de la pestaña y las pérdidas de foco durante el examen, para contar con incidencias que puedan revisarse en su contexto.',
    'Registrar cambios observables de navegación durante un intento activo y presentarlos como información que requiere interpretación humana.')
rf(g, 1, 'Detección y agrupación de salidas del examen',
   'El sistema deberá detectar cambios de visibilidad, pérdidas de foco y salidas de página durante el intento activo, agrupando las señales que correspondan a una misma salida.',
   'Intento activo y señales de visibilidad, foco y salida de página.',
   'Evento de salida o retorno asociado al intento, sin contar varias señales del mismo episodio como salidas distintas.')
rf(g, 2, 'Registro de eventos sin duplicados',
   'El sistema deberá identificar cada evento de navegación y evitar su duplicación al reenviarlo. Registrará la hora de recepción del servidor y la última comunicación recibida del intento.',
   'Sesión, intento y eventos identificados enviados desde el navegador.',
   'Eventos persistidos una sola vez y última comunicación actualizada.')
rf(g, 3, 'Avisos y consulta de incidencias',
   'El sistema deberá mostrar un aviso al volver al examen y permitir consultar las incidencias en el resumen. Mientras el intento esté activo solicitará la confirmación de salida admitida por el navegador. Las incidencias no modificarán automáticamente la nota ni se presentarán como prueba de fraude.',
   'Retorno al examen, solicitud de salida o consulta del resumen.',
   'Aviso o confirmación del navegador cuando sea posible, y registro informativo de incidencias.')

g = group(27, 'Seguimiento de presencia mediante cámara', 'Propuesta de la docente',
    'Como docente, quiero que el examen registre incidencias de presencia mediante cámara, con consentimiento y alternativas ante dificultades, para disponer de información contextual durante la revisión de las entregas.',
    'Registrar condiciones de presencia observables sin identificar personas, conservar imágenes ni aplicar sanciones automáticas.')
rf(g, 1, 'Consentimiento y alternativa de seguimiento',
   'El sistema deberá solicitar la aceptación de las condiciones antes de un intento nuevo y permitir elegir el modo cámara o declarar una dificultad por permisos, dispositivo, compatibilidad, falla técnica o accesibilidad.',
   'Aceptación expresa, modo seleccionado y motivo de dificultad cuando corresponda.',
   'Consentimiento y modo asociados al intento. La alternativa declarada queda disponible para revisión.')
rf(g, 2, 'Activación explícita y preparación de la cámara',
   'El sistema deberá activar la cámara solo por una acción explícita y el permiso del navegador, sin solicitar audio. En modo cámara deberá verificar un rostro estable durante al menos 1,5 segundos antes de habilitar el inicio.',
   'Acción de activación, permiso del navegador y observaciones del detector.',
   'Vista de cámara y estado de preparación, o aviso de dificultad con acceso a la alternativa.')
rf(g, 3, 'Detección de episodios de presencia',
   'El sistema deberá detectar episodios de ausencia de rostro de al menos 5 segundos y de varios rostros de al menos 3 segundos durante el examen. Cuando la pestaña esté oculta, deberá omitir estas observaciones y utilizar el registro de navegación.',
   'Intento activo, cantidad de rostros observada, duración y visibilidad de la pestaña.',
   'Aviso e incidencia de presencia al alcanzar el umbral, sin identificación de las personas.')
rf(g, 4, 'Registro de duración y fallos técnicos de cámara',
   'El sistema deberá registrar cada episodio con un identificador y actualizar su duración estimada sin duplicar el contador ni reducirla por un reenvío anterior. Los fallos de captura o del detector deberán registrarse como interrupciones técnicas.',
   'Evento de cámara, identificador, duración estimada y estado técnico.',
   'Episodio actualizado o interrupción técnica registrada; un fallo del detector no se etiqueta como ausencia de rostro.')
rf(g, 5, 'Procesamiento local y alcance de los eventos',
   'El sistema deberá analizar las imágenes en el dispositivo y transmitir únicamente los eventos y datos de duración previstos. No deberá almacenar ni transmitir imágenes, vídeo, audio o plantillas de identidad; tampoco deberá inferir emociones, mirada o intención.',
   'Imágenes temporales del dispositivo y resultados locales del detector.',
   'Eventos informativos de presencia asociados al intento, sin material audiovisual persistido ni sanciones automáticas.')
rf(g, 6, 'Desactivación y reanudación de la cámara',
   'El sistema deberá detener la cámara al entregar, vencer el plazo, salir o retirar el consentimiento. Al regresar o recargar deberá exigir una nueva acción de activación. Las dificultades de cámara no deberán impedir editar respuestas dentro del plazo vigente.',
   'Estado del intento, salida, recarga, retiro del consentimiento o fallo técnico.',
   'Captura detenida o reactivada por el estudiante, con el plazo del examen conservado.')

g = group(28, 'Visualización didáctica de Bubble Sort', 'Observación',
    'Como estudiante, quiero observar paso a paso un ejemplo de Bubble Sort, para comprender cómo las comparaciones e intercambios ordenan una lista.',
    'Ofrecer un apoyo visual para comprender el algoritmo y relacionar sus pasos con una explicación accesible.')
rf(g, 1, 'Presentación de la secuencia ilustrativa',
   'El sistema deberá mostrar una lista de ejemplo con las comparaciones, intercambios, pasadas y posiciones ordenadas, acompañada por una explicación del paso actual y contadores de operaciones.',
   'Ejemplo didáctico definido y paso actual de la animación.',
   'Representación y explicación del estado del algoritmo, identificadas como ejemplo ilustrativo independiente del código del estudiante.')
rf(g, 2, 'Control de la reproducción de la animación',
   'El sistema deberá permitir reproducir, pausar, avanzar un paso, reiniciar y ajustar la velocidad del ejemplo. Deberá pausar la reproducción al cerrar la sección de la animación.',
   'Acción de reproducción, pausa, avance, reinicio, velocidad o cierre de la sección.',
   'Animación actualizada conforme al control seleccionado y explicación textual del paso visible.')

# Ampliaciones de historias existentes. Se mantienen sus identificadores.
g = group(1, 'Cierre y vigencia de las sesiones', 'Observación',
    'Como usuario autenticado, quiero cerrar mi sesión y que el acceso privado dependa de una sesión vigente, para controlar el acceso a mi cuenta.',
    'Completar el acceso descrito en HU-01 con cierre efectivo de sesión y validación de su vigencia en el servidor.', 'ampliacion')
rf(g, 7, 'Cierre y revocación de la sesión',
   'El sistema deberá permitir cerrar la sesión, revocarla en el servidor y eliminar la cookie del navegador. Las solicitudes posteriores que utilicen el token revocado deberán perder el acceso a funciones privadas.',
   'Sesión activa y solicitud de cierre.',
   'Sesión revocada, cookie eliminada y acceso privado condicionado a una nueva autenticación.')
rf(g, 8, 'Verificación de vigencia de la sesión',
   'El sistema deberá validar en el servidor la sesión y el estado activo de la cuenta antes de autorizar funciones privadas. Las sesiones tendrán una vigencia de siete días y los tokens inválidos, vencidos o revocados deberán rechazarse.',
   'Token de sesión, fecha de vencimiento y estado de la cuenta.',
   'Identidad autenticada para la operación o solicitud de iniciar sesión nuevamente.')

g = group(6, 'Presentación del avance y del nivel de forma contextual', 'Observación',
    'Como estudiante, quiero conocer mi avance en Python a partir de mi actividad y de los temas practicados, para reconocer lo que he trabajado y decidir cómo continuar.',
    'Sustituir la asignación obligatoria de categorías por rangos fijos por una descripción del avance sustentada en evidencia disponible y comprensible para el estudiante.', 'modificacion')
rf(g, 1, 'Obtención de evidencia del avance',
   'El sistema deberá obtener de la actividad de la cuenta los ejercicios trabajados y superados, sus temas y los resultados disponibles, para sustentar la presentación del avance del estudiante.',
   'Cuenta autenticada, catálogo y actividad registrada.',
   'Evidencia de avance por ejercicio y tema, sin utilizar datos simulados ni actividad de otras cuentas.')
rf(g, 2, 'Interpretación contextual del nivel y del avance',
   'El sistema deberá describir el avance mediante los ejercicios superados, pendientes y temas practicados, sin exigir su conversión a las categorías Principiante, Intermedio o Avanzado mediante rangos fijos. Si no existe actividad, deberá indicar que el estudiante aún no ha comenzado.',
   'Evidencia de actividad y estado de los ejercicios de la cuenta.',
   'Descripción del avance acorde con lo registrado, sin asignar capacidades que la plataforma no haya medido.')
rf(g, 3, 'Presentación y explicación del avance',
   'El sistema deberá presentar indicadores de avance en el perfil y en progreso, indicando que las pruebas públicas muestran práctica superada y que esos valores no constituyen una calificación de competencias.',
   'Indicadores calculados y solicitud de consulta del perfil o de progreso.',
   'Avance visible con una explicación de su significado y de la evidencia utilizada.')

g = group(8, 'Registro de la actividad de práctica', 'Observación',
    'Como estudiante autenticado, quiero que se registren mis intentos de práctica y los ejercicios que supero, para conservar evidencia de mi trabajo dentro de mi cuenta.',
    'Ampliar el historial de evaluaciones con actividad de práctica verificable y vinculada a la sesión.', 'ampliacion')
rf(g, 5, 'Registro de intentos de práctica por cuenta',
   'El sistema deberá registrar cada ejecución o prueba de un ejercicio del catálogo para la cuenta identificada por la sesión del servidor, junto con la modalidad, fecha, acción y resultado disponible.',
   'Sesión válida, ejercicio, modalidad, acción y resultado del ejecutor.',
   'Intento asociado a la cuenta. La práctica sin sesión podrá ejecutarse, pero no se incorporará al progreso de una cuenta.')
rf(g, 6, 'Reconocimiento de un ejercicio superado',
   'El sistema deberá marcar un ejercicio como superado únicamente cuando la acción Probar termine correctamente, ejecute al menos una prueba pública original y reporte su aprobación. El resultado declarado por el navegador no será suficiente para acreditar el avance.',
   'Ejercicio del catálogo y resultado de las pruebas originales procesado por el servidor.',
   'Ejercicio superado una sola vez en los indicadores de avance de la cuenta.')
rf(g, 7, 'Conservación del avance ante nuevos intentos',
   'El sistema deberá conservar el estado superado cuando un intento posterior falle, sea cancelado o tenga un error técnico. Si falla la persistencia de un resultado, deberá avisar al estudiante sin presentar el avance como confirmado.',
   'Avance existente, nuevo resultado y estado del guardado.',
   'Intento incorporado cuando se confirme y ejercicios superados anteriores conservados.')

g = group(9, 'Consulta del progreso de práctica', 'Observación',
    'Como estudiante, quiero consultar mi actividad, mis ejercicios pendientes y los resultados recientes, para reconocer mi continuidad de práctica y retomar el trabajo.',
    'Ampliar la consulta de progreso con métricas de práctica calculadas a partir de los registros de la cuenta.', 'ampliacion')
rf(g, 5, 'Resumen de indicadores de práctica',
   'El sistema deberá mostrar los ejercicios superados sobre el total del catálogo, los ejercicios con intentos aún no superados, el número de ejecuciones y pruebas y el porcentaje de avance, contando cada ejercicio superado una sola vez.',
   'Catálogo y actividad de la cuenta autenticada.',
   'Indicadores calculados con los datos de la cuenta y sus ejercicios.')
rf(g, 6, 'Actividad de los últimos siete días',
   'El sistema deberá mostrar los intentos por día y la cantidad de días con actividad en los últimos siete días, utilizando la fecha de Colombia para agrupar los registros.',
   'Fechas de los intentos y fecha actual de Colombia.',
   'Gráfica diaria y contador de días activos de la última semana.')
rf(g, 7, 'Listado de ejercicios y resultados recientes',
   'El sistema deberá listar los ejercicios trabajados, permitir filtrarlos por superados o en progreso y ofrecer acceso para continuarlos. Además, deberá mostrar los últimos veinte intentos con su acción, resultado y fecha.',
   'Actividad de la cuenta y filtro de estado seleccionado.',
   'Listado filtrado de ejercicios y relación de hasta veinte intentos recientes.')
rf(g, 8, 'Presentación de cuentas sin actividad y fallos de consulta',
   'El sistema deberá mostrar ceros y una invitación a comenzar cuando la cuenta no tenga actividad. Si falla la consulta de datos, deberá informar la indisponibilidad y permitir reintentar sin sustituir los registros por métricas ficticias.',
   'Sesión y resultado de la consulta de progreso.',
   'Estado inicial de la cuenta o aviso de indisponibilidad con opción de reintentar.')

g = group(11, 'Recomendaciones basadas en la práctica', 'Observación',
    'Como estudiante, quiero recibir sugerencias a partir de mis intentos y de las ayudas que he consultado, para elegir una acción concreta con la que continuar aprendiendo.',
    'Complementar las rutas de estudio de la SRS con recomendaciones inmediatas derivadas de la práctica registrada.', 'ampliacion')
rf(g, 5, 'Generación de recomendaciones por actividad',
   'El sistema deberá generar sugerencias para comenzar, retomar pruebas fallidas, comprobar código que solo se ha ejecutado, continuar con otro ejercicio o volver a resolver uno después de consultar ayudas, según la actividad de la cuenta.',
   'Intentos, resultados, ejercicios superados y consultas de pistas o soluciones.',
   'Recomendaciones explicadas y vinculadas a una acción o ejercicio disponible.')
rf(g, 6, 'Tratamiento de incidencias técnicas en las recomendaciones',
   'El sistema deberá diferenciar los errores técnicos del ejecutor de los fallos de la solución y sugerir reintentar cuando corresponda. Las recomendaciones de práctica deberán indicar su fundamento en la actividad registrada, sin atribuir capacidades no medidas.',
   'Resultados técnicos, actividad y recomendaciones calculadas.',
   'Sugerencia de recuperación o práctica coherente con la evidencia y con los avances conservados.')

g = group(14, 'Consulta del avance de práctica por tema', 'Observación',
    'Como estudiante, quiero ver cuántos ejercicios he superado en cada tema, para reconocer qué contenidos he practicado y cuáles puedo seguir trabajando.',
    'Complementar el detalle por subtema de las evaluaciones con el avance del catálogo de práctica, conservando el significado de cada indicador.', 'ampliacion')
rf(g, 5, 'Cálculo y presentación del avance por tema',
   'El sistema deberá agrupar los ejercicios del catálogo por tema y calcular cuántos ha superado la cuenta respecto del total de cada tema. Deberá presentar estos valores como avance de práctica, sin confundirlos con el porcentaje de aciertos de una evaluación.',
   'Temas del catálogo y ejercicios superados de la cuenta.',
   'Cantidad y proporción de ejercicios superados por tema, visibles en el perfil o en progreso.')

INTRO = [
    'Este complemento incorpora las necesidades identificadas durante el desarrollo de PyLevel y actualiza los requisitos afectados de la especificación original. Las historias nuevas conservan la secuencia desde HU-16 y sus requisitos se organizan desde RF-16; las ampliaciones mantienen los identificadores de las historias existentes.',
    'Las historias de la sección de evaluación, correspondientes a exámenes, guardado de respuestas, incidencias y cámara, tienen como fuente Propuesta de la docente. Las demás historias de este complemento tienen como fuente Observación.',
]

SCOPE = [
    'El panel docente queda retirado del alcance. HU-12, RF-12 y sus requisitos derivados se conservan únicamente como referencias históricas y sus identificadores no se reutilizan. Las referencias y permisos que dependían exclusivamente de ese panel deberán retirarse de los casos de uso y de la trazabilidad vigente.',
    'El módulo de administración del banco de preguntas permanece previsto y pendiente de implementación bajo RF-10. Su estado pendiente no lo convierte en un requisito nuevo. El resto de las funciones originales no modificadas por este complemento conserva su referencia en la SRS.',
    'La nueva redacción de RF-06.1, RF-06.2 y RF-06.3 sustituye sus fichas anteriores. El avance se presenta con la actividad y los temas practicados, sin exigir los rangos rígidos de clasificación de la versión original. Los indicadores de práctica y el estado de entrega de un examen no equivalen a una calificación automática.',
    'Las fichas de RF-24 a RF-27 describen las condiciones de operación del examen y su seguimiento. La calificación automática prevista en la SRS continúa pendiente; las entregas actuales se conservan para revisión. Los eventos de navegación y cámara son informativos y no producen sanciones automáticas.',
    'RF-22 formaliza la generación de contenido de IA y su presentación en el catálogo. La carga completa del contenido generado en el editor y su incorporación al seguimiento por cuenta permanecen pendientes de integración y verificación.',
]
