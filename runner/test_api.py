import asyncio
import unittest
import uuid

from aiohttp.test_utils import TestClient, TestServer
from api import Gateway, create_app

TOKEN = 'local-test-credential-with-at-least-32-characters'
PAYLOAD = {'files': {'main.py': 'print(42)'}, 'action': 'run'}


class ControlledGateway(Gateway):
    def __init__(self, **kwargs):
        super().__init__(TOKEN, ready=lambda: True, **kwargs)
        self.started = asyncio.Event()
        self.release = asyncio.Event()
        self.cancelled = asyncio.Event()

    async def run(self, payload):
        self.started.set()
        try:
            await self.release.wait()
            return {'status': 'completed', 'exit_code': 0, 'output': '42\n'}
        except asyncio.CancelledError:
            self.cancelled.set()
            raise


class GatewayTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.gateway = ControlledGateway(concurrency=1, queue_size=1, queue_timeout=.2)
        self.client = TestClient(TestServer(create_app(self.gateway), handler_cancellation=True))
        await self.client.start_server()

    async def asyncTearDown(self):
        self.gateway.release.set()
        await self.client.close()

    def headers(self, user=None):
        return {'Authorization': 'Bearer ' + TOKEN, 'X-Pylevel-User-Id': user or str(uuid.uuid4())}

    async def test_authentication_and_validation_precede_execution(self):
        self.assertEqual((await self.client.get('/api/health')).status, 401)
        self.assertEqual((await self.client.post('/api/execute', json=PAYLOAD)).status, 401)
        self.assertEqual((await self.client.get('/api/health', headers=self.headers())).status, 200)
        self.assertEqual((await self.client.post('/api/execute', headers=self.headers(), json={'files': {'../escape.py': ''}})).status, 400)
        self.assertEqual((await self.client.post('/api/execute', headers=self.headers(), data='x'*262145)).status, 415)
        large = self.headers()
        large['Content-Type'] = 'application/json'
        self.assertEqual((await self.client.post('/api/execute', headers=large, data='x'*262145)).status, 413)
        self.assertEqual(self.gateway.running, 0)

    async def test_bounded_queue_and_per_account_concurrency(self):
        first_user = str(uuid.uuid4())
        first = asyncio.create_task(self.client.post('/api/execute', headers=self.headers(first_user), json=PAYLOAD))
        await asyncio.wait_for(self.gateway.started.wait(), 1)
        duplicate = await self.client.post('/api/execute', headers=self.headers(first_user), json=PAYLOAD)
        self.assertEqual(duplicate.status, 429)
        queued = asyncio.create_task(self.client.post('/api/execute', headers=self.headers(), json=PAYLOAD))
        await asyncio.sleep(.02)
        saturated = await self.client.post('/api/execute', headers=self.headers(), json=PAYLOAD)
        self.assertEqual(saturated.status, 429)
        self.assertEqual(self.gateway.running, 1)
        queued_result = await queued
        self.assertEqual(queued_result.status, 429)
        self.gateway.release.set()
        self.assertEqual((await first).status, 200)
        self.assertEqual(len(self.gateway.users), 0)

    async def test_disconnect_releases_the_execution_slot(self):
        request = asyncio.create_task(self.client.post('/api/execute', headers=self.headers(), json=PAYLOAD))
        await asyncio.wait_for(self.gateway.started.wait(), 1)
        request.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await request
        await asyncio.wait_for(self.gateway.cancelled.wait(), 1)
        await asyncio.sleep(.01)
        self.assertEqual(self.gateway.running, 0)
        self.assertEqual(len(self.gateway.users), 0)


if __name__ == '__main__':
    unittest.main()
