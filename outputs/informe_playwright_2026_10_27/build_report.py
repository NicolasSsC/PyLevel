from pathlib import Path
from datetime import datetime, timezone, timedelta
from zipfile import ZipFile
from html import escape
import json, hashlib, sys
from PIL import Image as PILImage
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

sys.stdout.reconfigure(encoding='utf-8')
B=Path(__file__).parent; Q=B/'qa'; Q.mkdir(exist_ok=True)
R=json.loads((B/'results.json').read_text(encoding='utf-8'))
OUT=B/'PyLevel_Informe_de_pruebas_Playwright.docx'
W,H=595.276,841.89; M=46.8; CW=W-2*M
pdfmetrics.registerFont(TTFont('Arial',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold',r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold')
body=ParagraphStyle('Body',fontName='Arial',fontSize=10,leading=13,spaceAfter=7)
small=ParagraphStyle('Small',parent=body,fontSize=8.5,leading=11,spaceAfter=7)
head=ParagraphStyle('Heading',parent=body,fontName='ArialBold',fontSize=17,leading=21,spaceAfter=10)
title=ParagraphStyle('Title',parent=head,fontSize=24,leading=28,spaceAfter=9)
caption=ParagraphStyle('Caption',parent=small,fontSize=8.5,leading=11,spaceAfter=10)

doc=Document(); sec=doc.sections[0]
sec.page_width=Pt(W);sec.page_height=Pt(H)
sec.left_margin=sec.right_margin=sec.top_margin=sec.bottom_margin=Pt(M)
sec.header_distance=sec.footer_distance=Pt(20)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Caption']:
 s=doc.styles[name];s.font.name='Arial';s.font.color.rgb=RGBColor(0,0,0)
 s.paragraph_format.space_after=Pt(7);s.paragraph_format.line_spacing=Pt(13)
doc.styles['Normal'].font.size=Pt(10)
doc.styles['Title'].font.size=Pt(24);doc.styles['Title'].font.bold=True
doc.styles['Title'].paragraph_format.line_spacing=Pt(28)
doc.styles['Heading 1'].font.size=Pt(17);doc.styles['Heading 1'].font.bold=True
doc.styles['Heading 1'].paragraph_format.line_spacing=Pt(21)
doc.styles['Heading 1'].paragraph_format.space_before=Pt(0)
doc.styles['Caption'].font.size=Pt(8.5)
doc.styles['Caption'].paragraph_format.line_spacing=Pt(11)
doc.styles['Caption'].paragraph_format.space_after=Pt(10)
doc.styles['Caption'].font.italic=False
lang=OxmlElement('w:lang');lang.set(qn('w:val'),'es-CO');doc.styles['Normal']._element.get_or_add_rPr().append(lang)
header=sec.header.paragraphs[0];header.text='PyLevel   |   Verificación local con Playwright'
for r in header.runs:r.font.size=Pt(8);r.font.color.rgb=RGBColor(0,0,0)
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
footer.add_run('Página ').font.size=Pt(8)
f=OxmlElement('w:fldSimple');f.set(qn('w:instr'),'PAGE');footer._p.append(f)
story=[]; expected_text=[]; figures=[]

def p(text,style='Normal'):
 para=doc.add_paragraph(text,style)
 if style=='Caption':para.paragraph_format.keep_with_next=False
 story.append(Paragraph(escape(text),{'Normal':body,'Title':title,'Heading 1':head,'Caption':caption}.get(style,body)))
 expected_text.append(text)
 return para

def smallp(text):
 para=p(text)
 for r in para.runs:r.font.size=Pt(8.5)
 para.paragraph_format.line_spacing=Pt(11)
 story[-1]=Paragraph(escape(text),small)

def page():
 doc.add_page_break();story.append(PageBreak())

def table(headers,rows,widths):
 t=doc.add_table(rows=1,cols=len(headers));t.autofit=False;t.alignment=WD_TABLE_ALIGNMENT.CENTER
 widths=[x*CW for x in widths]
 for c,w in zip(t.columns,widths):c.width=Pt(w)
 pr=t._tbl.tblPr
 borders=OxmlElement('w:tblBorders')
 for side in ['top','left','bottom','right','insideH','insideV']:
  el=OxmlElement('w:'+side)
  for a,v in [('val','single'),('sz','4'),('color','D9D9D9')]:el.set(qn('w:'+a),v)
  borders.append(el)
 pr.append(borders)
 margins=OxmlElement('w:tblCellMar')
 for side,n in [('top',80),('bottom',80),('left',90),('right',90)]:
  el=OxmlElement('w:'+side);el.set(qn('w:w'),str(n));el.set(qn('w:type'),'dxa');margins.append(el)
 pr.append(margins)
 repeat=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(repeat)
 data=[]
 for ri,values in enumerate([headers]+rows):
  row=t.rows[0] if ri==0 else t.add_row()
  row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
  pdfrow=[]
  for ci,(cell,val,w) in enumerate(zip(row.cells,values,widths)):
   cell.width=Pt(w);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   cell.text=str(val);pa=cell.paragraphs[0]
   pa.paragraph_format.space_after=Pt(0);pa.paragraph_format.line_spacing=Pt(11.5)
   compact=w/CW<=.20
   pa.alignment=WD_ALIGN_PARAGRAPH.CENTER if compact else WD_ALIGN_PARAGRAPH.LEFT
   for r in pa.runs:
    r.font.size=Pt(9);r.font.bold=(ri==0)
    r.font.color.rgb=RGBColor(255,255,255) if ri==0 else RGBColor(0,0,0)
   sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'19384C' if ri==0 else ('F1F5F8' if ri%2==0 else 'FFFFFF'))
   cell._tc.get_or_add_tcPr().append(sh)
   st=ParagraphStyle('Cell',parent=body,fontSize=9,leading=11.5,spaceAfter=0,fontName='ArialBold' if ri==0 else 'Arial',textColor=colors.white if ri==0 else colors.black,alignment=1 if compact else 0)
   pdfrow.append(Paragraph(escape(str(val)),st))
  data.append(pdfrow)
 pdf=Table(data,colWidths=widths,repeatRows=1,hAlign='CENTER')
 commands=[('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#19384C')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),4.5),('RIGHTPADDING',(0,0),(-1,-1),4.5),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]
 for ri in range(2,len(data),2):commands.append(('BACKGROUND',(0,ri),(-1,ri),colors.HexColor('#F1F5F8')))
 pdf.setStyle(TableStyle(commands));story.extend([pdf,Spacer(1,8)])
 gap=doc.add_paragraph();gap.paragraph_format.space_after=Pt(2);gap.paragraph_format.line_spacing=Pt(2)

