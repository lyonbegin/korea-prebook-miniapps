"""UNNI public-data gateway: return upstream immediately, persist raw responses afterward.

No endpoint discovery, authentication bypass, scraping, or private-data caching.
Only configured, fixed upstream hosts may be contacted.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qsl, unquote, urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from starlette.background import BackgroundTask
from .catalog_schema import CATALOG_SCHEMA
from .subcategories import SUBCATEGORY_ROWS

log = logging.getLogger("unni.cache")

# Fixed, reviewed hosts; these are APK-sourced candidates, NOT validated public APIs.
# Do not add arbitrary user-supplied origins or forward browser-provided target URLs.
UPSTREAMS = {
    "public-web": "https://unni.app",
    "mobile-bff": "https://mobile-bff.gangnamunni.com",
    "service-offer": "https://kuiperbelt-event.gangnamunni.com",
    "hospital-detail": "https://kuiperbelt-hospital.gangnamunni.com",
    "doctor": "https://mobile-bff.gangnamunni.com",
}
SAFE_REQUEST_HEADERS = (
    "accept", "accept-language", "x-language", "x-country-code", "x-platform",
    "x-app-version", "x-client-version", "x-region",
)
SAFE_RESPONSE_HEADERS = (
    "content-type", "content-encoding", "content-language", "etag", "last-modified", "vary",
)
PRIVATE_PATH = re.compile(
    r"(^|/)(?:auth|login|token|session|member|user|account|my|profile|"
    r"consultation|consult|reservation|appointment|payment|order|chat|notification|"
    r"message|patient|medical-record)(?:/|$)", re.I
)
PRIVATE_QUERY_KEY = re.compile(
    r"(?:token|session|secret|password|auth|cookie|key|email|phone|user|member|patient|"
    r"consultation|reservation|order|payment|identity)", re.I
)
CACHE_TYPES = ("text/html", "application/json", "application/problem+json", "image/webp", "image/png", "image/jpeg")
MAX_CACHE_BYTES = int(os.getenv("MAX_CACHE_BYTES", str(4 * 1024 * 1024)))

SCHEMA = """
CREATE SCHEMA IF NOT EXISTS unni_clone;
CREATE TABLE IF NOT EXISTS unni_clone.original_response_cache (
  cache_key TEXT PRIMARY KEY,
  upstream_service TEXT NOT NULL,
  upstream_url TEXT NOT NULL,
  request_variant JSONB NOT NULL,
  status_code INTEGER NOT NULL,
  response_headers JSONB NOT NULL,
  raw_body BYTEA NOT NULL,
  size_bytes BIGINT NOT NULL,
  stored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_original_cache_service ON unni_clone.original_response_cache(upstream_service);
"""


@dataclass
class Captured:
    chunks: list[bytes] = field(default_factory=list)
    size: int = 0
    completed: bool = False
    overflow: bool = False

    def append(self, chunk: bytes) -> None:
        if self.overflow:
            return
        self.size += len(chunk)
        if self.size > MAX_CACHE_BYTES:
            self.chunks.clear()
            self.overflow = True
            return
        self.chunks.append(chunk)


def request_variant(request: Request) -> dict[str, str]:
    """Only public representation selectors. User tokens are not part of public cache keys."""
    return {key: request.headers.get(key, "") for key in SAFE_REQUEST_HEADERS}


def safe_public_request(request: Request, decoded_path: str) -> bool:
    if request.method != "GET" or PRIVATE_PATH.search(decoded_path):
        return False
    if request.headers.get("authorization") or request.headers.get("cookie") or request.headers.get("proxy-authorization"):
        return False
    if any(PRIVATE_QUERY_KEY.search(key) for key, _ in parse_qsl(request.url.query, keep_blank_values=True)):
        return False
    # Railway injects X-Forwarded-* / trace headers. None of those is forwarded upstream.
    # Only explicit user-identity/auth headers bypass the shared public-data cache.
    if any(k in {"x-user-id", "x-session-id", "x-api-key", "x-auth-token",
                 "x-personalization", "x-device-id", "x-patient-id"}
           for k in request.headers):
        return False
    return True


def public_response(upstream: httpx.Response, variant: dict[str, str]) -> bool:
    if upstream.status_code != 200:
        return False
    cc = upstream.headers.get("cache-control", "").lower()
    mime = upstream.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    # Public static images may set tracking cookies; cookie headers are not stored
    # or forwarded to browsers. Personalized JSON/HTML remain uncached.
    if "set-cookie" in upstream.headers and not (mime.startswith("image/") and "public" in cc):
        return False
    if "private" in cc or "no-store" in cc:
        return False
    if mime not in CACHE_TYPES and not mime.endswith("+json"):
        return False
    vary = upstream.headers.get("vary", "")
    if any(h.strip().lower() not in (*SAFE_REQUEST_HEADERS, "accept-encoding")
           for h in vary.split(",") if h.strip()):
        return False
    size = upstream.headers.get("content-length", "")
    if size.isdigit() and int(size) > MAX_CACHE_BYTES:
        return False
    return True


def filtered_response_headers(headers: Any) -> dict[str, str]:
    return {k: headers[k] for k in SAFE_RESPONSE_HEADERS if k in headers}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pg = None
    # Railway PostgreSQL is required for persistence. If unavailable, stay transparent:
    # upstream streaming still functions, but readiness clearly reports cache disabled.
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        import asyncpg
        try:
            pool = await asyncpg.create_pool(dsn=db_url, min_size=1, max_size=5, timeout=8)
            async with pool.acquire() as conn:
                await conn.execute(SCHEMA)
                # This creates only unni_clone.* objects in the existing DB.
                # Keep raw-response proxy available if catalog migration fails.
                try:
                    await conn.execute(CATALOG_SCHEMA)
                    await conn.executemany("INSERT INTO unni_clone.categories(category_id,parent_category_id,name_en,source_path) VALUES ($1,$2,$3,$4) ON CONFLICT(category_id) DO NOTHING", SUBCATEGORY_ROWS)
                except Exception:
                    log.exception("UNNI catalog migration failed; response cache remains available")
            app.state.pg = pool
        except Exception:
            log.exception("PostgreSQL unavailable: fail-open proxy, caching disabled")
    try:
        yield
    finally:
        if app.state.pg is not None:
            await app.state.pg.close()


app = FastAPI(title="UNNI public-data transparent write-behind cache", lifespan=lifespan)
origins = [s.strip() for s in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "HEAD"],
                   allow_headers=["*"], expose_headers=["x-data-source", "x-cache"])


@app.get("/health")
async def health(request: Request):
    pg = getattr(request.app.state, "pg", None)
    table_ok = False
    if pg is not None:
        try:
            table_ok = await pg.fetchval("SELECT to_regclass('unni_clone.original_response_cache') IS NOT NULL")
        except Exception:
            log.exception("DB table readiness check failed")
    return {"ok": True, "cache": "postgresql" if pg else "not_connected",
            "db_table_ready": bool(table_ok), "db_table": "unni_clone.original_response_cache",
            "policy": "MISS=stream origin first; database save after transfer; HIT=return raw bytes from PostgreSQL",
            "configured_services": list(UPSTREAMS)}



@app.get("/cache/status")
async def cache_status(request: Request):
    """Non-sensitive proof that the existing PostgreSQL table is receiving writes."""
    pool = getattr(request.app.state, "pg", None)
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL unavailable")
    data = await pool.fetchrow(
        "SELECT count(*) AS rows, coalesce(sum(size_bytes), 0) AS bytes "
        "FROM unni_clone.original_response_cache"
    )
    return {"ok": True, "table": "unni_clone.original_response_cache",
            "rows": int(data["rows"]), "stored_bytes": int(data["bytes"])}




@app.get("/catalog/status")
async def catalog_status(request: Request):
    """Read-only counts; do not report a seeded catalog as fully acquired data."""
    pool = getattr(request.app.state, "pg", None)
    if pool is None:
        raise HTTPException(status_code=503, detail="PostgreSQL unavailable")
    tables = ("categories", "hospitals", "doctors", "events", "event_options", "media_assets", "source_provenance")
    counts = {}
    for table in tables:
        try:
            counts[table] = int(await pool.fetchval("SELECT count(*) FROM unni_clone." + table))
        except Exception as exc:
            counts[table] = None
    counts["top_level_categories"] = await pool.fetchval("SELECT count(*) FROM unni_clone.categories WHERE parent_category_id IS NULL")
    counts["subcategories"] = await pool.fetchval("SELECT count(*) FROM unni_clone.categories WHERE parent_category_id IS NOT NULL")
    return {"ok": True, "database": "existing Railway pgvector",
            "schema": "unni_clone", "records": counts,
            "source": "14 verified primary categories plus 88 public subcategories; original no-store HTML is not cached",
            "full_catalog_imported": False}


@app.get("/gateway/{service}/{rest:path}")
async def gateway(service: str, rest: str, request: Request):
    if service not in UPSTREAMS:
        raise HTTPException(status_code=404, detail="Unknown upstream service")
    # Raw URL path/query preserves original parameter order, encoding and key identity.
    raw_path = request.scope.get("raw_path", request.url.path.encode()).decode("ascii", "surrogateescape")
    prefix = f"/gateway/{service}/"
    if not raw_path.startswith(prefix):
        raise HTTPException(status_code=400, detail="Invalid gateway path")
    suffix = raw_path[len(prefix):]
    decoded = unquote(suffix)
    if (len(suffix) > 2048 or len(request.url.query) > 4096 or not suffix
            or decoded.startswith("/") or "\\" in decoded
            or any(part in (".", "..") for part in decoded.split("/"))
            or any(ch in decoded for ch in "\r\n\0")):
        raise HTTPException(status_code=400, detail="Invalid upstream path")
    query = request.scope.get("query_string", b"").decode("ascii", "surrogateescape")
    source_url = UPSTREAMS[service] + "/" + suffix + ("?" + query if query else "")
    if urlsplit(source_url).hostname != urlsplit(UPSTREAMS[service]).hostname:
        raise HTTPException(status_code=400, detail="Invalid host")

    variant = request_variant(request)
    cache_key = hashlib.sha256(json.dumps(
        {"service": service, "path": suffix, "query": query, "variant": variant},
        ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()).hexdigest()
    pool = getattr(request.app.state, "pg", None)
    can_cache = safe_public_request(request, decoded)
    if can_cache and pool is not None:
        try:
            record = await pool.fetchrow(
                "SELECT status_code, response_headers, raw_body, stored_at FROM unni_clone.original_response_cache WHERE cache_key=$1",
                cache_key,
            )
            if record:
                headers = dict(record["response_headers"])
                headers.update({"x-cache": "HIT", "x-data-source": "postgresql"})
                return Response(content=bytes(record["raw_body"]), status_code=record["status_code"], headers=headers)
        except Exception:
            log.exception("Cache read failed, continue with upstream")

    # Open upstream before returning the StreamingResponse so original status and
    # headers can be delivered unmodified (except transport/hop-by-hop fields).
    client = httpx.AsyncClient(follow_redirects=False, timeout=httpx.Timeout(30.0, connect=8.0))
    outbound_headers = {h: request.headers[h] for h in SAFE_REQUEST_HEADERS if h in request.headers}
    outbound_headers["accept-encoding"] = "identity"
    try:
        upstream = await client.send(client.build_request("GET", source_url, headers=outbound_headers), stream=True)
    except httpx.HTTPError:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Origin unavailable")
    should_store = bool(can_cache and pool is not None and public_response(upstream, variant))
    if can_cache and pool is not None and not should_store:
        log.warning("Public response cache bypass: service=%s status=%d set_cookie=%s cache_control=%s content_type=%s vary=%s",
                    service, upstream.status_code, "set-cookie" in upstream.headers,
                    upstream.headers.get("cache-control", "")[:80],
                    upstream.headers.get("content-type", "")[:80],
                    upstream.headers.get("vary", "")[:80])
    captured = Captured()

    async def bytes_to_client():
        try:
            async for chunk in upstream.aiter_raw():
                if should_store:
                    captured.append(chunk)
                yield chunk
            captured.completed = True
        finally:
            await upstream.aclose()
            await client.aclose()

    async def save_after_response():
        # Starlette invokes this only AFTER response body streaming finishes.
        # No DB INSERT is awaited on the client's response path.
        if not should_store or not captured.completed or captured.overflow or pool is None:
            return
        try:
            await pool.execute(
                """INSERT INTO unni_clone.original_response_cache
                   (cache_key, upstream_service, upstream_url, request_variant,
                    status_code, response_headers, raw_body, size_bytes)
                   VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8)
                   ON CONFLICT(cache_key) DO NOTHING""",
                cache_key, service, source_url, json.dumps(variant), upstream.status_code,
                json.dumps(filtered_response_headers(upstream.headers)),
                b"".join(captured.chunks), captured.size,
            )
        except Exception:
            log.exception("Background cache insert failed; original response was already sent")

    headers = filtered_response_headers(upstream.headers)
    headers.update({"x-cache": "MISS" if should_store else "BYPASS", "x-data-source": "origin"})
    return StreamingResponse(bytes_to_client(), status_code=upstream.status_code, headers=headers,
                             background=BackgroundTask(save_after_response))
