"""Authenticated single-process gateway to the disposable gVisor supervisor."""
import asyncio
import contextlib
import hmac
import json
import os
import signal
import subprocess
import sys
import uuid
from pathlib import Path

from aiohttp import web
from execute import validate

MAX_BODY = 262144
EXECUTE_SCRIPT = Path(__file__).with_name('execute.py')


def response(data, status=200, retry=None):
    headers = {'Cache-Control': 'no-store'}
    if retry is not None:
        headers['Retry-After'] = str(retry)
    return web.json_response(data, status=status, headers=headers)


def runtime_ready():
    try:
        runtimes = subprocess.run(['docker', 'info', '--format', '{{json .Runtimes}}'],
                                 capture_output=True, text=True, timeout=4, check=True)
        if 'runsc' not in json.loads(runtimes.stdout):
            return False
        return subprocess.run(['docker', 'image', 'inspect', os.environ.get('PYLEVEL_IMAGE', 'pylevel-python:local')],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=4).returncode == 0
    except (OSError, ValueError, subprocess.SubprocessError):
        return False


async def stop_process(process):
    if process.returncode is not None:
        return
    with contextlib.suppress(ProcessLookupError):
        process.send_signal(signal.SIGINT)
    try:
        await asyncio.wait_for(process.wait(), 20)
    except asyncio.TimeoutError:
        with contextlib.suppress(ProcessLookupError):
            process.kill()
        await process.wait()


class Gateway:
    def __init__(self, token, concurrency=2, queue_size=8, queue_timeout=5, ready=runtime_ready):
        if not token or len(token) < 32:
            raise ValueError('A private runner credential of at least 32 characters is required')
        if not 1 <= concurrency <= 4 or not 0 <= queue_size <= 32 or not 0 < queue_timeout <= 10:
            raise ValueError('Invalid runner capacity')
        self.token = token
        self.capacity = concurrency
        self.maximum = concurrency + queue_size
        self.queue_timeout = queue_timeout
        self.semaphore = asyncio.Semaphore(concurrency)
        self.users = set()
        self.running = 0
        self.healthy = False
        self.ready = ready

    async def run(self, payload):
        # The supervisor never receives the API token, SQL credentials or web secrets.
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'),
               'PYLEVEL_IMAGE': os.environ.get('PYLEVEL_IMAGE', 'pylevel-python:local'),
               'PYTHONDONTWRITEBYTECODE': '1'}
        process = await asyncio.create_subprocess_exec(
            sys.executable, '-B', str(EXECUTE_SCRIPT), stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            env=env, limit=524288)
        try:
            output, _ = await asyncio.wait_for(process.communicate(json.dumps(payload).encode()), 35)
            if len(output) > 524288:
                raise ValueError('Invalid supervisor response')
            result = json.loads(output)
            if (result.get('status') not in ('completed', 'timeout', 'output_limit', 'cleanup_failed') or
                    not isinstance(result.get('exit_code'), int) or not isinstance(result.get('output'), str)):
                raise ValueError('Invalid supervisor response')
            return result
        finally:
            # Shield cleanup even when the client disconnects during execution.
            await asyncio.shield(stop_process(process))

    async def execute(self, request):
        if not self.healthy:
            return response({'error': 'Executor unavailable'}, 503)
        if request.content_type != 'application/json':
            return response({'error': 'JSON content type required'}, 415)
        try:
            user_id = str(uuid.UUID(request.headers.get('X-Pylevel-User-Id', '')))
        except ValueError:
            return response({'error': 'A valid account identifier is required'}, 400)
        try:
            async with asyncio.timeout(5):
                raw = await request.read()
            payload = validate(json.loads(raw))
            if len(json.dumps(payload).encode()) > MAX_BODY:
                return response({'error': 'Project too large'}, 413)
        except web.HTTPRequestEntityTooLarge:
            return response({'error': 'Project too large'}, 413)
        except (ValueError, TypeError, AttributeError, UnicodeDecodeError):
            return response({'error': 'Invalid project'}, 400)
        except TimeoutError:
            return response({'error': 'Request body timed out'}, 408)

        # No await between checking and reserving capacity in this one event loop.
        if user_id in self.users or len(self.users) >= self.maximum:
            return response({'error': 'Executor busy; retry shortly'}, 429, retry=3)
        self.users.add(user_id)
        acquired = False
        try:
            try:
                await asyncio.wait_for(self.semaphore.acquire(), self.queue_timeout)
                acquired = True
            except TimeoutError:
                return response({'error': 'Execution queue timed out'}, 429, retry=3)
            self.running += 1
            try:
                result = await self.run(payload)
                return response(result)
            except (OSError, ValueError, TimeoutError):
                return response({'error': 'Executor unavailable'}, 503)
            finally:
                self.running -= 1
        finally:
            if acquired:
                self.semaphore.release()
            self.users.discard(user_id)

    async def health(self, request):
        return response({'status': 'online' if self.healthy else 'offline',
                         'active': self.running, 'queued': max(0, len(self.users) - self.running),
                         'capacity': self.capacity}, 200 if self.healthy else 503)


def create_app(gateway):
    @web.middleware
    async def authenticate(request, handler):
        expected = 'Bearer ' + gateway.token
        if not hmac.compare_digest(request.headers.get('Authorization', '').encode(), expected.encode()):
            return response({'error': 'Unauthorized'}, 401)
        if request.query_string:
            return response({'error': 'Query parameters are not accepted'}, 400)
        return await handler(request)

    app = web.Application(client_max_size=MAX_BODY, middlewares=[authenticate])
    app.router.add_get('/api/health', gateway.health)
    app.router.add_post('/api/execute', gateway.execute)

    async def monitor(app):
        gateway.healthy = await asyncio.to_thread(gateway.ready)
        if not gateway.healthy:
            raise RuntimeError('Docker, gVisor and the configured image must be ready')

        async def poll():
            while True:
                await asyncio.sleep(5)
                gateway.healthy = await asyncio.to_thread(gateway.ready)
        task = asyncio.create_task(poll())
        yield
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    app.cleanup_ctx.append(monitor)
    return app


if __name__ == '__main__':
    gateway = Gateway(os.environ.get('PYLEVEL_RUNNER_TOKEN', ''),
                      concurrency=int(os.environ.get('RUNNER_MAX_CONCURRENCY', '2')),
                      queue_size=int(os.environ.get('RUNNER_MAX_QUEUE', '8')),
                      queue_timeout=float(os.environ.get('RUNNER_QUEUE_TIMEOUT', '5')))
    web.run_app(create_app(gateway), host='127.0.0.1', port=8787,
                access_log=None, handler_cancellation=True, shutdown_timeout=35)
