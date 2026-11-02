"""Internal layout preview from the actual OOXML, not a native Word renderer."""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from html import escape
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor

BASE=Path(__file__).resolve().parent.parent
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns={'w':W}
def q(n):return '{'+W+'}'+n
pdfmetrics.registerFont(TTFont('PreviewArial',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('PreviewArialBold',r'C:\Windows\Fonts\arialbd.ttf'))
style=ParagraphStyle('body',fontName='PreviewArial',fontSize=10.5,leading=12.6,spaceAfter=0)

def text(p):return ''.join(p.xpath('.//w:t/text()',namespaces=ns))
def height_and_text(tc,width):
    txt='\n'.join(text(p) for p in tc.findall(q('p')))
    col=tc.find('./'+q('tcPr')+'/'+q('shd'))
    is_blue=col is not None and col.get(q('fill'),'').lower()=='377cb7'
    sty=ParagraphStyle('cell',parent=style,textColor=HexColor('#FFFFFF' if is_blue else '#000000'))
    para=Paragraph(escape(txt).replace('\n','<br/>'),sty)
    h=para.wrap(width-11.5,10000)[1]
    return h,para,is_blue

def draw_table(c,t,y,page_height):
    grid=[float(el.get(q('w')))/20 for el in t.find(q('tblGrid')).findall(q('gridCol'))]
    x=(11909/20-sum(grid))/2
    for row in t.findall(q('tr')):
        hnode=row.find('./'+q('trPr')+'/'+q('trHeight'))
        h=float(hnode.get(q('val')))/20 if hnode is not None else 0
        col=0;items=[]
        for tc in row.findall(q('tc')):
            span=tc.find('./'+q('tcPr')+'/'+q('gridSpan'))
            span=int(span.get(q('val'))) if span is not None else 1
            width=sum(grid[col:col+span]);th,para,blue=height_and_text(tc,width)
            h=max(h,th+3);items.append((sum(grid[:col])+x,width,th,para,blue,tc));col+=span
        # A small conservative surplus is used both for Word page planning and this preview.
        h*=1.11
        assert y-h>=62,('overflow',y,h)
        for cell_x,width,th,para,blue,tc in items:
            c.setFillColor(HexColor('#377CB7' if blue else '#FFFFFF'))
            c.setStrokeColor(HexColor('#202020'));c.setLineWidth(1)
            c.rect(cell_x,y-h,width,h,stroke=1,fill=1)
            align=tc.find('./'+q('tcPr')+'/'+q('vAlign'))
            ty=y-1.5-th if align is not None and align.get(q('val'))=='top' else y-(h-th)/2-th
            para.drawOn(c,cell_x+5.75,ty)
        y-=h
    return y-10

def render(path,out):
    with ZipFile(path) as z:root=E.fromstring(z.read('word/document.xml'))
    body=root.find(q('body'));sect=body.find(q('sectPr'))
    size=sect.find(q('pgSz'));pw=float(size.get(q('w')))/20;ph=float(size.get(q('h')))/20
    c=canvas.Canvas(str(out),pagesize=(pw,ph));y=ph-72;pages=1
    for el in body:
        if el.tag==q('sectPr'):continue
        if el.tag==q('p'):
            br=el.find('./'+q('pPr')+'/'+q('pageBreakBefore'))
            if br is not None and br.get(q('val'))=='1':
                c.showPage();pages+=1;y=ph-72;continue
            txt=text(el)
            if not txt:continue
            sz=el.find('.//'+q('sz'));fs=float(sz.get(q('val')))/2 if sz is not None else 10.5
            pstyle=el.find('./'+q('pPr')+'/'+q('pStyle'))
            bold=False
            sty=ParagraphStyle('p',parent=style,fontSize=fs,leading=fs*1.2,textColor=HexColor('#000000'))
            p=Paragraph(escape(txt),sty);_,height=p.wrap(pw-144,10000)
            spacing=el.find('./'+q('pPr')+'/'+q('spacing'))
            after=float(spacing.get(q('after'),'120'))/20 if spacing is not None else 6
            assert y-height>=62,('paragraph overflow',txt)
            p.drawOn(c,72,y-height);y-=height+after+3
        elif el.tag==q('tbl'):y=draw_table(c,el,y,ph)
    c.save();return pages

if __name__=='__main__':
    print('Reference layout preview pages',render(Path(r'C:\Users\nicol\Downloads\formatos.docx'),BASE/'qa'/'referencia_alternativa.pdf'))
    print('Final layout preview pages',render(BASE/'PyLevel_Requerimientos_nuevos_y_actualizados.docx',BASE/'qa'/'previsualizacion_alternativa.pdf'))
