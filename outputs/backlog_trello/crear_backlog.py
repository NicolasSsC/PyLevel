from pathlib import Path
from io import BytesIO
from html import escape
import json
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE=Path(__file__).parent
QA=BASE/'qa'
QA.mkdir(parents=True,exist_ok=True)
OUT=BASE/'PyLevel_Backlog_para_Trello.docx'

# Transcripción de la lista aprobada en la conversación. No se reclasifican tareas.
DATA='''Definir el alcance final del proyecto|General|Alta|Hecho
Organizar las tareas por sprint|General|Alta|Pendiente
Actualizar la especificación de requisitos|Documentación|Alta|Parcial
Documentar las historias de usuario y sus requerimientos|Documentación|Alta|Hecho
Actualizar los diagramas y casos de uso|Documentación|Media|Pendiente
Elaborar el manual de usuario|Documentación|Media|Pendiente
Documentar la instalación y configuración|Documentación|Media|Hecho
Diseñar las pantallas y los recorridos principales|UX/UI|Alta|Parcial
Unificar colores, tipografía y componentes|UX/UI|Media|Hecho
Adaptar las pantallas a diferentes tamaños|UX/UI|Media|Hecho
Mejorar los mensajes de error y confirmación|UX/UI|Media|Hecho
Crear y actualizar la estructura de la base de datos|DB|Alta|Parcial
Guardar usuarios, perfiles y sesiones|DB|Alta|Hecho
Guardar ejercicios, preguntas y pruebas en la base de datos|DB|Alta|Pendiente
Guardar intentos, respuestas y resultados de exámenes|DB|Alta|Parcial
Guardar la actividad y el progreso de práctica|DB|Alta|Hecho
Definir la conservación y eliminación de incidencias|DB|Alta|Pendiente
Construir la página de inicio y la navegación|Front|Media|Hecho
Crear los formularios de registro e inicio de sesión|Front|Alta|Hecho
Implementar el registro y la autenticación|Back|Alta|Hecho
Gestionar el vencimiento y cierre de sesiones|Back|Alta|Hecho
Bloquear temporalmente los intentos fallidos de acceso|Back|Alta|Pendiente
Controlar los permisos de Estudiante y Administrador|Back|Alta|Parcial
Crear la pantalla de consulta y edición del perfil|Front|Media|Hecho
Validar los cambios de datos personales y correo|Back|Alta|Hecho
Mostrar el catálogo de ejercicios clásicos y contextualizados|Front|Alta|Hecho
Implementar los filtros del catálogo|Front|Media|Hecho
Mostrar enunciados, ejemplos y resultados esperados|Front|Alta|Hecho
Implementar el editor de código y la navegación entre archivos|Front|Alta|Hecho
Guardar y recuperar borradores en el navegador|Front|Alta|Hecho
Permitir restablecer los archivos de un ejercicio|Front|Media|Hecho
Mostrar pistas y soluciones de referencia|Front|Media|Hecho
Implementar la animación de Bubble Sort|Front|Baja|Hecho
Configurar el entorno aislado para ejecutar Python|Back|Alta|Hecho
Conectar el editor con el servicio de ejecución|API|Alta|Hecho
Ejecutar las pruebas públicas originales de cada ejercicio|Back|Alta|Hecho
Mostrar la salida, los errores y el estado de ejecución|Front|Alta|Hecho
Permitir detener una ejecución|API|Alta|Hecho
Registrar intentos y reconocer ejercicios superados|Back|Alta|Hecho
Mostrar el progreso, la actividad y el avance por temas|Front|Alta|Hecho
Generar recomendaciones según la práctica registrada|Back|Media|Hecho
Crear la interfaz de conversación con PyBot|Front|Media|Hecho
Conectar PyBot con el servicio de inteligencia artificial|API|Media|Hecho
Enviar el contexto del ejercicio a PyBot|API|Media|Hecho
Generar ejercicios por tema y dificultad|API|Media|Parcial
Cargar los ejercicios generados en el editor|Front|Alta|Pendiente
Validar y registrar la práctica de ejercicios generados|Back|Alta|Pendiente
Crear la pantalla del examen|Front|Alta|Hecho
Gestionar un intento por cuenta y versión del examen|Back|Alta|Hecho
Controlar el tiempo y el vencimiento del examen|Back|Alta|Hecho
Guardar, recuperar y sincronizar las respuestas|API|Alta|Hecho
Resolver conflictos de respuestas entre pestañas|Back|Alta|Hecho
Gestionar la entrega y bloquear cambios posteriores|Back|Alta|Hecho
Registrar salidas de pestaña y pérdidas de foco|Back|Alta|Hecho
Mostrar avisos y el resumen de incidencias|Front|Media|Hecho
Solicitar consentimiento y activar la cámara|Front|Alta|Hecho
Ofrecer una alternativa ante dificultades con la cámara|Front|Alta|Hecho
Detectar y registrar incidencias de presencia|Front|Alta|Hecho
Detener la cámara al finalizar o retirar el consentimiento|Front|Alta|Hecho
Incorporar preguntas de opción múltiple al examen|Front|Media|Pendiente
Validar las respuestas y calcular la calificación del examen|Back|Alta|Pendiente
Generar reportes de resultados y aspectos por reforzar|Back|Alta|Pendiente
Mostrar el historial y comparar evaluaciones|Front|Media|Parcial
Generar rutas de estudio con recursos recomendados|Back|Media|Pendiente
Construir el panel de administración|Front|Alta|Pendiente
Permitir registrar, editar e inactivar preguntas|Back|Alta|Pendiente
Validar las preguntas y sus casos de prueba|Back|Alta|Pendiente
Administrar recursos de estudio y explicaciones de errores|Back|Media|Pendiente
Probar registro, sesiones, permisos y perfil|QA|Alta|Parcial
Probar editores, borradores y ejecución real de Python|QA|Alta|Parcial
Probar PyBot y los ejercicios generados|QA|Alta|Pendiente
Probar el examen, su guardado y su entrega|QA|Alta|Parcial
Probar la cámara y sus alternativas con dispositivos reales|QA|Alta|Parcial
Comprobar que cada cuenta acceda únicamente a sus datos|QA|Alta|Parcial
Revisar accesibilidad y navegación por teclado|QA|Media|Pendiente
Medir rendimiento y disponibilidad|QA|Alta|Pendiente
Realizar pruebas de aceptación con usuarios|QA|Alta|Pendiente
Preparar la aplicación para producción|Despliegue|Alta|Parcial
Desplegar el ejecutor con control de acceso y capacidad|Despliegue|Alta|Pendiente
Configurar el dominio, HTTPS y las variables de entorno|Despliegue|Alta|Pendiente
Configurar copias de seguridad y recuperación|Despliegue|Alta|Pendiente
Publicar y verificar la versión final|Despliegue|Alta|Pendiente
Implementar insignias y puntos opcionales|Back|Baja|Pendiente'''
ROWS=[line.split('|') for line in DATA.splitlines()]
assert all(len(r)==4 for r in ROWS)
assert len(set(r[0] for r in ROWS))==len(ROWS)

