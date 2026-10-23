"""Olive Young -> K-TAXBACK recurring collector job API.

Revives the actual C:\tour\olive.py pipeline (category page -> product-data
network response -> seed.py upsert), without a Windows Chrome dependency.
"""
from __future__ import annotations

import json, os, re, secrets, uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from fastapi import Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import MetaData, Table, inspect, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

def now():
    return datetime.now(timezone.utc).isoformat()

class RefreshIn(BaseModel):
    category_ids: list[str] = Field(default_factory=list, max_length=8)
    max_pages: int = Field(default=2, ge=1, le=10)

class CaptureIn(BaseModel):
    category_id: str
    page_index: int = Field(ge=1, le=10)
    source_url: str
    payload: dict

class ProductDetailIn(BaseModel):
    prdt_no: str
    source_url: str
    detail_data: dict | None = None
    details_info: dict | None = None

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
        t=Table("korea_prebook_kt_categories",MetaData(),autoload_with=engine)
        with engine.connect() as c:
            return [str(x) for x in c.execute(select(t.c.category_id)).scalars().all()]

    def job_record(jid):
        with engine.connect() as c:
            row=c.execute(text("SELECT * FROM korea_prebook_kt_refresh_jobs WHERE id=:id"),
                          {"id":jid}).mappings().first()
        if row is None:raise HTTPException(404,"작업 없음")
        return dict(row)

    def create_job(data:RefreshIn, auto=False):
        ready()
        known=set(categories())
        ids=data.category_ids or [x for x in categories() if x!="1000000001"][:4]
        ids=list(dict.fromkeys(ids))
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

    @app.post("/manager/api/ktaxback/refresh/worker/auto")
    def auto(authorization:str|None=Header(None)):
        auth(authorization);ready()
        with engine.connect() as c:
            recent=c.execute(text("""SELECT created_at FROM korea_prebook_kt_refresh_jobs
                ORDER BY created_at DESC LIMIT 1""")).scalar_one_or_none()
        if recent:
            timestamp=datetime.fromisoformat(recent)
            if timestamp>datetime.now(timezone.utc)-timedelta(hours=24):
                return {"scheduled":False,"reason":"not_due"}
        try:return {"scheduled":True,"job":create_job(RefreshIn())}
        except HTTPException as exc:
            if exc.status_code==409:return {"scheduled":False,"reason":"active_job"}
            raise

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
        unique={}
        for hit in hits:
            if isinstance(hit,dict) and isinstance(hit.get("fields"),dict):
                normalized=normalize_hit(hit["fields"])
                if normalized:unique[normalized["prdt_no"]]=normalized
        if hits and not unique:
            raise HTTPException(422,"유효한 상품 식별번호를 찾지 못했습니다")
        t=Table("korea_prebook_kt_products",MetaData(),autoload_with=engine)
        allowed=set(t.c.keys())
        changes=0
        with engine.begin() as c:
            for row in unique.values():
                number=row["prdt_no"]
                previous=c.execute(select(t).where(t.c.prdt_no==number)).mappings().first()
                record={k:v for k,v in row.items() if k in allowed}
                if previous is None:
                    record.setdefault("nrml_amt",0.0)
                    record.setdefault("sale_amt",0.0)
                else:
                    # Original seed.py logic: partial pages cannot erase valid
                    # values; zero price from missing data must not clobber.
                    for price_col in ("nrml_amt","sale_amt"):
                        if record.get(price_col)==0 and previous.get(price_col):
                            record.pop(price_col,None)
                dialect=engine.dialect.name
                stmt=pg_insert(t).values(**record) if dialect=="postgresql" else sqlite_insert(t).values(**record)
                values={col:stmt.excluded[col] for col in record if col!="prdt_no"}
                if values:stmt=stmt.on_conflict_do_update(index_elements=["prdt_no"],set_=values)
                else:stmt=stmt.on_conflict_do_nothing(index_elements=["prdt_no"])
                c.execute(stmt)
                new_price=record.get("sale_amt")
                old_price=previous.get("sale_amt") if previous else None
                if new_price is not None and old_price is not None and abs(float(new_price)-float(old_price))>0.0001:
                    c.execute(text("""INSERT INTO korea_prebook_kt_price_history
                     (id,prdt_no,previous_price,current_price,source,job_id,observed_at)
                     VALUES(:id,:prdt,:old,:new,'oliveyoung',:jid,:at)"""),
                     {"id":str(uuid.uuid4()),"prdt":number,"old":old_price,"new":new_price,"jid":jid,"at":now()})
                    changes+=1
            c.execute(text("""UPDATE korea_prebook_kt_refresh_jobs
                SET pages=pages+1,processed=processed+:n,
                changed_prices=changed_prices+:changes,message=:msg
                WHERE id=:jid"""),{
                    "n":len(unique),"changes":changes,"jid":jid,
                    "msg":data.category_id+" page "+str(data.page_index)+" -> "+str(len(unique))+" products"
                })
        return {"accepted":len(unique),"changed_prices":changes,"job_id":jid}

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
