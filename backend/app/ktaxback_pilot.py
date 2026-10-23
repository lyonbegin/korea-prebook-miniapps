"""10 representative original Olive Young categories × 5 source languages,
10 real items each: direct capture -> original K-TAXBACK PostgreSQL tables.

No legacy SQLite data is imported. Untranslated source text is reported as
untranslated, never fabricated or copied into localized product records.
"""
from __future__ import annotations
import json,os,re,secrets,uuid
from datetime import datetime,timezone,timedelta
from html import unescape
from urllib.parse import urlparse
from fastapi import Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text, MetaData,Table,select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

CATEGORIES={
 "1000000003":"Face Masks","1000000008":"Skincare",
 "1000000011":"Suncare","1000000031":"Makeup",
 "1000000052":"Bath & Body","1000000070":"Hair",
 "1000000087":"Makeup Brush & Tools","1000000095":"Wellness",
 "1000000119":"Men's Care","1000000134":"Supplements",
}
LANGS=("en","jp","zh_cn","zh_tw","vi_vn")
SCRIPT={
 "jp":re.compile("[\u3040-\u30ff\u3400-\u9fff]"),
 "zh_cn":re.compile("[\u3400-\u9fff]"),
 "zh_tw":re.compile("[\u3400-\u9fff]"),
 "vi_vn":re.compile("[ăâđêôơưĂÂĐÊÔƠƯà-ỹÀ-Ỹ]"),
}
PREFIX="korea_prebook_kt_"
def timestamp():return datetime.now(timezone.utc).isoformat()
def safe(t):return unescape(str(t or "")).strip()[:1200]

class Sample(BaseModel):
    task_id:str
    url:str
    selected_language:str=Field(max_length=32)
    title:str=Field(default="",max_length=120)
    payload:dict=Field(default_factory=dict)
    error:str=Field(default="",max_length=700)

