"""Public-source browser/data gateway for the independently deployed MyDoctor study.

The project stores permitted public factual metadata in mydoctor_clone within
the EXISTING PostgreSQL. It never writes to unni_clone, never fetches authenticated
third-party content and never claims to confirm real medical bookings.
"""
from __future__ import annotations
import os, re, json, hashlib, logging, asyncio
from contextlib import asynccontextmanager
from urllib.parse import unquote, urlsplit, parse_qsl
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from .catalog_schema import SCHEMA
from .source_parser import extract_page, source_key
from .sitemap_index import sync_public_index,backfill_existing_route_types
from .public_facts import extract_public_facts,seed_observed_facts,seed_menu_facts,insert_facts,safe_route

try:
    import asyncpg
except ImportError:
    asyncpg = None
LOG = logging.getLogger("mydoctor.gateway")
BASE = "https://my-doctor.io"
SENSITIVE = re.compile(r"(token|auth|session|password|secret|cookie|email|phone|patient|member|user|order|payment|reservation|consultation)",re.I)
ALLOWED = ("/","/hospital","/medical-cost","/telemedicine","/healthLab","/medicine","/pharmacy","/health","/medicineInfo","/price","/dept-hub","/map","/qna","/company","/event","/sitemap")
MAX_BYTES=4*1024*1024

def is_allowed_path(path: str) -> bool:
    return path == "/" or any(path == p or path.startswith(p+"/") for p in ALLOWED if p!="/")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool=None
    dsn=os.getenv("DATABASE_URL")
    if dsn and asyncpg:
        try:
            pool=await asyncpg.create_pool(dsn=dsn,min_size=1,max_size=3,timeout=8)
            async with pool.acquire() as c: await c.execute(SCHEMA)
            app.state.pool=pool
            await seed_observed_facts(pool)
            await seed_menu_facts(pool)
            if os.getenv("SITEMAP_SYNC_ENABLED","1")=="1":
                async def refresh_types_and_sitemaps():
                    await backfill_existing_route_types(pool)
                    await sync_public_index(pool)
                app.state.sitemap_task=asyncio.create_task(refresh_types_and_sitemaps())
        except Exception:
            LOG.exception("mydoctor schema startup failed")
    yield
    task=getattr(app.state,"sitemap_task",None)
    if task and not task.done():
        task.cancel()
        try: await task
        except asyncio.CancelledError: pass
    if app.state.pool:
        await app.state.pool.close()