def fig(file,text,width=6.8):
 path=B/file
 assert path.exists(),path
 px=doc.add_paragraph();px.alignment=WD_ALIGN_PARAGRAPH.CENTER
 px.paragraph_format.space_after=Pt(4);px.paragraph_format.line_spacing=1
 px.paragraph_format.keep_with_next=True
 shape=px.add_run().add_picture(str(path),width=Inches(width))
 shape._inline.docPr.set('descr',text)
 pw,ph=PILImage.open(path).size
 im=Image(str(path),width=width*72,height=width*72*ph/pw)
 story.append(KeepTogether([im,Spacer(1,4),Paragraph(escape(text),caption)]))
 para=doc.add_paragraph(text,'Caption');expected_text.append(text)
 figures.append({'file':str(path.relative_to(B)),'caption':text,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})

p('Informe de pruebas de PyLevel','Title')
p('Ejecución de la aplicación y pruebas de Playwright','Heading 1')
smallp('27 de octubre de 2026 | Inicio a las 00:32:44 | Hora de Colombia UTC menos 5')
p('La aplicación compiló e inició correctamente en el entorno local de pruebas. Los 10 casos existentes de Playwright fueron aprobados en 29,68 segundos, sin reintentos. El resultado confirma los recorridos descritos en este informe; quedan funcionalidades fuera de esta suite.')
table(['Ejecutados','Aprobados','Fallidos','Omitidos','Inestables'],[['10','10','0','0','0']],[.2]*5)
fig('evidence/01_reporte_playwright.png','Figura 1. Reporte HTML de la ejecución actual con los diez casos aprobados.',6.7)
smallp('Destinatario: documentación y seguimiento del proyecto PyLevel. Las capturas corresponden a cuentas ficticias y datos de prueba. El resultado no corresponde al reporte histórico previamente guardado en el proyecto.')