def mount_pilot(app,engine):
    with engine.begin() as c:
        c.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_pilot_tasks
          (id VARCHAR(36) PRIMARY KEY,category_id TEXT NOT NULL,category_name TEXT NOT NULL,
           lang_code TEXT NOT NULL,state TEXT NOT NULL,requested INTEGER NOT NULL,
           received INTEGER NOT NULL DEFAULT 0,selected INTEGER NOT NULL DEFAULT 0,
           written INTEGER NOT NULL DEFAULT 0,verified INTEGER NOT NULL DEFAULT 0,
           untranslated INTEGER NOT NULL DEFAULT 0,
           language_evidence TEXT NOT NULL DEFAULT '',source_url TEXT NOT NULL DEFAULT '',
           sample_json TEXT NOT NULL DEFAULT '[]',error TEXT NOT NULL DEFAULT '',
           created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
           UNIQUE(category_id,lang_code))"""))
    def auth(token):
        expected=os.getenv("ADMIN_API_TOKEN","")
        if not token or not expected or not secrets.compare_digest(token,"Bearer "+expected):
            raise HTTPException(401,"관리자 인증 실패")

    def table(name):
        return Table(PREFIX+name,MetaData(),autoload_with=engine)

    def upsert(conn,t,row,keys):
        stmt=(pg_insert if engine.dialect.name=="postgresql" else sqlite_insert)(t).values(**row)
        updates={k:stmt.excluded[k] for k in row if k not in keys}
        if updates:stmt=stmt.on_conflict_do_update(index_elements=keys,set_=updates)
        else:stmt=stmt.on_conflict_do_nothing(index_elements=keys)
        conn.execute(stmt)

    @app.post("/manager/api/ktaxback/pilot/start")
    def prepare(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.begin() as conn:
            # Pilot replaces the previously scheduled 150-category fullscan.
            conn.execute(text("UPDATE korea_prebook_kt_fullscan SET active=0 WHERE id=1"))
            conn.execute(text("""UPDATE korea_prebook_kt_refresh_jobs SET state='failed',
              message='Limited 10-category pilot selected',finished_at=:t
              WHERE state='queued'"""),{"t":timestamp()})
            for category,name in CATEGORIES.items():
                for lang in LANGS:
                    if engine.dialect.name=="postgresql":
                        conn.execute(text("""INSERT INTO korea_prebook_kt_pilot_tasks
                           (id,category_id,category_name,lang_code,state,requested,created_at,updated_at)
                           VALUES(:id,:cat,:name,:lang,'queued',10,:at,:at)
                           ON CONFLICT(category_id,lang_code) DO NOTHING"""),
                           {"id":str(uuid.uuid4()),"cat":category,"name":name,
                            "lang":lang,"at":timestamp()})
                    else:
                        conn.execute(text("""INSERT OR IGNORE INTO korea_prebook_kt_pilot_tasks
                           (id,category_id,category_name,lang_code,state,requested,created_at,updated_at)
                           VALUES(:id,:cat,:name,:lang,'queued',10,:at,:at)"""),
                           {"id":str(uuid.uuid4()),"cat":category,"name":name,
                            "lang":lang,"at":timestamp()})
        return {"categories":CATEGORIES,"languages":LANGS,"tasks":len(CATEGORIES)*len(LANGS),"per_task":10,
                "source":"original Olive Young global","legacy_data_imported":False}

    @app.get("/manager/api/ktaxback/pilot/next")
    def next_task(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.begin() as conn:
            cutoff=(datetime.now(timezone.utc)-timedelta(minutes=7)).isoformat()
            conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                  SET state='queued',error='Recovered after worker restart',updated_at=:t
                  WHERE state='running' AND updated_at<:stale"""),
                  {"t":timestamp(),"stale":cutoff})
            sql="""SELECT id,category_id,category_name,lang_code,requested
              FROM korea_prebook_kt_pilot_tasks WHERE state='queued'
              ORDER BY CASE WHEN lang_code='en' THEN 0 WHEN lang_code='jp' THEN 1
                WHEN lang_code='zh_cn' THEN 2 WHEN lang_code='zh_tw' THEN 3 ELSE 4 END,
                category_id LIMIT 1"""
            if engine.dialect.name=="postgresql":sql+=" FOR UPDATE SKIP LOCKED"
            row=conn.execute(text(sql)).mappings().first()
            if row:
                conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                  SET state='running',updated_at=:t WHERE id=:id"""),
                  {"t":timestamp(),"id":row["id"]})
        return {"task":dict(row) if row else None}

    @app.post("/manager/api/ktaxback/pilot/result")
    def result(data:Sample,authorization:str|None=Header(None)):
        auth(authorization)
        host=urlparse(data.url)
        if host.scheme!="https" or host.hostname!="global.oliveyoung.com":
            raise HTTPException(422,"Source must be actual Olive Young HTTPS")
        with engine.begin() as conn:
            task=conn.execute(text("SELECT * FROM korea_prebook_kt_pilot_tasks WHERE id=:id"),
                              {"id":data.task_id}).mappings().first()
            if not task or task["state"]!="running":raise HTTPException(409,"Pilot task not running")
            lang=task["lang_code"]
            if data.error:
                conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks SET state='failed',
                  error=:err,source_url=:url,language_evidence=:e,updated_at=:t WHERE id=:id"""),
                  {"err":data.error[:700],"url":data.url[:1000],
                   "e":data.selected_language[:32],"t":timestamp(),"id":task["id"]})
                return {"state":"failed","reason":data.error}
            hits=(data.payload.get("hits") or {}).get("hit",[])
            if not isinstance(hits,list) or not hits:raise HTTPException(422,"No real product-data hits")
            chosen=[]
            for hit in hits:
                if not isinstance(hit,dict) or not isinstance(hit.get("fields"),dict):continue
                f=hit["fields"]
                number=safe(f.get("prdtNo"));name=safe(f.get("prdtName") or f.get("prdtNameEn"))
                if not re.fullmatch("[A-Za-z0-9_-]{3,60}",number) or not name:continue
                if number not in [x[0] for x in chosen]:chosen.append((number,name,f))
                if len(chosen)>=task["requested"]:break
            if not chosen:raise HTTPException(422,"No valid original product identifiers")
            p=table("products");brand=table("brands");cat=table("categories")
            tr=table("product_translations");nam=table("product_names_i18n")
            received=len(hits);written=verified=skipped=0;samples=[]
            # Save original-category identifiers, not synthetic product contents.
            upsert(conn,cat,{"category_id":task["category_id"],
              "category_name":task["category_name"],"depth":2},["category_id"])
            for number,name,f in chosen:
                entry={"prdt_no":number,"source_name":name}
                if lang=="en":
                    record={"prdt_no":number,"prdt_name":name,
                            "category_id":safe(f.get("ctgrNo")) or task["category_id"],
                            "nrml_amt":float(f.get("nrmlAmt") or 0),
                            "sale_amt":float(f.get("saleAmt") or 0)}
                    bid=safe(f.get("brandNo"))
                    if bid:
                        upsert(conn,brand,{"brand_no":bid,"brand_name":safe(f.get("brandName")) or bid},
                               ["brand_no"])
                        record["brand_no"]=bid
                    for key,source in (("image_path","imagePath"),("prdt_name_kor","korPrdtName"),
                      ("best_yn","bestYn"),("new_yn","newYn"),("review_cnt","reviewCnt")):
                        if f.get(source) is not None:record[key]=f[source]
                    old=conn.execute(select(p.c.prdt_no).where(p.c.prdt_no==number)).scalar_one_or_none()
                    upsert(conn,p,record,["prdt_no"])
                    check=conn.execute(select(p.c.prdt_no,p.c.prdt_name).where(p.c.prdt_no==number)).first()
                    if check and check.prdt_no==number and check.prdt_name==name:
                        written+=1;verified+=1
                        entry["state"]="verified_original_product"
                    else:entry["state"]="readback_mismatch"
                else:
                    english=conn.execute(select(p.c.prdt_name).where(p.c.prdt_no==number)).scalar_one_or_none()
                    localized=bool(english and english!=name and SCRIPT[lang].search(name))
                    if not localized:
                        skipped+=1;entry["state"]="untranslated_or_missing_en"
                    else:
                        # These are the exact original K-TAXBACK multilingual tables.
                        row={"prdt_no":number,"lang_code":lang,
                             "field_key":"detail-data.product.prdtNameEn",
                             "source_text":english,"translated_text":name}
                        upsert(conn,tr,row,["prdt_no","lang_code","field_key"])
                        upsert(conn,nam,{"prdt_no":number,"lang_code":lang,"prdt_name":name},
                               ["prdt_no","lang_code"])
                        saved=conn.execute(select(tr.c.translated_text).where(
                          (tr.c.prdt_no==number)&(tr.c.lang_code==lang)&
                          (tr.c.field_key=="detail-data.product.prdtNameEn"))).scalar_one_or_none()
                        if saved==name:
                            written+=1;verified+=1;entry["state"]="verified_localized"
                        else:entry["state"]="readback_mismatch"
                if len(samples)<10:samples.append(entry)
            state="verified" if verified>0 and verified==written else "untranslated" if skipped==len(chosen) else "failed"
            conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
               SET state=:state,received=:received,selected=:selected,written=:written,
                verified=:verified,untranslated=:skipped,language_evidence=:e,
                source_url=:url,sample_json=:sample,error=:err,updated_at=:t WHERE id=:id"""),
               {"id":task["id"],"state":state,"received":received,"selected":len(chosen),
                "written":written,"verified":verified,"skipped":skipped,"e":data.selected_language,
                "url":data.url[:1000],"sample":json.dumps(samples,ensure_ascii=False),
                "err":"" if state=="verified" else "No source-verified localized names saved",
                "t":timestamp()})
        return {"category":task["category_id"],"lang":lang,"state":state,
                "received":received,"selected":len(chosen),"written":written,"verified":verified,
                "untranslated":skipped,"sample":samples[:2]}

    @app.get("/manager/api/ktaxback/pilot/report")
    def report(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.connect() as conn:
            tasks=[dict(r) for r in conn.execute(text(
              "SELECT * FROM korea_prebook_kt_pilot_tasks ORDER BY category_id,lang_code")).mappings()]
            counts={}
            for name in ("products","brands","categories","category_filters","product_images",
                         "product_options","product_details","product_translations",
                         "product_names_i18n","category_names_i18n","category_filters_i18n"):
                counts[name]=conn.execute(text("SELECT COUNT(*) FROM "+PREFIX+name)).scalar_one()
            per_lang=[dict(x) for x in conn.execute(text("""SELECT lang_code,COUNT(*) AS rows
                FROM korea_prebook_kt_product_translations GROUP BY lang_code""")).mappings()]
        for t in tasks:
            t["sample"]=json.loads(t.pop("sample_json"))
        return {"source":"global.oliveyoung.com","categories":CATEGORIES,
                "languages":LANGS,"tasks":tasks,"db_counts":counts,
                "stored_translation_rows_by_language":per_lang,"legacy_imported":False}
