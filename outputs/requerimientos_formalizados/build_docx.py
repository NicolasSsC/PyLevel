"""Clone the supplied OOXML tables, preserving every other package part."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from copy import deepcopy
from html import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
import hashlib, json, re
from contenido import groups, INTRO, SCOPE

BASE=Path(__file__).parent
REF=Path(r'C:\Users\nicol\Downloads\formatos.docx')
OUT=BASE/'PyLevel_Requerimientos_nuevos_y_actualizados.docx'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W14='http://schemas.microsoft.com/office/word/2010/wordml'
ns={'w':W}
def q(name): return '{'+W+'}'+name
inventory=json.loads((BASE/'qa'/'template-inventory.json').read_text(encoding='utf-8'))
assert hashlib.sha256(REF.read_bytes()).hexdigest() in (BASE/'artifact.md').read_text(encoding='utf-8')
with ZipFile(REF) as z:
    root=E.fromstring(z.read('word/document.xml'))
body=root.find(q('body'))
hu_source,rf_source=[deepcopy(t) for t in body.findall(q('tbl'))]
# The reference stores fractional twips in integer-only OOXML width attributes.
# Round by less than half a twip so readers accept the original geometry.
for source_table in [hu_source,rf_source]:
    for el in source_table.iter():
        for attr,value in list(el.attrib.items()):
            if attr==q('w') and re.fullmatch(r'\d+\.\d+',value):el.set(attr,str(round(float(value))))
section=deepcopy(body.find(q('sectPr')))
for el in list(body): body.remove(el)

pdfmetrics.registerFont(TTFont('PreviewArial',r'C:\Windows\Fonts\arial.ttf'))
style=ParagraphStyle('measure',fontName='PreviewArial',fontSize=10.5,leading=12.6,spaceBefore=0,spaceAfter=0)
def measure(text,width):
    return Paragraph(escape(text).replace('\n','<br/>'),style).wrap(width,10000)[1]

def set_text(cell,text):
    p0=cell.find(q('p'))
    p_template=deepcopy(p0)
    for child in list(cell):
        if child.tag!=q('tcPr'): cell.remove(child)
    for line in text.split('\n'):
        p=deepcopy(p_template)
        r0=p.find(q('r'))
        rpr=deepcopy(r0.find(q('rPr'))) if r0 is not None and r0.find(q('rPr')) is not None else None
        for child in list(p):
            if child.tag!=q('pPr'): p.remove(child)
        r=E.SubElement(p,q('r'))
        if rpr is not None:r.append(rpr)
        t=E.SubElement(r,q('t'));t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');t.text=line
        cell.append(p)

def cells(table,row): return table.findall(q('tr'))[row].findall(q('tc'))
def hu(g):
    t=deepcopy(hu_source)
    set_text(cells(t,0)[1],g['source']);set_text(cells(t,0)[2],f"HU-{g['code']:02d}")
    set_text(cells(t,1)[1],g['story']);set_text(cells(t,3)[0],g['need'])
    set_text(cells(t,5)[0],'\n'.join(r['code']+' '+r['title'] for r in g['requirements']))
    return t
def requirement(r):
    t=deepcopy(rf_source)
    set_text(cells(t,0)[1],r['code']+' — '+r['title'])
    set_text(cells(t,1)[1],r['summary']);set_text(cells(t,3)[0],r['inputs']);set_text(cells(t,5)[0],r['results'])
    return t

def table_row_heights(t):
    grid=[float(c.get(q('w')))/20 for c in t.find(q('tblGrid')).findall(q('gridCol'))]
    heights=[]
    for tr in t.findall(q('tr')):
        h=tr.find('./'+q('trPr')+'/'+q('trHeight'))
        height=float(h.get(q('val')))/20 if h is not None else 0
        col=0
        for tc in tr.findall(q('tc')):
            span=tc.find('./'+q('tcPr')+'/'+q('gridSpan'))
            span=int(span.get(q('val'))) if span is not None else 1
            width=sum(grid[col:col+span])-11.5
            ps=tc.findall(q('p'))
            text='\n'.join(''.join(p.itertext()) if False else ''.join(p.xpath('.//w:t/text()',namespaces=ns)) for p in ps)
            height=max(height,measure(text,width)+3)
            col+=span
        heights.append(height)
    return heights

def keep_table(t):
    paras=t.findall('.//'+q('p'))
    for p in paras:
        pp=p.find(q('pPr'))
        if pp is None: pp=E.Element(q('pPr'));p.insert(0,pp)
        for name in ['keepNext','keepLines']:
            el=pp.find(q(name))
            if el is None:el=E.SubElement(pp,q(name))
            el.set(q('val'),'1' if name=='keepLines' or p is not paras[-1] else '0')
    for row in t.findall(q('tr')):
        pp=row.find(q('trPr'))
        if pp is None:pp=E.Element(q('trPr'));row.insert(0,pp)
        el=pp.find(q('cantSplit'))
        if el is None:el=E.SubElement(pp,q('cantSplit'))
        el.set(q('val'),'1')

def paragraph(text='',role='Normal',size=10.5,before=0,after=6,keep=False):
    p=E.Element(q('p'));pp=E.SubElement(p,q('pPr'))
    E.SubElement(pp,q('pStyle')).set(q('val'),role)
    spacing=E.SubElement(pp,q('spacing'))
    for key,val in [('before',before*20),('after',after*20),('line',240)]:spacing.set(q(key),str(int(val)))
    spacing.set(q('lineRule'),'auto')
    E.SubElement(pp,q('keepNext')).set(q('val'),'1' if keep else '0')
    E.SubElement(pp,q('keepLines')).set(q('val'),'1')
    r=E.SubElement(p,q('r'));rp=E.SubElement(r,q('rPr'))
    fonts=E.SubElement(rp,q('rFonts'))
    for key in ['ascii','hAnsi','cs','eastAsia']:fonts.set(q(key),'Aptos')
    E.SubElement(rp,q('sz')).set(q('val'),str(int(size*2)))
    E.SubElement(rp,q('color')).set(q('val'),'000000')
    E.SubElement(r,q('t')).text=text
    return p

pages=[]
current=[]
used=0
CAPACITY=(16834-2880)/20-34
def flush():
    global current,used
    if current:pages.append(current)
    current=[];used=0
def add_text(text,role='Normal',size=10.5,after=7,keep=False):
    global used
    width=(11909-2880)/20
    height=measure(text,width)*(size/10.5)+after+3
    current.append({'type':'p','text':text,'role':role,'size':size,'after':after,'keep':keep,'height':height})
    used+=height
def add_card(t,title=None,tag=None):
    global used
    heights=table_row_heights(t)
    # Explicit page planning leaves room for Word's font substitution and layout rounding.
    height=sum(heights)*1.11+10+(32 if title else 0)
    if current and used+height>CAPACITY:flush()
    if title:add_text(title,'Heading2',12,6,True)
    keep_table(t)
    current.append({'type':'table','xml':t,'heights':heights,'height':sum(heights)*1.11+10,'tag':tag})
    used+=sum(heights)*1.11+10

add_text('PyLevel Requerimientos nuevos y actualizados','Title',26,12,True)
for text in INTRO:add_text(text)
add_text('Actualización del alcance','Heading2',16,8,True)
for text in SCOPE:add_text(text)
flush()

add_text('Historias de usuario nuevas','Heading2',16,10,True)
for g in groups:
    if g['kind']=='nuevo':add_card(hu(g),f"HU {g['code']:02d} {g['title']}",f"HU-{g['code']:02d}")
flush()
add_text('Historias de usuario actualizadas','Heading2',16,10,True)
add_text('Las siguientes fichas complementan las historias existentes. HU 06 sustituye la formulación anterior de clasificación por rangos fijos.')
for g in groups:
    if g['kind']!='nuevo':add_card(hu(g),f"HU {g['code']:02d} {g['title']}",f"HU-{g['code']:02d}")
flush()

add_text('Requerimientos funcionales nuevos','Heading2',16,10,True)
for g in groups:
    if g['kind']=='nuevo':
        for i,r in enumerate(g['requirements']):
            add_card(requirement(r),f"RF {g['code']:02d} {g['title']}" if i==0 else None,r['code'])
flush()
add_text('Requerimientos funcionales actualizados','Heading2',16,10,True)
add_text('RF 06 contiene fichas de reemplazo. Los demás requisitos de esta sección se agregan a los grupos existentes y conservan los requisitos originales no afectados.')
for g in groups:
    if g['kind']!='nuevo':
        for i,r in enumerate(g['requirements']):
            add_card(requirement(r),f"RF {g['code']:02d} {g['title']}" if i==0 else None,r['code'])
flush()

# All formatting outside document.xml remains byte-identical to the template.
for i,page in enumerate(pages):
    if i:
        p=paragraph('',after=0,size=1)
        E.SubElement(p.find(q('pPr')),q('pageBreakBefore')).set(q('val'),'1')
        body.append(p)
    for block in page:
        if block['type']=='p':body.append(paragraph(block['text'],block['role'],block['size'],after=block['after'],keep=block['keep']))
        else:
            body.append(block['xml'])
            body.append(paragraph('',size=1,after=8))
body.append(section)
for i,p in enumerate(root.findall('.//'+q('p')),1):p.set('{'+W14+'}paraId',f'{i:08X}')
xml=E.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
with ZipFile(REF) as zin,ZipFile(OUT,'w') as zout:
    for part in zin.infolist():zout.writestr(part,xml if part.filename=='word/document.xml' else zin.read(part.filename))

reqs=[r for g in groups for r in g['requirements']]
data={'histories':len(groups),'requirements':len(reqs),'planned_pages':len(pages),
      'groups':groups,'pages':[],'render_status':'native_renderer_unavailable'}
for page in pages:
    data['pages'].append([{k:(E.tostring(v,encoding='unicode') if k=='xml' else v) for k,v in b.items()} for b in page])
(BASE/'qa'/'layout.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

with ZipFile(OUT) as z:
    for name,info in inventory.items():
        if name!='word/document.xml':assert hashlib.sha256(z.read(name)).hexdigest()==info['sha256'],name
    actual=E.fromstring(z.read('word/document.xml'))
    actual_tables=actual.xpath('/w:document/w:body/w:tbl',namespaces=ns)
    assert len(actual_tables)==len(groups)+len(reqs)
    assert E.tostring(actual.find('w:body/w:sectPr',ns))==E.tostring(section)
    codes=[r['code'] for r in reqs]
    assert len(codes)==len(set(codes))
    plain='\n'.join(text for t in actual_tables for text in t.xpath('.//w:t/text()',namespaces=ns))
    for code in codes:assert plain.count(code)==2,(code,plain.count(code))
    def structure(el):
        return (el.tag,tuple(sorted(el.attrib.items())),el.text,tuple(structure(c) for c in el))
    for t in actual_tables:
        rows=t.findall(q('tr'))
        assert len(rows)==6
        is_hu=bool(cells(t,0)[0].xpath('.//w:t[text()="Fuente"]',namespaces=ns))
        source=hu_source if is_hu else rf_source
        assert structure(t.find(q('tblPr')))==structure(source.find(q('tblPr')))
        assert structure(t.find(q('tblGrid')))==structure(source.find(q('tblGrid')))
        for a,b in zip(t.findall('.//'+q('tcPr')),source.findall('.//'+q('tcPr'))):assert structure(a)==structure(b)
    assert 'HU-12' not in [f"HU-{g['code']:02d}" for g in groups]
    assert all(g['source']==('Propuesta de la docente' if 24<=g['code']<=27 else 'Observación') for g in groups)

print(json.dumps({'output':str(OUT),'histories':len(groups),'requirements':len(reqs),'planned_pages':len(pages),
    'new_histories':sum(g['kind']=='nuevo' for g in groups),'preserved_parts':len(inventory)-1,'structural_checks':'PASS'},ensure_ascii=False))
