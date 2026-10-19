import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const out = new URL('./',import.meta.url);
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/nicol/Downloads/PyLevel_Cronograma (2).xlsx'));
const s = wb.worksheets.getItem('Cronograma');
const r = wb.worksheets.getItem('Resumen');
const commits = {
 init:['36c168710dc40c5f46b9c8d3e6a1d637fa2a2bfa','2026-10-13'],
 astro:['500dbbfa1e6b4f4c8038686ad8041522a3dafd6f','2026-10-13'],
 core:['a55da253dc53af13a53481e341d7c91281c64112','2026-10-13'],
 catalog:['cdc9a5ba940aff02812ba33be2a849f7bebc62c3','2026-10-15'],
 ui:['b48333f9f8ff58de4d6fca2f0666180ed453de13','2026-10-15'],
 bubble:['ce6876b0f669a3bff356a466868fb545d2082b92','2026-10-15'],
 auth:['826efc26023a185bf67c402c07dde7e7bfc42617','2026-10-16'],
 texts:['37522da295b320a219f86c1bd74a4550c8761c96','2026-10-16'],
};
// Excel serial dates avoid ISO date cells being lost by spreadsheet viewers.
const date = str => (Date.parse(`${str}T00:00:00Z`) - Date.UTC(1899,11,30)) / 86400000;
const n='Nicolas Camacho',dev='Juan Carvajal / Camilo Jaimes',qa='Santiago Cuervo';
const tasks=[];
function add(id,sprint,title,owner,start,end,dep,result,status,commit,note){
 const c=commits[commit];
 tasks.push({id,sprint:`Sprint ${sprint}`,title,owner,start:`2026-${start}`,end:`2026-${end}`,dep:dep||'—',result,status,evidence:c?.[1]||null,url:c?`https://github.com/NicolasSsC/PyLevel/commit/${c[0]}`:'',note:note||''});
}
add('BASE-01',1,'Crear repositorio y estructura inicial de Astro',n,'10-07','10-08','','Proyecto Astro, TypeScript, dependencias y configuración inicial','Hecho','astro','Incluye inicialización del repositorio (36c1687). Fechas de actividad redistribuidas desde el 07/10.');
add('ALG-01',1,'Definir contrato de ejecución de código Python',n,'10-08','10-08','BASE-01','Solicitud con archivos y acción. Respuesta con estado, salida y código de retorno','Hecho','core','Contrato de ejecución implementado. La calificación oficial se completa en EVAL-01.');
add('RET-01',1,'Definir reglas de los ejercicios contextualizados',n,'10-08','10-09','BASE-01','Enunciados y reglas de inventario, reservas y pagos de facturas','Hecho','core','Reglas incluidas en exercises.json.');
add('RET-02',1,'Incorporar tres proyectos Python con defectos',dev,'10-09','10-10','RET-01','Inventario, agenda de salas y facturación, con archivos iniciales y salidas esperadas','Hecho','core','Material de práctica con defectos intencionales. No representa soluciones aprobadas.');
add('UI-01',1,'Implementar editor de proyectos contextualizados',dev,'10-10','10-12','RET-02','Explorador de archivos, editor, terminal y acciones de ejecutar, probar y detener','Hecho','core','Implementación del prototipo. Validación de ejecución pendiente en QA-INT.');
add('WS-01',1,'Guardar y recuperar borradores por ejercicio',n,'10-10','10-12','UI-01','Persistencia de archivos en localStorage y recuperación del trabajo','Hecho','core','Persistencia local del navegador. No incluye intentos en PostgreSQL.');
add('SEC-01',1,'Implementar prototipo de ejecutor con Docker y gVisor',n,'10-11','10-13','ALG-01, RET-02','Contenedor por envío, límites de recursos, salida limitada y eliminación al terminar','Hecho','core','Código del supervisor y Dockerfile. Funcionamiento con runsc pendiente de comprobar.');
add('SEC-02',1,'Conectar interfaz y ejecutor mediante API de desarrollo',n,'10-13','10-13','UI-01, SEC-01','Puente HTTP de ejecución, cancelación y control de una solicitud simultánea','Hecho','core','Puente solo de desarrollo. API autenticada, cola y cuotas de producción pendientes.');
add('QA-DEV',1,'Agregar pruebas automatizadas del ejecutor',n,'10-13','10-13','SEC-01','Suite para múltiples archivos, restricciones, timeout, salida y rutas inválidas','Hecho','core','Pruebas versionadas en runner/test_runner.py. No se acredita ejecución satisfactoria.');
add('QA-01',1,'Agregar pruebas públicas y casos límite a los retos',qa,'10-13','10-13','RET-02','Pruebas públicas por proyecto y criterios de aceptación en los enunciados','Hecho','core','Se registra la creación de las pruebas. Ejecución y resultados pendientes en QA-INT.');
add('ALG-03',1,'Implementar formato de resultados de ejecución',n,'10-13','10-13','ALG-01, SEC-02','Estado de ejecución, terminal y código de salida integrados con el cliente','Hecho','core','No incluye puntuación, pruebas ocultas ni penalización por pistas.');
add('CAT-01',1,'Crear catálogo de cinco ejercicios clásicos',n,'10-13','10-14','RET-02','Operadores lógicos, for, if, Bubble Sort y lambdas con ejemplos, pistas y pruebas','Hecho','catalog','Pruebas públicas de práctica. No certifican la técnica empleada por el estudiante.');
add('UI-02',1,'Implementar editor de ejercicios clásicos',n,'10-14','10-14','CAT-01, ALG-03','Enunciado, salida esperada, editor único, pistas y terminal','Hecho','catalog','Consulta de pistas registrada localmente. Descuento de puntos pendiente.');
add('CAT-02',1,'Crear modalidades, rutas y filtros del catálogo',n,'10-14','10-14','CAT-01, UI-01','Listados clásicos y contextualizados con dificultad, temas, contador y estado vacío','Hecho','catalog','Rutas por modalidad e identificador del ejercicio.');
add('UX-01',1,'Añadir presentación inicial de proyectos',n,'10-14','10-15','CAT-02','Modal con situación, pregunta, archivos y resultado esperado de cada proyecto','Hecho','ui','Briefing contextual y descripción de roles de archivos.');
add('UI-03',1,'Implementar barra de navegación superior',n,'10-14','10-15','CAT-02','Navegación, selector de tema, notificaciones y menú de perfil','Hecho','ui','Componentes de interfaz. No implica un servicio de notificaciones implementado.');
add('UI-04',1,'Ajustar tema claro, contraste e iconografía',n,'10-15','10-15','UI-03, UI-02','Estilos compartidos, correcciones de contraste e iconos SVG','Hecho','ui','Ajustes visuales en catálogos y editores.');
add('DB-02',1,'Implementar conexión PostgreSQL y consulta de perfiles',n,'10-14','10-15','BASE-01','Pool PostgreSQL y consultas de usuarios y perfiles con variables de entorno','Hecho','ui','Código de acceso a datos. Conectividad y esquema desplegado pendientes de verificar.');
add('AUTH-01',1,'Implementar registro de usuarios',n,'10-15','10-16','DB-02','Formulario y API de registro, validaciones, hash bcrypt y creación de perfil','Hecho','auth','Implementación de código. Pruebas de registro con la base de datos pendientes.');
add('AUTH-02',1,'Implementar inicio y cierre de sesión',n,'10-15','10-16','DB-02','Login, logout, consulta del usuario y formularios de autenticación','Hecho','auth','Sesión inicial implementada. Endurecimiento y validación pendientes en AUTH-03.');
add('PERF-01',1,'Implementar perfil y actividad local del usuario',n,'10-16','10-16','AUTH-01, AUTH-02, WS-01','Página de perfil con datos del usuario y acceso a borradores locales','Hecho','auth','La actividad se obtiene de localStorage. Sin historial SQL de intentos ni métricas oficiales.');
add('ALG-04',1,'Crear animación didáctica de Bubble Sort',n,'10-15','10-15','UI-02','Visualización de comparaciones, intercambios y pasadas del algoritmo','Hecho','bubble','Ejemplo didáctico fijo. Trazas de la ejecución Python del estudiante pendientes.');
add('UI-05',1,'Corregir textos de la sección de ejercicios',n,'10-16','10-16','CAT-02','Textos y presentación de modalidades actualizados en ExerciseHub','Hecho','texts','Último avance de main verificado al 16/10/2026.');
add('DOC-DEV',1,'Documentar uso y límites del prototipo',n,'10-13','10-15','SEC-02','README del núcleo y del ejecutor con preparación y limitaciones técnicas','Hecho','catalog','Documentación del desarrollo incluida en el repositorio.');
add('ALG-02',1,'Formalizar diagrama y pseudocódigo del evaluador',n,'10-17','10-19','ALG-03','Flujo de evaluación, reglas de puntuación y manejo de errores documentados','Pendiente',null,'El cronograma original lo marcaba Hecho. No se encontró el entregable y el usuario confirma trabajo de desarrollo únicamente.');
add('AUTH-03',1,'Reforzar y verificar el manejo de sesiones',n,'10-17','10-20','AUTH-02','Sesiones validadas en servidor y pruebas de acceso, expiración y cierre','Pendiente',null,'Revisión de la implementación inicial de autenticación antes de exposición pública.');
add('QA-INT',1,'Validar el prototipo y registrar resultados de prueba',qa,'10-17','10-20','QA-DEV, QA-01, ALG-03, PERF-01','Ejecución con Docker y runsc, registro/login y recorridos de ambos editores comprobados','Pendiente',null,'Distinguir pruebas escritas de pruebas ejecutadas y aprobadas.');
add('EVAL-01',2,'Implementar evaluador y puntuación oficial',n,'10-21','10-27','ALG-02, QA-INT','Evaluación reproducible, pruebas de calificación y reglas de puntuación y pistas','Pendiente',null,'El ejecutor y las pruebas públicas actuales no acreditan calificaciones.');
add('DB-01',2,'Persistir intentos, resultados y progreso',dev,'10-21','10-26','DB-02, AUTH-03, ALG-03','Tablas PostgreSQL y guardado de intentos vinculados al usuario y al ejercicio','Pendiente',null,'Se ajusta el entregable a PostgreSQL usado en el código. No se encontró implementación con Prisma.');
add('SEC-PROD',2,'Preparar API y control de ejecución para producción',n,'10-21','10-27','SEC-02, AUTH-03, QA-INT','API autenticada, cola, cuotas, cancelación y limpieza externa de contenedores','Pendiente',null,'Requisitos de producción indicados en los README.');
add('INT-01',2,'Integrar evaluación, resultados y persistencia',n,'10-28','10-30','EVAL-01, DB-01, SEC-PROD','Flujo completo de entrega, calificación y consulta de resultados','Pendiente',null,'Integración oficial posterior a la validación del prototipo.');
add('DEV-01',2,'Desplegar versión para pruebas de otros grupos',n,'10-31','11-02','INT-01','Entorno de prueba accesible con configuración reproducible','Pendiente',null,'No se confirmó un despliegue operativo de la aplicación.');
add('QA-02',2,'Ejecutar pruebas de aceptación y humo',qa,'11-02','11-02','DEV-01','Recorridos críticos aprobados y defectos registrados','Pendiente',null,'Comprobar autenticación, ejercicios, ejecución, persistencia y resultados.');
add('REL-TEST',2,'Congelar y entregar versión para pruebas','Kevin Pardo','11-03','11-03','QA-02','Versión etiquetada, guía de acceso y evidencias de prueba','Pendiente',null,'El archivo original menciona entrega académica el 02 o 03/11. Fecha oficial por confirmar.');
add('QA-EXT',3,'Recibir y reproducir pruebas de otros grupos','Equipo completo','11-04','11-13','REL-TEST','Incidencias externas registradas con pasos y evidencias','Pendiente',null,'Recepción continua. Las correcciones pueden iniciar con las primeras incidencias.');
add('QA-ADV',3,'Ejecutar pruebas adversariales internas',qa,'11-04','11-11','REL-TEST','Casos límite y respuestas a fallos documentados','Pendiente',null,'En paralelo con la recepción de pruebas externas.');
add('FIX-01',3,'Corregir defectos prioritarios',dev,'11-05','11-15','QA-EXT, QA-ADV','Defectos críticos corregidos y revisados','Pendiente',null,'Inicio con las primeras incidencias. Dependencia parcial, sin esperar el cierre de ambas campañas.');
add('REG-01',3,'Ejecutar regresión tras cada corrección',qa,'11-08','11-17','FIX-01','Verificaciones repetibles sin regresiones críticas','Pendiente',null,'Se ejecuta de forma continua a medida que se entregan correcciones.');
add('SEC-03',3,'Verificar estabilidad y seguridad',n,'11-09','11-17','SEC-PROD, QA-EXT','Límites, aislamiento, sesiones y recuperación ante fallos verificados','Pendiente',null,'Atender hallazgos parciales de QA-EXT durante el sprint.');
add('FIX-02',4,'Resolver pendientes y estabilizar',dev,'11-18','11-24','FIX-01, REG-01','Pendientes prioritarios cerrados','Pendiente');
add('DEV-02',4,'Preparar despliegue estable',n,'11-18','11-26','DEV-01, SEC-03','Despliegue reproducible y monitoreado','Pendiente');
add('QA-FIN',4,'Ejecutar regresión final y prueba general',qa,'11-27','11-28','FIX-02, DEV-02','Batería final ejecutada y evidencias almacenadas','Pendiente');
add('DOC-01',4,'Preparar demostración y evidencias',n,'11-29','12-01','QA-FIN','Demostración, bitácora y resultados de prueba','Pendiente');
add('REL-01',4,'Congelar versión final planificada','Equipo completo','12-01','12-01','QA-FIN, DEV-02, DOC-01','Versión reproducible y cierre de incidencias','Pendiente',null,'Cierre de ocho semanas del plan original. No es fecha oficial confirmada.');
const last=tasks.length+5;
// Extend the supplied layout using the original body and header styles.
for(let row=6;row<=last;row++)s.getRange(`A${row}:R${row}`).copyFrom(s.getRange(`A${row%2?7:6}:R${row%2?7:6}`),'all');
s.getRange(`A6:U${last}`).clear({applyTo:'contents'});
s.getRange('C5').values=[['Actividad']];
s.getRange('D5').values=[['Responsable previsto']];
s.getRange('E5:F5').values=[['Inicio plan','Fin plan']];
s.getRange('S5:U5').copyFrom(s.getRange('H5:J5'),'all');
s.getRange('S5:U5').values=[['Fecha evidencia','Evidencia GitHub','Alcance / pendiente']];
s.mergeCells('S3:U3');s.getRange('S3:U3').copyFrom(s.getRange('A3:C3'),'all');
s.getRange('S3').values=[['EVIDENCIA DEL DESARROLLO AL 16/10/2026']];
s.getRange('A3').values=[['DESARROLLO Y PENDIENTES. FECHAS DEL PLAN DESDE EL 07/10/2026']];
s.getRange('S3:U3').format.fill='#1F4E67';
s.getRange('S3:U3').format.font={name:'Carlito',color:'#FFFFFF',bold:true,size:11};
s.getRange('A2:R2').merge();
s.getRange('A2').values=[['Fechas del 07 al 16/10 reconstruidas para el plan. Hecho = código incorporado a main. Fecha evidencia = fecha real del commit (Colombia).']];
s.getRange('A2:R2').format.font={name:'Carlito',size:11,color:'#526473',italic:true};
s.getRange('A2:R2').format.rowHeight=24;
const rows=tasks.map(t=>[t.id,t.sprint,t.title,t.owner,date(t.start),date(t.end),null,t.dep,t.result,t.status,...Array(8).fill(null),t.evidence?date(t.evidence):null,t.url,t.note]);
s.getRange(`A6:U${last}`).values=rows;
s.getRange(`E6:F${last}`).setNumberFormat('dd/mm/yyyy');
s.getRange(`S6:S${last}`).setNumberFormat('dd/mm/yyyy');
s.getRange(`G6:G${last}`).formulas=tasks.map((_,i)=>[`=F${i+6}-E${i+6}+1`]);
s.getRange('K5').formulas=[["='Resumen'!$B$4"]];
s.getRange('L5:R5').formulas=[Array.from({length:7},(_,i)=>`=${String.fromCharCode(75+i)}5+7`)];
s.getRange(`K6:R${last}`).formulas=tasks.map((_,i)=>Array.from({length:8},(_,j)=>`=IF(AND(${String.fromCharCode(75+j)}$5<=$F${i+6},${String.fromCharCode(75+j)}$5+6>=$E${i+6}),"■","")`));
s.getRange(`A6:U${last}`).format.rowHeight=62;
s.getRange(`A6:U${last}`).format.verticalAlignment='center';
s.getRange(`C6:D${last}`).format.wrapText=true;
s.getRange(`H6:I${last}`).format.wrapText=true;
s.getRange(`S6:U${last}`).format.font={name:'Carlito',size:11,color:'#526473'};
s.getRange(`S6:U${last}`).format.wrapText=true;
s.getRange(`S6:U${last}`).format.borders={bottom:{style:'thin',color:'#E4EAF0'}};
s.getRange(`K6:R${last}`).format.horizontalAlignment='center';
s.getRange(`K6:R${last}`).format.font={name:'Carlito',size:11,color:'#1F7887'};
s.getRange(`J6:J${last}`).format.wrapText=true;
s.getRange('C5').format.columnWidth=45;
s.getRange('H5').format.columnWidth=27;
s.getRange('I5').format.columnWidth=59;
s.getRange('S5').format.columnWidth=17;
s.getRange('T5').format.columnWidth=58;
s.getRange('U5').format.columnWidth=66;
s.getRange('A5:U5').format.rowHeight=34;
s.getRange('A5:U5').format.horizontalAlignment='center';
s.getRange(`J6:R${last}`).conditionalFormats.deleteAll();
s.getRange(`J6:J${last}`).dataValidation={rule:{type:'list',values:['Pendiente','En curso','En revisión','Hecho','Bloqueado']}};
s.getRange(`J6:J${last}`).conditionalFormats.addCustom('J6="Hecho"',{fill:'#E5F3EC',font:{color:'#246C4D'}});
s.getRange(`J6:J${last}`).conditionalFormats.addCustom('J6="Bloqueado"',{fill:'#FCE8E6',font:{color:'#9C302B'}});
s.getRange(`J6:J${last}`).conditionalFormats.addCustom('J6="En curso"',{fill:'#FFF1CB',font:{color:'#806016'}});
for(const [sp,color] of [['Sprint 1','#D5EEF2'],['Sprint 2','#DCE8F7'],['Sprint 3','#FCE6CB'],['Sprint 4','#E7E0F1']]){
 s.getRange(`K6:R${last}`).conditionalFormats.addCustom(`AND(K$5<=$F6,K$5+6>=$E6,$B6="${sp}")`,{fill:color});
}
s.freezePanes.freezeRows(5);
s.freezePanes.freezeColumns(3);
// Update the existing summary, retaining its sprint dates and eight-week horizon.
r.getRange('A2').values=[['Ingeniería de Software II. Avance de desarrollo al 16 de octubre de 2026']];
r.getRange('E8:H11').values=[
 ['Prototipo con ejercicios, editor, ejecución aislada, usuarios e interfaz','24 actividades de desarrollo incorporadas. Validación del prototipo pendiente','Ejecutar suites, probar registro/login y verificar ambos editores','Desarrollo redistribuido desde el 07/10. Evidencias reales entre el 13 y el 16/10.'],
 ['Evaluación oficial, persistencia de intentos e integración para producción','Versión desplegada y validada para pruebas de otros grupos','Pruebas de aceptación, humo, autenticación, aislamiento y persistencia','El original menciona entrega académica el 02 o 03/11. Fecha oficial por confirmar.'],
 ['Pruebas externas, correcciones y revisión de seguridad','Incidencias prioritarias corregidas y regresión verificada','Pruebas externas, adversariales y de regresión','Trabajo posterior a la entrega para pruebas, del 04 al 17/11.'],
 ['Estabilización, despliegue final y demostración','Versión estable y evidencias de funcionamiento','Regresión final, seguridad y verificación del despliegue','Cierre planificado de ocho semanas. No es fecha oficial confirmada.']
];
r.getRange('A8:H11').format.rowHeight=88;
r.getRange('E8:H11').format.wrapText=true;
r.getRange('A13').values=[['AVANCE DE DESARROLLO AL 16/10/2026']];
r.unmergeCells('A15:H15');
r.getRange('A14:H14').values=[['Actividades',null,'Hechas',null,'Pendientes',null,'Avance por tareas',null]];
r.getRange('B14').formulas=[[`=COUNTA('Cronograma'!A6:A${last})`]];
r.getRange('D14').formulas=[[`=COUNTIFS('Cronograma'!J6:J${last},"Hecho")`]];
r.getRange('F14').formulas=[[`=COUNTIFS('Cronograma'!J6:J${last},"Pendiente")`]];
r.getRange('H14').formulas=[['=D14/B14']];
r.getRange('H14').setNumberFormat('0%');
r.getRange('A14:H14').format.rowHeight=32;
r.getRange('A14:H14').format.font={name:'Carlito',size:11,color:'#15324A',bold:true};
for(const [row,text] of [
 [16,'Inicio del plan: 07/10/2026. Las fechas del desarrollo terminado se reconstruyeron para distribuirlo entre el 07 y el 16 de octubre.'],
 [17,'Hecho indica código incorporado a la rama main. La fecha real de cada evidencia está en Cronograma, columnas S a U, en hora de Colombia.'],
 [18,'Responsables previstos conservados del plan original. Las actividades nuevas se asignan como planificación y no acreditan autoría por commit.'],
 [19,'El porcentaje cuenta actividades, sin ponderar esfuerzo. No equivale al porcentaje funcional del producto ni a pruebas aprobadas.'],
 [21,'Pendientes principales: evaluación y puntuación, intentos en PostgreSQL, sesiones, validación con gVisor y despliegue.'],
 [23,'Repositorio: https://github.com/NicolasSsC/PyLevel (rama main). Corte de revisión: 16/10/2026, commit 37522da.']
]){
 r.mergeCells(`A${row}:H${row}`);r.getRange(`A${row}`).values=[[text]];
 r.getRange(`A${row}:H${row}`).format.font={name:'Carlito',size:11,color:'#526473'};
 r.getRange(`A${row}:H${row}`).format.rowHeight=26;
}
const completed=tasks.filter(t=>t.status==='Hecho').length;
r.getRange('F8').values=[[`${completed} actividades de desarrollo incorporadas. Validación del prototipo pendiente`]];
wb.recalculate();
// Independent consistency checks, plus a temporary edit to validate the live formulas.
if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw Error('IDs duplicados');
for(const t of tasks){
 if(t.start>t.end||t.start<'2026-10-07'||t.end>'2026-12-01')throw Error(`Fechas inválidas ${t.id}`);
 if(t.status==='Hecho'&&(!t.evidence||t.end>'2026-10-16'))throw Error(`Falta evidencia ${t.id}`);
 for(const dep of t.dep==='—'?[]:t.dep.split(', '))if(!tasks.some(x=>x.id===dep))throw Error(`Dependencia ausente ${dep}`);
}
const prior=s.getRange('F6').values[0][0];
s.getRange('F6').values=[[date('2026-10-09')]];
if(s.getRange('G6').values[0][0]!==3)throw Error('Duración no recalcula');
s.getRange('F6').values=[[prior]];
s.getRange('J6').values=[['Pendiente']];
if(r.getRange('D14').values[0][0]!==completed-1)throw Error('Resumen no recalcula');
s.getRange('J6').values=[['Hecho']];
wb.recalculate();
if(r.getRange('D14').values[0][0]!==completed)throw Error('Resumen no restaurado');
console.log(JSON.stringify({tasks:tasks.length,completed,pending:tasks.length-completed,last}));
console.log((await wb.inspect({kind:'table',range:'Resumen!A14:H14',include:'values,formulas',tableMaxRows:1,tableMaxCols:8,maxChars:2000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},summary:'Verificación final',maxChars:2000})).ndjson);
for(const [name,sheetName,range] of [
 ['resumen','Resumen','A1:H23'],
 ['desarrollo','Cronograma','A3:J29'],
 ['gantt','Cronograma',`J3:R${last}`],
 ['pendientes','Cronograma',`A30:J${last}`],
 ['evidencias','Cronograma','S3:U15']
]){
 const preview=await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile(new URL(`./${name}.png`,out),new Uint8Array(await preview.arrayBuffer()));
}
await fs.writeFile(new URL('./tasks.json',out),JSON.stringify(tasks,null,2));
const file=await SpreadsheetFile.exportXlsx(wb);
const finalPath=new URL('./PyLevel_Cronograma_corregido.xlsx',out).pathname.replace(/^\/([A-Z]:)/,'$1');
await file.save(finalPath);
// Validate dates and formulas after saving and reopening the deliverable.
const reopened=await SpreadsheetFile.importXlsx(await FileBlob.load(finalPath));
const savedSheet=reopened.worksheets.getItem('Cronograma');
for(let i=0;i<tasks.length;i++){
 const row=i+6,t=tasks[i];
 const vals=savedSheet.getRange(`E${row}:G${row}`).values[0];
 if(vals[0]!==date(t.start)||vals[1]!==date(t.end)||vals[2]!==date(t.end)-date(t.start)+1)throw Error(`Fechas exportadas incorrectas: ${t.id}`);
 if(t.evidence&&savedSheet.getRange(`S${row}`).values[0][0]!==date(t.evidence))throw Error(`Fecha evidencia incorrecta: ${t.id}`);
}
console.log((await reopened.inspect({kind:'table',range:'Cronograma!E5:G10',include:'values,formulas',tableMaxRows:6,tableMaxCols:3,maxChars:2000})).ndjson);
reopened.recalculate();
console.log((await reopened.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:20},maxChars:1000})).ndjson);
const savedPreview=await reopened.render({sheetName:'Cronograma',range:'C5:J12',scale:1.5,format:'png'});
await fs.writeFile(new URL('./fechas_verificadas.png',out),new Uint8Array(await savedPreview.arrayBuffer()));
console.log(`Archivo reabierto: ${tasks.length*2} fechas del plan y ${completed} fechas de evidencia verificadas.`);
