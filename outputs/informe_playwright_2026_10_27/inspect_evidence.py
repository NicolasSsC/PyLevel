from pathlib import Path
from zipfile import ZipFile
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timezone, timedelta

B=Path(__file__).parent
r=json.loads((B/'results.json').read_text(encoding='utf-8'))
print('STATS',r['stats'])
print('ERRORS',r.get('errors'))
for suite in r['suites']:
 for s in suite['specs']:
  for t in s['tests']:
   x=t['results'][0]
   print(json.dumps({'file':s['file'],'line':s['line'],'title':s['title'],'status':x['status'],'duration':x['duration']},ensure_ascii=False))

for z in (B/'test-results').glob('*/trace.zip'):
 if z.parent.name.startswith(('exam-','account-muestra')):
  with ZipFile(z) as f:
   print('TRACE',z.parent.name, f.namelist()[:8])
   for n in f.namelist():
    if n.endswith('.trace') and n!='test.trace':
     ev=[json.loads(x) for x in f.read(n).splitlines()]
     for e in ev:
      if e.get('type')=='before':
       params=e.get('params',{})
       if 'value' in params:params={k:v for k,v in params.items() if k!='value'}
       print('STEP',e.get('callId'),e.get('startTime'),e.get('apiName'),e.get('method'),str(params)[:180])
     frames=[e for e in ev if e.get('type')=='screencast-frame']
     print('FRAME_COUNT',len(frames))
