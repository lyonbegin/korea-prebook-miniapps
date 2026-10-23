"""Native WeChat and Alipay K-TAXBACK shop read-only API.

Uses only actual collected product rows and original K-TAXBACK locale tables.
Preserves original prdt_no, USD price and Olive Young relative CDN images.
Does not create order/payment/cart records.
"""
from __future__ import annotations

import re
from collections import defaultdict
from fastapi import HTTPException, Query
from sqlalchemy import MetaData, Table, select

CDN = "https://cdn-image.oliveyoung.com/"
LANGUAGES = ("en", "jp", "zh_cn", "zh_tw")
# Original shop V3's representative parent-category catalogue.
TOP = (
    ("1000000003", "Face Masks", "面膜", "フェイスマスク", "面膜"),
    ("1000000008", "Skincare", "护肤", "スキンケア", "護膚"),
    ("1000000011", "Suncare", "防晒", "サンケア", "防曬"),
    ("1000000031", "Makeup", "彩妆", "メイク", "彩妝"),
    ("1000000052", "Bath & Body", "身体护理", "ボディケア", "身體護理"),
    ("1000000070", "Hair", "护发", "ヘアケア", "護髮"),
    ("1000000087", "Tools", "美妆工具", "メイクツール", "美妝工具"),
    ("1000000095", "Wellness", "健康护理", "ウェルネス", "健康護理"),
    ("1000000119", "Men's Care", "男士护理", "メンズケア", "男士護理"),
    ("1000000134", "Supplements", "健康补充品", "サプリメント", "健康補充品"),
)
NAME_PATH = "detail-data.product.prdtNameEn"
DISPLAY = {"en":1, "zh_cn":2, "jp":3, "zh_tw":4}

def image_url(v):
    if not v:
        return ""
    value = str(v).strip()
    if value.startswith("https://cdn-image.oliveyoung.com/"):
        return value
    if value.startswith("https://"):
        # Existing catalogue is source-controlled; restrict image origin to the
        # source CDN so users' clients aren't silently sent to arbitrary hosts.
        return ""
    if value.startswith("http://") or value.startswith("//"):
        return ""
    return CDN + value.lstrip("/")

