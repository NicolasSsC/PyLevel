import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const dir = new URL('./', import.meta.url);
const source = 'C:/Users/nicol/Downloads/PyLevel_Cronograma_corregido (1) (1).xlsx';
const finalPath = new URL('PyLevel_Cronograma_actualizado_18_octubre_2026.xlsx', dir).pathname.replace(/^\/([A-Za-z]:)/,'$1');
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const s = wb.worksheets.getItem('Cronograma'), summary = wb.worksheets.getItem('Resumen');
const baseline = s.getRange('A5:U48').values;
const existing = baseline.map((values,index)=>({values:[...values],sourceRow:index+5}));
const byId = new Map(existing.map(row=>[row.values[0],row]));
const serial = day => (Date.UTC(2026,9,day)-Date.UTC(1899,11,30))/86400000;
const main = 'https://github.com/NicolasSsC/PyLevel/commit/9fa0e3364caf6738155d004be4102d80c06eb284';
const camera = 'https://github.com/NicolasSsC/PyLevel/commit/cb83adbe8549d4ac6727db67c0486336e858872f';
const n = 'Nicolas Camacho', dev = 'Juan Carvajal / Camilo Jaimes', qa = 'Santiago Cuervo';
const appended = [];
function add(id,title,owner,start,end,dependencies,deliverable,note,url=main) {
  appended.push({values:[id,'Sprint 1',title,owner,serial(start),serial(end),end-start+1,dependencies,deliverable,'Hecho',...Array(8).fill(null),serial(18),url,note]});
}
const sessions = byId.get('AUTH-03');
Object.assign(sessions.values,{4:serial(17),5:serial(18),9:'Hecho',18:serial(18),19:main,
  8:'Sesiones opacas en PostgreSQL, cookies HttpOnly y SameSite, revocación, vencimiento y protección de acceso y origen',
  20:'Sesiones validadas en servidor. Pruebas de acceso, expiración, revocación y CSRF incorporadas y ejecutadas.'});
const persistence = byId.get('DB-01');
Object.assign(persistence.values,{1:'Sprint 1',2:'Persistir intentos, actividad y progreso en PostgreSQL',4:serial(17),5:serial(18),9:'Hecho',18:serial(18),19:main,
  8:'Migraciones SQL para sesiones, intentos de examen, respuestas, incidencias, perfil y actividad de práctica vinculada al usuario',
  20:'Adelantado del Sprint 2 al 17–18/10. Guardado con control de revisiones y plazo de servidor. La calificación oficial sigue pendiente en EVAL-01.'});
