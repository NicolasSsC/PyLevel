"""Local trusted supervisor. JSON stdin: {files: {path: source}, action: run|test}."""
import json
import os
import selectors
import subprocess
import sys
import time
import tempfile
import uuid
from pathlib import PurePosixPath

IMAGE = os.environ.get('PYLEVEL_IMAGE', 'pylevel-python:local')
MAX_OUTPUT = 65536
TIMEOUT = 10


def validate(payload):
    files = payload.get('files')
    action = payload.get('action', 'run')
    if action not in ('run', 'test') or not isinstance(files, dict) or not 1 <= len(files) <= 50:
        raise ValueError('Invalid action or file count')
    for name, content in files.items():
        path = PurePosixPath(name)
        if (not name or len(name) > 200 or path.is_absolute() or
                '..' in path.parts or '\\' in name or '\x00' in name or
                str(path) != name or not isinstance(content, str)):
            raise ValueError('Invalid file path or content')
    if action == 'run' and 'main.py' not in files:
        raise ValueError('main.py is required')
    return {'files': files, 'action': action}


def execute(payload):
    payload = validate(payload)
    encoded = json.dumps(payload).encode()
    if len(encoded) > 262144:
        raise ValueError('Project too large')
    name = 'pylevel-' + uuid.uuid4().hex
    command = [
        'docker', 'run', '--rm', '-i', '--name', name, '--runtime=runsc',
        '--label', 'pylevel.execution=true', '--network=none', '--read-only',
        '--user=65534:65534', '--cap-drop=ALL', '--security-opt=no-new-privileges',
        '--memory=128m', '--memory-swap=128m', '--cpus=0.5', '--pids-limit=32',
        '--ulimit', 'nofile=64:64', '--ulimit', 'core=0:0', '--log-driver=none',
        '--tmpfs', '/workspace:rw,noexec,nosuid,nodev,size=8m,mode=1777',
        '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=8m,mode=1777', IMAGE,
    ]
    output = bytearray()
    reason = 'completed'
    start = time.monotonic()
    source = tempfile.TemporaryFile()
    source.write(encoded)
    source.seek(0)
    process = subprocess.Popen(command, stdin=source, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT)
    selector = selectors.DefaultSelector()
    try:
        selector.register(process.stdout, selectors.EVENT_READ)
        while selector.get_map():
            if time.monotonic() - start >= TIMEOUT:
                reason = 'timeout'
                break
            for key, _ in selector.select(0.1):
                chunk = os.read(key.fd, 4096)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                remaining = MAX_OUTPUT - len(output)
                output.extend(chunk[:remaining])
                if len(chunk) > remaining:
                    reason = 'output_limit'
                    break
            if reason != 'completed':
                break
    finally:
        # Detach output first: a full pipe must not block Docker's cleanup path.
        if process.poll() is None:
            if reason == 'completed':
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
            else:
                process.kill()
        process.stdout.close()
        process.wait()
        source.close()
        selector.close()
        try:
            cleanup = subprocess.run(['docker', 'rm', '-f', name], capture_output=True, timeout=15)
            if cleanup.returncode and b'No such container' not in cleanup.stderr:
                reason = 'cleanup_failed'
        except subprocess.TimeoutExpired:
            reason = 'cleanup_failed'
    return {'status': reason, 'exit_code': process.returncode,
            'output': output.decode('utf-8', errors='replace')}


if __name__ == '__main__':
    try:
        raw = sys.stdin.buffer.read(262145)
        if len(raw) > 262144:
            raise ValueError('Request too large')
        print(json.dumps(execute(json.loads(raw))))
    except (ValueError, TypeError, AttributeError) as error:
        print(json.dumps({'status': 'invalid_request', 'error': str(error)}))
        sys.exit(2)
