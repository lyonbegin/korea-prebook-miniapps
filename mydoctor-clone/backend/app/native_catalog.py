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
    # The original getHospitalListV2 uses HOSPITAL_BASE_ROUTE_V2 + '/'.
    # Runtime verified: GET allowed, but anonymous access returns 401.
    "hospital-list": ("patient-api/v2/hospital/",
                      ("offset", "limit", "vertical_key", "ordering", "city_ids", "district_ids")),
    "pharmacy-nearby": ("patient-api/pharmacist/v2/nearby-pharmacy", ("latitude", "longitude", "lat", "lng", "page", "limit")),
    # Verified with Hermes function 27181/27183 and original anonymous GET 200.
    "lowest-price-categories": ("patient-api/medical-map/lowest-price/categories",
                                ("vertical_key",)),
    # Verified with Hermes function 27189/27191 and original anonymous GET 200.
    "lowest-price": ("patient-api/medical-map/lowest-price/v2/regions",
                     ("category_id", "variant")),
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
    r"(?:Bearer\s+[A-Za-z0-9._~+/-]{12,}|"
    r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?!\w))", re.I
)
NUMBER_FIELD = {"page", "limit", "size", "offset", "latitude", "longitude", "lat", "lng", "category_id"}
TEXT_FIELD = {"expose_place", "sorting", "symptom", "department", "region", "vertical_key", "variant", "ordering"}

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
        "runtime_method": "GET for verified price categories/regions; others per-route unverified",
        "response_schema": "price GET confirmed; full per-field mapping not yet verified",
        "resources": [
            {"name": name, "source_path": path,
             "method": "GET_UNVERIFIED", "query_keys": list(keys)}
            for name, (path, keys) in NATIVE_RESOURCES.items()
        ],
        "excluded": "all authenticated, user-specific and reservation-mutation routes",
    }

def is_private_field(key: str) -> bool:
    """Check snake_case, camelCase, hyphenated and case-insensitive field names."""
    canonical = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key)
    canonical = re.sub(r"[^A-Za-z0-9]+", "_", canonical).lower()
    return bool(BLOCKED_KEY.search(canonical))


def sanitize_public_json(value: Any, depth: int = 0) -> Any:
    """Remove private fields from public catalog JSON; fail closed on unsupported nodes."""
    if depth > MAX_DEPTH:
        raise ValueError("Unexpectedly nested original response")
    if isinstance(value, dict):
        result = {}
        for k, v in value.items():
            key = str(k)
            if is_private_field(key) or len(key) > 100:
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

def public_json_shape(value: Any, depth: int = 0) -> Any:
    """Data-free shape summary; records only field names and JSON types."""
    if depth >= 4:
        return "nested"
    if isinstance(value, dict):
        return {str(key)[:70]: public_json_shape(v, depth + 1)
                for key, v in list(value.items())[:24]}
    if isinstance(value, list):
        return {"array_length": len(value),
                "first_item_shape": public_json_shape(value[0], depth + 1)
                    if value else "empty"}
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    return "null"


def log_native_shape(resource: str, data: Any, origin: str) -> None:
    schema = json.dumps(public_json_shape(data), ensure_ascii=False)
    logging.getLogger("uvicorn.error").info(
        "NATIVE_APK_650_JSON_SHAPE resource=%s from=%s shape=%s",
        resource, origin, schema[:2900],
    )


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
            if key in ("page", "offset", "size", "limit") and (not val.isdecimal() or int(val) > (100 if key in ("limit", "size") else 2000)):
                raise HTTPException(400, "Invalid pagination")
            if key == "category_id" and (not val.isdecimal() or int(val) < 1 or int(val) > 100000000):
                raise HTTPException(400, "Invalid price category id")
        elif key in ("city_ids","district_ids") and not re.fullmatch(r"\d{1,9}(,\d{1,9}){0,10}", val):
            raise HTTPException(400, "Invalid region code list")
        elif key in TEXT_FIELD and not re.fullmatch(r"[\w가-힣 .:-]{1,80}", val):
            raise HTTPException(400, "Invalid search parameter")
        query.append((key, val))
    return urlencode(sorted(query))

