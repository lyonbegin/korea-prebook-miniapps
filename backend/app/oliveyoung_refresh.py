"""Olive Young -> K-TAXBACK recurring collector job API.

Revives the actual C:\tour\olive.py pipeline (category page -> product-data
network response -> seed.py upsert), without a Windows Chrome dependency.
"""
from __future__ import annotations

import json, os, re, secrets, uuid, hashlib
from html import unescape
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from pathlib import Path
from fastapi import Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import MetaData, Table, inspect, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

def now():
    return datetime.now(timezone.utc).isoformat()

class RefreshIn(BaseModel):
    category_ids: list[str] = Field(default_factory=list, max_length=8)
    max_pages: int = Field(default=2, ge=1, le=100)

class CaptureIn(BaseModel):
    category_id: str
    page_index: int = Field(ge=1, le=100)
    source_url: str
    payload: dict

class ProductDetailIn(BaseModel):
    prdt_no: str
    source_url: str
    detail_data: dict | None = None
    details_info: dict | None = None

class CategoryDoneIn(BaseModel):
    category_id: str
    pages: int = Field(ge=0,le=100)
    exhausted: bool = False
    message: str = Field(default="",max_length=400)

class JobUpdate(BaseModel):
    state: str
    message: str = Field(default="", max_length=1200)

PRODUCT_FIELDS = {
    "brandNo":"brand_no","ctgrNo":"category_id","prdtName":"prdt_name",
    "korPrdtName":"prdt_name_kor","nrmlAmt":"nrml_amt",
    "minNrmlAmt":"min_nrml_amt","maxNrmlAmt":"max_nrml_amt",
    "saleAmt":"sale_amt","minSaleAmt":"min_sale_amt","maxSaleAmt":"max_sale_amt",
    "eventSlprcDscntRt":"event_slprc_dscnt_rt","discountRate":"discount_rate",
    "imagePath":"image_path","bestYn":"best_yn","newYn":"new_yn",
    "flashYn":"flash_yn","sellingFastYn":"selling_fast_yn",
    "giftYn":"gift_yn","soldOutYn":"sold_out_yn",
    "reviewCnt":"review_cnt","reviewScore":"avg_score",
    "minBuyPsbltQty":"min_buy_qty","maxBuyPsbltQty":"max_buy_qty",
    "optnName":"option_name","rgstDtm":"registered_at",
}
REAL_FIELDS={"nrml_amt","min_nrml_amt","max_nrml_amt","sale_amt","min_sale_amt",
             "max_sale_amt","event_slprc_dscnt_rt","discount_rate","avg_score"}
INT_FIELDS={"review_cnt","min_buy_qty","max_buy_qty"}
MAX_HITS=200

