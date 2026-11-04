"""Remove only expired disposable PyLevel containers after interrupted supervisors."""
import datetime
import json
import subprocess

listed = subprocess.run(['docker', 'ps', '-aq', '--filter', 'label=pylevel.execution=true'],
                        capture_output=True, text=True, timeout=10, check=True)
removed = 0
for identifier in listed.stdout.split():
    inspected = subprocess.run(['docker', 'inspect', identifier], capture_output=True, text=True, timeout=10)
    if inspected.returncode:
        continue
    container = json.loads(inspected.stdout)[0]
    created = datetime.datetime.fromisoformat(container['Created'].replace('Z', '+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - created).total_seconds()
    if (container.get('Config', {}).get('Labels', {}).get('pylevel.execution') == 'true' and
            container.get('Name', '').startswith('/pylevel-') and age > 90):
        subprocess.run(['docker', 'rm', '-f', identifier], capture_output=True, timeout=20, check=True)
        removed += 1
print(json.dumps({'expired_runner_containers_removed': removed}))
