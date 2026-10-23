import zipfile,xml.etree.ElementTree as E,json
p=r'C:\Users\nicol\Downloads\PyLevel_Cronograma_corregido (1) (1).xlsx'
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(p) as z:
 for filename in ['xl/workbook.xml','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml']:
  root=E.fromstring(z.read(filename))
  print(filename)
  if 'workbook.xml' in filename:
   print('DEFINED NAMES',[(x.attrib,x.text) for x in root.findall('m:definedNames/m:definedName',ns)])
   continue
  print('DIM',root.tag, root.find('m:dimension',ns).attrib if root.find('m:dimension',ns) is not None else 'omitted')
  print('MERGES',[x.attrib for x in root.findall('m:mergeCells/m:mergeCell',ns)])
  print('FILTER',[x.attrib for x in root.findall('m:autoFilter',ns)])
  print('FORMULAS',[(c.attrib['r'],f.attrib,f.text) for c in root.findall('.//m:c',ns) if (f:=c.find('m:f',ns)) is not None][:20])
  print('CF',[(x.attrib,[(r.attrib,[f.text for f in r.findall('m:formula',ns)]) for r in x]) for x in root.findall('m:conditionalFormatting',ns)])
  print('VALIDATIONS',[(x.attrib,[c.text for c in x]) for x in root.findall('m:dataValidations/m:dataValidation',ns)])
  print('ROW HEIGHTS',[(r.attrib.get('r'),r.attrib.get('ht')) for r in root.findall('m:sheetData/m:row',ns)][:8])
  print('VIEWS',E.tostring(root.find('m:sheetViews',ns),encoding='unicode') if root.find('m:sheetViews',ns) is not None else None)
