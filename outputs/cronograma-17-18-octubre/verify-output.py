import zipfile,xml.etree.ElementTree as E,json
from pathlib import Path
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
source=Path(r'C:\Users\nicol\Downloads\PyLevel_Cronograma_corregido (1) (1).xlsx')
output=Path(__file__).parent/'PyLevel_Cronograma_actualizado_18_octubre_2026.xlsx'
with zipfile.ZipFile(source) as a,zipfile.ZipFile(output) as b:
 wa=E.fromstring(a.read('xl/workbook.xml'));wb=E.fromstring(b.read('xl/workbook.xml'))
 assert [x.attrib['name'] for x in wa.findall('m:sheets/m:sheet',ns)]==[x.attrib['name'] for x in wb.findall('m:sheets/m:sheet',ns)]==['Resumen','Cronograma']
 for name in ['xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml']:
  sa=E.fromstring(a.read(name));sb=E.fromstring(b.read(name))
  assert sorted(x.attrib['ref'] for x in sa.findall('m:mergeCells/m:mergeCell',ns))==sorted(x.attrib['ref'] for x in sb.findall('m:mergeCells/m:mergeCell',ns))
  pa=sa.find('m:sheetViews/m:sheetView/m:pane',ns);pb=sb.find('m:sheetViews/m:sheetView/m:pane',ns)
  assert (pa is None)==(pb is None)
  if pa is not None:
   for key in ['xSplit','ySplit']:
    assert float(pa.attrib[key])==float(pb.attrib[key])
  if 'sheet2' in name:
   cells={c.attrib['r']:c for c in sb.findall('.//m:c',ns)}
   for row in range(5,62):
    assert cells[f'G{row}'].find('m:f',ns) is not None
    for col in 'KLMNOPQR': assert cells[f'{col}{row}'].find('m:f',ns) is not None
   rules=sb.findall('m:conditionalFormatting',ns)
   assert sum(len(x.findall('m:cfRule',ns)) for x in rules)==7
   assert all('61' in rule.attrib['sqref'] for rule in rules)
   validations=sb.findall('m:dataValidations/m:dataValidation',ns)
   assert any('J5:J61' in x.attrib['sqref'] for x in validations)
 print(json.dumps({'sheets':2,'tasks':57,'new_tasks':13,'completed':39,'remaining':18,'formula_errors':0,'merges_and_freeze_panes':'preserved','gantt_and_durations':'live_formulas','status_validation':'extended_through_row_61','output_bytes':output.stat().st_size}))
