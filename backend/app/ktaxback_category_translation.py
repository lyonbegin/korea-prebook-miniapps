"""Use the original Olive Young translate-texts responses for original K-TAXBACK category_names_i18n.
Only real English category rows read from existing Railway PostgreSQL are accepted.
"""
from __future__ import annotations
import secrets,os,re,uuid
from urllib.parse import urlparse
from datetime import datetime,timezone
from pydantic import BaseModel,Field
from fastapi import Header,HTTPException
from sqlalchemy import MetaData,Table,select,text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from app.ktaxback_translation import SOURCE,LANG_TARGET,LANG_SCRIPTS
from app.ktaxback_pilot import CATEGORIES

class CategoryItem(BaseModel):
    category_id:str=Field(pattern=r"^[0-9]{10}$")
    source_text:str=Field(min_length=1,max_length=250)

class CategoryCapture(BaseModel):
    lang_code:str
    source_url:str
    response_status:int=Field(ge=0,le=599)
    request_payload:dict
    response_payload:dict=Field(default_factory=dict)
    assignments:list[CategoryItem]=Field(default_factory=list,max_length=20)
    error:str=Field(default="",max_length=500)

class FilterAssignment(BaseModel):
    category_id: str = Field(pattern=r"^[0-9]{10}$")
    filter_group: str = Field(min_length=1,max_length=250)
    option_name: str = Field(min_length=1,max_length=300)
    option_count: int = Field(ge=0)

class FilterCapture(BaseModel):
    lang_code: str
    source_url: str
    response_status: int = Field(ge=0,le=599)
    request_payload: dict
    response_payload: dict = Field(default_factory=dict)
    assignments: list[FilterAssignment] = Field(default_factory=list,max_length=8)
    error: str = Field(default="",max_length=500)

