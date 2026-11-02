from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from copy import deepcopy
import hashlib,json
from contenido import groups

BASE=Path(__file__).parent
OUT=BASE/'PyLevel_Requerimientos_nuevos_y_actualizados.docx'
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns={'w':W}
old_bytes=OUT.read_bytes()
with ZipFile(OUT) as z:
    parts={i.filename:(i,z.read(i.filename)) for i in z.infolist()}
root=E.fromstring(parts['word/document.xml'][1])
original=E.tostring(root)
targets={f"HU-{g['code']:02d}":g['story'] for g in groups if 24<=g['code']<=27}
changed=[]
for t in root.xpath('/w:document/w:body/w:tbl',namespaces=ns):
    header=t.xpath('./w:tr[1]/w:tc',namespaces=ns)
    if len(header)!=3:continue
    code=''.join(header[2].xpath('.//w:t/text()',namespaces=ns))
    if code not in targets:continue
    assert ''.join(header[1].xpath('.//w:t/text()',namespaces=ns))=='Propuesta de la docente'
    cell=t.xpath('./w:tr[2]/w:tc[2]',namespaces=ns)[0]
    nodes=cell.xpath('.//w:t',namespaces=ns)
    assert len(nodes)==1
    old=nodes[0].text
    nodes[0].text=targets[code]
    changed.append((code,nodes[0],old))
assert len(changed)==4
new_xml=E.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
for _,node,old in changed:node.text=old
assert E.tostring(root)==original,'Unexpected XML modification outside the four stories'
(BASE/'qa'/'antes_correccion_perspectiva_docente.docx').write_bytes(old_bytes)
temp=BASE/'correccion_temporal.docx'
with ZipFile(temp,'w') as z:
    for name,(info,data) in parts.items():z.writestr(info,new_xml if name=='word/document.xml' else data)
with ZipFile(temp) as z:
    assert all(z.read(name)==data for name,(_,data) in parts.items() if name!='word/document.xml')
    final=E.fromstring(z.read('word/document.xml'))
    assert len(final.xpath('/w:document/w:body/w:tbl',namespaces=ns))==80
temp.replace(OUT)
record={'changed_histories':sorted(targets),'change':'Only Historia de Usuario text in four cells',
    'table_format':'unchanged','functional_requirements':'unchanged','source':'Propuesta de la docente',
    'native_pagination_verified':False,'output_sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()}
(BASE/'qa'/'correccion_docente.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record,ensure_ascii=False))