app=FastAPI(title="Independent MyDoctor public-source clone API",lifespan=lifespan)
origins=[x.strip() for x in os.getenv("FRONTEND_ORIGINS","http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_methods=["GET"],allow_headers=["*"],expose_headers=["x-cache","x-data-source"])

@app.get("/health")
async def health(request:Request):
    pool=request.app.state.pool
    return {"ok":True,"database":"connected" if pool else "not_connected",
            "schema":"mydoctor_clone","source":BASE,"source_mode":"public GET only"}

@app.get("/catalog/status")
async def catalog_status(request:Request):
    pool=request.app.state.pool
    if not pool: raise HTTPException(503,"Database not connected")
    tables=("source_records","original_response_cache","departments","symptoms","hospitals","hospital_price_items","medical_cost_categories","source_assets")
    counts={}
    for name in tables:
        counts[name]=int(await pool.fetchval(f"SELECT count(*) FROM mydoctor_clone.{name}"))
    facts=await pool.fetch("SELECT quality,COUNT(*) AS n FROM mydoctor_clone.public_page_facts GROUP BY quality")
    fact_counts={row["quality"]:int(row["n"]) for row in facts}
    counts["public_page_facts"]=sum(fact_counts.values())
    fetched=await pool.fetchval("""SELECT COUNT(*) FROM mydoctor_clone.source_records
      WHERE source_evidence='origin_200'""")
    indexed=await pool.fetchval("SELECT COUNT(*) FROM mydoctor_clone.original_routes")
    return {"ok":True,"schema":"mydoctor_clone","records":counts,
            "indexed_public_route_urls":int(indexed),"http_200_original_pages":int(fetched),
            "public_facts_by_quality":fact_counts,
            "full_catalog_imported":False,
            "note":"Indexed URLs and unverified legacy rows are not verified source content."}

@app.get("/catalog/coverage")
async def catalog_coverage(request:Request):
    pool=request.app.state.pool
    if not pool:raise HTTPException(503,"Database unavailable")
    rows=await pool.fetch("""SELECT source_section,COUNT(*) AS discovered,
      COUNT(data_verified_at) AS data_verified,
      COUNT(clone_verified_at) AS clone_verified
      FROM mydoctor_clone.original_routes GROUP BY source_section ORDER BY COUNT(*) DESC""")
    types=await pool.fetch("""SELECT template_key AS template,COUNT(*) AS discovered,
      COUNT(data_verified_at) AS data_verified,
      COUNT(clone_verified_at) AS clone_verified,
      MIN(original_url) AS example_url
      FROM mydoctor_clone.original_routes GROUP BY template_key ORDER BY COUNT(*) DESC""")
    checks=await pool.fetch("""SELECT sitemap_url,http_status,url_count,error,last_attempt_at
      FROM mydoctor_clone.sitemap_imports ORDER BY sitemap_url""")
    return {"discovered_routes":sum(int(r["discovered"]) for r in rows),
            "data_verified_routes":sum(int(r["data_verified"]) for r in rows),
            "clone_verified_routes":sum(int(r["clone_verified"]) for r in rows),
            "sections":[dict(r) for r in rows],
            "page_types":[dict(r) for r in types],
            "test_policy":"One representative path per distinct UI/interaction template, plus separately verified unique behaviors.",
            "sitemaps":[{"url":r["sitemap_url"],"status":r["http_status"],
                         "indexed":r["url_count"],"error":r["error"],
                         "last_checked":r["last_attempt_at"].isoformat()} for r in checks],
            "notice":"Site URL index is not equivalent to collected original content or functional parity."}

@app.get("/catalog/routes")
async def catalog_routes(request:Request,section:str="",limit:int=40,offset:int=0):
    pool=request.app.state.pool
    if not pool:raise HTTPException(503,"Database unavailable")
    if limit<1 or limit>100 or offset<0 or offset>1000000:
        raise HTTPException(400,"Invalid pagination")
    rows=await pool.fetch("""SELECT original_url,route_path,source_section,
      source_verified_at,data_verified_at,clone_verified_at
      FROM mydoctor_clone.original_routes
      WHERE ($1='' OR source_section=$1)
      ORDER BY original_url LIMIT $2 OFFSET $3""",section,limit,offset)
    return {"section":section,"limit":limit,"offset":offset,
            "routes":[{"original_url":r["original_url"],"path":r["route_path"],
                       "section":r["source_section"],
                       "source_verified":r["source_verified_at"] is not None,
                       "data_verified":r["data_verified_at"] is not None,
                       "clone_verified":r["clone_verified_at"] is not None} for r in rows]}

@app.get("/catalog/page")
async def catalog_page(request:Request,path:str="/"):
    """DB first. On MISS collect only allowed public factual metadata from original.
    HTML marked no-store/private is NEVER retained. On origin 403/429, only
    already persisted verified factual data can be returned.
    """
    route=safe_route(path)
    if route is None or not is_allowed_path(urlsplit(route).path):
        raise HTTPException(400,"Invalid public source path")
    if request.headers.get("authorization") or request.headers.get("cookie"):
        raise HTTPException(403,"Authenticated data cannot be used")
    source_url=BASE+route
    pool=request.app.state.pool
    if pool is None:
        raise HTTPException(503,"PostgreSQL unavailable")
    row=await pool.fetchrow("""SELECT facts,quality,source_evidence,observed_at
         FROM mydoctor_clone.public_page_facts WHERE original_url=$1""",source_url)
    if row:
        data=json.loads(row["facts"]) if isinstance(row["facts"],str) else dict(row["facts"])
        return JSONResponse({"ok":True,"cache":"HIT","from":"postgresql",
             "quality":row["quality"],"source_evidence":row["source_evidence"],
             "facts":data,"complete_original_data":False},
            headers={"x-cache":"HIT","x-data-source":"postgresql",
                     "x-fact-quality":row["quality"]})
    # First visit: the original is requested only after a DB miss.
    async with httpx.AsyncClient(timeout=httpx.Timeout(24,connect=8),
                follow_redirects=False) as client:
        try:
            upstream=await client.get(source_url,headers={
                "accept":"text/html","accept-language":"ko-KR,ko;q=0.9",
                "user-agent":"MyDoctorPublicFactReader/1.0"})
        except httpx.HTTPError:
            raise HTTPException(502,"Original publicly accessible page unavailable")
    if upstream.status_code!=200:
        return JSONResponse(status_code=503,content={
          "ok":False,"source_status":upstream.status_code,
          "error":"ORIGINAL_PUBLIC_SOURCE_UNAVAILABLE","route":route,
          "cache":"MISS","complete_original_data":False},
          headers={"cache-control":"no-store","x-cache":"MISS"})
    content_type=upstream.headers.get("content-type","").lower()
    if not content_type.startswith("text/html") or len(upstream.content)>MAX_BYTES:
        raise HTTPException(502,"Unsupported public content")
    facts=extract_public_facts(upstream.content,source_url)
    if not (facts.get("title") or facts.get("headline")):
        raise HTTPException(502,"No factual source metadata extracted")
    try:
        await insert_facts(pool,facts,overwrite=True)
    except Exception:
        LOG.exception("Public facts could not be persisted to PostgreSQL")
        raise HTTPException(503,"Database write failed; original facts are uncommitted")
    return JSONResponse({"ok":True,"cache":"MISS","from":"original_public_facts",
       "quality":facts["quality"],"source_evidence":facts["source_evidence"],
       "facts":facts,"complete_original_data":False},
       headers={"x-cache":"MISS","x-data-source":"origin-public-facts",
                "x-fact-quality":facts["quality"]})

@app.get("/catalog/page-cache/status")
async def public_cache_status(request:Request):
    pool=request.app.state.pool
    if not pool:raise HTTPException(503,"PostgreSQL unavailable")
    rows=await pool.fetch("SELECT quality,COUNT(*) AS n FROM mydoctor_clone.public_page_facts GROUP BY quality")
    return {"database":"mydoctor_clone.public_page_facts",
        "total":sum(int(x["n"]) for x in rows),
        "by_quality":{x["quality"]:int(x["n"]) for x in rows},
        "cache_mode":"DB_FIRST_PUBLIC_FACTS","raw_no_store_html_cached":False,
        "full_catalog_imported":False}

async def ingest(pool,url:str,body:bytes,status:int):
    if pool is None or status!=200 or len(body)>MAX_BYTES:return
    data=extract_page(body,url)
    async with pool.acquire() as c:
        async with c.transaction():
            await c.execute("""INSERT INTO mydoctor_clone.source_records(source_key,original_url,page_kind,title,response_status)
                 VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_key) DO UPDATE
                 SET title=EXCLUDED.title,fetched_at=NOW(),response_status=EXCLUDED.response_status""",
                source_key(url),url,data["kind"],data["title"],status)
            await c.execute("""UPDATE mydoctor_clone.source_records
              SET source_evidence='origin_200' WHERE source_key=$1""",source_key(url))
            await c.execute("""UPDATE mydoctor_clone.original_routes
              SET source_verified_at=NOW(),last_status=200
              WHERE original_url=$1""",url)
            for row in data["departments"]:
                await c.execute("""INSERT INTO mydoctor_clone.departments(source_key,name,original_url)
                  VALUES($1,$2,$3) ON CONFLICT(source_key) DO UPDATE SET name=EXCLUDED.name,fetched_at=NOW()""",
                    source_key(row["url"]),row["name"],row["url"])
            for row in data["cost_categories"]:
                await c.execute("""INSERT INTO mydoctor_clone.medical_cost_categories(source_key,name,original_url)
                  VALUES($1,$2,$3) ON CONFLICT(source_key) DO UPDATE SET name=EXCLUDED.name,fetched_at=NOW()""",
                    source_key(row["url"]),row["name"],row["url"])
            if data["hospital"]:
                h=data["hospital"]
                await c.execute("""INSERT INTO mydoctor_clone.hospitals(original_hospital_id,name,address,phone,original_url)
                  VALUES($1,$2,$3,$4,$5) ON CONFLICT(original_hospital_id) DO UPDATE
                  SET name=EXCLUDED.name,address=CASE WHEN EXCLUDED.address<>'' THEN EXCLUDED.address ELSE mydoctor_clone.hospitals.address END,
                  fetched_at=NOW()""",h["id"],h["name"],h["address"],h["phone"],url)
                for i,row in enumerate(data["hospital_prices"],1):
                    await c.execute("""INSERT INTO mydoctor_clone.hospital_price_items(original_hospital_id,ordinal,item_name,price_text,details)
                      VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(original_hospital_id,ordinal)
                      DO UPDATE SET item_name=EXCLUDED.item_name,price_text=EXCLUDED.price_text,details=EXCLUDED.details,fetched_at=NOW()""",
                      h["id"],i,row["name"],row["price"],json.dumps(row["extra"],ensure_ascii=False))

@app.get("/gateway/public-web/{rest:path}")
async def gateway(rest:str,request:Request,background_tasks:BackgroundTasks):
    raw_path=request.scope.get("raw_path",b"").decode("utf-8","surrogateescape")
    prefix="/gateway/public-web/"
    if not raw_path.startswith(prefix):
        raise HTTPException(400,"Invalid proxy route")
    raw_suffix=raw_path[len(prefix):]
    path="/"+unquote(raw_suffix)
    if not is_allowed_path(path) or ".." in path or "\\" in path or "\x00" in path or len(path)>1500:
        raise HTTPException(400,"Not a permitted public route")
    if request.headers.get("authorization") or request.headers.get("cookie"):
        raise HTTPException(403,"Authenticated requests are not proxied")
    query=request.scope.get("query_string",b"").decode("utf-8","replace")
    if len(query)>1800 or any(SENSITIVE.search(k) for k,v in parse_qsl(query,keep_blank_values=True)):
        raise HTTPException(403,"Personal or private requests are not proxied")
    original_url=BASE+path+("?" +query if query else "")
    key=source_key(original_url)
    pool=request.app.state.pool
    if pool:
        try:
            row=await pool.fetchrow("SELECT raw_body,content_type FROM mydoctor_clone.original_response_cache WHERE cache_key=$1",key)
            if row:
                return Response(content=bytes(row["raw_body"]),media_type=row["content_type"],headers={"x-cache":"HIT","x-data-source":"postgresql"})
        except Exception: LOG.exception("cache read failed")
    async with httpx.AsyncClient(timeout=httpx.Timeout(25,connect=8),follow_redirects=False) as client:
        try:
            upstream=await client.get(original_url,headers={"accept":"text/html","accept-language":"ko-KR,ko;q=0.9","user-agent":"Mozilla/5.0 MyDoctorPublicStudy/1.0"})
        except httpx.HTTPError as e:
            LOG.warning("origin network error: %s",type(e).__name__)
            raise HTTPException(502,"Original source unavailable")
    if upstream.status_code in (301,302,307,308):
        return Response(status_code=upstream.status_code,headers={"location":upstream.headers.get("location","/")})
    # Never treat handcrafted placeholder data as observed original content.
    if upstream.status_code in (403,429):
        if pool:
            try:
                await pool.execute("""UPDATE mydoctor_clone.original_routes
                  SET last_status=$2 WHERE original_url=$1""",original_url,upstream.status_code)
            except Exception:
                LOG.exception("Failed to record public origin rate limit")
        return JSONResponse(status_code=503,
            content={"error":"ORIGIN_TEMPORARILY_UNAVAILABLE",
                     "origin_http_status":upstream.status_code,
                     "original_url":original_url,
                     "detail":"Source data unavailable; clone parity unverified"},
            headers={"x-data-source":"origin-unavailable","cache-control":"no-store"})
    body=upstream.content
    if len(body)>MAX_BYTES*2:raise HTTPException(502,"Origin payload too large")
    content_type=upstream.headers.get("content-type","text/html").split(";")[0].strip()
    cache_control=upstream.headers.get("cache-control","").lower()
    if upstream.status_code==200 and pool and content_type=="text/html" and len(body)<=MAX_BYTES:
        background_tasks.add_task(ingest,pool,original_url,body,upstream.status_code)
    if upstream.status_code==200 and pool and len(body)<=MAX_BYTES and "no-store" not in cache_control and "private" not in cache_control and "public" in cache_control and "set-cookie" not in upstream.headers:
        async def cache():
            try:
                await pool.execute("""INSERT INTO mydoctor_clone.original_response_cache
                  (cache_key,original_url,content_type,cache_control,raw_body,size_bytes)
                  VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(cache_key) DO NOTHING""",
                  key,original_url,content_type,cache_control,body,len(body))
            except Exception: LOG.exception("cache insertion failed")
        background_tasks.add_task(cache)
    return Response(content=body,status_code=upstream.status_code,
                    media_type=content_type,background=background_tasks,
                    headers={"x-cache":"MISS","x-data-source":"origin"})