def mount_category_translation(app,engine):
    def auth(token):
        expected=os.getenv("ADMIN_API_TOKEN","")
        if not expected or not token or not secrets.compare_digest(token,"Bearer "+expected):
            raise HTTPException(401,"Manager token required")

    def read():
        cat=Table("korea_prebook_kt_categories",MetaData(),autoload_with=engine)
        dest=Table("korea_prebook_kt_category_names_i18n",MetaData(),autoload_with=engine)
        return cat,dest

    @app.get("/manager/api/ktaxback/translation/category-source")
    def source(authorization:str|None=Header(None)):
        auth(authorization)
        cat,dest=read()
        items=[]
        with engine.connect() as con:
            rows=con.execute(select(cat.c.category_id,cat.c.category_name).where(
                cat.c.category_id.in_(list(CATEGORIES)))).mappings().all()
            translated=con.execute(select(dest.c.category_id,dest.c.lang_code)).all()
            found={}
            for ident,lang in translated:found.setdefault(ident,[]).append(lang)
            for r in rows:
                name=str(r["category_name"] or "").strip()
                if not name or re.fullmatch(r"\d+",name):continue
                items.append({"category_id":r["category_id"],
                    "source_text":name,"existing_langs":found.get(r["category_id"],[])})
        return {"items":items,"language_targets":LANG_TARGET,"source":SOURCE,
                "source_type":"original_k_taxback_categories_from_postgres"}

    @app.post("/manager/api/ktaxback/translation/category-capture")
    def capture(data:CategoryCapture,authorization:str|None=Header(None)):
        auth(authorization)
        if data.lang_code not in LANG_TARGET:raise HTTPException(422,"Language excluded")
        parts=urlparse(data.source_url)
        if (parts.scheme,parts.hostname,parts.path)!=(
            "https","translation.oliveyoung.com","/public/translate-texts"):
            raise HTTPException(422,"Unexpected translation source")
        sent=data.request_payload.get("texts")
        response=data.response_payload.get("translations")
        if data.response_status==200 and (
            data.request_payload.get("source_language")!="en" or
            data.request_payload.get("target_language")!=LANG_TARGET[data.lang_code] or
            not isinstance(sent,list) or not isinstance(response,list) or
            len(sent)!=len(response) or len(sent)>20):
            raise HTTPException(422,"Mismatched source translation JSON")
        cat,dest=read()
        accepted=verified=rejected=0
        if data.response_status==200:
            mapping={}
            for before,item in zip(sent,response):
                if isinstance(before,str) and isinstance(item,dict) and not item.get("error"):
                    value=item.get("text")
                    if isinstance(value,str):mapping[before]=value.strip()
            with engine.begin() as con:
                for item in data.assignments:
                    english=con.execute(select(cat.c.category_name).where(
                        cat.c.category_id==item.category_id)).scalar_one_or_none()
                    translated=mapping.get(item.source_text)
                    if english!=item.source_text or not translated or translated==english or not LANG_SCRIPTS[data.lang_code].search(translated):
                        rejected+=1;continue
                    row={"category_id":item.category_id,"lang_code":data.lang_code,
                         "category_name":translated}
                    stmt=(pg_insert if engine.dialect.name=="postgresql" else sqlite_insert)(dest).values(**row)
                    con.execute(stmt.on_conflict_do_update(
                        index_elements=["category_id","lang_code"],
                        set_={"category_name":stmt.excluded.category_name}))
                    accepted+=1
                    value=con.execute(select(dest.c.category_name).where(
                        dest.c.category_id==item.category_id,
                        dest.c.lang_code==data.lang_code)).scalar_one_or_none()
                    if value!=translated:
                        raise HTTPException(500,"Localized category read-back failed")
                    verified+=1
        return {"lang_code":data.lang_code,"http":data.response_status,
                "translated_received":len(response) if isinstance(response,list) else 0,
                "stored":accepted,"verified":verified,"rejected":rejected,
                "error":data.error}


    @app.get("/manager/api/ktaxback/translation/filter-source")
    def filters_source(authorization:str|None=Header(None),limit_per_category:int=6):
        auth(authorization)
        if limit_per_category<1 or limit_per_category>8:
            raise HTTPException(422,"1-8 English filter options per category")
        filters=Table("korea_prebook_kt_category_filters",MetaData(),autoload_with=engine)
        translated=Table("korea_prebook_kt_category_filters_i18n",MetaData(),autoload_with=engine)
        with engine.connect() as con:
            base=con.execute(select(filters.c.category_id,filters.c.filter_group,
                   filters.c.option_name,filters.c.option_count).where(
                   filters.c.category_id.in_(list(CATEGORIES))).order_by(
                   filters.c.category_id,filters.c.filter_group,filters.c.option_name)).mappings().all()
            existing=con.execute(select(translated.c.category_id,translated.c.lang_code,
                   translated.c.filter_group,translated.c.option_name,
                   translated.c.option_count)).mappings().all()
        outputs={}
        for row in base:
            cid=row["category_id"]
            lst=outputs.setdefault(cid,[])
            if len(lst)>=limit_per_category:continue
            candidate=dict(row)
            # Original primary key of filter localization stores translated group
            # and name, not the English fields. Do not falsely map existing rows.
            candidate["existing_language_rows"]={
                lang:sum(1 for t in existing if t["category_id"]==cid and t["lang_code"]==lang)
                for lang in LANG_TARGET}
            lst.append(candidate)
        return {"categories":[{"category_id":id,"items":rows} for id,rows in outputs.items()],
                "source_endpoint":SOURCE,"languages":LANG_TARGET}

    @app.post("/manager/api/ktaxback/translation/filter-capture")
    def filter_capture(data:FilterCapture,authorization:str|None=Header(None)):
        auth(authorization)
        if data.lang_code not in LANG_TARGET:
            raise HTTPException(422,"Language outside requested scope")
        part=urlparse(data.source_url)
        if (part.scheme,part.hostname,part.path)!=(
                "https","translation.oliveyoung.com","/public/translate-texts"):
            raise HTTPException(422,"Untrusted translation response")
        original=data.request_payload.get("texts")
        localized=data.response_payload.get("translations")
        if data.response_status!=200:
            return {"state":"source_error","http":data.response_status,
                    "saved":0,"verified":0,"error":data.error}
        if (data.request_payload.get("source_language")!="en" or
            data.request_payload.get("target_language")!=LANG_TARGET[data.lang_code] or
            not isinstance(original,list) or not isinstance(localized,list) or
            len(original)!=len(localized) or len(original)>20):
            raise HTTPException(422,"Unmatched original source/translation pairs")
        pairs={}
        for source,result in zip(original,localized):
            if isinstance(source,str) and isinstance(result,dict) and not result.get("error"):
                txt=result.get("text")
                if isinstance(txt,str) and txt.strip():
                    pairs[source]=txt.strip()
        base=Table("korea_prebook_kt_category_filters",MetaData(),autoload_with=engine)
        dest=Table("korea_prebook_kt_category_filters_i18n",MetaData(),autoload_with=engine)
        accepted=verified=rejected=0
        with engine.begin() as con:
            for row in data.assignments:
                exists=con.execute(select(base.c.option_count).where(
                    base.c.category_id==row.category_id,
                    base.c.filter_group==row.filter_group,
                    base.c.option_name==row.option_name)).scalar_one_or_none()
                if exists is None:
                    rejected+=1;continue
                group=pairs.get(row.filter_group,row.filter_group)
                name=pairs.get(row.option_name,row.option_name)
                if (group==row.filter_group and name==row.option_name) or not any(
                        LANG_SCRIPTS[data.lang_code].search(x) for x in (group,name)):
                    rejected+=1;continue
                item={"category_id":row.category_id,"lang_code":data.lang_code,
                    "filter_group":group,"option_name":name,"option_count":exists}
                insert=(pg_insert if engine.dialect.name=="postgresql" else sqlite_insert)(dest).values(**item)
                con.execute(insert.on_conflict_do_update(
                    index_elements=["category_id","lang_code","filter_group","option_name"],
                    set_={"option_count":insert.excluded.option_count}))
                accepted+=1
                check=con.execute(select(dest.c.option_count).where(
                    dest.c.category_id==row.category_id,
                    dest.c.lang_code==data.lang_code,
                    dest.c.filter_group==group,
                    dest.c.option_name==name)).scalar_one_or_none()
                if check!=exists:raise HTTPException(500,"Localized filter verification failed")
                verified+=1
        return {"lang_code":data.lang_code,"http":200,
                "saved":accepted,"verified":verified,"rejected":rejected}
