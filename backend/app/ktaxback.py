"""K-TAXBACK catalogue migration and original tour UI JSON compatibility.

Only allowlisted, user-supplied catalogue tables. No account, order, cart or
payment records. Legacy image paths and prices are returned unchanged.
The imported database is empty until an authenticated import explicitly occurs.
"""
from __future__ import annotations

import os
import re
import secrets
from collections import defaultdict
from typing import Any

from fastapi import Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column, Float, Integer, Index, MetaData, PrimaryKeyConstraint, Table, Text,
    create_engine, inspect, select, text,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

ALLOWED = frozenset((
    "products", "brands", "categories", "category_filters", "attribute_defs",
    "product_images", "product_options", "product_details", "product_attributes",
    "product_relations", "reviews", "home_corners", "home_corner_sets",
    "home_banners", "home_corner_products", "product_translations",
    "category_names_i18n", "category_filters_i18n", "seed_progress",
    "shop_collections", "shop_pickup_centers", "shop_price_offers", "shop_bundles",
    "product_names_i18n", "product_breadcrumb_i18n", "review_media",
))
PREFIX = "korea_prebook_kt_"
IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
LANGS = {"en", "jp", "vi_vn", "zh_cn", "zh_tw", "ko"}
PAGE_SIZE = 24
MAX_ROWS = 250

class ColumnDef(BaseModel):
    name: str
    type: str = "TEXT"
    notnull: int = 0
    pk: int = 0

class SchemaDef(BaseModel):
    name: str
    columns: list[ColumnDef] = Field(min_length=1, max_length=75)

class ImportBatch(BaseModel):
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=MAX_ROWS)

def column_type(t: str):
    t = t.upper().strip()
    if t == "INTEGER":
        return Integer
    if t in ("REAL", "FLOAT", "DOUBLE"):
        return Float
    if t in ("TEXT", "VARCHAR", "CHAR", "NUMERIC", "BOOLEAN", ""):
        return Text
    raise HTTPException(422, "Unsupported SQLite column type")