def mount_miniapp_shop(app, engine):
    def raw():
        def table(name):
            return Table("korea_prebook_kt_"+name, MetaData(),autoload_with=engine)
        with engine.connect() as con:
            products = [dict(v) for v in con.execute(select(table("products"))).mappings()]
            brands = {x["brand_no"]:x for x in con.execute(select(table("brands"))).mappings()}
            cats = [dict(v) for v in con.execute(select(table("categories"))).mappings()]
            names = {(x["prdt_no"], x["lang_code"]):x["prdt_name"] for x in con.execute(
                select(table("product_names_i18n"))).mappings()}
            for tr in con.execute(select(table("product_translations")).where(
                    table("product_translations").c.field_key==NAME_PATH)).mappings():
                names.setdefault((tr["prdt_no"], tr["lang_code"]), tr["translated_text"])
            category_names = {(x["category_id"],x["lang_code"]):x["category_name"]
                              for x in con.execute(select(table("category_names_i18n"))).mappings()}
            pilot = [dict(x) for x in con.execute(select(table("pilot_tasks")).
                     where(table("pilot_tasks").c.lang_code=="en",
                           table("pilot_tasks").c.state=="verified")).mappings()]
        return products,brands,cats,names,category_names,pilot

    def grouped(products,categories,pilot):
        # Preserve each product's source category ID. Pilot samples can also
        # describe a V3 primary-category shelf when the source item is a leaf.
        child=defaultdict(list)
        for cat in categories:
            if cat.get("parent_id"):
                child[str(cat["parent_id"])].append(str(cat["category_id"]))
        tags=defaultdict(set)
        for root, *_ in TOP:
            descendants={root}
            frontier=[root]
            while frontier:
                for cid in child.get(frontier.pop(),[]):
                    if cid not in descendants:
                        descendants.add(cid);frontier.append(cid)
            for p in products:
                if str(p.get("category_id")) in descendants:
                    tags[root].add(p["prdt_no"])
        import json
        for entry in pilot:
            category=str(entry.get("category_id",""))
            if category not in {x[0] for x in TOP}:continue
            try:
                for sample in json.loads(entry.get("sample_json") or "[]"):
                    if sample.get("state")=="verified_original_product":
                        tags[category].add(sample["prdt_no"])
            except (ValueError,TypeError):
                continue
        return tags

    def pack(row,brands,names,lang):
        bid=row.get("brand_no")
        brand=brands.get(bid,{}) if bid else {}
        original=row.get("prdt_name") or ""
        name=names.get((row["prdt_no"],lang)) or original
        normal=row.get("nrml_amt")
        sale=row.get("sale_amt")
        try:
            discount=max(0,round((1-float(sale)/float(normal))*100)) if normal and sale and float(normal)>float(sale) else 0
        except (ValueError,TypeError,ZeroDivisionError):
            discount=0
        return {
            "id":row["prdt_no"], "prdtNo":row["prdt_no"],
            "name":name,"originalName":original,
            "brand":brand.get("brand_name") or "",
            "image":image_url(row.get("image_path")),
            "price":round(float(sale or 0),2),
            "regularPrice":round(float(normal or 0),2),
            "currency":"USD","discount":discount,
            "new":row.get("new_yn")=="Y", "best":row.get("best_yn")=="Y",
            "reviewCount":row.get("review_cnt") or 0,
            "categoryId":row.get("category_id") or "",
            "soldOut":row.get("sold_out_yn")=="Y"
        }

    def catalog(lang,category,keyword,sort,page,size):
        if lang not in LANGUAGES:raise HTTPException(422,"Unsupported locale")
        products,brands,cats,names,category_names,pilots=raw()
        tags=grouped(products,cats,pilots)
        candidates=products
        if category and category!="all":
            if category not in tags:raise HTTPException(404,"Category unavailable")
            members=tags[category]
            candidates=[p for p in candidates if p["prdt_no"] in members]
        if keyword:
            term=keyword.strip().casefold()
            candidates=[p for p in candidates if term in (
                str(names.get((p["prdt_no"],lang)) or p.get("prdt_name") or "")+
                " "+str(brands.get(p.get("brand_no"),{}).get("brand_name") or "")
            ).casefold()]
        if sort=="best":
            candidates.sort(key=lambda p:(p.get("best_yn")=="Y",int(p.get("review_cnt") or 0)),reverse=True)
        elif sort=="new":
            candidates.sort(key=lambda p:(p.get("new_yn")=="Y",str(p["prdt_no"])),reverse=True)
        elif sort=="sale":
            candidates.sort(key=lambda p:(
                (float(p.get("nrml_amt") or 0)-float(p.get("sale_amt") or 0)),
                int(p.get("review_cnt") or 0)),reverse=True)
        elif sort=="price_asc":
            candidates.sort(key=lambda p:float(p.get("sale_amt") or 0))
        else:
            candidates.sort(key=lambda p:p["prdt_no"])
        total=len(candidates)
        start=(page-1)*size
        cards=[pack(p,brands,names,lang) for p in candidates[start:start+size]]
        index=DISPLAY[lang]
        # Use actual original category translations when available; only UI
        # labels are locally translated to identify the native navigation.
        sections=[{"id":cid,"label":category_names.get((cid,lang)) or labels[index],
                   "count":len(tags.get(cid,set()))}
                  for cid,*labels in TOP]
        return {"lang":lang,"category":category or "all","sort":sort,
                "products":cards,"categories":sections,"total":total,
                "page":page,"pageSize":size,"hasMore":start+size<total,
                "currency":"USD","checkoutAvailable":False}

    @app.get("/v1/ktaxback/miniapp/home")
    def home(lang:str="zh_cn"):
        values=catalog(lang,"all","","best",1,20)
        return {"brand":"K-TAXBACK",**values,
                "source":"K-TAXBACK original PostgreSQL catalogue",
                "navigation":["home","category","best","new","sale"]}

    @app.get("/v1/ktaxback/miniapp/products")
    def listing(lang:str="zh_cn",category:str="all",
                keyword:str=Query("",max_length=100),
                sort:str=Query("best",pattern=r"^(best|new|sale|price_asc|all)$"),
                page:int=Query(1,ge=1,le=10000),
                size:int=Query(20,ge=1,le=50)):
        return catalog(lang,category,keyword,sort,page,size)

    @app.get("/v1/ktaxback/miniapp/products/{prdt_no}")
    def detail(prdt_no:str,lang:str="zh_cn"):
        if lang not in LANGUAGES:raise HTTPException(422,"Unsupported locale")
        if not re.fullmatch(r"[A-Za-z0-9_-]{2,60}",prdt_no):
            raise HTTPException(400,"Invalid product")
        product,brands,_,names,_,_=raw()
        row=next((p for p in product if p["prdt_no"]==prdt_no),None)
        if row is None:raise HTTPException(404,"Product not in catalogue")
        t=lambda name:Table("korea_prebook_kt_"+name,MetaData(),autoload_with=engine)
        with engine.connect() as con:
            image_rows=[dict(x) for x in con.execute(select(t("product_images")).where(
                t("product_images").c.prdt_no==prdt_no,
                t("product_images").c.image_type=="gallery")).mappings()]
            options=[dict(x) for x in con.execute(select(t("product_options")).where(
                t("product_options").c.prdt_no==prdt_no)).mappings()]
            desc=con.execute(select(t("product_details")).where(
                t("product_details").c.prdt_no==prdt_no,
                t("product_details").c.lang_code==lang)).mappings().first()
            if not desc:
                desc=con.execute(select(t("product_details")).where(
                    t("product_details").c.prdt_no==prdt_no,
                    t("product_details").c.lang_code=="en")).mappings().first()
            tr={x["field_key"]:x["translated_text"] for x in con.execute(
                select(t("product_translations")).where(
                    t("product_translations").c.prdt_no==prdt_no,
                    t("product_translations").c.lang_code==lang)).mappings()}
        gallery=[image_url(x["image_path"]) for x in sorted(image_rows,
            key=lambda x:x.get("sort_order") or 0) if image_url(x["image_path"])]
        if not gallery and row.get("image_path"):
            gallery=[image_url(row["image_path"])]
        choices=[]
        for i,v in enumerate(sorted(options,key=lambda x:x.get("option_id") or 0)):
            choices.append({"name":tr.get(f"detail-data.product.optionList[{i}].snglOptnNameEn")
                                   or v.get("option_name") or "",
                            "price":v.get("sale_amt"),"available":bool(v.get("in_stock")),
                            "default":bool(v.get("is_default"))})
        details=dict(desc) if desc else {}
        for field,key in (("why_we_love_it","whyWeLoveItText"),
                          ("featured_ingredients","ftrdIngrdText"),
                          ("how_to_use","howToUseText")):
            details[field]=tr.get("details-info.details."+key) or details.get(field) or ""
        return {"product":pack(row,brands,names,lang),
                "images":gallery,"options":choices,
                "description":{"summary":details.get("why_we_love_it",""),
                    "ingredients":details.get("featured_ingredients",""),
                    "howToUse":details.get("how_to_use","")},
                "checkoutAvailable":False,"currency":"USD","lang":lang}