page();p('Entorno y resultados por caso','Heading 1')
p('Se ejecutó la aplicación compilada por Astro, con PostgreSQL compatible en memoria mediante PGlite. El servidor y la base fueron administrados por el fixture de Playwright; los datos de prueba no se conservaron como datos de usuarios reales.')
table(['Componente','Condición utilizada'],[
 ['Navegador','Chromium 156.0.8078.4, sin ventana visible; Playwright 1.64.1.'],
 ['Aplicación y base','http://127.0.0.1:4341 y base temporal en el puerto 55441.'],
 ['Configuración','Un trabajador, idioma es-CO, zona America/Bogota y cero reintentos.'],
 ['Evidencia','Capturas y trazas activadas para todos los casos mediante una configuración auxiliar.'],
],[.24,.76])
labels=[('T01','Perfil sin sesión'),('T02','Progreso sin sesión'),('T03','Examen sin sesión'),('T04','Contraseña incorrecta'),('T05','Registro y ciclo de sesión'),('T06','Datos personales persistentes'),('T07','Progreso inicial'),('T08','Examen sin cámara'),('T09','Introducción y catálogo'),('T10','Inicio con ancho móvil')]
checks=[
 'Redirige al acceso y conserva el destino solicitado.',
 'Redirige al acceso y conserva el destino solicitado.',
 'Redirige al acceso y conserva el destino solicitado.',
 'Rechaza las credenciales y muestra el mensaje esperado.',
 'Registra, conserva sesión, verifica cookie, sale y vuelve a ingresar.',
 'Conserva nombre, ocupación y cumpleaños después de recargar.',
 'Muestra el estado inicial, feedback y enlace al catálogo.',
 'Exige consentimientos, guarda y recupera una respuesta y entrega.',
 'Permite saltar la introducción y acceder al catálogo.',
 'Muestra títulos y no desborda horizontalmente a 390 × 844.',
]
specs=[s for suite in R['suites'] for s in suite['specs']]
rows=[]
for (code,label),check,s in zip(labels,checks,specs):
 res=s['tests'][0]['results'][0]
 rows.append([code+' '+label,check,'Aprobado',f"{res['duration']/1000:.3f}".replace('.',',')])
table(['Caso','Verificación principal','Resultado','Segundos'],rows,[.27,.45,.16,.12])
smallp('Las duraciones individuales no se suman al tiempo total porque este incluye preparación y cierre. T01 a T07 pertenecen a account.spec.ts; T08 a exam.spec.ts; T09 y T10 a home.spec.ts.')

page();p('Evidencias de acceso y perfil','Heading 1')
p('Se verificó el rechazo de credenciales incorrectas y la persistencia de los datos personales. Las capturas muestran el estado visible; la conservación de datos se confirmó con aserciones posteriores a la recarga.')
fig('evidence/02_credenciales.png','Figura 2. T04. Mensaje de rechazo al ingresar una contraseña incorrecta. El HTTP 401 asociado es esperado.')
fig('evidence/03_perfil.png','Figura 3. T06. Nombre, ocupación y cumpleaños conservados después de recargar. La página aparece en la posición de desplazamiento usada por la prueba.')

page();p('Evidencias de evaluación','Heading 1')
p('T08 usó la alternativa de cámara no disponible. Se escribió una respuesta y se eliminó el borrador local antes de recargar, por lo que su recuperación comprobó el guardado en el servidor. Después se entregó el examen y se verificó el estado pendiente de revisión en el perfil.')
fig('evidence/05_examen_respuesta.jpeg','Figura 4. T08. Respuesta escrita durante el examen. Fotograma original de la traza anterior a la recarga.')
fig('evidence/06_examen_entregado.jpeg','Figura 5. T08. Examen entregado con una de tres respuestas y evaluación pendiente. La incidencia de cámara corresponde a la dificultad declarada; no demuestra detección de rostros.')

page();p('Evidencias de progreso y navegación','Heading 1')
p('Una cuenta nueva presenta su estado inicial de progreso y puede llegar al catálogo. Estas comprobaciones cubren el ingreso a las pantallas; la suite no resuelve ejercicios ni calcula métricas después de practicar.')
fig('evidence/04_progreso.jpeg','Figura 6. T07. Estado inicial de progreso de una cuenta sin actividad. Fotograma original de la traza; el test verifica los textos del estado inicial y el enlace al catálogo.')
fig('evidence/07_catalogo.png','Figura 7. T09. Catálogo alcanzado desde el inicio después de saltar la introducción. No se ejecutaron soluciones Python.')

page();p('Comprobación visual en ancho móvil','Heading 1')
p('T10 aprobó la comprobación de ausencia de desbordamiento horizontal a 390 × 844 píxeles. Su captura automática se tomó durante la animación de entrada de una sección, cuando el texto todavía tenía poca opacidad. La visibilidad usada por el test no equivale a una comprobación de legibilidad final.')
p('La comprobación complementaria aprobó con el mismo recorrido y una espera de 1,5 segundos. La opacidad del contenedor pasó de 0 a 1 y el ancho del documento permaneció en 390 píxeles, sin desbordamiento. El texto resultó legible. Esta prueba adicional se cuenta por separado de los diez casos originales.')
fig('mobile-check/mobile-settled.png','Figura 8. Inicio con ventana de 390 × 844 después de la espera adicional. Captura de la comprobación complementaria; no corresponde a un dispositivo móvil físico.',2.8)
smallp('Mejora propuesta para QA: esperar a que termine la animación antes de capturar la pantalla y agregar comprobaciones visuales estables. La espera usada aquí permite documentar el estado observado; no constituye una prueba de rendimiento ni una regresión visual con imágenes de referencia.')

