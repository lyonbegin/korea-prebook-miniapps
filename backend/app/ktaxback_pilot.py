"""10 representative original Olive Young categories × 4 source languages,
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
LANGS=("en","jp","zh_cn","zh_tw")
SCRIPT={
 "jp":re.compile("[\u3040-\u30ff\u3400-\u9fff]"),
 "zh_cn":re.compile("[\u3400-\u9fff]"),
 "zh_tw":re.compile("[\u3400-\u9fff]"),
}
PREFIX="korea_prebook_kt_"
def timestamp():return datetime.now(timezone.utc).isoformat()
def safe(t):return unescape(str(t or "")).strip()[:1200]

class BlockedReason(BaseModel):
        reason: str = Field(min_length=1,max_length=500)


class Sample(BaseModel):
    task_id:str
    url:str
    selected_language:str=Field(max_length=240)
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
        c.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_pilot_retries
          (version TEXT PRIMARY KEY, prior_task_count INTEGER NOT NULL, created_at TEXT NOT NULL)"""))

    with engine.begin() as c:
        c.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
            SET state='excluded',error='vi_vn removed by project owner',
                updated_at=:at
            WHERE lang_code='vi_vn' AND state IN ('queued','running')"""),
            {"at":timestamp()})

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
            # User expressly excluded Vietnamese. Keep historic rows as audit
            # evidence but never schedule/claim them again.
            conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                SET state='excluded',error='Excluded by project owner',updated_at=:now
                WHERE lang_code='vi_vn' AND state IN ('queued','running')"""),
                {"now":timestamp()})
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

    @app.post("/manager/api/ktaxback/pilot/retry-selector-v2")
    def retry_selector_v2(authorization:str|None=Header(None)):
        auth(authorization)
        version="visible_preferences_v2"
        with engine.begin() as conn:
            if conn.execute(text("""SELECT version FROM korea_prebook_kt_pilot_retries
               WHERE version=:v"""),{"v":version}).scalar_one_or_none():
                return {"enqueued":0,"reason":"already_applied"}
            rows=conn.execute(text("""SELECT id,category_id,lang_code,state FROM
               korea_prebook_kt_pilot_tasks
               WHERE state IN ('failed','untranslated') AND lang_code!='vi_vn'""")).mappings().all()
            # Versioned one-time recovery; preserve actual prior states in the
            # source audit table and mark current task as queued.
            conn.execute(text("""INSERT INTO korea_prebook_kt_pilot_retries
                (version,prior_task_count,created_at) VALUES(:v,:n,:t)"""),
                {"v":version,"n":len(rows),"t":timestamp()})
            for row in rows:
                conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                   SET state='queued',updated_at=:t,
                     error='Retry scheduled after visible language selector correction'
                   WHERE id=:id AND state IN ('failed','untranslated') AND lang_code!='vi_vn'"""),
                   {"id":row["id"],"t":timestamp()})
        return {"enqueued":len(rows),"version":version}

    @app.post("/manager/api/ktaxback/pilot/stop-on-restriction")
    def stop_on_restriction(data:BlockedReason,authorization:str|None=Header(None)):
        auth(authorization)
        with engine.begin() as c:
            affected=c.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                 SET state='blocked',error=:reason,updated_at=:t
                 WHERE state IN ('queued','running') AND lang_code!='vi_vn'"""),
                {"reason":"Source site access restriction: "+data.reason,
                 "t":timestamp()}).rowcount
        return {"stopped":True,"unattempted_or_running_marked_blocked":affected,
                "real_saved_rows_preserved":True}

    @app.post("/manager/api/ktaxback/pilot/retry-fish-preferences")
    def one_time_preference_validation(authorization:str|None=Header(None)):
        """Exactly three category tests, one per target language, never bulk-crawl."""
        auth(authorization)
        version="fish_saved_country_language_v1"
        selected=("jp","zh_cn","zh_tw")
        with engine.begin() as conn:
            exists=conn.execute(text("""SELECT version FROM korea_prebook_kt_pilot_retries
                WHERE version=:v"""),{"v":version}).scalar_one_or_none()
            if exists:return {"scheduled":False,"reason":"already_created"}
            conn.execute(text("""INSERT INTO korea_prebook_kt_pilot_retries
                (version,prior_task_count,created_at) VALUES(:v,3,:now)"""),
                {"v":version,"now":timestamp()})
            total=0
            for lang in selected:
                total+=conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                   SET state='queued',received=0,selected=0,written=0,verified=0,
                    untranslated=0,language_evidence='',error='',
                    updated_at=:now
                   WHERE lang_code=:lang AND category_id='1000000008' AND
                     state IN ('failed','untranslated','blocked')"""),
                   {"now":timestamp(),"lang":lang}).rowcount
        return {"scheduled":True,"categories":1,"languages":list(selected),
                "tasks":total,"version":version}

    @app.get("/manager/api/ktaxback/pilot/next")
    def next_task(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.begin() as conn:
            cutoff=(datetime.now(timezone.utc)-timedelta(minutes=7)).isoformat()
            conn.execute(text("""UPDATE korea_prebook_kt_pilot_tasks
                  SET state='queued',error='Recovered after worker restart',updated_at=:t
                  WHERE state='running' AND lang_code!='vi_vn' AND updated_at<:stale"""),
                  {"t":timestamp(),"stale":cutoff})
            sql="""SELECT id,category_id,category_name,lang_code,requested
              FROM korea_prebook_kt_pilot_tasks WHERE state='queued' AND lang_code!='vi_vn'
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
            tr=table("product_translations")
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
                    selected_codes={"jp":"ja","zh_cn":"zh","zh_tw":"zh-TW","vi_vn":"vi"}
                    language_confirmed=("selected-code="+selected_codes[lang]) in data.selected_language
                    localized=bool(language_confirmed and english and english!=name and SCRIPT[lang].search(name))
                    if not localized:
                        skipped+=1;entry["state"]="untranslated_or_missing_en"
                    else:
                        # These are the exact original K-TAXBACK multilingual tables.
                        row={"prdt_no":number,"lang_code":lang,
                             "field_key":"detail-data.product.prdtNameEn",
                             "source_text":english,"translated_text":name}
                        upsert(conn,tr,row,["prdt_no","lang_code","field_key"])
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

    @app.get("/v1/ktaxback/pilot/summary")
    def public_pilot_summary():
        """Safe read-only counts from production PostgreSQL; no login tokens or raw source HTML."""
        with engine.connect() as conn:
            states=[dict(row) for row in conn.execute(text("""SELECT category_id,
                category_name,lang_code,state,requested,received,selected,written,
                verified,untranslated,language_evidence,error FROM korea_prebook_kt_pilot_tasks
                WHERE lang_code!='vi_vn' ORDER BY category_id,lang_code""")).mappings()]
            stored={}
            for name in ("products","brands","categories","category_filters","product_images",
                         "product_options","product_details","product_translations",
                         "category_names_i18n","category_filters_i18n"):
                stored[name]=conn.execute(text(
                    "SELECT COUNT(*) FROM "+PREFIX+name)).scalar_one()
            locales=[dict(row) for row in conn.execute(text("""SELECT lang_code,
              COUNT(*) AS stored FROM korea_prebook_kt_product_translations
              GROUP BY lang_code ORDER BY lang_code""")).mappings()]
        return {"categories":len(CATEGORIES),"languages":list(LANGS),
                "tasks":states,"table_counts":stored,"translation_languages":locales,
                "legacy_sqlite_imported":False}

    @app.get("/manager/api/ktaxback/pilot/report")
    def report(authorization:str|None=Header(None)):
        auth(authorization)
        with engine.connect() as conn:
            tasks=[dict(r) for r in conn.execute(text(
              "SELECT * FROM korea_prebook_kt_pilot_tasks WHERE lang_code!='vi_vn' ORDER BY category_id,lang_code")).mappings()]
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