add('EXAM-01','Desarrollar la ventana de examen de Python',n,17,18,'AUTH-03, DB-01','Pantalla previa, tres retos de código, navegación por preguntas, revisión y confirmación de entrega','Examen de 30 minutos. Respuestas y entrega pendientes de revisión humana; no incluye calificación automática.');
add('EXAM-02','Implementar tiempo, autoguardado y recuperación del examen',n,17,18,'EXAM-01, DB-01','Plazo de servidor, guardado automático, recuperación local y resolución de conflictos entre pestañas','Volver a entrar no reinicia el tiempo. Entrega inmutable y rechazo de respuestas fuera de plazo.');
add('EXAM-03','Registrar salidas de pestaña y ventana durante el examen',n,17,18,'EXAM-01, DB-01','Avisos por pérdida de foco y visibilidad, señales de cierre y reconexión, registro sin duplicados','Las incidencias requieren revisión. Un cierre y una desconexión no se distinguen con certeza; no hay penalización automática.');
add('PERF-02','Actualizar y editar los datos personales del perfil',dev,18,18,'AUTH-03, DB-01, PERF-01','Nombre, ocupación, cumpleaños, correo y cierre de sesión con datos persistidos en PostgreSQL','El cambio de correo exige la contraseña actual y revoca otras sesiones. Se eliminaron los datos de perfil simulados.');
add('PERF-03','Mostrar el historial de exámenes en Mi perfil',dev,18,18,'PERF-02, EXAM-02','Lista de intentos, fechas, estados de entrega y calificación pendiente de revisión','El historial consulta los intentos de la cuenta autenticada. No muestra notas inventadas.');
add('PROG-01','Registrar la actividad real de los ejercicios',n,17,18,'DB-01, AUTH-03, UI-01, UI-02','Registro de ejecuciones, pruebas, pistas, ejercicios superados y errores técnicos por usuario','Las pruebas originales del servidor determinan la resolución. La consulta de pistas no descuenta puntos.');
add('PROG-02','Desarrollar Progreso y métricas con feedback de actividad',dev,18,18,'PROG-01, PERF-02','Ejercicios realizados, avance por temas y recomendaciones basadas en la actividad registrada','Feedback derivado de resultados, intentos, pistas y fallos técnicos. Sin métricas simuladas.');
add('HOME-01','Crear la portada con el logo de Python y sus aplicaciones',n,18,18,'UI-03, CAT-02','Hero con logo oficial, explicación de Python, IA, robótica, análisis de datos y desarrollo de aplicaciones','Incluye llamadas a los ejercicios y el cierre «Con Python, construye lo que te imagines».');
add('HOME-02','Añadir animaciones de scroll y navegación en la portada',n,18,18,'HOME-01, UI-04','Aparición de secciones, ilustraciones animadas, progreso de lectura y capítulos de navegación','Diseño adaptable y compatibilidad con movimiento reducido. Recursos visuales locales.');
add('CAM-01','Integrar permisos y procesamiento local de cámara',n,18,18,'EXAM-01, AUTH-03','Consentimiento, permiso del navegador, vista previa y detector local de rostros con MediaPipe en un Worker','No se graban ni se envían imágenes, vídeo o audio. Modelo y runtime servidos desde la app; alternativa por dificultad técnica o accesibilidad.',camera);
add('CAM-02','Detectar y registrar incidencias de cámara',n,18,18,'CAM-01, EXAM-03, DB-01','Avisos por ausencia sostenida, varios rostros e interrupciones, duración de episodios, reconexión y apagado al finalizar','Umbrales iniciales de 5 s sin rostro y 3 s con varios. Eventos sin duplicados y sin modificar la nota. Calibración con cámaras reales pendiente.',camera);
add('QA-APP','Verificar sesiones, cuenta, examen y control de cámara',qa,17,18,'AUTH-03, EXAM-02, PERF-02, PROG-02, HOME-02, CAM-02','Pruebas automatizadas de lógica y SQL, verificación HTTP, tipos, compilación y recorridos de navegador','24 pruebas automatizadas aprobadas y comprobación HTTP. Detector probado con cámara simulada. No sustituye la validación de Docker/runsc de QA-INT.',camera);
add('DOC-APP','Documentar los módulos y las migraciones incorporadas',n,18,18,'EXAM-03, PERF-03, PROG-02, HOME-02, CAM-02','Documentación de sesiones, examen, cuenta, portada, cámara y preparación de migraciones','Incluye límites de supervisión, procesamiento local, despliegue por HTTPS y conservación de eventos. No acredita despliegue en producción.',camera);

// Keep the original rows through 16/10 in their original order. Move only the
// two completed planned tasks into the new 17–18/10 block, before future work.
const historic = existing.slice(0,24);
const pending = existing.slice(24).filter(row=>!['AUTH-03','DB-01'].includes(row.values[0]));
byId.get('QA-INT').values[9]='En curso';
byId.get('QA-INT').values[20]='Validaciones de aplicación y HTTP ejecutadas en QA-APP. Sigue pendiente comprobar el supervisor con Docker y runsc y los recorridos completos del ejecutor.';
byId.get('SEC-PROD').values[9]='En curso';
byId.get('SEC-PROD').values[20]='API de práctica autenticada y protección de origen incorporadas el 17–18/10. Cola, cuotas y limpieza externa de contenedores para producción siguen pendientes.';
byId.get('PERF-01').values[20]='Versión inicial basada en actividad local. Ampliada a datos persistidos, historial SQL y métricas en PERF-02, PERF-03 y PROG-02 (18/10).';
byId.get('AUTH-01').values[20]='Registro validado con base temporal en las pruebas HTTP de QA-APP (17–18/10).';
byId.get('AUTH-02').values[20]='Sesión inicial reforzada y verificada en AUTH-03 (17–18/10).';
byId.get('UI-05').values[20]='Correcciones de textos incorporadas el 16/10. La nueva portada se registra en HOME-01 y HOME-02.';
byId.get('DB-02').values[20]='Acceso a datos ampliado con las migraciones de DB-01. Conexión y persistencia verificadas; despliegue de producción pendiente.';
const recent=[sessions,persistence,...appended];
const tasks=[...historic,...recent,...pending];
const last=tasks.length+4;
assert.equal(tasks.length,57);
assert.equal(new Set(tasks.map(t=>t.values[0])).size,57);

