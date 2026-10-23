"""K-TAXBACK: persist only *observed* Olive Young translate-texts pairs.

Matches original C:\\tour\\batch_translate.py and seed.py field keys.
No generated translations, no locale-name copying and no Vietnamese collection.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import unescape
from urllib.parse import urlparse

from fastapi import Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import MetaData, Table, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

SOURCE = "https://translation.oliveyoung.com/public/translate-texts"
LANG_TARGET = {"jp": "ja", "zh_cn": "zh", "zh_tw": "zh-TW"}
LANG_SCRIPTS = {
    "jp": re.compile(r"[\u3040-\u30ff\u3400-\u9fff]"),
    "zh_cn": re.compile(r"[\u3400-\u9fff]"),
    "zh_tw": re.compile(r"[\u3400-\u9fff]"),
}
NAME_FIELD = "detail-data.product.prdtNameEn"


def utcnow():
    return datetime.now(timezone.utc).isoformat()


class TranslationLease(BaseModel):
    category_id: str = Field(pattern=r"^[0-9]{10}$")
    lang_code: str
    owner: str = Field(pattern=r"^[a-z0-9-]{24,60}$")


class SourceAssignment(BaseModel):
    prdt_no: str = Field(min_length=2, max_length=60)
    field_key: str = Field(min_length=5, max_length=180)
    source_text: str = Field(min_length=1, max_length=3000)


class SourceTranslation(BaseModel):
    category_id: str = Field(default="", max_length=12)
    lang_code: str
    source_url: str
    response_status: int = Field(ge=0, le=599)
    request_payload: dict = Field(default_factory=dict)
    response_payload: dict = Field(default_factory=dict)
    assignments: list[SourceAssignment] = Field(default_factory=list, max_length=30)
    error: str = Field(default="", max_length=600)


def mount_translation(app, engine):
    with engine.begin() as con:
        con.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_translation_audit (
            id VARCHAR(36) PRIMARY KEY, lang_code TEXT NOT NULL,
            source_endpoint TEXT NOT NULL, http_status INTEGER NOT NULL,
            requested INTEGER NOT NULL, returned INTEGER NOT NULL,
            accepted INTEGER NOT NULL, verified INTEGER NOT NULL,
            rejected INTEGER NOT NULL, error TEXT NOT NULL, recorded_at TEXT NOT NULL
        )"""))

    with engine.begin() as con:
        con.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_translation_leases (
            category_id TEXT NOT NULL, lang_code TEXT NOT NULL,
            owner TEXT NOT NULL, lease_until TEXT NOT NULL,
            PRIMARY KEY(category_id,lang_code)
        )"""))
        con.execute(text("""CREATE TABLE IF NOT EXISTS korea_prebook_kt_translation_category_audit (
            category_id TEXT NOT NULL, lang_code TEXT NOT NULL,
            http_status INTEGER NOT NULL, requested INTEGER NOT NULL,
            source_returned INTEGER NOT NULL, db_verified INTEGER NOT NULL,
            rejected INTEGER NOT NULL, error TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            PRIMARY KEY(category_id,lang_code)
        )"""))

    # Backfill previously source-verified name pairs from product_translations
    # into the ORIGINAL product_names_i18n table. This reads only existing
    # Railway PostgreSQL rows; no legacy SQLite import, no synthetic translation.
    with engine.begin() as con:
        names = Table("korea_prebook_kt_product_names_i18n",
                      MetaData(),autoload_with=engine)
        products = Table("korea_prebook_kt_products",MetaData(),
                         autoload_with=engine)
        source_translations = Table("korea_prebook_kt_product_translations",
                                    MetaData(),autoload_with=engine)
        pairs = con.execute(select(
            source_translations.c.prdt_no,
            source_translations.c.lang_code,
            source_translations.c.translated_text
        ).select_from(source_translations.join(
            products,products.c.prdt_no==source_translations.c.prdt_no
        )).where(
            source_translations.c.field_key==NAME_FIELD,
            source_translations.c.lang_code.in_(list(LANG_TARGET)),
            source_translations.c.source_text==products.c.prdt_name,
            source_translations.c.translated_text.is_not(None),
            source_translations.c.translated_text!=products.c.prdt_name
        )).mappings().all()
        for pair in pairs:
            row={"prdt_no":pair["prdt_no"],"lang_code":pair["lang_code"],
                 "prdt_name":pair["translated_text"]}
            stmt=(pg_insert(names) if engine.dialect.name=="postgresql"
                  else sqlite_insert(names)).values(**row)
            con.execute(stmt.on_conflict_do_update(
                index_elements=["prdt_no","lang_code"],
                set_={"prdt_name":stmt.excluded.prdt_name}))

    def auth(token):
        expected = os.getenv("ADMIN_API_TOKEN") or ""
        if not expected or not token or not secrets.compare_digest(token, "Bearer "+expected):
            raise HTTPException(401, "Manager token required")

    def tables():
        return (
            Table("korea_prebook_kt_products", MetaData(), autoload_with=engine),
            Table("korea_prebook_kt_product_translations", MetaData(), autoload_with=engine)
        )

    @app.post("/manager/api/ktaxback/translation/claim")
    def claim(data: TranslationLease, authorization: str | None = Header(None)):
        auth(authorization)
        if data.lang_code not in LANG_TARGET:
            raise HTTPException(422,"Unsupported language")
        lease=Table("korea_prebook_kt_translation_leases",MetaData(),
                    autoload_with=engine)
        issued=utcnow()
        until=(datetime.now(timezone.utc)+timedelta(minutes=5)).isoformat()
        with engine.begin() as con:
            dialect=pg_insert if engine.dialect.name=="postgresql" else sqlite_insert
            stmt=dialect(lease).values(category_id=data.category_id,
                lang_code=data.lang_code,owner=data.owner,lease_until=until)
            stmt=stmt.on_conflict_do_update(
                index_elements=["category_id","lang_code"],
                set_={"owner":stmt.excluded.owner,"lease_until":stmt.excluded.lease_until},
                where=lease.c.lease_until < issued)
            con.execute(stmt)
            current=con.execute(select(lease.c.owner,lease.c.lease_until).where(
                lease.c.category_id==data.category_id,
                lease.c.lang_code==data.lang_code)).first()
        return {"acquired":bool(current and current.owner==data.owner),
                "lease_until":current.lease_until if current else None}

    @app.post("/manager/api/ktaxback/translation/release")
    def release(data: TranslationLease, authorization: str | None = Header(None)):
        auth(authorization)
        lease=Table("korea_prebook_kt_translation_leases",MetaData(),
                    autoload_with=engine)
        with engine.begin() as con:
            removed=con.execute(lease.delete().where(
                lease.c.category_id==data.category_id,
                lease.c.lang_code==data.lang_code,
                lease.c.owner==data.owner)).rowcount
        return {"released":bool(removed)}

    @app.get("/manager/api/ktaxback/translation/sample")
    def original_source_sample(category_id: str = Query("1000000008"), limit: int = Query(10, ge=1, le=30),
                               authorization: str | None = Header(None)):
        auth(authorization)
        product, _ = tables()
        cats = Table("korea_prebook_kt_categories",MetaData(),autoload_with=engine)
        with engine.connect() as con:
            relationships=con.execute(select(cats.c.category_id,cats.c.parent_id)).all()
            child_map={}
            for cid, parent in relationships:
                child_map.setdefault(parent, []).append(cid)
            included={category_id}; remaining=[category_id]
            while remaining:
                parent=remaining.pop()
                for cid in child_map.get(parent,[]):
                    if cid not in included:
                        included.add(cid);remaining.append(cid)
            query=select(product.c.prdt_no,product.c.prdt_name).where(
                product.c.category_id.in_(included)
            ).order_by(product.c.prdt_no).limit(limit)
            items=[dict(r) for r in con.execute(query).mappings()]
            scope="category_and_descendants"
            if len(items)<limit:
                # Source data is not invented: fill a thin category's sample
                # with other real original English products already held in PG.
                # The response explicitly reports this wider sampling scope.
                ids=[x["prdt_no"] for x in items]
                fill=select(product.c.prdt_no,product.c.prdt_name).order_by(
                    product.c.prdt_no).limit(limit)
                if ids:fill=fill.where(~product.c.prdt_no.in_(ids))
                extra=[dict(r) for r in con.execute(fill).mappings()]
                items.extend(extra[:limit-len(items)])
                scope="category_plus_verified_original_products" if ids else "verified_catalogue_fallback"
        return {"category_id":category_id,"scope":scope,
                "included_category_ids":len(included),"items":items,
                "source_language":"en","target_languages":LANG_TARGET,"source_api":SOURCE}

    @app.get("/manager/api/ktaxback/translation/verified-category-samples")
    def verified_category_samples(authorization: str | None = Header(None)):
        """Real ten-item lists from English pilot's observed source responses.

        This is not a synthetic category remapping and does not touch the old
        SQLite source database. Multi-language translations attach by prdt_no.
        """
        auth(authorization)
        products, translations = tables()
        with engine.connect() as con:
            pilot=con.execute(text("""SELECT category_id,category_name,sample_json
                 FROM korea_prebook_kt_pilot_tasks
                 WHERE lang_code='en' AND state='verified'
                 ORDER BY category_id""")).mappings().all()
            existing={}
            for row in con.execute(select(
                translations.c.prdt_no,translations.c.lang_code,
                translations.c.source_text
            ).where(translations.c.field_key == NAME_FIELD)).all():
                existing.setdefault(row.prdt_no,[]).append(
                    (row.lang_code,row.source_text))
            category_samples=[]
            for record in pilot:
                rows=json.loads(record["sample_json"])
                ids=[r.get("prdt_no") for r in rows if r.get("prdt_no")]
                if not ids:continue
                matching=con.execute(select(products.c.prdt_no,products.c.prdt_name).where(
                    products.c.prdt_no.in_(ids)
                )).mappings().all()
                lookup={r["prdt_no"]:dict(r) for r in matching}
                items=[]
                for ident in ids:
                    product=lookup.get(ident)
                    if product:
                        items.append({"prdt_no":ident,"prdt_name":product["prdt_name"],
                                      "existing_translations":[lang for lang,src in existing.get(ident,[]) if src==product["prdt_name"]]})
                category_samples.append({"category_id":record["category_id"],
                     "category_name":record["category_name"],
                     "items":items[:10],"source":"verified_en_pilot_page_json"})
        return {"categories":category_samples,"target_languages":LANG_TARGET,
                "source_endpoint":SOURCE,"old_sqlite_imported":False}

    @app.get("/manager/api/ktaxback/translation/detail-source")
    def detail_source(authorization:str|None=Header(None)):
        """Only originals present in the live PostgreSQL product detail/option rows."""
        auth(authorization)
        products=Table("korea_prebook_kt_products",MetaData(),autoload_with=engine)
        options=Table("korea_prebook_kt_product_options",MetaData(),autoload_with=engine)
        details=Table("korea_prebook_kt_product_details",MetaData(),autoload_with=engine)
        translations=Table("korea_prebook_kt_product_translations",MetaData(),autoload_with=engine)
        colnames={"why_we_love_it":"whyWeLoveItText",
                  "featured_ingredients":"ftrdIngrdText","how_to_use":"howToUseText"}
        samples=[]
        with engine.connect() as conn:
            category=conn.execute(select(details.c.prdt_no).where(
                details.c.lang_code=="en").order_by(
                details.c.prdt_no).limit(10)).scalars().all()
            if not category:
                category=conn.execute(select(options.c.prdt_no).distinct().limit(10)).scalars().all()
            for no in category:
                p=conn.execute(select(products.c.prdt_no).where(products.c.prdt_no==no)).scalar_one_or_none()
                if not p:continue
                d=conn.execute(select(details).where(details.c.prdt_no==no,
                                    details.c.lang_code=="en")).mappings().first()
                o=conn.execute(select(options).where(options.c.prdt_no==no).order_by(
                    options.c.option_id).limit(15)).mappings().all()
                fields=[]
                for i,entry in enumerate(o):
                    name=str(entry.get("option_name") or "").strip()
                    if name:fields.append({"field_key":f"detail-data.product.optionList[{i}].snglOptnNameEn",
                                            "source_text":name})
                if d:
                    for attr,label in colnames.items():
                        txt=str(d.get(attr) or "").strip()
                        # Never truncate source text: the translator must
                        # match an existing original DB value exactly.
                        if txt and len(txt)<=3000:
                            fields.append({"field_key":"details-info.details."+label,
                                           "source_text":txt})
                present=conn.execute(select(translations.c.lang_code,translations.c.field_key,
                    translations.c.source_text).where(translations.c.prdt_no==no)).mappings().all()
                for field in fields:
                    field["existing_langs"]=[x["lang_code"] for x in present if
                        x["field_key"]==field["field_key"] and
                        x["source_text"]==field["source_text"]]
                samples.append({"prdt_no":no,"fields":fields})
        return {"samples":samples,"languages":LANG_TARGET,"source":SOURCE,
                "uses_original_option_indices":True}

    @app.post("/manager/api/ktaxback/translation/capture")
    def capture_observed_translation(data: SourceTranslation, authorization: str | None = Header(None)):
        auth(authorization)
        lang = data.lang_code
        if lang not in LANG_TARGET:
            raise HTTPException(422, "Unsupported target language; vi_vn excluded")
        if data.category_id and not re.fullmatch(r"[0-9]{10}",data.category_id):
            raise HTTPException(422, "Invalid real Olive Young category")
        parsed = urlparse(data.source_url)
        if parsed.scheme != "https" or parsed.hostname != "translation.oliveyoung.com" \
           or parsed.path != "/public/translate-texts":
            raise HTTPException(422, "Not the original Olive Young translation endpoint")

        sent = data.request_payload.get("texts")
        returned = data.response_payload.get("translations")
        req_lang = data.request_payload.get("target_language")
        status = int(data.response_status)
        accepted = verified = rejected = 0
        reasons = {"unchanged_or_wrong_script":0,"unknown_product":0,"source_mismatch":0,"field_mismatch":0,"unmapped_output":0}
        error = data.error
        if status == 200:
            if data.request_payload.get("source_language") != "en" \
                or req_lang != LANG_TARGET[lang] \
                or not isinstance(sent, list) or not isinstance(returned, list) \
                or not sent or len(sent) != len(returned) \
                or len(sent) > 30:
                raise HTTPException(422, "Response does not match original translation API request")
        else:
            sent = sent if isinstance(sent, list) else []
            returned = []
            error = error or "Original translation API HTTP "+str(status)

        product, translations = tables()
        # Reflect all tables BEFORE starting the write transaction. For in-memory
        # SQLite the engine uses a shared connection: reflecting inside the
        # transaction may open/close that connection and roll back the upsert.
        names = Table("korea_prebook_kt_product_names_i18n",
                      MetaData(), autoload_with=engine)
        options = Table("korea_prebook_kt_product_options",
                        MetaData(), autoload_with=engine)
        detail_table = Table("korea_prebook_kt_product_details",
                             MetaData(), autoload_with=engine)
        # Same transaction: imported translation and audit are committed together.
        with engine.begin() as con:
            if status == 200:
                assignment_index = {}
                for assignment in data.assignments:
                    # Restrict output to original seeded product-field paths; never
                    # let caller create arbitrary field keys on the catalogue.
                    if assignment.field_key != NAME_FIELD and not re.fullmatch(
                        r"(detail-data\.product\.optionList\[\d{1,2}\]\.snglOptnNameEn"
                        r"|details-info\.details\.(whyWeLoveItText|ftrdIngrdText|howToUseText|sellingPointText))",
                        assignment.field_key
                    ):
                        raise HTTPException(422, "Unsupported original seed.py field key")
                    if not re.fullmatch(r"[A-Za-z0-9_-]{2,60}", assignment.prdt_no):
                        raise HTTPException(422, "Invalid product identifier")
                    assignment_index[(assignment.source_text, assignment.prdt_no,
                                      assignment.field_key)] = assignment

                source_to_translated = {}
                for source, response in zip(sent, returned):
                    if not isinstance(source, str) or not isinstance(response, dict) or response.get("error"):
                        continue
                    value = response.get("text")
                    if isinstance(value, str) and value.strip():
                        source_to_translated[source] = unescape(value.strip())

                for (original, number, key), assignment in assignment_index.items():
                    translated = source_to_translated.get(original)
                    if not translated or translated == original or not LANG_SCRIPTS[lang].search(translated):
                        reasons["unchanged_or_wrong_script"] += 1
                        rejected += 1
                        continue
                    exists = con.execute(select(product.c.prdt_name).where(
                        product.c.prdt_no == number)).scalar_one_or_none()
                    if not exists:
                        reasons["unknown_product"] += 1
                        rejected += 1
                        continue
                    if key == NAME_FIELD and exists != original:
                        reasons["source_mismatch"] += 1
                        rejected += 1
                        continue
                    if key.startswith("detail-data.product.optionList["):
                        match=re.search(r"optionList\[(\d+)\]",key)
                        if not match:
                            rejected += 1
                            continue
                        opt=options
                        originals=con.execute(select(opt.c.option_name).where(
                             opt.c.prdt_no==number).order_by(opt.c.option_id)).scalars().all()
                        idx=int(match.group(1))
                        if idx>=len(originals) or originals[idx] != original:
                            rejected += 1
                            continue
                    if key.startswith("details-info.details."):
                        attr={
                         "whyWeLoveItText":"why_we_love_it",
                         "ftrdIngrdText":"featured_ingredients",
                         "howToUseText":"how_to_use",
                        }.get(key.rsplit(".",1)[-1])
                        if not attr:
                            rejected += 1
                            continue
                        detail=detail_table
                        recorded=con.execute(select(detail.c[attr]).where(
                            detail.c.prdt_no==number,detail.c.lang_code=="en"
                        )).scalar_one_or_none()
                        if str(recorded or "").strip() != original.strip():
                            rejected += 1
                            continue
                    row = {"prdt_no": number, "lang_code": lang, "field_key": key,
                           "source_text": original, "translated_text": translated}
                    insert = pg_insert(translations) if engine.dialect.name == "postgresql" \
                        else sqlite_insert(translations)
                    statement = insert.values(**row)
                    con.execute(statement.on_conflict_do_update(
                        index_elements=["prdt_no", "lang_code", "field_key"],
                        set_={"source_text": statement.excluded.source_text,
                              "translated_text": statement.excluded.translated_text}
                    ))
                    # Original seed.py maintains a dedicated name table as
                    # well as the field-key translation table. Populate both
                    # only from a validated real translate-texts source pair.
                    if key == NAME_FIELD:
                        nstmt = (pg_insert(names) if engine.dialect.name=="postgresql"
                                 else sqlite_insert(names)).values(
                                     prdt_no=number, lang_code=lang,
                                     prdt_name=translated)
                        con.execute(nstmt.on_conflict_do_update(
                            index_elements=["prdt_no","lang_code"],
                            set_={"prdt_name":nstmt.excluded.prdt_name}))
                        confirmed = con.execute(select(names.c.prdt_name).where(
                            names.c.prdt_no==number,names.c.lang_code==lang
                        )).scalar_one_or_none()
                        if confirmed != translated:
                            raise HTTPException(500,"Localized product name read-back mismatch")
                    accepted += 1
                    readback = con.execute(select(translations.c.translated_text).where(
                        translations.c.prdt_no == number,
                        translations.c.lang_code == lang,
                        translations.c.field_key == key
                    )).scalar_one_or_none()
                    if readback == translated:
                        verified += 1
                    else:
                        raise HTTPException(500, "Translation DB read-back failed")

            if status == 200 and rejected and not error:
                error = "Translation rejected: " + ", ".join(
                    k+"="+str(v) for k,v in reasons.items() if v
                )

            if data.category_id:
                con.execute(text("""INSERT INTO korea_prebook_kt_translation_category_audit
                     (category_id,lang_code,http_status,requested,source_returned,
                      db_verified,rejected,error,observed_at)
                     VALUES (:cid,:lang,:http,:req,:returned,:verified,:rejected,:error,:now)
                     ON CONFLICT(category_id,lang_code) DO UPDATE SET
                       http_status=:http,requested=:req,source_returned=:returned,
                       db_verified=:verified,rejected=:rejected,
                       error=:error,observed_at=:now"""),
                     {"cid":data.category_id,"lang":lang,"http":status,
                      "req":len(sent),"returned":len(returned),"verified":verified,
                      "rejected":rejected,"error":error[:600],"now":utcnow()})
            con.execute(text("""INSERT INTO korea_prebook_kt_translation_audit (
                id,lang_code,source_endpoint,http_status,requested,returned,accepted,
                verified,rejected,error,recorded_at)
                VALUES (:id,:lang,:src,:status,:requested,:returned,:accepted,
                        :verified,:rejected,:error,:now)"""),
                {"id": str(uuid.uuid4()), "lang": lang, "src": SOURCE, "status": status,
                 "requested": len(sent), "returned": len(returned),
                 "accepted": accepted, "verified": verified, "rejected": rejected,
                 "error": error[:600], "now": utcnow()})
        return {"category_id":data.category_id,"lang_code": lang,
                "http_status": status, "requested": len(sent),
                "translated_returned": len(returned), "db_inserted": accepted,
                "db_verified": verified, "rejected": rejected,
                "source": SOURCE, "error": error, "rejection_reasons":reasons}

    @app.get("/v1/ktaxback/translations/examples")
    def public_translation_examples():
        """Public products' translated names only, for production DB/API audit."""
        products,translations=tables()
        examples={}
        with engine.connect() as con:
            for lang in LANG_TARGET:
                rows=con.execute(select(
                    translations.c.prdt_no,translations.c.source_text,
                    translations.c.translated_text).where(
                    translations.c.lang_code==lang,
                    translations.c.field_key==NAME_FIELD).order_by(
                    translations.c.prdt_no).limit(3)).mappings().all()
                examples[lang]=[dict(row) for row in rows]
        return {"source":"translation.oliveyoung.com/public/translate-texts",
                "examples":examples,"languages":list(LANG_TARGET),
                "legacy_sqlite_imported":False}

    @app.get("/manager/api/ktaxback/translation/status")
    def translation_status(authorization: str | None = Header(None)):
        auth(authorization)
        with engine.connect() as con:
            events = [dict(row) for row in con.execute(text("""
                SELECT lang_code,http_status,requested,returned,accepted,verified,rejected,
                       error,recorded_at FROM korea_prebook_kt_translation_audit
                ORDER BY recorded_at DESC LIMIT 50
            """)).mappings()]
            actual = [dict(row) for row in con.execute(text("""
                SELECT lang_code,COUNT(*) AS rows FROM korea_prebook_kt_product_translations
                WHERE lang_code IN ('jp','zh_cn','zh_tw') GROUP BY lang_code
            """)).mappings()]
            categories=[dict(row) for row in con.execute(text("""
                SELECT category_id,lang_code,http_status,requested,
                       source_returned,db_verified,rejected,error,observed_at
                FROM korea_prebook_kt_translation_category_audit
                ORDER BY category_id,lang_code
            """)).mappings()]
        return {"source": SOURCE, "languages": list(LANG_TARGET), "events": events,
                "persisted_rows_by_language": actual,
                "category_results":categories}
