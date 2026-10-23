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
    """api is the authenticated existing Railway manager transport."""
    status=await api("/manager/api/ktaxback/translation/status")
    existing={row["lang_code"]:int(row["rows"]) for row in status.get("persisted_rows_by_language",[])}
    sample=await api("/manager/api/ktaxback/translation/sample?category_id=1000000008&limit=10")
    rows=sample.get("items",[])
    if not rows:
        LOG.warning("Original K-TAXBACK English category sample empty; no language request.")
        return {"error":"empty_product_sample"}
    results={}
    context=await browser.new_context(
        locale="en-US",
        extra_http_headers={
            "Origin":"https://global.oliveyoung.com",
            "Referer":"https://global.oliveyoung.com/",
        })
    try:
        for lang,target in LOCALES.items():
            if existing.get(lang,0)>=10:
                LOG.info("TRANSLATE_PROBE_SKIPPED %s (10 verified records already in PostgreSQL)",lang)
                continue
            raw=[str(x["prdt_name"]) for x in rows if x.get("prdt_name")]
            assignments=[{
                "prdt_no":str(x["prdt_no"]),
                "field_key":"detail-data.product.prdtNameEn",
                "source_text":str(x["prdt_name"])
            } for x in rows if x.get("prdt_name")]
            if not raw:continue
            payload={"source_language":"en","target_language":target,"texts":raw}
            http_status=0;result={};error=""
            try:
                response=await context.request.post(
                    API_URL, data=payload,
                    headers={"Content-Type":"application/json",
                             "Accept":"application/json",
                             "Origin":"https://global.oliveyoung.com",
                             "Referer":"https://global.oliveyoung.com/"},
                    timeout=24000)
                http_status=response.status
                if http_status==200:
                    result=await response.json()
                    if not isinstance(result,dict):result={}
                else:
                    error="Source translate-texts HTTP "+str(http_status)
                    LOG.warning("TRANSLATE_SOURCE_HTTP lang=%s status=%s",lang,http_status)
            except Exception as exc:
                error="Source translation network error: "+type(exc).__name__+" "+str(exc)[:250]
                LOG.warning("TRANSLATE_SOURCE_ERROR %s %s",lang,error)
            outcome=await api("/manager/api/ktaxback/translation/capture","POST",{
                "lang_code":lang,
                "source_url":API_URL,
                "response_status":http_status,
                "request_payload":payload,
                "response_payload":result,
                "assignments":assignments,
                "error":error})
            results[lang]=outcome
            LOG.info("ORIGINAL_TRANSLATE_RESPONSE lang=%s http=%s received=%s verified=%s rejected=%s",
                lang,http_status,outcome.get("translated_returned"),outcome.get("db_verified"),
                outcome.get("rejected"))
            if http_status in (401,403,429):
                LOG.warning("Provider refused translation request; stop all other language probes.")
                break
            await asyncio.sleep(2.0)
    finally:
        await context.close()
    return results
