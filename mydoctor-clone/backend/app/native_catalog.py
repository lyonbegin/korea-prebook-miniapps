"""Conservative native-app public JSON connector for MyDoctor Android 6.50.0.

Proof: static Hermes string table inside user-supplied XAPK.
The string table proves a path exists but does NOT prove a GET method, public
access, request parameters, or a response schema. All paths here remain
runtime-UNVERIFIED until a valid anonymous JSON response is actually observed.

Never forward credentials, private session data, arbitrary URLs, POSTs or
patient-specific routes. Native JSON is surfaced immediately on a cache MISS
and stored in the isolated mydoctor_clone schema after the response.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from urllib.parse import urlencode
from typing import Any

import httpx
from fastapi import BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse

LOG = logging.getLogger("mydoctor.native")
ORIGIN = "https://api-prod.merakiplace.work"
SOURCE_VERSION = "6.50.0"
MAX_BODY = 1024 * 1024
MAX_DEPTH = 18

# Only read-oriented catalog endpoints observed literally in the 6.50.0 bundle.
# GET is a controlled probe hypothesis, not a recovered method declaration.
NATIVE_RESOURCES = {
    "home-menu": ("patient-api/app/home-menu/", ()),
    "home-banner": ("patient-api/app/app-banner/", ("expose_place",)),
    "app-config": ("patient-api/app/configure/", ()),
    "doctor-list": ("patient-api/doctor/doctors/", ("page", "limit", "size", "offset", "sorting", "symptom", "department")),
    "hospital-list": ("patient-api/hospital/", ("page", "limit", "size", "offset", "region", "department")),
    "pharmacy-nearby": ("patient-api/pharmacist/v2/nearby-pharmacy", ("latitude", "longitude", "lat", "lng", "page", "limit")),
    "lowest-price": ("patient-api/medical-map/lowest-price/v2", ("latitude", "longitude", "lat", "lng", "region", "page", "limit")),
    "health-info": ("patient-api/health-lab/v2/home/", ("page", "limit")),
}

# PII/auth/user-specific fields should never transit through a shared public cache.
# Business listing names, descriptions, map coordinates and prices are allowed.
BLOCKED_KEY = re.compile(
    r"(?:^|_)(?:user|users|member|members|patient|patients|owner|"
    r"token|authorization|password|passwords|credential|secret|session|"
    r"email|mobile_phone|cellphone|birthday|birthdate|resident_number|"
    r"personal_id|fcm_token|push_token|refresh_token|access_token|"
    r"payment_method|credit_card|card_number|account_number|"
    r"address_detail|ssn)(?:$|_)", re.I
)
BLOCKED_VALUE = re.compile(
    r"(?:Bearer\\s+[A-Za-z0-9._~+/-]{12,}|"
    r"(?<![\\w.+-])[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}(?!\\w))", re.I
)
NUMBER_FIELD = {"page", "limit", "size", "offset", "latitude", "longitude", "lat", "lng"}
TEXT_FIELD = {"expose_place", "sorting", "symptom", "department", "region"}

NATIVE_CACHE_SCHEMA = """
CREATE SCHEMA IF NOT EXISTS mydoctor_clone;
CREATE TABLE IF NOT EXISTS mydoctor_clone.native_public_api_cache (
  cache_key text PRIMARY KEY,
  resource text NOT NULL,
  source_path text NOT NULL,
  query_string text NOT NULL DEFAULT '',
  response_json jsonb NOT NULL,
  origin_status integer NOT NULL,
  source_version text NOT NULL DEFAULT '6.50.0',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS native_public_api_cache_resource_idx
 ON mydoctor_clone.native_public_api_cache(resource,fetched_at DESC);
"""

def public_inventory() -> dict:
    return {
        "source": "Android 6.50.0 Hermes string table",
        "origin": ORIGIN,
        "evidence": "static_path_only",
        "runtime_method": "GET_probe_unverified",
        "response_schema": "unverified_until_successful_anonymous_JSON",
        "resources": [
            {"name": name, "source_path": path,
             "method": "GET_UNVERIFIED", "query_keys": list(keys)}
            for name, (path, keys) in NATIVE_RESOURCES.items()
        ],
        "excluded": "all authenticated, user-specific and reservation-mutation routes",
    }

def sanitize_public_json(value: Any, depth: int = 0) -> Any:
    """Remove private fields from public catalog JSON; fail closed on unsupported nodes."""
    if depth > MAX_DEPTH:
        raise ValueError("Unexpectedly nested original response")
    if isinstance(value, dict):
        result = {}
        for k, v in value.items():
            key = str(k)
            if BLOCKED_KEY.search(key) or len(key) > 100:
                continue
            result[key] = sanitize_public_json(v, depth + 1)
        return result
    if isinstance(value, list):
        if len(value) > 1000:
            raise ValueError("Original response exceeds public list limit")
        return [sanitize_public_json(v, depth + 1) for v in value]
    if isinstance(value, str):
        if len(value) > 16000:
            raise ValueError("Unexpectedly long JSON field")
        return "[REDACTED]" if BLOCKED_VALUE.search(value) else value
    if value is None or isinstance(value, (int, float, bool)):
        return value
    raise ValueError("Unsupported original JSON type")

def safe_parameters(resource: str, args) -> str:
    if resource not in NATIVE_RESOURCES:
        raise HTTPException(404, "Unknown native catalog resource")
    permitted = set(NATIVE_RESOURCES[resource][1])
    if len(list(args.multi_items())) > 12:
        raise HTTPException(400, "Too many native catalog parameters")
    query = []
    for key, val in args.multi_items():
        if key not in permitted:
            raise HTTPException(400, "Unverified or private query parameter")
        if len(val) > 80 or any(ord(c) < 32 for c in val):
            raise HTTPException(400, "Invalid native catalog parameter")
        if key in NUMBER_FIELD:
            try:
                num = float(val)
            except (TypeError, ValueError):
                raise HTTPException(400, "Invalid numeric native parameter")
            if not (-180 <= num <= 180) and key in ("latitude", "longitude", "lat", "lng"):
                raise HTTPException(400, "Coordinate out of range")
            if key in ("page", "offset", "size", "limit") and (not val.isdecimal() or int(val) > 2000):
                raise HTTPException(400, "Invalid pagination")
        elif key in TEXT_FIELD and not re.fullmatch(r"[\\w가-힣 .:-]{1,80}", val):
            raise HTTPException(400, "Invalid search parameter")
        query.append((key, val))
    return urlencode(sorted(query))

async def save_native_after_response(pool, key: str, resource: str, path: str, query: str, data: Any):
    try:
        await pool.execute(
            """INSERT INTO mydoctor_clone.native_public_api_cache
               (cache_key,resource,source_path,query_string,response_json,origin_status,source_version)
               VALUES($1,$2,$3,$4,$5::jsonb,200,$6)
               ON CONFLICT(cache_key) DO UPDATE SET
               response_json=EXCLUDED.response_json,
               fetched_at=now(), origin_status=200""",
            key, resource, path, query, json.dumps(data, ensure_ascii=False), SOURCE_VERSION,
        )
    except Exception:
        LOG.exception("Failed to persist anonymous native catalog resource %s", resource)

async def get_native_public_catalog(
    request: Request, background_tasks: BackgroundTasks, resource: str
):
    if request.headers.get("authorization") or request.headers.get("cookie"):
        raise HTTPException(403, "Credentials are not accepted by the public catalog")
    if resource not in NATIVE_RESOURCES:
        raise HTTPException(404, "Unknown native catalog resource")
    path, _ = NATIVE_RESOURCES[resource]
    query = safe_parameters(resource, request.query_params)
    key = hashlib.sha256((SOURCE_VERSION + ":" + resource + "?" + query).encode()).hexdigest()
    pool = request.app.state.pool
    if pool is None:
        raise HTTPException(503, "PostgreSQL unavailable")
    cached = await pool.fetchrow(
        """SELECT response_json,fetched_at FROM mydoctor_clone.native_public_api_cache
           WHERE cache_key=$1 AND fetched_at>now()-interval '24 hours'""",
        key,
    )
    if cached:
        data = cached["response_json"]
        if isinstance(data, str):
            data = json.loads(data)
        return JSONResponse(
            {"ok": True, "resource": resource, "cache": "HIT",
             "from": "postgresql", "data": data,
             "source_method": "GET_observed_on_origin_miss",
             "schema_verified": False},
            headers={"x-cache": "HIT", "x-data-source": "native-app-json-postgres"},
        )
    url = ORIGIN + "/" + path + ("?" + query if query else "")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(16, connect=6),
        follow_redirects=False,
        trust_env=False,
    ) as client:
        try:
            reply = await client.get(
                url, headers={"accept": "application/json",
                              "accept-language": "ko-KR,ko;q=0.9",
                              "user-agent": "MyDoctorNativePublicCatalogStudy/0.1"},
            )
        except httpx.HTTPError as exc:
            LOG.warning("Native API network unavailable %s: %s", resource, type(exc).__name__)
            return JSONResponse(
                status_code=503,
                content={"ok": False, "resource": resource,
                         "error": "NATIVE_API_NETWORK_UNAVAILABLE",
                         "method_and_schema_verified": False},
                headers={"cache-control": "no-store", "x-cache": "MISS"},
            )
    if reply.status_code != 200:
        return JSONResponse(
            status_code=503,
            content={"ok": False, "resource": resource, "cache": "MISS",
                     "origin_http_status": reply.status_code,
                     "error": "NATIVE_API_NOT_PUBLICLY_AVAILABLE",
                     "method_and_schema_verified": False},
            headers={"cache-control": "no-store", "x-cache": "MISS"},
        )
    if (not reply.headers.get("content-type", "").lower().startswith("application/json")
        or len(reply.content) > MAX_BODY
        or reply.headers.get("set-cookie")):
        raise HTTPException(502, "Not an eligible anonymous public JSON response")
    try:
        raw = reply.json()
        clean = sanitize_public_json(raw)
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(502, "Original public JSON response failed validation")
    if not isinstance(clean, (dict, list)) or not clean:
        raise HTTPException(502, "Empty original public JSON response")
    cache_control = reply.headers.get("cache-control", "").lower()
    cacheable = not any(x in cache_control for x in ("private", "no-store"))
    if cacheable:
        background_tasks.add_task(
            save_native_after_response, pool, key, resource, path, query, clean,
        )
    return JSONResponse(
        {"ok": True, "resource": resource, "cache": "MISS",
         "from": "original_android_api", "data": clean,
         "source_method": "GET_observed",
         "schema_verified": False,
         "cache_write": "queued_after_response" if cacheable else "blocked_by_origin_cache_control"},
        background=background_tasks,
        headers={"x-cache": "MISS", "x-data-source": "native-app-json",
                 "cache-control": "no-store"},
    )