// Copy the existing pending rows bottom-up so their styles survive relocation.
for(let i=pending.length-1;i>=0;i--){
 const dest=5+historic.length+recent.length+i;
 s.getRange(`A${dest}:U${dest}`).copyFrom(s.getRange(`A${pending[i].sourceRow}:U${pending[i].sourceRow}`),'all');
}
for(let i=0;i<recent.length;i++){
 const row=29+i;
 s.getRange(`A${row}:U${row}`).copyFrom(s.getRange(`A${row%2?27:28}:U${row%2?27:28}`),'all');
 s.getRange(`A${row}:U${row}`).format.rowHeight=76;
}
for(let i=0;i<tasks.length;i++){
 const row=i+5;
 // Do not replace the historical formulas when updating their notes.
 if(i<24){ s.getRange(`U${row}`).values=[[tasks[i].values[20]]]; continue; }
 s.getRange(`A${row}:U${row}`).values=[tasks[i].values];
}
// The input uses shared formulas. Re-express the same formulas explicitly while
// extending their dependencies, so they remain live after import and export.
s.getRange(`G5:G${last}`).formulas=tasks.map((_,i)=>[`=F${i+5}-E${i+5}+1`]);
s.getRange('L4:R4').formulas=[Array.from({length:7},(_,i)=>`=${String.fromCharCode(75+i)}4+7`)];
s.getRange(`K5:R${last}`).formulas=tasks.map((_,i)=>Array.from({length:8},(_,j)=>`=IF(AND(${String.fromCharCode(75+j)}$4<=$F${i+5},${String.fromCharCode(75+j)}$4+6>=$E${i+5}),"■","")`));
s.getRange(`E29:F${last}`).setNumberFormat('dd/mm/yyyy');
s.getRange(`S29:S${last}`).setNumberFormat('dd/mm/yyyy');
// Fit the evidence columns to the date, commit URL and scope of the added work.
s.getRange('S4').format.columnWidth=17;
s.getRange('T4').format.columnWidth=58;
s.getRange('U4').format.columnWidth=66;
s.getRange('S2').values=[['EVIDENCIA DEL DESARROLLO AL 18/10/2026']];
s.getRange(`J5:R${last}`).conditionalFormats.deleteAll();
for(const [status,fill,color] of [['Hecho','#E5F3EC','#246C4D'],['Bloqueado','#FCE8E6','#9C302B'],['En curso','#FFF1CB','#806016']]) s.getRange(`J5:J${last}`).conditionalFormats.addCustom(`J5="${status}"`,{fill,font:{color}});
for(const [sprint,fill] of [['Sprint 1','#D5EEF2'],['Sprint 2','#DCE8F7'],['Sprint 3','#FCE6CB'],['Sprint 4','#E7E0F1']]) s.getRange(`K5:R${last}`).conditionalFormats.addCustom(`AND(K$4<=$F5,K$4+6>=$E5,$B5="${sprint}")`,{fill});
s.getRange(`J5:J${last}`).dataValidation={rule:{type:'list',values:['Pendiente','En curso','En revisión','Hecho','Bloqueado']}};
const done=tasks.filter(t=>t.values[9]==='Hecho').length;
assert.equal(done,39);
summary.getRange('A2').values=[['Ingeniería de Software II. Avance de desarrollo al 18 de octubre de 2026']];
summary.getRange('E8:H8').values=[[
 'Prototipo con ejercicios, examen, perfil, métricas, portada y control local de cámara',
 '39 actividades incorporadas. Sesiones y persistencia verificadas; validación del ejecutor pendiente',
 '24 pruebas automatizadas aprobadas, comprobación HTTP y pruebas de interfaz con cámara simulada',
 'Actualización del 17 al 18/10. Evidencia Git incorporada el 18/10. Pendiente validar Docker/runsc.'
]];
summary.getRange('E9').values=[['Calificación oficial, integración y preparación para producción']];
summary.getRange('A13').values=[['AVANCE DE DESARROLLO AL 18/10/2026']];
summary.getRange('B14').formulas=[[`=COUNTA('Cronograma'!A5:A${last})`]];
summary.getRange('D14').formulas=[[`=COUNTIFS('Cronograma'!J5:J${last},"Hecho")`]];
summary.getRange('E14').values=[['Por completar']];
summary.getRange('F14').formulas=[['=B14-D14']];
summary.getRange('A16').values=[['Se conserva el plan inicial. El avance de esta actualización se ubica entre el 17 y el 18/10/2026; sus evidencias Git corresponden al 18/10.']];
summary.getRange('A19').values=[['El avance cuenta tareas sin ponderar esfuerzo. Por completar incluye las actividades pendientes y en curso; no equivale al porcentaje funcional del producto.']];
summary.getRange('A21').values=[['Pendientes principales: calificación oficial y pruebas ocultas, validación con gVisor, cola y cuotas de producción, integración y despliegue.']];
summary.getRange('A23').values=[['Repositorio: https://github.com/NicolasSsC/PyLevel (rama main). Corte de revisión: 18/10/2026, commits 9fa0e33 y cb83adb.']];