def mount_ktaxback(app, engine):
    metadata = MetaData()
    definitions = Table(
        PREFIX+"definitions", metadata,
        Column("name", Text, primary_key=True),
        Column("description", Text, nullable=False),
    )
    metadata.create_all(engine, tables=[definitions])

    def authenticate(authorization):
        token = os.getenv("ADMIN_API_TOKEN", "")
        if not token or not authorization or not secrets.compare_digest(
            authorization, "Bearer "+token
        ):
            raise HTTPException(401, "관리자 인증 필요")

    def allowed(name):
        if name not in ALLOWED:
            raise HTTPException(404, "Unsupported catalogue table")
        return name

    def reflect(name):
        allowed(name)
        actual = PREFIX + name
        if not inspect(engine).has_table(actual):
            raise HTTPException(503, "K-TAXBACK data not imported: "+name)
        return Table(actual, MetaData(), autoload_with=engine)

    def entries(table, limit=20000, **filters):
        t = reflect(table)
        q = select(t)
        for key, value in filters.items():
            if key in t.c:
                q = q.where(t.c[key] == value)
        q = q.limit(limit)
        with engine.connect() as con:
            return [dict(r) for r in con.execute(q).mappings().all()]

    def one(table, **filters):
        items = entries(table, 1, **filters)
        return items[0] if items else None

    def optional(table, limit=20000, **filters):
        if not inspect(engine).has_table(PREFIX+table):
            return []
        return entries(table, limit, **filters)

    def trans(prdt, lang, key):
        if lang == "en":
            return None
        row = optional("product_translations", 1,
                       prdt_no=prdt, lang_code=lang, field_key=key)
        return row[0].get("translated_text") if row else None

    def name_for(p, lang):
        if lang != "en":
            rows = optional("product_names_i18n", 1,
                            prdt_no=p["prdt_no"], lang_code=lang)
            if rows and rows[0].get("prdt_name"):
                return rows[0]["prdt_name"]
        return trans(p["prdt_no"], lang, "detail-data.product.prdtNameEn") or p["prdt_name"]

    def product_record(p, lang):
        b = one("brands", brand_no=p["brand_no"]) if p.get("brand_no") else None
        img = p.get("image_path")
        if lang != "en":
            v = sorted(optional("product_images", 500, prdt_no=p["prdt_no"], lang_code=lang),
                       key=lambda x:x.get("sort_order") or 0)
            img = next((r["image_path"] for r in v if r.get("image_type") == "gallery"), img)
        return {
            "prdtNo":p["prdt_no"], "prdtName":name_for(p,lang),
            "korPrdtName":p.get("prdt_name_kor"),
            "brandNo":p.get("brand_no"),
            "brandName":b.get("brand_name") if b else None,
            "korBrandName":b.get("kor_brand_name") if b else None,
            "ctgrNo":p.get("category_id"),"nrmlAmt":p.get("nrml_amt"),
            "minNrmlAmt":p.get("min_nrml_amt"), "maxNrmlAmt":p.get("max_nrml_amt"),
            "saleAmt":p.get("sale_amt"), "minSaleAmt":p.get("min_sale_amt"),
            "maxSaleAmt":p.get("max_sale_amt"),"eventSlprcDscntRt":p.get("event_slprc_dscnt_rt"),
            "imagePath":img, "bestYn":p.get("best_yn"), "newYn":p.get("new_yn"),
            "flashYn":p.get("flash_yn"), "sellingFastYn":p.get("selling_fast_yn"),
            "giftYn":p.get("gift_yn"), "soldOutYn":p.get("sold_out_yn"),
            "reviewCnt":p.get("review_cnt"), "avgScore":p.get("avg_score"),
            "reviewScore":p.get("avg_score"), "sellStatCode":"10",
        }

    def language(raw):
        if raw not in LANGS:
            raise HTTPException(422,"Unsupported language")
        return raw

    @app.post("/manager/api/ktaxback/schema")
    def register_schema(schema: SchemaDef, authorization: str | None = Header(None)):
        authenticate(authorization)
        allowed(schema.name)
        cols = schema.columns
        names = [x.name for x in cols]
        if len(set(names)) != len(names) or not all(IDENTIFIER.fullmatch(n) for n in names):
            raise HTTPException(422,"Invalid or duplicate columns")
        pk = [c.name for c in sorted(cols, key=lambda x:x.pk) if c.pk > 0]
        if not pk:
            raise HTTPException(422,"Primary key required")
        columns = [Column(c.name, column_type(c.type), nullable=not bool(c.notnull)) for c in cols]
        table = Table(PREFIX+schema.name, MetaData(), *columns, PrimaryKeyConstraint(*pk))
        table.create(engine, checkfirst=True)
        actual = Table(PREFIX+schema.name, MetaData(), autoload_with=engine)
        for keys, suffix in ((("prdt_no", "lang_code"), "product_lang"),
                             (("category_id",), "category"), (("brand_no",), "brand"),
                             (("prdt_no",), "product")):
            if all(key in actual.c for key in keys):
                Index(actual.name + "_" + suffix, *(actual.c[key] for key in keys)).create(
                    engine, checkfirst=True
                )
        if set(actual.c.keys()) != set(names) or list(actual.primary_key.columns.keys()) != pk:
            raise HTTPException(409, "Existing table schema differs; migration not applied")
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                statement=pg_insert(definitions).values(name=schema.name, description="catalog")
            else:
                statement=sqlite_insert(definitions).values(name=schema.name, description="catalog")
            conn.execute(statement.on_conflict_do_nothing(index_elements=["name"]))
        return {"name": schema.name, "columns":len(names), "primary_key":pk, "ready":True}

    @app.post("/manager/api/ktaxback/import/{table_name}")
    def import_rows(table_name: str, data: ImportBatch, authorization: str | None = Header(None)):
        authenticate(authorization)
        t = reflect(table_name)
        allowed_fields = set(t.c.keys())
        pk = list(t.primary_key.columns.keys())
        for row in data.rows:
            if set(row) - allowed_fields or any(row.get(k) is None for k in pk):
                raise HTTPException(422, "Invalid row columns or missing key")
        rows = [{k:v for k,v in row.items() if k in allowed_fields} for row in data.rows]
        with engine.begin() as con:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                stmt = pg_insert(t).values(rows)
            elif dialect == "sqlite":
                stmt = sqlite_insert(t).values(rows)
            else:
                raise HTTPException(503,"Database dialect unsupported")
            updates={c:stmt.excluded[c] for c in allowed_fields if c not in pk}
            if updates:
                stmt=stmt.on_conflict_do_update(index_elements=pk,set_=updates)
            else:
                stmt=stmt.on_conflict_do_nothing(index_elements=pk)
            # A batch may contain repeated primary keys from source snapshots.
            # Single row statements avoid PG cardinality errors for duplicates.
            for row in rows:
                ins = pg_insert(t).values(**row) if dialect == "postgresql" else sqlite_insert(t).values(**row)
                updates={key:ins.excluded[key] for key in row if key not in pk}
                if updates:
                    ins=ins.on_conflict_do_update(index_elements=pk,set_=updates)
                else:
                    ins=ins.on_conflict_do_nothing(index_elements=pk)
                con.execute(ins)
        return {"table":table_name, "received":len(rows), "status":"committed"}

    @app.get("/manager/api/ktaxback/status")
    def import_status(authorization: str | None = Header(None)):
        authenticate(authorization)
        with engine.connect() as con:
            registered=[r[0] for r in con.execute(select(definitions.c.name))]
        counts={}
        for name in registered:
            t=reflect(name)
            with engine.connect() as con:
                counts[name]=con.execute(text("SELECT COUNT(*) FROM "+t.name)).scalar_one()
        return {"registered_tables":registered,"counts":counts,
                "source":"read-only SQLite copy", "contains_accounts":False}

    def product(prdtNo):
        if not re.fullmatch(r"[A-Za-z0-9_-]{2,60}", prdtNo):
            raise HTTPException(400,"Invalid product number")
        p=one("products",prdt_no=prdtNo)
        if not p:
            raise HTTPException(404,"Product not found")
        return p

    @app.get("/detail-data.json")
    def detail(prdtNo:str=Query(...),lang:str="en"):
        p=product(prdtNo);lang=language(lang)
        brand=one("brands",brand_no=p["brand_no"]) if p.get("brand_no") else None
        imgs=optional("product_images", 1000, prdt_no=prdtNo,lang_code=lang)
        if not imgs and lang!="en":
            imgs=optional("product_images", 1000, prdt_no=prdtNo,lang_code="en")
        imgs=sorted([x for x in imgs if x["image_type"]=="gallery"],
                    key=lambda x:x.get("sort_order") or 0)
        opts=sorted(optional("product_options", 250,prdt_no=prdtNo),
                    key=lambda x:x.get("option_id") or 0)
        categories={c["category_id"]:c for c in optional("categories",500)}
        chain=[];cur=categories.get(p.get("category_id"));visited=set()
        while cur and cur["category_id"] not in visited:
            visited.add(cur["category_id"]);chain.insert(0,cur["category_name"])
            cur=categories.get(cur.get("parent_id"))
        display=name_for(p,lang)
        return {"product":{
            "prdtNo":prdtNo,"brandName":brand.get("brand_name") if brand else None,
            "brandNameEn":brand.get("brand_name") if brand else None,
            "prdtName":display,"prdtNameEn":display,
            "thumbnailList":[{"imagePath":x["image_path"]} for x in imgs],
            "nrmlAmt":p.get("nrml_amt"),"saleAmt":p.get("sale_amt"),
            "discountRate":p.get("discount_rate"),
            "allPathCtgrNameEn":" &gt; ".join(chain),
            "minBuyPsbltQty":p.get("min_buy_qty") or 1,
            "maxBuyPsbltQty":p.get("max_buy_qty") or 10,
            "optnName":p.get("option_name"),"bestYn":p.get("best_yn"),
            "newYn":p.get("new_yn"),"sellingFastYn":p.get("selling_fast_yn"),
            "optionList":[{
               "snglOptnNameEn": trans(prdtNo,lang,f"detail-data.product.optionList[{i}].snglOptnNameEn") or x["option_name"],
               "saleAmt":x.get("sale_amt"),
               "sellStatCode":"10" if x.get("in_stock") else "20",
               "rprstYn":"Y" if x.get("is_default") else "N",
            } for i,x in enumerate(opts)]
        }}

    @app.get("/details-info.json")
    def details_info(prdtNo:str=Query(...),lang:str="en"):
        product(prdtNo);lang=language(lang)
        d=one("product_details",prdt_no=prdtNo,lang_code=lang)
        own=bool(d)
        if not d:
            d=one("product_details",prdt_no=prdtNo,lang_code="en")
        imgs=[x for x in optional("product_images",1000,prdt_no=prdtNo,lang_code=lang if own else "en") if x.get("image_type")=="description"]
        if not d and not imgs:raise HTTPException(404,"Details not found")
        base={"whyWeLoveItText":(d or {}).get("why_we_love_it") or "",
              "ftrdIngrdText":(d or {}).get("featured_ingredients") or "",
              "howToUseText":(d or {}).get("how_to_use") or ""}
        if not own and lang != "en":
            for k in base:
                base[k]=trans(prdtNo,lang,"details-info.details."+k) or base[k]
        base["optimDtlDesc"]="".join('<img data-src="'+x["image_path"].replace('"',"&quot;")+'">' for x in imgs)
        return {"details":base}

    def assemble_corner(page_key,lang):
        lang=language(lang)
        if not inspect(engine).has_table(PREFIX+"home_corners"):
            raise HTTPException(503,"K-TAXBACK home catalogue not imported")
        corners=sorted(entries("home_corners",2000,page_key=page_key),
                       key=lambda c:c.get("sort_seq") or 0)
        allsets=optional("home_corner_sets",1000)
        allbanners=optional("home_banners",5000)
        allitems=optional("home_corner_products",10000)
        by_sets=defaultdict(list);by_banners=defaultdict(list);by_items=defaultdict(list)
        for x in allsets:by_sets[x["corner_pk"]].append(x)
        for x in allbanners:by_banners[x["set_id"]].append(x)
        for x in allitems:by_items[x["set_id"]].append(x)
        corner_list=[]
        for corner in corners:
            setmap={}
            for setrow in sorted(by_sets[corner["corner_pk"]],
                                 key=lambda v:v.get("sort_order") or 0):
                entry={}
                if setrow.get("set_name"):
                    entry["SET_NAME"]=[{"contsCont":setrow["set_name"],"sortSeq":0}]
                products=[]
                for linked in sorted(by_items[setrow["set_id"]],
                                     key=lambda v:v.get("sort_order") or 0):
                    p=one("products",prdt_no=linked["prdt_no"])
                    if p:products.append(product_record(p,lang))
                if products:entry["PRODUCT"]=products
                banners=by_banners[setrow["set_id"]]
                if banners:
                    b=banners[0]
                    if b.get("image_path"):
                        entry["IMAGE"]=[{
                            "contsMbleImagePath":b["image_path"],
                            "contsPcImagePath":b["image_path"],
                            "contsUrl":b.get("url"),
                            "contsUrlUseYn":"Y" if b.get("url") else "N",
                            "contsMbleAltrnText":b.get("alt_text"),
                            "contsPcAltrnText":b.get("alt_text")
                        }]
                    captions=[b.get("caption_1"),b.get("caption_2"),b.get("caption_3")]
                    captions=[x for x in captions if x]
                    if captions:
                        entry["TEXT"]={str(i):[{"contsCont":v,"sortSeq":i}]
                                       for i,v in enumerate(captions)}
                setmap[setrow["set_key"]]=entry
            corner_list.append({
                "dispPageConrNo":corner["corner_id"],
                "dispConrTmplNo":corner["template_no"],
                "dispConrName":corner.get("corner_name"),
                "sortSeq":str(corner.get("sort_seq") or 0),
                "langCode":"en",
                "setContsMap":setmap
            })
        return {"cornerList":corner_list}

    @app.get("/main-vue-data.json")
    def home(lang:str="en"):
        return assemble_corner("home",lang)

    @app.get("/new-arrivals-data.json")
    def new_arrivals(lang:str="en"):
        return assemble_corner("newarrivals",lang)

    @app.get("/flash-deal-vue-data.json")
    def flash_deals(lang:str="en"):
        return {"pageInfo":assemble_corner("flashdeal",lang)}

    @app.get("/featured-brands.json")
    def featured_brands(lang:str="en"):
        return assemble_corner("brands",lang)["cornerList"]

    @app.get("/best-seller-data.json")
    def bestseller_categories(lang:str="en"):
        language(lang)
        cats=entries("categories",1000)
        names={x["category_id"]:x["category_name"] for x in optional(
            "category_names_i18n",1000,lang_code=lang)}
        ordered=sorted([c for c in cats if c.get("depth")==1 and
                        c["category_id"]!="1000000001"],
                       key=lambda x:-(x.get("product_count") or 0))
        return {"ctgrList":[{"ctgrNo":c["category_id"],
                             "ctgrName":names.get(c["category_id"],c["category_name"])}
                            for c in ordered]}

    @app.get("/review-list.json")
    def review_list(prdtNo:str=Query(...),lang:str="en"):
        product(prdtNo);language(lang)
        rows=optional("reviews",5000,prdt_no=prdtNo,lang_code=lang) if lang!="en" else []
        own=bool(rows)
        if not rows:rows=optional("reviews",5000,prdt_no=prdtNo,lang_code="en")
        rows.sort(key=lambda r:r.get("sort_order") or 0)
        answer=[]
        for i,r in enumerate(rows):
            media=[{"imagePath":m["image_path"]} for m in optional(
                "review_media",500,review_key=r["review_key"])]
            body=(r.get("body") or "")
            if lang!="en" and not own:
                body=trans(prdtNo,lang,f"review-list.reviewList[{i}].conText") or body
            answer.append({"prdtReviewNo":r["review_no"],"previewScore":r.get("score"),
                           "conText":body,"loginId":None,"snglOptnName":r.get("option_name"),
                           "reviewRgstYmd":r.get("written_at"),"goodCnt":r.get("good_cnt"),
                           "reviewMediaList":media})
        return {"reviewList":answer,"totalCount":len(answer)}

    @app.get("/relation-list.json")
    def relations(prdtNo:str=Query(...),lang:str="en"):
        p=product(prdtNo);language(lang)
        result={}
        for bucket,relation_type,key in (("ctgrRelation","category","category_id"),
                                         ("brandRelation","brand","brand_no")):
            rows=optional("product_relations",3000,prdt_no=prdtNo,
                          relation_type=relation_type,lang_code=lang) if lang!="en" else []
            if not rows:rows=optional("product_relations",3000,prdt_no=prdtNo,
                                     relation_type=relation_type,lang_code="en")
            related=[]
            for r in sorted(rows,key=lambda x:x.get("sort_order") or 0):
                pr=one("products",prdt_no=r["related_prdt_no"])
                if pr:related.append(product_record(pr,lang))
            if not related and p.get(key):
                related=[product_record(x,lang) for x in sorted(
                    [x for x in entries("products",20000,**{key:p[key]}) if x["prdt_no"]!=prdtNo],
                    key=lambda x:-(x.get("review_cnt") or 0))[:8]]
            result[bucket]=related
        return result

    @app.get("/product-data-kpop.json")
    def kpop(lang:str="en"):
        language(lang)
        if not one("categories",category_id="1000000162"):
            raise HTTPException(404,"K-pop category not imported")
        categories=entries("categories",1000)
        ids={"1000000162"}
        for _ in range(15):
            before=len(ids)
            ids.update(c["category_id"] for c in categories if c.get("parent_id") in ids)
            if len(ids)==before:break
        rows=[p for p in entries("products",20000) if p.get("category_id") in ids]
        rows.sort(key=lambda p:p["prdt_no"])
        return {"hits":{"found":len(rows),"hit":[{"fields":product_record(p,lang)} for p in rows[:500]]},
                "brandFacets":[]}

    @app.get("/brand-list.json")
    def brand_list():
        return [{
            "brandNo":r["brand_no"],"brandUrlName":r.get("brand_url_name"),
            "brandName":r.get("brand_name"),"korBrandName":r.get("kor_brand_name"),
            "firstDigitBrandName":r.get("first_letter"),"newYn":r.get("new_yn"),
            "brandDesc":r.get("brand_desc"),"brandLogoImagePath":r.get("logo_image_path"),
            "prdtCnt":r.get("product_count")
        } for r in sorted(entries("brands",10000),key=lambda r:(r.get("brand_name") or "").lower())]

    @app.get("/order-best.json")
    def bests(lang:str="en"):
        lang=language(lang)
        items=entries("products",15000)
        best=sorted([p for p in items if p.get("best_yn")=="Y"],
                    key=lambda p:-(p.get("review_cnt") or 0))[:20]
        return [product_record(p,lang) for p in best]

    @app.get("/oliveyoung_json_data/ctgr_{ctgr}/page_{page}.json")
    def category_page(ctgr:str,page:int,lang:str="en"):
        lang=language(lang)
        if page<1 or page>2000:raise HTTPException(404,"Page not found")
        cats=entries("categories",1000)
        children={};ids={ctgr};todo=[ctgr]
        for c in cats:children.setdefault(c.get("parent_id"),[]).append(c["category_id"])
        while todo:
            for child in children.get(todo.pop(),[]):
                if child not in ids:ids.add(child);todo.append(child)
        items=[p for p in entries("products",20000) if p.get("category_id") in ids]
        items.sort(key=lambda p:p["prdt_no"]);total=len(items)
        start=(page-1)*PAGE_SIZE
        if start>=total:raise HTTPException(404,"No category results")
        subset=items[start:start+PAGE_SIZE]
        attrs=defaultdict(int);brands=defaultdict(int)
        matched_ids = {p["prdt_no"] for p in items}
        for p in items:
            if p.get("brand_no"):brands[p["brand_no"]]+=1
        for a in optional("product_attributes",40000):
            if a["prdt_no"] in matched_ids:
                attrs[a["attr_name"]]+=1
        allbrands={b["brand_no"]:b.get("brand_name","") for b in optional("brands",10000)}
        return {
          "hits":{"found":total,"hit":[{"fields":{
              **product_record(p,lang),
              "attrValList":[x["attr_name"] for x in optional("product_attributes",250,prdt_no=p["prdt_no"])]
          }} for p in subset]},
          "brandFacets":[{"value":f"{id}^{allbrands.get(id,'')}","count":count} for id,count in brands.items()],
          "min":min((p.get("sale_amt") or 0 for p in items),default=0),
          "max":max((p.get("sale_amt") or 0 for p in items),default=0),
          "attrFacets":[{"value":f"Attr:^:{k}","count":v} for k,v in attrs.items()],
          "categoryFacets":[],"reviewScoreFacets":[],"eventSlprcDscntRtFacets":[],"productPriceMap":{},
        }

    @app.get("/FINAL_category_with_real_filters.json")
    def category_tree(lang:str="en"):
        lang=language(lang);cats=entries("categories",1000)
        names={x["category_id"]:x["category_name"] for x in optional("category_names_i18n",2000,lang_code=lang)}
        flt=defaultdict(lambda:defaultdict(list))
        for f in optional("category_filters",30000):
            flt[f["category_id"]][f["filter_group"]].append({"name":f["option_name"],"count":f["option_count"]})
        nodes={c["category_id"]:{
            "categoryId":c["category_id"],"categoryName":names.get(c["category_id"],c["category_name"]),
            "depth":c.get("depth"),"productCount":c.get("product_count"),
            "availableFilters":[{"filterGroup":g,"options":o} for g,o in flt[c["category_id"]].items()],
            "subCategories":[]
        } for c in cats}
        roots=[]
        for c in cats:
            if c.get("parent_id") in nodes:nodes[c["parent_id"]]["subCategories"].append(nodes[c["category_id"]])
            else:roots.append(nodes[c["category_id"]])
        return roots
