"""One-shot, original Olive Young translation endpoint probe.

Mirrors original C:\\tour\\batch_translate.py: source_language=en,
target_language=ja/zh/zh-TW, texts=[real names], response.translations[].
Never invent translations, never retry 403/access challenges.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from playwright.async_api import Browser

API_URL="https://translation.oliveyoung.com/public/translate-texts"
LOCALES={"jp":"ja","zh_cn":"zh","zh_tw":"zh-TW"}
LOG=logging.getLogger("ktaxback_oliveyoung_translations")


async def probe(browser:Browser, api):
    """Source-locale producer: original 10×10 English samples, three translations.

    Uses PG leases to avoid duplicate HTTP on Railway rolling deployments,
    checks exact source_text for staleness, and honors source HTTP denials.
    """
    sample_api="/manager/api/ktaxback/translation/verified-category-samples"
    report=await api(sample_api)
    categories=report.get("categories",[])
    if not categories:return {"error":"no_verified_english_category_samples"}
    results=[];blocked=False
    ctx=await browser.new_context(locale="en-US",
        extra_http_headers={"Origin":"https://global.oliveyoung.com",
                            "Referer":"https://global.oliveyoung.com/"})
    try:
        for old in categories[:10]:
            cid=old["category_id"]
            for lang,target in LOCALES.items():
                owner=str(uuid.uuid4())
                lease={"category_id":cid,"lang_code":lang,"owner":owner}
                acquired=await api("/manager/api/ktaxback/translation/claim","POST",lease)
                if not acquired.get("acquired"):
                    LOG.info("TRANSLATION_LEASE_BUSY cid=%s lang=%s",cid,lang)
                    continue
                try:
                    # Another category may have translated an overlapping item.
                    # Read current rows *after* claiming the lease.
                    latest=await api(sample_api)
                    item=next((c for c in latest.get("categories",[])
                               if c.get("category_id")==cid),None)
                    if not item:continue
                    source_items=item["items"][:10]
                    remaining=[x for x in source_items
                              if lang not in x.get("existing_translations",[])]
                    if not remaining:
                        LOG.info("CAT_TRANSLATION_SKIP cat=%s lang=%s",cid,lang)
                        continue
                    payload={"source_language":"en","target_language":target,
                             "texts":[x["prdt_name"] for x in remaining]}
                    assignments=[{"prdt_no":str(x["prdt_no"]),
                                  "field_key":"detail-data.product.prdtNameEn",
                                  "source_text":str(x["prdt_name"])} for x in remaining]
                    status=0;response_json={};error=""
                    try:
                        response=await ctx.request.post(API_URL,data=payload,
                            headers={"Content-Type":"application/json","Accept":"application/json",
                                     "Origin":"https://global.oliveyoung.com",
                                     "Referer":"https://global.oliveyoung.com/"},
                            timeout=25000)
                        status=response.status
                        if status==200:
                            response_json=await response.json()
                            if not isinstance(response_json,dict):response_json={}
                        else:error="Original translation API HTTP "+str(status)
                    except Exception as exc:
                        error=type(exc).__name__+": "+str(exc)[:240]
                    out=await api("/manager/api/ktaxback/translation/capture","POST",{
                        "category_id":cid,"lang_code":lang,"source_url":API_URL,
                        "response_status":status,"request_payload":payload,
                        "response_payload":response_json,"assignments":assignments,
                        "error":error})
                    rec={"category_id":cid,"language":lang,"sampled":len(source_items),
                         "requested":len(remaining),"http":status,
                         "db_verified":out.get("db_verified",0),
                         "rejected":out.get("rejected",0)}
                    results.append(rec)
                    LOG.info("ORIGINAL_TRANSLATE_CATEGORY_RESULT %s",rec)
                    if status in (401,403,429):
                        blocked=True
                        LOG.warning("Provider access restriction %s: stop remaining requests",status)
                        break
                    await asyncio.sleep(2.0)
                finally:
                    try:
                        await api("/manager/api/ktaxback/translation/release","POST",lease)
                    except Exception:LOG.exception("Translation lease release failed %s %s",cid,lang)
            if blocked:break
    finally:
        await ctx.close()
    totals={}
    for x in results:
        slot=totals.setdefault(x["language"],{"requests":0,"db_verified":0})
        slot["requests"]+=1
        slot["db_verified"]+=x["db_verified"]
    LOG.info("ORIGINAL_TRANSLATE_CATEGORIES_FINAL %s",totals)
    return {"categories":len(categories),"http_events":len(results),
            "blocked":blocked,"by_language":totals}


async def probe_categories(browser:Browser,api):
    """One small original-source category-title translation batch per language."""
    source=await api("/manager/api/ktaxback/translation/category-source")
    rows=source.get("items",[])
    if not rows:
        LOG.warning("No real English category titles saved yet")
        return {"error":"empty_source_categories"}
    out={}
    context=await browser.new_context(locale="en-US")
    try:
        for lang,target in LOCALES.items():
            pending=[r for r in rows if lang not in r.get("existing_langs",[])]
            if not pending:continue
            payload={"source_language":"en","target_language":target,
                     "texts":[r["source_text"] for r in pending]}
            status=0;response={};error=""
            try:
                r=await context.request.post(API_URL,data=payload,
                    headers={"Content-Type":"application/json",
                             "Origin":"https://global.oliveyoung.com",
                             "Referer":"https://global.oliveyoung.com/"},
                    timeout=24000)
                status=r.status
                if status==200:
                    response=await r.json()
                    if not isinstance(response,dict):response={}
                else:error="Provider HTTP "+str(status)
            except Exception as exc:
                error=type(exc).__name__+" "+str(exc)[:250]
            result=await api("/manager/api/ktaxback/translation/category-capture","POST",{
                "lang_code":lang,"source_url":API_URL,"response_status":status,
                "request_payload":payload,"response_payload":response,
                "assignments":[{"category_id":r["category_id"],
                                "source_text":r["source_text"]} for r in pending],
                "error":error})
            out[lang]=result
            LOG.info("ORIGINAL_CATEGORY_TRANSLATION %s %s",lang,result)
            if status in (401,403,429):
                LOG.warning("Source translation restriction; stop other categories")
                break
            await asyncio.sleep(2)
    finally:await context.close()
    return out


async def probe_filters(browser:Browser,api):
    """Small original-category filter option/group localization pilot.

    Never synthesize localized values. The source K-TAXBACK SQLite schema stores
    translated filter_group and option_name as the locale table's composite key.
    """
    src=await api("/manager/api/ktaxback/translation/filter-source?limit_per_category=6")
    cats=src.get("categories",[])[:10]
    out={}
    context=await browser.new_context(locale="en-US")
    stop=False
    try:
        for category in cats:
            cid=category["category_id"]
            rows=category.get("items",[])[:6]
            if not rows:continue
            for lang,target in LOCALES.items():
                # Do not retransmit this category/language once its bounded
                # source sample has been fully persisted.
                stored=max((r.get("existing_language_rows",{}).get(lang,0) for r in rows),default=0)
                if stored>=len(rows):continue
                unique=list(dict.fromkeys(
                    item for row in rows for item in (row["filter_group"],row["option_name"])
                    if isinstance(item,str) and item.strip()))
                if not unique:continue
                payload={"source_language":"en","target_language":target,"texts":unique}
                status=0;response={};error=""
                try:
                    result=await context.request.post(API_URL,data=payload,
                        headers={"Content-Type":"application/json",
                                 "Origin":"https://global.oliveyoung.com",
                                 "Referer":"https://global.oliveyoung.com/"},
                        timeout=25000)
                    status=result.status
                    if status==200:
                        response=await result.json()
                        if not isinstance(response,dict):response={}
                    else:error="Source HTTP "+str(status)
                except Exception as ex:error=type(ex).__name__+" "+str(ex)[:200]
                result=await api("/manager/api/ktaxback/translation/filter-capture","POST",{
                    "lang_code":lang,"source_url":API_URL,"response_status":status,
                    "request_payload":payload,"response_payload":response,
                    "assignments":[{"category_id":cid,"filter_group":r["filter_group"],
                                    "option_name":r["option_name"],
                                    "option_count":r["option_count"]} for r in rows],
                    "error":error})
                out.setdefault(cid,{})[lang]=result
                LOG.info("ORIGINAL_FILTER_I18N %s %s %s",cid,lang,result)
                if status in (401,403,429):
                    stop=True;break
                await asyncio.sleep(2.0)
            if stop:break
    finally:await context.close()
    return {"source_categories":len(cats),"results":out,"provider_blocked":stop}


async def probe_details(browser:Browser,api):
    """Translate actual original option/details strings; preserve original DB fields."""
    data=await api("/manager/api/ktaxback/translation/detail-source")
    samples=data.get("samples",[])
    if not samples:return {"source_products":0,"results":[]}
    count=0;done=[];blocked=False
    ctx=await browser.new_context(locale="en-US")
    try:
        for product in samples[:10]:
            no=product["prdt_no"]
            fields=product.get("fields",[])
            for lang,target in LOCALES.items():
                remaining=[x for x in fields if lang not in x.get("existing_langs",[])]
                if not remaining:continue
                # Limit to 20 actual field values per source request, without
                # rewriting original option ordering or translating HTML.
                remaining=remaining[:20]
                unique=list(dict.fromkeys(x["source_text"] for x in remaining))
                payload={"source_language":"en","target_language":target,"texts":unique}
                response_data={};status=0;error=""
                try:
                    res=await ctx.request.post(API_URL,data=payload,
                        headers={"Content-Type":"application/json",
                                 "Origin":"https://global.oliveyoung.com",
                                 "Referer":"https://global.oliveyoung.com/"},
                        timeout=25000)
                    status=res.status
                    if status==200:
                        response_data=await res.json()
                        if not isinstance(response_data,dict):response_data={}
                    else:error="Source HTTP "+str(status)
                except Exception as exc:error=type(exc).__name__+" "+str(exc)[:210]
                output=await api("/manager/api/ktaxback/translation/capture","POST",{
                    "lang_code":lang,"source_url":API_URL,"response_status":status,
                    "request_payload":payload,"response_payload":response_data,
                    "assignments":[{"prdt_no":no,"field_key":x["field_key"],
                                    "source_text":x["source_text"]} for x in remaining],
                    "error":error})
                result={"product":no,"lang":lang,"http":status,
                        "saved":output.get("db_inserted",0),
                        "verified":output.get("db_verified",0),
                        "rejected":output.get("rejected",0)}
                LOG.info("ORIGINAL_OPTION_DETAILS_I18N %s",result)
                done.append(result);count+=output.get("db_verified",0)
                if status in (401,403,429):blocked=True;break
                await asyncio.sleep(2)
            if blocked:break
    finally:await ctx.close()
    return {"source_products":len(samples),"events":len(done),
            "db_verified":count,"provider_blocked":blocked}