// Test the extended formulas in-place and restore the inputs before delivery.
const probe=29;
const oldStatus=s.getRange(`J${probe}`).values[0][0];
s.getRange(`J${probe}`).values=[['Pendiente']];
assert.equal(summary.getRange('D14').values[0][0],done-1);
s.getRange(`J${probe}`).values=[[oldStatus]];
const oldEnd=s.getRange(`F${probe}`).values[0][0];
s.getRange(`F${probe}`).values=[[oldEnd+1]];
assert.equal(s.getRange(`G${probe}`).values[0][0],3);
s.getRange(`F${probe}`).values=[[oldEnd]];
wb.recalculate();
assert.equal(summary.getRange('B14').values[0][0],57);
assert.equal(summary.getRange('D14').values[0][0],39);
assert.equal(summary.getRange('F14').values[0][0],18);
assert.equal(summary.getRange('H14').values[0][0],39/57);
for(const [i,t] of tasks.entries()){
 const row=i+5, value=s.getRange(`E${row}:G${row}`).values[0];
 assert.equal(value[2],value[1]-value[0]+1);
 for(const dep of t.values[7]==='—'?[]:t.values[7].split(', ')) assert.ok(tasks.some(x=>x.values[0]===dep),`Missing dependency ${dep}`);
 if(recent.includes(t)){ assert.ok(value[0]>=serial(17)&&value[1]<=serial(18)); assert.equal(s.getRange(`S${row}`).values[0][0],serial(18)); }
}
console.log((await wb.inspect({kind:'table',range:'Resumen!A13:H14',include:'values,formulas',tableMaxRows:2,tableMaxCols:8,maxChars:2000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30},maxChars:1500})).ndjson);
for(const [name,sheetName,range,scale] of [
 ['resumen','Resumen','A1:H23',1],
 ['actualizacion','Cronograma','A29:J43',1.2],
 ['evidencias','Cronograma','S29:U43',1.1],
 ['gantt','Cronograma','J29:R44',1.2]
]){
 const image=await wb.render({sheetName,range,scale,format:'png'});
 await fs.writeFile(new URL(`${name}.png`,dir),new Uint8Array(await image.arrayBuffer()));
}
const output=await SpreadsheetFile.exportXlsx(wb); await output.save(finalPath);
const reopened=await SpreadsheetFile.importXlsx(await FileBlob.load(finalPath));
assert.equal(reopened.worksheets.items.length,2);
assert.deepEqual(reopened.worksheets.getItem('Resumen').getRange('B4:D4').values,summary.getRange('B4:D4').values);
assert.equal(reopened.worksheets.getItem('Resumen').getRange('D14').values[0][0],39);
for(let i=0;i<tasks.length;i++) assert.deepEqual(reopened.worksheets.getItem('Cronograma').getRange(`A${i+5}:J${i+5}`).values,s.getRange(`A${i+5}:J${i+5}`).values);
await fs.writeFile(new URL('updated-data.json',dir),JSON.stringify(tasks.map(t=>t.values),null,2));
console.log(JSON.stringify({output:finalPath,total:57,done:39,outstanding:18,added:13,completedExisting:2,period:'17–18/10/2026',evidence:'18/10/2026'}));