# Diagnostic path variants are derived from the 6.50.0 Hermes strings.
# Do not assume that a path found in the string table is a GET list endpoint.
# Anonymous GET only; no credentials, no mutations, no source response body logged.
NATIVE_FAILURE_PROBES = (
    ("hospital_original_guess", "GET", "/patient-api/hospital/"),
    ("hospital_v2_candidate", "GET", "/patient-api/v2/hospital"),
    ("hospital_v2_slash", "GET", "/patient-api/v2/hospital/"),
    ("lowest_price_v2", "GET", "/patient-api/medical-map/lowest-price/v2"),
    ("lowest_price_v2_slash", "GET", "/patient-api/medical-map/lowest-price/v2/"),
    ("lowest_price_v1", "GET", "/patient-api/medical-map/lowest-price"),
    # Actual suffixes recovered from Hermes function 27183/27187/27191.
    ("lowest_price_categories_actual", "GET", "/patient-api/medical-map/lowest-price/categories"),
    ("lowest_price_v1_regions_actual", "GET", "/patient-api/medical-map/lowest-price/regions"),
    ("lowest_price_v2_regions_actual", "GET", "/patient-api/medical-map/lowest-price/v2/regions"),
    ("lowest_price_v2_regions_options", "OPTIONS", "/patient-api/medical-map/lowest-price/v2/regions"),
    ("lowest_price_v2_options", "OPTIONS", "/patient-api/medical-map/lowest-price/v2"),
    ("lowest_price_v2_slash_options", "OPTIONS", "/patient-api/medical-map/lowest-price/v2/"),
    ("hospital_v2_options", "OPTIONS", "/patient-api/v2/hospital/"),
)