TITLE='Backlog de PyLevel'
INTRO='Cada fila corresponde a una tarjeta de Trello e incluye la tarea, su etiqueta, prioridad y estado. Hecho indica que existe implementación; las pruebas finales y el despliegue se registran por separado.'
LEGEND='Estados: Hecho, Parcial y Pendiente. Prioridades: Alta, Media y Baja.'
NOTES=[
    'Las tareas de QA marcadas como parciales ya tienen pruebas automatizadas o cobertura de algunas funciones, pero falta confirmar la validación completa.',
    'El historial de exámenes ya funciona; la comparación y los resultados calificados siguen pendientes.',
]
HEADERS=['Qué se debe hacer','Etiqueta','Prioridad','Estado']
WIDTHS=[4.06,1.10,0.80,0.91]
BLUE='234B68'
STATUS={'Hecho':'21613B','Parcial':'805B00','Pendiente':'555555'}

def shade(cell,color):
    pr=cell._tc.get_or_add_tcPr()
    el=pr.find(qn('w:shd'))
    if el is None:el=OxmlElement('w:shd');pr.append(el)
    el.set(qn('w:fill'),color)

doc=Document()
sec=doc.sections[0]
sec.page_width=Inches(8.27);sec.page_height=Inches(11.69)
sec.left_margin=sec.right_margin=Inches(0.7)
sec.top_margin=sec.bottom_margin=Inches(0.65)
sec.header_distance=sec.footer_distance=Inches(0.3)
for name in ['Normal','Title','Heading 1','Heading 2']:
    sty=doc.styles[name]
    sty.font.name='Arial';sty.font.color.rgb=RGBColor(0,0,0)
normal=doc.styles['Normal'];normal.font.size=Pt(10)
normal.paragraph_format.space_after=Pt(6)
normal.paragraph_format.line_spacing=1.1
title=doc.styles['Title'];title.font.size=Pt(22);title.font.bold=True
title.paragraph_format.space_after=Pt(10)
doc.add_paragraph(TITLE,'Title')
doc.add_paragraph(INTRO)
doc.add_paragraph(LEGEND)

table=doc.add_table(rows=1,cols=4)
table.alignment=WD_TABLE_ALIGNMENT.CENTER
table.autofit=False
for col,width in zip(table.columns,WIDTHS):col.width=Inches(width)
pr=table._tbl.tblPr
borders=OxmlElement('w:tblBorders')
for side in ['top','left','bottom','right','insideH','insideV']:
    el=OxmlElement('w:'+side)
    for attr,value in [('val','single'),('sz','4'),('color','D9D9D9')]:el.set(qn('w:'+attr),value)
    borders.append(el)
