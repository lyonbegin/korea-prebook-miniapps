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
from datetime import datetime, timezone
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


class SourceAssignment(BaseModel):
    prdt_no: str = Field(min_length=2, max_length=60)
    field_key: str = Field(min_length=5, max_length=180)
    source_text: str = Field(min_length=1, max_length=3000)


class SourceTranslation(BaseModel):
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

    def auth(token):
        expected = os.getenv("ADMIN_API_TOKEN") or ""
        if not expected or not token or not secrets.compare_digest(token, "Bearer "+expected):
            raise HTTPException(401, "Manager token required")

    def tables():
        return (
            Table("korea_prebook_kt_products", MetaData(), autoload_with=engine),
            Table("korea_prebook_kt_product_translations", MetaData(), autoload_with=engine)
        )

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
                translations.c.prdt_no,translations.c.lang_code
            ).where(translations.c.field_key == NAME_FIELD)).all():
                existing.setdefault(row.prdt_no,[]).append(row.lang_code)
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
                                      "existing_translations":existing.get(ident,[])})
                category_samples.append({"category_id":record["category_id"],
                     "category_name":record["category_name"],
                     "items":items[:10],"source":"verified_en_pilot_page_json"})
        return {"categories":category_samples,"target_languages":LANG_TARGET,
                "source_endpoint":SOURCE,"old_sqlite_imported":False}

    @app.post("/manager/api/ktaxback/translation/capture")
    def capture_observed_translation(data: SourceTranslation, authorization: str | None = Header(None)):
        auth(authorization)
        lang = data.lang_code
        if lang not in LANG_TARGET:
            raise HTTPException(422, "Unsupported target language; vi_vn excluded")
        parsed = urlparse(data.source_url)
        if parsed.scheme != "https" or parsed.hostname != "translation.oliveyoung.com" \
           or parsed.path != "/public/translate-texts":
            raise HTTPException(422, "Not the original Olive Young translation endpoint")

        sent = data.request_payload.get("texts")
        returned = data.response_payload.get("translations")
        req_lang = data.request_payload.get("target_language")
        status = int(data.response_status)
        accepted = verified = rejected = 0
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
                        rejected += 1
                        continue
                    exists = con.execute(select(product.c.prdt_name).where(
                        product.c.prdt_no == number)).scalar_one_or_none()
                    if not exists:
                        rejected += 1
                        continue
                    if key == NAME_FIELD and exists != original:
                        # Prevent attaching a translation to an unrelated stale item.
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

            con.execute(text("""INSERT INTO korea_prebook_kt_translation_audit (
                id,lang_code,source_endpoint,http_status,requested,returned,accepted,
                verified,rejected,error,recorded_at)
                VALUES (:id,:lang,:src,:status,:requested,:returned,:accepted,
                        :verified,:rejected,:error,:now)"""),
                {"id": str(uuid.uuid4()), "lang": lang, "src": SOURCE, "status": status,
                 "requested": len(sent), "returned": len(returned),
                 "accepted": accepted, "verified": verified, "rejected": rejected,
                 "error": error[:600], "now": utcnow()})
        return {"lang_code": lang, "http_status": status, "requested": len(sent),
                "translated_returned": len(returned), "db_inserted": accepted,
                "db_verified": verified, "rejected": rejected,
                "source": SOURCE, "error": error}

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
        return {"source": SOURCE, "languages": list(LANG_TARGET), "events": events,
                "persisted_rows_by_language": actual}