async def audit_source_endpoints_once(app) -> None:
    """Compare original anonymous HTTP status and expected list-route alternatives.

    Stores status-only diagnostics in application memory (never Postgres).
    Invoked once after deployment; one request per known code-string variant.
    """
    import asyncio
    app.state.native_path_diagnostics = {"state": "running", "results": {}}
    results = {}
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(9, connect=4),
            follow_redirects=False, trust_env=False,
        ) as client:
            for name, method, path in NATIVE_FAILURE_PROBES:
                try:
                    response = await client.request(
                        method, ORIGIN + path,
                        headers={
                            "accept": "application/json",
                            "accept-language": "ko-KR,ko;q=0.9",
                            "user-agent": "MyDoctorNativeStaticPathAudit/0.1",
                        },
                    )
                    item = {
                        "http_status": response.status_code,
                        "response_content_type": response.headers.get(
                            "content-type", ""
                        ).split(";")[0][:50],
                        "response_bytes": min(len(response.content), 2000000),
                        "redirected": response.status_code in (301,302,307,308),
                        "method": method,
                        "allow": response.headers.get("allow", "")[:100],
                        "location_kind": ("trailing_slash" if
                            response.headers.get("location", "").endswith("/") and
                            response.status_code in (301,302,307,308)
                            else None),
                    }
                    if (
                        response.status_code in (400, 404, 405, 422)
                        and item["response_content_type"] == "application/json"
                        and len(response.content) < 15000
                    ):
                        try:
                            body = response.json()
                            if isinstance(body, dict):
                                item["error_field_names"] = list(body)[:12]
                        except ValueError:
                            pass
                    results[name] = item
                except httpx.HTTPError as err:
                    results[name] = {
                        "network_exception": type(err).__name__
                    }
                LOG.warning("native-path-audit %s %s", name, results[name])
                await asyncio.sleep(0.15)
            # The original Hermes price screen uses route.params.verticalKey
            # with an observed 'mounjaro' default. Query categories first,
            # then use only IDs actually returned by the origin.
            try:
                cats = await client.get(
                    ORIGIN + "/patient-api/medical-map/lowest-price/categories",
                    params={"vertical_key": "mounjaro"},
                    headers={"accept": "application/json",
                             "user-agent": "MyDoctorNativeStaticPathAudit/0.1"},
                )
                cat_result = {"http_status": cats.status_code,
                              "query_key": "vertical_key",
                              "query_source": "Hermes app route default mounjaro",
                              "method": "GET"}
                found_ids = []
                if cats.status_code == 200 and cats.headers.get(
                        "content-type", "").startswith("application/json"):
                    body = sanitize_public_json(cats.json())
                    cat_result["shape"] = public_json_shape(body)
                    def walk_categories(value, depth=0):
                        if depth > 5 or len(found_ids) >= 8:
                            return
                        if isinstance(value, list):
                            for item in value[:20]:
                                walk_categories(item, depth+1)
                        elif isinstance(value, dict):
                            if ("id" in value and
                                isinstance(value["id"], (int, str)) and
                                str(value["id"]).isdigit()):
                                found_ids.append(str(value["id"]))
                            for key in ("data","results","categories","items",
                                        "list","children","subcategories"):
                                if key in value:
                                    walk_categories(value[key], depth+1)
                    walk_categories(body)
                else:
                    try:
                        cat_error=cats.json()
                        if isinstance(cat_error,dict):
                            cat_result["error_field_names"]=list(cat_error)[:8]
                    except ValueError:
                        pass
                results["lowest_categories_vertical_mounjaro"]=cat_result
                LOG.warning("native-path-audit categories-with-original-vertical %s",cat_result)
                if found_ids:
                    category_id=found_ids[0]
                    for variant in ("none","district"):
                        params={"category_id":category_id}
                        if variant != "none":
                            params["variant"]=variant
                        reg=await client.get(
                            ORIGIN + "/patient-api/medical-map/lowest-price/v2/regions",
                            params=params,
                            headers={"accept":"application/json",
                                     "user-agent":"MyDoctorNativeStaticPathAudit/0.1"},
                        )
                        item={"http_status":reg.status_code,
                              "category_id":"observed_from_original_categories",
                              "variant":variant,
                              "response_content_type":reg.headers.get(
                                  "content-type","").split(";")[0]}
                        if reg.status_code==200 and item["response_content_type"]=="application/json":
                            item["response_shape"]=public_json_shape(
                                sanitize_public_json(reg.json()))
                        elif item["response_content_type"]=="application/json":
                            try:
                                err=reg.json()
                                if isinstance(err,dict):
                                    item["error_field_names"]=list(err)[:8]
                            except ValueError:
                                pass
                        results["lowest_v2_regions_with_real_id_"+variant]=item
                        LOG.warning("native-path-audit lowest-v2-with-real-category %s",item)
            except (httpx.HTTPError,ValueError) as err:
                results["lowest_categories_vertical_mounjaro"]={
                    "error_type":type(err).__name__}
    except Exception as err:
        LOG.exception("Native static-path audit failed: %s", type(err).__name__)
    app.state.native_path_diagnostics = {
        "state": "complete",
        "source_evidence": "Android 6.50.0 Hermes static paths",
        "method": "unauthenticated GET; not original call graph",
        "results": results,
    }


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
    # The original app constructs GET /categories?vertical_key=... and
    # GET /v2/regions?category_id=... . Missing values MUST fail locally.
    if resource == "lowest-price-categories" and not request.query_params.get("vertical_key"):
        raise HTTPException(400, "vertical_key required by original app")
    if resource == "lowest-price" and not request.query_params.get("category_id"):
        raise HTTPException(400, "category_id required by original app")
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
        log_native_shape(resource, data, "postgresql")
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
        # Preserve the actual failure reason instead of converting EVERY
        # upstream 401, 404 and 405 into the same misleading HTTP 503.
        origin_failure = {
            400: "NATIVE_API_REQUIRED_PARAMETERS_UNKNOWN",
            401: "NATIVE_API_AUTHENTICATION_REQUIRED",
            403: "NATIVE_API_ACCESS_DENIED",
            404: "NATIVE_API_ENDPOINT_NOT_FOUND",
            405: "NATIVE_API_REQUEST_METHOD_NOT_ALLOWED",
            429: "NATIVE_API_RATE_LIMITED",
        }.get(reply.status_code, "NATIVE_API_UNAVAILABLE")
        gateway_status = 503 if reply.status_code == 429 or reply.status_code >= 500 else 502
        LOG.warning("Native API origin rejected %s: source_http=%s classification=%s",
                    resource, reply.status_code, origin_failure)
        return JSONResponse(
            status_code=gateway_status,
            content={"ok": False, "resource": resource, "cache": "MISS",
                     "origin_http_status": reply.status_code,
                     "error": origin_failure,
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
    log_native_shape(resource, clean, "original_json_200")
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
