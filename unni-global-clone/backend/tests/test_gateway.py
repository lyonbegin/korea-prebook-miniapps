"""Gateway contract: stream first, write only after body transfer, cache public raw bytes."""
import importlib.util
import json
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from app import main as module

class AsyncChunks(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield RAW_JSON

ORIGINAL_CLIENT = httpx.AsyncClient
RAW_JSON = b'{\n  "eventId": "70809", "options": [1, 2, 3], "price": 163.68\n}\n'

class FakePG:
    def __init__(self):
        self.records = {}
        self.writes = 0
        self.reads = 0
    async def close(self):
        pass
    async def fetchrow(self, query, key):
        self.reads += 1
        return self.records.get(key)
    async def execute(self, query, key, service, source_url, variant, status, headers, raw, length):
        self.writes += 1
        self.records.setdefault(key, {'status_code':status, 'response_headers':json.loads(headers), 'raw_body':raw, 'stored_at':'now'})

def prepare(monkeypatch, origin):
    calls = []
    def handle(request):
        calls.append(str(request.url))
        return origin(request)
    transport = httpx.MockTransport(handle)
    monkeypatch.setattr(module.httpx, 'AsyncClient', lambda **kwargs: ORIGINAL_CLIENT(transport=transport, **kwargs))
    return calls

def test_cache_miss_streams_then_saves_raw_and_hits_db(monkeypatch):
    pg = FakePG()
    calls = prepare(monkeypatch, lambda req: httpx.Response(200, stream=AsyncChunks(), headers={'content-type':'application/json'}))
    with TestClient(module.app) as cli:
        module.app.state.pg = pg
        url = '/gateway/mobile-bff/event/v2/70809?lang=en&currency=USD'
        first = cli.get(url)
        assert first.status_code == 200
        assert first.content == RAW_JSON
        assert first.headers['x-cache'] == 'MISS'
        assert pg.writes == 1
        assert len(calls) == 1
        second = cli.get(url)
        assert second.status_code == 200
        assert second.content == RAW_JSON
        assert second.headers['x-cache'] == 'HIT'
        assert second.headers['x-data-source'] == 'postgresql'
        assert len(calls) == 1, 'second request must not reach original server'

def test_auth_header_and_consultation_are_not_cached(monkeypatch):
    pg = FakePG()
    calls = prepare(monkeypatch, lambda req: httpx.Response(200, stream=AsyncChunks(), headers={'content-type':'application/json'}))
    with TestClient(module.app) as cli:
        module.app.state.pg = pg
        assert cli.get('/gateway/mobile-bff/event/v2/70809', headers={'authorization':'Bearer example'}).headers['x-cache'] == 'BYPASS'
        assert cli.get('/gateway/mobile-bff/consultation/123').headers['x-cache'] == 'BYPASS'
        assert cli.get('/gateway/mobile-bff/event/v2/70809?access_token=secret').headers['x-cache'] == 'BYPASS'
        assert pg.writes == 0 and len(calls) == 3

def test_private_origin_response_never_saved(monkeypatch):
    pg = FakePG()
    prepare(monkeypatch, lambda req: httpx.Response(200, stream=AsyncChunks(), headers={'content-type':'application/json','cache-control':'private, no-store'}))
    with TestClient(module.app) as cli:
        module.app.state.pg = pg
        rsp = cli.get('/gateway/mobile-bff/event/v2/70809')
        assert rsp.status_code == 200 and rsp.headers['x-cache'] == 'BYPASS'
        assert pg.writes == 0

def test_variants_separate_language_and_source_url(monkeypatch):
    pg = FakePG()
    calls = prepare(monkeypatch, lambda req: httpx.Response(200, stream=AsyncChunks(), headers={'content-type':'application/json'}))
    with TestClient(module.app) as cli:
        module.app.state.pg = pg
        url = '/gateway/mobile-bff/event/v2/70809'
        cli.get(url, headers={'accept-language':'en'})
        cli.get(url, headers={'accept-language':'zh-CN'})
        cli.get(url, headers={'accept-language':'en'})
        assert len(calls) == 2 and pg.writes == 2

def test_invalid_service_and_path_rejected_without_origin(monkeypatch):
    calls = prepare(monkeypatch, lambda req: httpx.Response(200, json={'ok':True}))
    with TestClient(module.app) as cli:
        assert cli.get('/gateway/evil-server/events/1').status_code == 404
        assert cli.get('/gateway/mobile-bff/../admin').status_code in (400, 404)
        assert not calls