pr.append(borders)
margins=OxmlElement('w:tblCellMar')
for side,value in [('top',85),('bottom',85),('left',100),('right',100)]:
    el=OxmlElement('w:'+side);el.set(qn('w:w'),str(value));el.set(qn('w:type'),'dxa');margins.append(el)
pr.append(margins)

def fill_row(row,values,index=None):
    row.height=None
    row_pr=row._tr.get_or_add_trPr()
    cant=OxmlElement('w:cantSplit');row_pr.append(cant)
    for i,(cell,value,width) in enumerate(zip(row.cells,values,WIDTHS)):
        cell.width=Inches(width);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
        cell.text=value
        p=cell.paragraphs[0]
        p.paragraph_format.space_before=Pt(0);p.paragraph_format.space_after=Pt(0)
        p.paragraph_format.line_spacing=1.05
        p.alignment=WD_ALIGN_PARAGRAPH.LEFT if i==0 else WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.font.name='Arial';run.font.size=Pt(9.5)
            if index is None:
                run.font.bold=True;run.font.color.rgb=RGBColor(255,255,255)
            elif i==3:
                run.font.bold=True;run.font.color.rgb=RGBColor.from_string(STATUS[value])
        shade(cell,BLUE if index is None else ('F1F5F8' if index%2 else 'FFFFFF'))

fill_row(table.rows[0],HEADERS)
repeat=OxmlElement('w:tblHeader');table.rows[0]._tr.get_or_add_trPr().append(repeat)
for i,values in enumerate(ROWS):fill_row(table.add_row(),values,i)
doc.add_paragraph('')
for note in NOTES:doc.add_paragraph(note)

footer=sec.footer.paragraphs[0]
footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=footer.add_run('Página ');r.font.name='Arial';r.font.size=Pt(8)
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
doc.core_properties.title=TITLE
doc.core_properties.subject='Tareas, etiquetas, prioridades y estados para Trello'
doc.core_properties.author=''
doc.core_properties.last_modified_by=''
doc.save(OUT)

# Round-trip check of every value in the requested table.
check=Document(OUT)
assert len(check.tables)==1
actual=[[cell.text for cell in row.cells] for row in check.tables[0].rows]
assert actual==[HEADERS]+ROWS

# Alternative layout preview using the same Arial font, column widths and values.
# This is not a native Word rendering; render_docx.py is attempted separately.
pdfmetrics.registerFont(TTFont('ArialPreview',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialPreviewBold',r'C:\Windows\Fonts\arialbd.ttf'))
sty=ParagraphStyle('Body',fontName='ArialPreview',fontSize=10,leading=11,spaceAfter=6)
cellstyle=ParagraphStyle('Cell',fontName='ArialPreview',fontSize=9.5,leading=9.975)
story=[Paragraph(TITLE,ParagraphStyle('Title',parent=sty,fontName='ArialPreviewBold',fontSize=22,leading=26,spaceAfter=10)),
       Paragraph(INTRO,sty),Paragraph(LEGEND,sty),Spacer(1,4)]
data=[]
for ri,row in enumerate([HEADERS]+ROWS):
    vals=[]
    for ci,value in enumerate(row):
        cs=ParagraphStyle('x',parent=cellstyle,alignment=0 if ci==0 else 1)
        if ri==0:cs.fontName='ArialPreviewBold';cs.textColor=colors.white
        elif ci==3:cs.fontName='ArialPreviewBold';cs.textColor=colors.HexColor('#'+STATUS[value])
        vals.append(Paragraph(escape(value),cs))
    data.append(vals)
t=Table(data,colWidths=[w*72 for w in WIDTHS],repeatRows=1,hAlign='CENTER')
commands=[('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D9D9D9')),
    ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#'+BLUE)),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),
    ('TOPPADDING',(0,0),(-1,-1),4.25),('BOTTOMPADDING',(0,0),(-1,-1),4.25)]
for ri in range(1,len(data)):
    if (ri-1)%2:commands.append(('BACKGROUND',(0,ri),(-1,ri),colors.HexColor('#F1F5F8')))
t.setStyle(TableStyle(commands));story.append(t);story.append(Spacer(1,10))
for note in NOTES:story.append(Paragraph(note,sty))
pdf=SimpleDocTemplate(str(QA/'previsualizacion.pdf'),pagesize=(8.27*72,11.69*72),
    leftMargin=.7*72,rightMargin=.7*72,topMargin=.65*72,bottomMargin=.65*72)
def page_number(c,d):
    c.setFont('ArialPreview',8);c.drawRightString(8.27*72-.7*72,.3*72,f'Página {d.page}')
pdf.build(story,onFirstPage=page_number,onLaterPages=page_number)
from pypdf import PdfReader
report={'output':str(OUT),'tasks':len(ROWS),'states':{s:sum(r[3]==s for r in ROWS) for s in STATUS},
    'round_trip':'All table values match the approved list','preview_pages':len(PdfReader(QA/'previsualizacion.pdf').pages),
    'native_pagination_verified':False}
(QA/'verificacion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
