from pathlib import Path
from zipfile import ZipFile
import json, shutil, hashlib, sys
sys.stdout.reconfigure(encoding='utf-8')
B=Path(__file__).parent
E=B/'evidence'; E.mkdir(exist_ok=True)
r=json.loads((B/'results.json').read_text(encoding='utf-8'))
manifest=[]
copies=[('rechaza una contraseña','02_credenciales.png'),('guarda los datos','03_perfil.png'),('permite saltar','07_catalogo.png'),('muestra el inicio en móvil','08_movil.png')]
for suite in r['suites']:
 for s in suite['specs']:
  x=s['tests'][0]['results'][0]
  for prefix,name in copies:
   if s['title'].startswith(prefix):
    src=Path(next(a['path'] for a in x['attachments'] if a['name']=='screenshot'))
    shutil.copy2(src,E/name)
    manifest.append({'file':name,'test':s['title'],'source':str(src.relative_to(B)),'kind':'test-final-screenshot'})

for prefix, selections in [
 ('account-muestra', [('04_progreso.jpeg', lambda e: e.get('method')=='click' and 'Elegir un ejercicio' in str(e.get('params')))]),
 ('exam-', [('05_examen_respuesta.jpeg', lambda e: e.get('method')=='reload'),('06_examen_entregado.jpeg',lambda e:e.get('method')=='goto' and e.get('params',{}).get('url')=='/perfil')])]:
 z=next((B/'test-results').glob(prefix+'*/trace.zip'))
 with ZipFile(z) as f:
  events=[]
  for n in f.namelist():
   if n.endswith('.trace') and n!='test.trace':events.extend(json.loads(x) for x in f.read(n).splitlines())
  frames=[e for e in events if e.get('type')=='screencast-frame']
  for name,predicate in selections:
   step=next(e for e in events if e.get('type')=='before' and predicate(e))
   frame=max((e for e in frames if e['timestamp']<=step['startTime']),key=lambda e:e['timestamp'])
   (E/name).write_bytes(f.read(frame['file']))
   manifest.append({'file':name,'source':str(z.relative_to(B)),'member':frame['file'],'timestamp':frame['timestamp'],'kind':'original-trace-screencast-frame'})
for m in manifest:m['sha256']=hashlib.sha256((E/m['file']).read_bytes()).hexdigest()
(B/'evidence-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