def normalize_hit(field):
    number=str(field.get("prdtNo") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{2,60}",number):
        return None
    item={"prdt_no":number}
    for src,dst in PRODUCT_FIELDS.items():
        value=field.get(src)
        if value is None or value=="":
            continue
        if dst=="prdt_name":
            from html import unescape
            value=unescape(str(value))
        if dst in REAL_FIELDS:
            try:value=float(value)
            except (ValueError,TypeError):continue
        if dst in INT_FIELDS:
            try:value=int(float(value))
            except (ValueError,TypeError):continue
        item[dst]=value
    if "prdt_name" not in item and field.get("prdtNameEn"):
        item["prdt_name"]=str(field["prdtNameEn"])
    if not item.get("prdt_name"):
        return None
    return item

def mount_oliveyoung_refresh(app,engine):
    with engine.begin() as c:
        c.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_refresh_jobs
          (id VARCHAR(36) PRIMARY KEY, state VARCHAR(24) NOT NULL,
           source VARCHAR(40) NOT NULL, category_ids TEXT NOT NULL,
           max_pages INTEGER NOT NULL, pages INTEGER NOT NULL,
           processed INTEGER NOT NULL, changed_prices INTEGER NOT NULL,
           message TEXT NOT NULL, created_at TEXT NOT NULL,
           started_at TEXT, finished_at TEXT)"""))
        c.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_price_history
          (id VARCHAR(36) PRIMARY KEY, prdt_no VARCHAR(60) NOT NULL,
           previous_price REAL, current_price REAL, source VARCHAR(40) NOT NULL,
           job_id VARCHAR(36) NOT NULL, observed_at TEXT NOT NULL)"""))

        c.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_capture_pages
          (job_id VARCHAR(36) NOT NULL, category_id TEXT NOT NULL, page_index INTEGER NOT NULL,
           source_url TEXT, raw_items INTEGER NOT NULL, normalized INTEGER NOT NULL,
           inserted INTEGER NOT NULL, updated INTEGER NOT NULL, verified INTEGER NOT NULL,
           brands INTEGER NOT NULL, categories INTEGER NOT NULL, filters INTEGER NOT NULL,
           fingerprint TEXT NOT NULL, sample_json TEXT NOT NULL, state TEXT NOT NULL,
           error TEXT NOT NULL, checked_at TEXT NOT NULL,
           PRIMARY KEY(job_id,category_id,page_index))"""))

        c.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_fullscan
           (id INTEGER PRIMARY KEY, active INTEGER NOT NULL, page_limit INTEGER NOT NULL,
            started_at TEXT NOT NULL, completed_at TEXT)"""))

    @app.get("/manager/ktaxback",response_class=HTMLResponse,include_in_schema=False)
    def original_collector_manager():
        return Path(__file__).with_name("ktaxback_collector.html").read_text(encoding="utf-8")

    def auth(v):
        key=os.getenv("ADMIN_API_TOKEN","")
        if not key or not v or not secrets.compare_digest(v,"Bearer "+key):
            raise HTTPException(401,"관리자 인증 필요")

    def ready():
        if not inspect(engine).has_table("korea_prebook_kt_products"):
            raise HTTPException(409,"K-TAXBACK 원본 상품 스키마를 먼저 이관해야 합니다")
        if not inspect(engine).has_table("korea_prebook_kt_categories"):
            raise HTTPException(409,"K-TAXBACK 카테고리 스키마를 먼저 이관해야 합니다")

    def categories():
        # Original 150 olive.py category targets, not imported old DB records.
        with engine.connect() as c:
            return [str(x) for x in c.execute(text(
                "SELECT category_id FROM korea_prebook_kt_category_targets ORDER BY priority")).scalars().all()]

    def job_record(jid):
        with engine.connect() as c:
            row=c.execute(text("SELECT * FROM korea_prebook_kt_refresh_jobs WHERE id=:id"),
                          {"id":jid}).mappings().first()
        if row is None:raise HTTPException(404,"작업 없음")
        return dict(row)

    def create_job(data:RefreshIn, auto=False):
        ready()
        available=[x for x in categories() if x!="1000000001"]
        known=set(categories())
        if data.category_ids:
            ids=list(dict.fromkeys(data.category_ids))
        else:
            with engine.connect() as c:
                previous=c.execute(text("""SELECT category_ids FROM korea_prebook_kt_refresh_jobs
                    WHERE source='oliveyoung' ORDER BY created_at DESC LIMIT 1""")).scalar_one_or_none()
            last=json.loads(previous)[-1] if previous else None
            start=(available.index(last)+1)%len(available) if last in available else 0
            ids=(available+available)[start:start+(8 if auto else 4)]
        if not ids or len(ids)>8 or any(cid not in known for cid in ids):
            raise HTTPException(422,"카테고리를 1~8개 선택하세요")
        with engine.begin() as c:
            existing=c.execute(text("""SELECT id FROM korea_prebook_kt_refresh_jobs
                WHERE state IN ('queued','running') LIMIT 1""")).scalar_one_or_none()
            if existing:raise HTTPException(409,"이미 수집 중: "+existing)
            jid=str(uuid.uuid4())
            c.execute(text("""INSERT INTO korea_prebook_kt_refresh_jobs
              (id,state,source,category_ids,max_pages,pages,processed,changed_prices,message,created_at)
              VALUES(:id,'queued','oliveyoung',:cats,:lim,0,0,0,:msg,:now)"""),
              {"id":jid,"cats":json.dumps(ids),"lim":data.max_pages,
               "msg":"scheduled" if auto else "manual","now":now()})
        return {"id":jid,"state":"queued","category_ids":ids,"max_pages":data.max_pages}

    @app.post("/manager/api/ktaxback/refresh/jobs",status_code=201)
    def queue(data:RefreshIn,authorization:str|None=Header(None)):
        auth(authorization)
        return create_job(data)

    @app.get("/manager/api/ktaxback/refresh/jobs")
    def jobs(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.connect() as c:
            rows=c.execute(text("""SELECT * FROM korea_prebook_kt_refresh_jobs
                ORDER BY created_at DESC LIMIT 50""")).mappings().all()
        return {"jobs":[dict(x) for x in rows]}

    @app.post("/manager/api/ktaxback/refresh/worker/recover")
    def recover_stale(authorization:str|None=Header(None)):
        auth(authorization)
        threshold=(datetime.now(timezone.utc)-timedelta(seconds=240)).isoformat()
        # started_at is refreshed by the worker's heartbeat and detail updates.
        with engine.begin() as c:
            stale=c.execute(text("""SELECT id,pages,processed FROM korea_prebook_kt_refresh_jobs
                WHERE state='running' AND started_at<:before"""),{"before":threshold}).mappings().all()
            for row in stale:
                c.execute(text("""UPDATE korea_prebook_kt_refresh_jobs
                 SET state='failed',message=:msg,finished_at=:now WHERE id=:id AND state='running'"""),
                 {"id":row["id"],"now":now(),
                  "msg":"Worker interrupted; verified pages="+str(row["pages"]) +
                        ", saved items="+str(row["processed"])+". Data preserved; next categories will continue."})
        return {"recovered":len(stale),"interrupted":[x["id"] for x in stale]}

    @app.post("/manager/api/ktaxback/refresh/worker/{jid}/heartbeat")
    def heartbeat(jid:str,authorization:str|None=Header(None)):
        auth(authorization)
        with engine.begin() as c:
            updated=c.execute(text("""UPDATE korea_prebook_kt_refresh_jobs
                SET started_at=:now WHERE id=:id AND state='running'"""),
                {"now":now(),"id":jid}).rowcount
        if not updated:raise HTTPException(409,"Job not running")
        return {"id":jid,"heartbeat":True}

    @app.get("/manager/api/ktaxback/refresh/worker/next")
    def next_job(authorization:str|None=Header(None)):
        auth(authorization)
        ready()
        # Scheduled work is generated only by the worker, whose environment
        # explicitly opts into OLIVEYOUNG_AUTO_REFRESH.
        with engine.begin() as c:
            query="SELECT id FROM korea_prebook_kt_refresh_jobs WHERE state='queued' ORDER BY created_at LIMIT 1"
            if engine.dialect.name=="postgresql":query+=" FOR UPDATE SKIP LOCKED"
            jid=c.execute(text(query)).scalar_one_or_none()
            if jid:
                c.execute(text("""UPDATE korea_prebook_kt_refresh_jobs
                    SET state='running',started_at=:t,message='browser starting' WHERE id=:id"""),
                    {"t":now(),"id":jid})
        if not jid:return {"job":None}
        row=job_record(jid)
        return {"job":{"id":jid,"categories":json.loads(row["category_ids"]),
                       "max_pages":row["max_pages"]}}

    class FullScanIn(BaseModel):
        max_pages: int = Field(default=30,ge=1,le=100)

    @app.post("/manager/api/ktaxback/refresh/fullscan",status_code=202)
    def start_fullscan(data:FullScanIn,authorization:str|None=Header(None)):
        auth(authorization);ready()
        with engine.begin() as c:
            c.execute(text("""INSERT INTO korea_prebook_kt_fullscan
             (id,active,page_limit,started_at,completed_at) VALUES(1,1,:pages,:now,NULL)
             ON CONFLICT(id) DO UPDATE SET active=1,page_limit=:pages,
             started_at=:now,completed_at=NULL"""),{"pages":data.max_pages,"now":now()})
            c.execute(text("""UPDATE korea_prebook_kt_category_targets SET
                last_state=NULL,last_checked=NULL,last_error=NULL,last_products=0"""))
        return {"active":True,"category_targets":len(categories()),
                "max_pages_per_category":data.max_pages,
                "existing_product_rows_preserved":True}

    @app.post("/manager/api/ktaxback/refresh/fullscan/stop")
    def stop_fullscan(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.begin() as c:
            c.execute(text("UPDATE korea_prebook_kt_fullscan SET active=0 WHERE id=1"))
        return {"active":False}

    @app.post("/manager/api/ktaxback/refresh/worker/auto")
    def auto(authorization:str|None=Header(None)):
        auth(authorization);ready()
        with engine.connect() as c:
            active_job=c.execute(text("""SELECT id FROM korea_prebook_kt_refresh_jobs
                 WHERE state IN ('queued','running') LIMIT 1""")).scalar_one_or_none()
            scan=c.execute(text("""SELECT active,page_limit FROM korea_prebook_kt_fullscan WHERE id=1""")).mappings().first()
        if active_job:return {"scheduled":False,"reason":"active_job"}
        if scan and scan["active"]:
            with engine.connect() as c:
                pending=[r[0] for r in c.execute(text("""SELECT category_id
                 FROM korea_prebook_kt_category_targets WHERE last_checked IS NULL
                 ORDER BY priority LIMIT 2""")).all()]
            if pending:
                return {"scheduled":True,
                        "job":create_job(RefreshIn(category_ids=pending,max_pages=scan["page_limit"]),auto=True)}
            with engine.begin() as c:
                c.execute(text("""UPDATE korea_prebook_kt_fullscan SET active=0,completed_at=:t
                                  WHERE id=1"""),{"t":now()})
            return {"scheduled":False,"reason":"fullscan_finished"}
        # If DB is empty, run pilot independently of any legacy SQLite import.
        with engine.connect() as c:
            total=c.execute(text("SELECT COUNT(*) FROM korea_prebook_kt_refresh_jobs")).scalar_one()
            recent=c.execute(text("""SELECT created_at FROM korea_prebook_kt_refresh_jobs
                 ORDER BY created_at DESC LIMIT 1""")).scalar_one_or_none()
        with engine.connect() as c:
            verified=c.execute(text("SELECT count(*) FROM korea_prebook_kt_capture_pages WHERE state='verified'")).scalar_one()
            failures=c.execute(text("SELECT count(*) FROM korea_prebook_kt_refresh_jobs WHERE state='failed'")).scalar_one()
        if verified==0 and failures < 3:
            return {"scheduled":True,
                    "job":create_job(RefreshIn(category_ids=["1000000003"],max_pages=2),auto=True),
                    "mode":"first_live_pilot"}
        if verified==0:
            return {"scheduled":False,"reason":"pilot_failed_3_times_review_errors"}
        if verified and not scan:
            # First real read-after-write success gates full catalogue collection;
            # no user-provided legacy database may be imported as a shortcut.
            with engine.begin() as c:
                c.execute(text("""INSERT INTO korea_prebook_kt_fullscan
                 (id,active,page_limit,started_at,completed_at)
                 VALUES(1,1,30,:now,NULL) ON CONFLICT(id) DO NOTHING"""),
                 {"now":now()})
                c.execute(text("""UPDATE korea_prebook_kt_category_targets
                   SET last_checked=NULL,last_state=NULL,last_error=NULL,last_products=0"""))
            return {"scheduled":False,"reason":"pilot_verified_fullscan_initialized"}
        if recent:
            timestamp=datetime.fromisoformat(recent)
            cadence=max(1,int(os.getenv("OLIVEYOUNG_REFRESH_HOURS","3")))
            if timestamp>datetime.now(timezone.utc)-timedelta(hours=cadence):
                return {"scheduled":False,"reason":"not_due"}
        try:return {"scheduled":True,"job":create_job(RefreshIn(max_pages=2),auto=True)}
        except HTTPException as exc:
            if exc.status_code==409:return {"scheduled":False,"reason":"active_job"}
            raise

    @app.get("/manager/api/ktaxback/refresh/overview")
    def overview(authorization:str|None=Header(None)):
        auth(authorization)
        t=Table("korea_prebook_kt_products",MetaData(),autoload_with=engine)
        with engine.connect() as c:
            counts={}
            for name in ("products","brands","categories","category_filters","product_images",
                         "product_options","product_details","product_attributes"):
                counts[name]=c.execute(text("SELECT count(*) FROM korea_prebook_kt_"+name)).scalar_one()
            statuses=[dict(x) for x in c.execute(text("""
                SELECT category_id,priority,display_name,last_state,last_error,last_checked,
                  last_products FROM korea_prebook_kt_category_targets ORDER BY priority
            """)).mappings()]
            pages=[dict(x) for x in c.execute(text("""
                SELECT job_id,category_id,page_index,raw_items,normalized,inserted,updated,
                 verified,brands,categories,filters,state,error,checked_at,source_url
                 FROM korea_prebook_kt_capture_pages ORDER BY checked_at DESC LIMIT 100
            """)).mappings()]
        return {"source":"global.oliveyoung.com","original_category_targets":len(statuses),
                "catalogue_db":counts,"categories":statuses,"pages":pages,
                "legacy_db_imported":False}

    @app.get("/manager/api/ktaxback/refresh/catalogue")
    def catalogue(category_id:str="",q:str="",limit:int=30,
                  authorization:str|None=Header(None)):
        auth(authorization)
        if limit<1 or limit>100:raise HTTPException(422,"limit 1..100")
        t=Table("korea_prebook_kt_products",MetaData(),autoload_with=engine)
        query=select(t.c.prdt_no,t.c.prdt_name,t.c.brand_no,t.c.category_id,
                     t.c.sale_amt,t.c.nrml_amt,t.c.image_path)
        if category_id:query=query.where(t.c.category_id==category_id)
        if q:query=query.where(t.c.prdt_name.ilike("%"+q[:80]+"%"))
        with engine.connect() as c:
            rows=[dict(x) for x in c.execute(query.limit(limit)).mappings()]
        return {"rows":rows,"count":len(rows)}

    @app.post("/manager/api/ktaxback/refresh/worker/{jid}/category_done")
    def category_done(jid:str,data:CategoryDoneIn,authorization:str|None=Header(None)):
        auth(authorization)
        job=job_record(jid)
        if job["state"]!="running" or data.category_id not in json.loads(job["category_ids"]):
            raise HTTPException(409,"Category not in running job")
        if data.pages==0:
            result="failed"
        elif data.exhausted:
            result="complete"
        else:
            result="partial"
        with engine.begin() as c:
            c.execute(text("""UPDATE korea_prebook_kt_category_targets
              SET last_state=:state,last_checked=:ts,last_error=:msg
              WHERE category_id=:id"""),{"state":result,"ts":now(),
                "msg":data.message if result!="complete" else "",
                "id":data.category_id})
        return {"category_id":data.category_id,"state":result,
                "exhausted":data.exhausted,"pages":data.pages}

    @app.post("/manager/api/ktaxback/refresh/worker/{jid}/page_error")
    def page_error(jid:str,data:CaptureIn,authorization:str|None=Header(None)):
        auth(authorization)
        job=job_record(jid)
        if job["state"]!="running" or data.category_id not in json.loads(job["category_ids"]):
            raise HTTPException(409,"No running job for category")
        reason=str(data.payload.get("error") or "No Olive Young product-data response")[:1200]
        with engine.begin() as c:
            c.execute(text("""INSERT INTO korea_prebook_kt_capture_pages
                (job_id,category_id,page_index,source_url,raw_items,normalized,inserted,
                 updated,verified,brands,categories,filters,fingerprint,sample_json,state,error,checked_at)
                 VALUES(:job,:cat,:page,:url,0,0,0,0,0,0,0,0,'','[]','failed',:err,:at)
                 ON CONFLICT(job_id,category_id,page_index) DO UPDATE
                 SET state='failed',error=:err,checked_at=:at"""),
                 {"job":jid,"cat":data.category_id,"page":data.page_index,
                  "url":data.source_url[:1000],"err":reason,"at":now()})
            c.execute(text("""UPDATE korea_prebook_kt_category_targets
                SET last_state='failed',last_error=:error,last_checked=:at
                WHERE category_id=:id"""),{"error":reason,"at":now(),"id":data.category_id})
        return {"logged":True,"category":data.category_id,"error":reason}

    @app.post("/manager/api/ktaxback/refresh/worker/{jid}/capture")
    def capture(jid:str,data:CaptureIn,authorization:str|None=Header(None)):
        auth(authorization)
        ready()
        job=job_record(jid)
        if job["state"]!="running":raise HTTPException(409,"작업 실행 중이 아님")
        if data.category_id not in json.loads(job["category_ids"]) or data.page_index>job["max_pages"]:
            raise HTTPException(422,"작업 범위를 벗어난 응답")
        parsed=urlparse(data.source_url)
        if parsed.scheme!="https" or parsed.hostname!="global.oliveyoung.com":
            raise HTTPException(422,"허용되지 않은 출처")
        if not isinstance(data.payload.get("hits"),dict):
            raise HTTPException(422,"올리브영 product-data 응답 형식이 아님")
        hits=data.payload["hits"].get("hit",[])
        if not isinstance(hits,list) or len(hits)>MAX_HITS:
            raise HTTPException(422,"응답 개수 초과/형식 오류")
        unique={};fields={}
        for hit in hits:
            if isinstance(hit,dict) and isinstance(hit.get("fields"),dict):
                normalized=normalize_hit(hit["fields"])
                if normalized:
                    unique[normalized["prdt_no"]]=normalized
                    fields[normalized["prdt_no"]]=hit["fields"]
        if hits and not unique:
            raise HTTPException(422,"유효한 상품 식별번호를 찾지 못했습니다")
        fingerprint=hashlib.sha256(json.dumps(data.payload,
            ensure_ascii=False,sort_keys=True).encode()).hexdigest()
        p=Table("korea_prebook_kt_products",MetaData(),autoload_with=engine)
        b=Table("korea_prebook_kt_brands",MetaData(),autoload_with=engine)
        cat=Table("korea_prebook_kt_categories",MetaData(),autoload_with=engine)
        attrs=Table("korea_prebook_kt_product_attributes",MetaData(),autoload_with=engine)
        filters=Table("korea_prebook_kt_category_filters",MetaData(),autoload_with=engine)
        definitions=Table("korea_prebook_kt_attribute_defs",MetaData(),autoload_with=engine)
        old_added=updated=changes=brand_count=cat_count=filter_count=0
        seen={};new_fields=set(p.c.keys())
        dialect=engine.dialect.name
        def upsert(connection,table,row,keys):
            stmt=pg_insert(table).values(**row) if dialect=="postgresql" else sqlite_insert(table).values(**row)
            others={col:stmt.excluded[col] for col in row if col not in keys}
            if others:stmt=stmt.on_conflict_do_update(index_elements=keys,set_=others)
            else:stmt=stmt.on_conflict_do_nothing(index_elements=keys)
            connection.execute(stmt)

        with engine.begin() as c:
            existing=c.execute(text("""SELECT fingerprint,state FROM korea_prebook_kt_capture_pages
                WHERE job_id=:j AND category_id=:id AND page_index=:n"""),
                {"j":jid,"id":data.category_id,"n":data.page_index}).mappings().first()
            if existing:
                if existing["fingerprint"] != fingerprint:
                    raise HTTPException(409,"Different response for already saved page")
                return {"accepted":len(unique),"changed_prices":0,
                        "verified":len(unique),"duplicate_page":True,"job_id":jid}
            for facet in data.payload.get("categoryFacets") or []:
                textval=unescape(str(facet.get("value") or ""))
                if ">" in textval:
                    parent,rest=textval.split(">",1)
                else:
                    parent,rest=None,textval
                parts=rest.split("^")
                if len(parts)!=3:continue
                depth,cid,cname=parts
                if not re.fullmatch(r"\d{10}",cid):continue
                if not depth.isdigit():continue
                seen[cid]=(cname,parent,int(depth),int(facet.get("count") or 0))
            seen.setdefault(data.category_id,(data.category_id,None,9,0))
            # FK parent placeholders if observed category parent missing.
            for cid,(name,parent,depth,n) in seen.items():
                if parent and parent not in seen:
                    upsert(c,cat,{"category_id":parent,"category_name":parent,"depth":1,"product_count":0},["category_id"])
                previous=c.execute(select(cat.c.category_name).where(cat.c.category_id==cid)).scalar_one_or_none()
                updated_name=name if name!=cid else (previous or cid)
                upsert(c,cat,{"category_id":cid,"category_name":updated_name,"depth":depth,"parent_id":parent,"product_count":n},["category_id"])
                cat_count+=1
            facet_brands={}
            for facet in data.payload.get("brandFacets") or []:
                value=unescape(str(facet.get("value") or ""))
                split=value.split("^",1)
                if len(split)==2:facet_brands[split[0]]=split[1]
            for number,row in unique.items():
                raw=fields[number];brand=row.get("brand_no")
                if brand:
                    label=unescape(str(raw.get("brandName") or facet_brands.get(brand) or brand))
                    if label==brand:
                        old_brand=c.execute(select(b.c.brand_name).where(b.c.brand_no==brand)).scalar_one_or_none()
                        label=old_brand or label
                    upsert(c,b,{"brand_no":brand,"brand_name":label},["brand_no"])
                    brand_count+=1
                cid=row.get("category_id")
                if cid and cid not in seen:
                    upsert(c,cat,{"category_id":cid,"category_name":cid,"depth":9,"product_count":0},["category_id"])
                previous=c.execute(select(p).where(p.c.prdt_no==number)).mappings().first()
                record={k:v for k,v in row.items() if k in new_fields}
                if previous is None:
                    record.setdefault("nrml_amt",0.0);record.setdefault("sale_amt",0.0)
                    old_added+=1
                else:
                    updated+=1
                    for price_col in ("nrml_amt","sale_amt"):
                        if record.get(price_col)==0 and previous.get(price_col):
                            record.pop(price_col,None)
                upsert(c,p,record,["prdt_no"])
                new_price=record.get("sale_amt")
                old_price=previous.get("sale_amt") if previous else None
                if new_price is not None and old_price is not None and abs(float(new_price)-float(old_price))>0.0001:
                    c.execute(text("""INSERT INTO korea_prebook_kt_price_history
                      (id,prdt_no,previous_price,current_price,source,job_id,observed_at)
                      VALUES(:id,:prdt,:old,:new,'oliveyoung',:jid,:at)"""),
                      {"id":str(uuid.uuid4()),"prdt":number,"old":old_price,
                       "new":new_price,"jid":jid,"at":now()})
                    changes+=1
                for rawattr in raw.get("attrFacet") or []:
                    parts=str(rawattr).split(":")
                    if len(parts)<3:continue
                    group,label=unescape(parts[0].strip()),unescape(parts[-1].strip())
                    attr_id=parts[1].split("^")[-1]
                    if not group or not label:continue
                    if re.fullmatch(r"AT\d+",attr_id):
                        upsert(c,definitions,{"attr_id":attr_id,"attr_group":group,"attr_name":label},["attr_id"])
                    upsert(c,attrs,{"prdt_no":number,"attr_name":label,
                                   "attr_id":attr_id if re.fullmatch(r"AT\d+",attr_id) else None},
                           ["prdt_no","attr_name"])
            for rawattr in data.payload.get("attrFacets") or []:
                parts=str(rawattr.get("value") or "").split(":")
                if len(parts)<3:continue
                group,label=unescape(parts[0].strip()),unescape(parts[-1].strip())
                if not group or not label:continue
                # Original source has category-filter uniqueness on three fields.
                stmt=pg_insert(filters).values(category_id=data.category_id,
                      filter_group=group,option_name=label,option_count=int(rawattr.get("count") or 0)) if dialect=="postgresql" else sqlite_insert(filters).values(
                      category_id=data.category_id,filter_group=group,option_name=label,option_count=int(rawattr.get("count") or 0))
                c.execute(stmt.on_conflict_do_update(
                    index_elements=["category_id","filter_group","option_name"],
                    set_={"option_count":stmt.excluded.option_count}))
                filter_count+=1
            saved=set(c.execute(select(p.c.prdt_no).where(p.c.prdt_no.in_(list(unique)))).scalars().all()) if unique else set()
            if len(saved)!=len(unique):
                raise HTTPException(500,"DB read-after-write verification failed")
            c.execute(text("""INSERT INTO korea_prebook_kt_capture_pages
                (job_id,category_id,page_index,source_url,raw_items,normalized,inserted,updated,
                 verified,brands,categories,filters,fingerprint,sample_json,state,error,checked_at)
                VALUES(:j,:cid,:pg,:url,:raw,:norm,:ins,:upd,:verified,:brands,:cats,:flt,
                       :fingerprint,:sample,'verified','',:ts)"""),
                {"j":jid,"cid":data.category_id,"pg":data.page_index,"url":data.source_url[:1000],
                 "raw":len(hits),"norm":len(unique),"ins":old_added,"upd":updated,
                 "verified":len(saved),"brands":brand_count,"cats":cat_count,"flt":filter_count,
                 "fingerprint":fingerprint,
                 "sample":json.dumps(list(unique.values())[:2],ensure_ascii=False)[:7000],"ts":now()})
            c.execute(text("""UPDATE korea_prebook_kt_refresh_jobs
                SET pages=pages+1,processed=processed+:n,changed_prices=changed_prices+:changes,message=:msg
                WHERE id=:jid"""),
                {"n":len(saved),"changes":changes,"jid":jid,
                 "msg":data.category_id+" page "+str(data.page_index)+
                 " saved="+str(len(saved))+" new="+str(old_added)})
            c.execute(text("""UPDATE korea_prebook_kt_category_targets SET
                last_state='verified',last_error='',last_checked=:ts,
                last_products=last_products+:n,display_name=:name WHERE category_id=:id"""),
                {"id":data.category_id,"n":len(saved),"ts":now(),
                 "name":seen[data.category_id][0] if seen[data.category_id][0]!=data.category_id else None})
        return {"accepted":len(unique),"inserted":old_added,"updated":updated,
                "verified":len(saved),"brands":brand_count,"categories":cat_count,
                "filters":filter_count,"changed_prices":changes,"job_id":jid}

    @app.post("/manager/api/ktaxback/refresh/worker/{jid}/detail")
    def update_product_detail(jid:str,data:ProductDetailIn,
                              authorization:str|None=Header(None)):
        auth(authorization)
        job=job_record(jid)
        if job["state"]!="running":raise HTTPException(409,"작업 실행 중이 아님")
        if not re.fullmatch(r"[A-Za-z0-9_-]{2,60}",data.prdt_no):
            raise HTTPException(422,"잘못된 상품 번호")
        parsed=urlparse(data.source_url)
        if parsed.scheme!="https" or parsed.hostname!="global.oliveyoung.com":
            raise HTTPException(422,"출처가 올리브영이 아님")
        payload=(data.detail_data or {}).get("product")
        if not isinstance(payload,dict) or str(payload.get("prdtNo"))!=data.prdt_no:
            raise HTTPException(422,"상품번호와 상세 응답 불일치")
        details=(data.details_info or {}).get("details")
        if not isinstance(details,dict):details={}
        required=("korea_prebook_kt_product_options","korea_prebook_kt_product_images",
                  "korea_prebook_kt_product_details")
        if not all(inspect(engine).has_table(t) for t in required):
            raise HTTPException(409,"상품 상세·옵션·이미지 테이블을 먼저 이관해야 합니다")
        tables=[Table(n,MetaData(),autoload_with=engine) for n in required]
        opts,img,det=tables
        from html import unescape
        opts_list=payload.get("optionList") or []
        gallery=payload.get("thumbnailList") or []
        # Original seed.py deletes and rebuilds the complete options/gallery
        # for one product, keeping other languages' records.
        with engine.begin() as c:
            pr=Table("korea_prebook_kt_products",MetaData(),autoload_with=engine)
            old=c.execute(select(pr).where(pr.c.prdt_no==data.prdt_no)).mappings().first()
            if old is None:raise HTTPException(409,"목록 상품을 먼저 저장해야 합니다")
            updated=normalize_hit(payload)
            if updated:
                update={k:v for k,v in updated.items() if k in pr.c and k!="prdt_no"}
                for key in ("sale_amt","nrml_amt"):
                    if update.get(key)==0 and old.get(key):update.pop(key,None)
                if update:
                    c.execute(pr.update().where(pr.c.prdt_no==data.prdt_no).values(**update))
            c.execute(opts.delete().where(opts.c.prdt_no==data.prdt_no))
            for entry in opts_list[:100]:
                if not isinstance(entry,dict):continue
                name=entry.get("snglOptnNameEn") or entry.get("snglOptnName")
                if not name:continue
                try:price=float(entry.get("saleAmt")) if entry.get("saleAmt") is not None else None
                except (TypeError,ValueError):price=None
                c.execute(opts.insert().values(prdt_no=data.prdt_no,option_name=str(name)[:500],
                    sale_amt=price,in_stock=1 if entry.get("sellStatCode")=="10" else 0,
                    is_default=1 if entry.get("rprstYn")=="Y" else 0))
            c.execute(img.delete().where(
                (img.c.prdt_no==data.prdt_no)&(img.c.lang_code=="en")&
                (img.c.image_type.in_(["gallery","description"]))))
            images=[]
            for idx,entry in enumerate(gallery[:100]):
                if isinstance(entry,dict) and entry.get("imagePath"):
                    images.append({"prdt_no":data.prdt_no,"image_path":str(entry["imagePath"])[:1500],
                                   "image_type":"gallery","sort_order":idx,"lang_code":"en"})
            if details:
                raw=details.get("optimDtlDesc") or details.get("dtlDesc") or ""
                from html import unescape as html_unescape
                urls=re.findall(r'(?:data-src|src)="([^"]+)"',html_unescape(raw))
                for idx,u in enumerate(dict.fromkeys(urls)):
                    if not re.search(r"\.gif(?:\?|$)",u,re.I):
                        images.append({"prdt_no":data.prdt_no,"image_path":u[:1500],
                                       "image_type":"description","sort_order":idx,"lang_code":"en"})
            if images:c.execute(img.insert(),images)
            if details:
                row={"prdt_no":data.prdt_no,"lang_code":"en",
                     "why_we_love_it":unescape(str(details.get("whyWeLoveItText") or "")),
                     "featured_ingredients":unescape(str(details.get("ftrdIngrdText") or "")),
                     "how_to_use":unescape(str(details.get("howToUseText") or ""))}
                stmt=pg_insert(det).values(**row) if engine.dialect.name=="postgresql" else sqlite_insert(det).values(**row)
                c.execute(stmt.on_conflict_do_update(
                    index_elements=["prdt_no","lang_code"],
                    set_={k:stmt.excluded[k] for k in row if k not in ("prdt_no","lang_code")}))
        return {"prdt_no":data.prdt_no,"options":len(opts_list),"images":len(images),
                "description_updated":bool(details)}

    @app.post("/manager/api/ktaxback/refresh/worker/{jid}/finish")
    def finish(jid:str,data:JobUpdate,authorization:str|None=Header(None)):
        auth(authorization)
        if data.state not in ("completed","failed"):
            raise HTTPException(422,"종료 상태 오류")
        row=job_record(jid)
        if row["state"]!="running":raise HTTPException(409,"상태 전환 불가")
        state=data.state
        if state=="completed" and row["pages"]==0:state="failed"
        with engine.begin() as c:
            c.execute(text("""UPDATE korea_prebook_kt_refresh_jobs
               SET state=:state,message=:msg,finished_at=:t WHERE id=:jid"""),
               {"state":state,"msg":(data.message or ("No responses" if state=="failed" else "Done")),
                "t":now(),"jid":jid})
        return {"id":jid,"state":state,"pages":row["pages"],"processed":row["processed"],
                "changed_prices":row["changed_prices"]}
