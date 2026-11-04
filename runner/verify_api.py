"""Live operator checks: reads its credential locally, prints only safe test outcomes."""
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from aiohttp import ClientSession, ClientTimeout


async def main():
    env_path = Path(sys.argv[1])
    base = sys.argv[2].rstrip('/')
    token = next(line.split('=', 1)[1].strip() for line in env_path.read_text().splitlines()
                 if line.startswith('PYLEVEL_RUNNER_TOKEN='))
    headers = {'Authorization': 'Bearer ' + token, 'X-Pylevel-User-Id': str(uuid.uuid4())}
    async with ClientSession(timeout=ClientTimeout(total=45)) as client:
        async with client.get(base + '/api/health') as result:
            assert result.status == 401, 'Unauthenticated access must be rejected'
        async with client.get(base + '/api/health', headers=headers) as result:
            health = await result.json()
            assert result.status == 200 and health['status'] == 'online', 'Executor must be ready'
        checks = [
            ('run', {'files': {'main.py': 'print(42)'}, 'action': 'run'}, '42\n'),
            ('public_tests', {'files': {'main.py': 'def sumar(a,b): return a+b',
                'tests/test_sum.py': 'import unittest\nfrom main import sumar\nclass Suma(unittest.TestCase):\n def test_suma(self): self.assertEqual(sumar(2,3),5)\n'}, 'action': 'test'}, 'Ran 1 test'),
            ('network_isolated', {'files': {'main.py': 'import socket\ntry:\n socket.create_connection(("1.1.1.1",443),timeout=1)\n print("NETWORK_OPEN")\nexcept OSError:\n print("NETWORK_BLOCKED")'}, 'action': 'run'}, 'NETWORK_BLOCKED'),
            ('credentials_isolated', {'files': {'main.py': 'import os\nassert "PYLEVEL_RUNNER_TOKEN" not in os.environ\nassert "DATABASE_URL" not in os.environ\nprint("NO_CREDENTIALS")'}, 'action': 'run'}, 'NO_CREDENTIALS'),
        ]
        for name, payload, expected in checks:
            async with client.post(base + '/api/execute', headers=headers, json=payload) as result:
                data = await result.json()
                assert result.status == 200 and data['status'] == 'completed' and data['exit_code'] == 0 and expected in data['output'], name
                print(json.dumps({'check': name, 'passed': True}))
        cancel_headers = {**headers, 'X-Pylevel-User-Id': str(uuid.uuid4())}
        running = asyncio.create_task(client.post(base + '/api/execute', headers=cancel_headers,
            json={'files': {'main.py': 'import time\ntime.sleep(9)'}, 'action': 'run'}))
        await asyncio.sleep(1)
        running.cancel()
        try:
            await running
        except asyncio.CancelledError:
            pass
        for _ in range(20):
            await asyncio.sleep(.25)
            async with client.get(base + '/api/health', headers=headers) as result:
                if (await result.json())['active'] == 0:
                    print(json.dumps({'check': 'cancellation', 'passed': True}))
                    break
        else:
            raise AssertionError('Cancellation did not release the execution slot')
        print(json.dumps({'authentication': 'verified', 'capacity': health['capacity'], 'complete': True}))


if __name__ == '__main__':
    asyncio.run(main())
