"""Trusted image entrypoint; all student files live only in ephemeral tmpfs."""
import json
import os
from pathlib import Path
import subprocess
import sys

payload = json.load(sys.stdin)
os.chdir('/workspace')
for name, content in payload['files'].items():
    path = Path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
args = ['main.py'] if payload['action'] == 'run' else ['-m', 'unittest', 'discover', '-s', 'tests', '-v']
sys.exit(subprocess.call([sys.executable, '-B', '-u', *args], stdin=subprocess.DEVNULL))
