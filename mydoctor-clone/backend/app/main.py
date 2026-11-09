"""Public-source browser/data gateway for the independently deployed MyDoctor study.

The project stores permitted public factual metadata in mydoctor_clone within
the EXISTING PostgreSQL. It never writes to unni_clone, never fetches authenticated
third-party content and never claims to confirm real medical bookings.
"""
from __future__ import annotations
import os, re, json, hashlib, logging
from contextlib import asynccontextmanager
from urllib.parse import unquote, urlsplit, parse_qsl
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
from .catalog_schema import SCHEMA
from .source_parser import extract_page, source_key
from .snapshots import snapshot_for

try:
    import asyncpg
except ImportError:
    asyncpg = None
LOG = logging.getLogger("mydoctor.gateway")
BASE = "https://my-doctor.io"
SENSITIVE = re.compile(r"(token|auth|session|password|secret|cookie|email|phone|patient|member|user|order|payment|reservation|consultation)",re.I)
ALLOWED = ("/","/hospital","/medical-cost","/telemedicine","/healthLab","/medicine","/pharmacy","/health","/medicineInfo","/price")
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
        except Exception:
            LOG.exception("mydoctor schema startup failed")
    yield
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
    return {"ok":True,"schema":"mydoctor_clone","records":counts,
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
    # The origin may throttle hosting IPs. Fall back only to dated observed
    # public FACTS and label the response; never misrepresent as live origin.
    if upstream.status_code in (403,429):
        observed=snapshot_for(path,query)
        if observed is not None:
            if pool:
                background_tasks.add_task(ingest,pool,original_url,observed,200)
            return Response(content=observed,status_code=200,media_type="text/html",
                headers={"x-cache":"BYPASS","x-data-source":"verified-public-snapshot-20261109"},
                background=background_tasks)
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