page();p('Hallazgos y próximos pasos','Heading 1')
p('No se detectaron fallos funcionales en las aserciones ejecutadas. Las diez trazas contienen 141 registros HTTP: 132 respuestas 200, cuatro 201, cuatro 302 y un 401. No se registraron respuestas 5xx ni fallos de transporte. El único error de consola corresponde al rechazo intencional de la contraseña incorrecta.')
p('El primer arranque dentro del entorno restringido compiló la aplicación, pero la conexión local devolvió EACCES. Se interrumpió ese intento y la ejecución completa se realizó con acceso autorizado al servidor local. Las advertencias NO_COLOR y FORCE_COLOR no impidieron completar las pruebas.')
table(['Prioridad','Cobertura que conviene agregar'],[
 ['Alta','Ejecutar, probar y detener Python con el runner real; verificar resultados y registro de progreso.'],
 ['Alta','Exámenes con vencimiento, intento único, desconexión, conflictos entre pestañas y rechazo de cambios después de entregar.'],
 ['Alta','Permisos de cámara, detección real de rostros, incidencias y cierre del dispositivo.'],
 ['Media','Métricas e historial con actividad; editores y examen en móvil; otros navegadores y capturas posteriores a las animaciones.'],
],[.16,.84])
p('No se probaron en esta ejecución el panel administrador pendiente, el servicio de IA, el despliegue en producción, la carga concurrente ni la seguridad integral. Tampoco se ejecutaron las pruebas unitarias o el análisis de tipos. La tasa de aprobación de esta suite no mide la cobertura total del proyecto.')
p('Trazabilidad y reproducción','Heading 1')
smallp('Fuentes: playwright.config.ts; tests/e2e/server.mjs; tests/e2e/account.spec.ts; tests/e2e/exam.spec.ts; tests/e2e/home.spec.ts; results.json; execution-authorized.log; diez archivos trace.zip y sus capturas. El manifiesto evidence-manifest.json conserva el origen de las imágenes extraídas.')
smallp('Desde C:\\programming\\pyLevel\\pyLevel, la suite habitual se ejecuta con pnpm test:e2e. Para conservar capturas de todos los casos como en este informe: pnpm exec playwright test --config ../outputs/informe_playwright_2026_10_27/run.config.ts. La comprobación móvil complementaria y sus resultados están en la subcarpeta mobile-check.')
smallp('Los archivos del informe, la configuración auxiliar, el reporte HTML, los resultados JSON y las trazas se conservan en outputs/informe_playwright_2026_10_27. El código de la aplicación y las pruebas originales no se modificaron para esta revisión.')

doc.core_properties.title='Informe de pruebas de PyLevel'
doc.core_properties.subject='Ejecución de Playwright y evidencia visual del 27 de octubre de 2026'
doc.core_properties.author='';doc.core_properties.last_modified_by=''
doc.save(OUT)
check=Document(OUT)
allp=[p.text for p in check.paragraphs]
assert all(t in allp for t in expected_text)
assert len(check.inline_shapes)==8
with ZipFile(OUT) as f:
 media=[n for n in f.namelist() if n.startswith('word/media/')]
 assert len(media)==8
 source_hashes={i['sha256'] for i in figures}
 embedded_hashes={hashlib.sha256(f.read(n)).hexdigest() for n in media}
 assert source_hashes==embedded_hashes

def footer_pdf(c,d):
 c.setFont('Arial',8);c.drawString(M,H-26,'PyLevel   |   Verificación local con Playwright')
 c.drawRightString(W-M,22,f'Página {d.page}')
pdf=SimpleDocTemplate(str(Q/'preview.pdf'),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=M,bottomMargin=M)
pdf.build(story,onFirstPage=footer_pdf,onLaterPages=footer_pdf)
pages=PdfReader(Q/'preview.pdf').pages
(Q/'figures.json').write_text(json.dumps(figures,ensure_ascii=False,indent=2),encoding='utf-8')
validation={'output':str(OUT),'images':len(check.inline_shapes),'embedded_images_identical_to_evidence':True,'text_roundtrip':True,'preview_pages':len(pages),'native_word_render_verified':False,'passed':R['stats']['expected'],'failed':R['stats']['unexpected']}
(Q/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(validation,ensure_ascii=False,indent=2))
