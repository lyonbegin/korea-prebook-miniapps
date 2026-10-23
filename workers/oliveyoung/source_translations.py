"""One-shot, original Olive Young translation endpoint probe.

Mirrors original C:\\tour\\batch_translate.py: source_language=en,
target_language=ja/zh/zh-TW, texts=[real names], response.translations[].
Never invent translations, never retry 403/access challenges.
"""
from __future__ import annotations

import asyncio
import logging
from playwright.async_api import Browser

API_URL="https://translation.oliveyoung.com/public/translate-texts"
LOCALES={"jp":"ja","zh_cn":"zh","zh_tw":"zh-TW"}
LOG=logging.getLogger("ktaxback_oliveyoung_translations")


async def probe(browser:Browser, api):
    """Run the exact user-scoped 10-category x 10-product x 3-language pilot.

    Each product ID comes from prior *real* English product-data captures,
    not inferred category aliases. Existing translations are skipped by ID.
    Failures are auditable and never counted as saved rows.
    """
    report=await api("/manager/api/ktaxback/translation/verified-category-samples")
    categories=report.get("categories",[])
    if not categories:
        LOG.error("Original 10-category live English capture evidence absent")
        return {"error":"no_verified_english_category_samples"}
    LOG.info("ORIGINAL_TRANSLATE_CATEGORY_COUNT %d",len(categories))
    results=[]
    context=await browser.new_context(
        locale="en-US",
        extra_http_headers={"Origin":"https://global.oliveyoung.com",
                            "Referer":"https://global.oliveyoung.com/"})
    blocked=False
    try:
        for cat in categories[:10]:
            cid=cat["category_id"]
            source_items=cat["items"][:10]
            if not source_items:
                LOG.warning("No captured English item IDs for category %s",cid)
                continue
            for lang,target in LOCALES.items():
                remaining=[x for x in source_items
                           if lang not in x.get("existing_translations",[])]
                if not remaining:
                    LOG.info("CAT_TRANSLATION_SKIP cat=%s lang=%s (all already in PG)",cid,lang)
                    continue
                payload={"source_language":"en","target_language":target,
                         "texts":[x["prdt_name"] for x in remaining]}
                assignments=[{
                    "prdt_no":str(x["prdt_no"]),
                    "field_key":"detail-data.product.prdtNameEn",
                    "source_text":str(x["prdt_name"])} for x in remaining]
                status=0;response_json={};error=""
                try:
                    response=await context.request.post(
                        API_URL,data=payload,
                        headers={"Content-Type":"application/json",
                                 "Accept":"application/json",
                                 "Origin":"https://global.oliveyoung.com",
                                 "Referer":"https://global.oliveyoung.com/"},
                        timeout=25000)
                    status=response.status
                    if status==200:
                        response_json=await response.json()
                        if not isinstance(response_json,dict):response_json={}
                    else:
                        error="Translation provider returned HTTP "+str(status)
                except Exception as exc:
                    error=type(exc).__name__+": "+str(exc)[:250]
                output=await api("/manager/api/ktaxback/translation/capture","POST",{
                    "lang_code":lang,"source_url":API_URL,
                    "response_status":status,"request_payload":payload,
                    "response_payload":response_json,
                    "assignments":assignments,"error":error})
                result={"category_id":cid,"language":lang,"sampled":len(source_items),
                        "requested":len(remaining),"http":status,
                        "db_verified":output.get("db_verified",0),
                        "rejected":output.get("rejected",0)}
                results.append(result)
                LOG.info("ORIGINAL_TRANSLATE_CATEGORY_RESULT %s",result)
                if status in (401,403,429):
                    LOG.warning("Original site denied translation; stop further requests without bypass or retry")
                    blocked=True;break
                await asyncio.sleep(2.0)
            if blocked:break
    finally:
        await context.close()
    sums={}
    for x in results:
        y=sums.setdefault(x["language"],{"requests":0,"db_verified":0})
        y["requests"]+=1;y["db_verified"]+=x["db_verified"]
    LOG.info("ORIGINAL_TRANSLATE_CATEGORIES_FINAL %s",sums)
    return {"categories":len(categories),"http_events":len(results),
            "blocked":blocked,"by_language":sums,"results":results[:35]}
