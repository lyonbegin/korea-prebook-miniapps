"""Bounded live verification run: 10 representative categories, 10 real products per category,
four original Olive Young language/country preferences. No synthetic data.
Railway uses existing admin token by reference. Previous full crawler disabled
for this pilot. Every task result is persisted to the pilot DB report.
"""
from __future__ import annotations
import asyncio,json,logging,os,signal,urllib.error,urllib.request,re,time
from urllib.parse import urlencode
from playwright.async_api import async_playwright

API=os.getenv("MANAGER_BASE","https://prebook-api-production-9b80.up.railway.app").rstrip("/")
KEY=os.getenv("ADMIN_API_TOKEN","")
LANG_LOCALE={"en":"en-US","jp":"ja-JP","zh_cn":"zh-CN","zh_tw":"zh-TW"}
DATA_CODE={"jp":"ja","zh_cn":"zh","zh_tw":"zh-TW"}
DISPLAY={"en":"English","jp":"日本語","zh_cn":"中文（简体）",
         "zh_tw":"中文（繁體）"}
LOG=logging.getLogger("ktaxback_10x5_pilot")
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
STOP=False
def signal_stop(*_):
    global STOP;STOP=True
signal.signal(signal.SIGTERM,signal_stop);signal.signal(signal.SIGINT,signal_stop)

def req(path,method="GET",data=None):
    payload=json.dumps(data,ensure_ascii=False).encode("utf-8") if data is not None else None
    h={"Authorization":"Bearer "+KEY,"Accept":"application/json"}
    if payload is not None:h["Content-Type"]="application/json"
    request=urllib.request.Request(API+path,method=method,headers=h,data=payload)
    try:
        with urllib.request.urlopen(request,timeout=100) as result:
            return json.loads(result.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        msg=exc.read(550).decode("utf-8","replace")
        raise RuntimeError(f"Pilot API {exc.code} {path}: {msg[:420]}") from exc

async def api(path,method="GET",data=None):
    return await asyncio.to_thread(req,path,method,data)

PREFERENCES = {
    "jp": {"country":"JAPAN","language":("日本語","Japanese")},
    "zh_cn": {"country":"CHINA","language":("中文（简体）","Chinese (Simplified)")},
    "zh_tw": {"country":"TAIWAN","language":("中文（繁體）","Chinese (Traditional)")},
}

async def click_visible(page, labels, timeout=3500):
    """Click exact visible text (the original site duplicates hidden modal markup)."""
    for label in labels:
        locator=page.get_by_text(label,exact=True)
        for i in reversed(range(min(await locator.count(),12))):
            node=locator.nth(i)
            try:
                if await node.is_visible():
                    await node.click(timeout=timeout)
                    return label
            except Exception:pass
    raise RuntimeError("Visible selector absent: "+"/".join(labels))

async def set_preferences(context, lang):
    """Fish-verified click sequence, persistent context shared across all categories."""
    if lang=="en":return "English original"
    config=PREFERENCES[lang]
    setup=await context.new_page()
    try:
        await setup.goto("https://global.oliveyoung.com/",
                         wait_until="domcontentloaded",timeout=45000)
        await setup.wait_for_timeout(1000)
        title=await setup.title()
        if any(x in title for x in ("Just a moment","Access restricted","しばらくお待ち")):
            raise RuntimeError("Global site access restriction: "+title)
        # Confirmed by real TinyFish interaction on 2026-10-23:
        # Shopping Preferences > Shipping Location > country >
        # Language > locale > Save > reopen to verify persistence.
        trigger=setup.get_by_role("button",name=re.compile("Shopping Preferences",re.I))
        if await trigger.count():
            visible=[trigger.nth(i) for i in range(min(await trigger.count(),10))
                     if await trigger.nth(i).is_visible()]
            if visible:await visible[-1].click(timeout=5000)
            else:await click_visible(setup,("Shopping Preferences",))
        else:
            await click_visible(setup,("Shopping Preferences",))
        # Country dropdown sometimes initially renders 'Global (Select Location)'.
        await click_visible(setup,("Global (Select Location)","Shipping Location"))
        await click_visible(setup,(config["country"],))
        # Language is a distinct dropdown; exact English is the initial value.
        await click_visible(setup,("English","Language"))
        selected=await click_visible(setup,config["language"])
        await click_visible(setup,("Save",))
        await setup.wait_for_timeout(400)
        # Re-open and check both values persist before collecting any products.
        if await trigger.count():
            candidate=trigger.last
            if await candidate.is_visible():await candidate.click(timeout=5000)
            else:await click_visible(setup,("Shopping Preferences",))
        else:await click_visible(setup,("Shopping Preferences",))
        body=await setup.locator("body").inner_text(timeout=4000)
        if config["country"] not in body or not any(x in body for x in config["language"]):
            raise RuntimeError("Preferences were not confirmed after Save")
        return "confirmed-country="+config["country"]+"|selected-code="+DATA_CODE[lang]+"|saved-language="+selected
    finally:
        await setup.close()

async def read_category(context,task,evidence):
    lang=task["lang_code"];cat=task["category_id"]
    url="https://global.oliveyoung.com/display/category?"+urlencode({"ctgrNo":cat})
    page=await context.new_page()
    results=asyncio.Queue()
    tasks=[]
    failures=[]
    async def on_response(r):
        if "product-data" not in r.url or r.status!=200:return
        try:
            body=await r.json()
            if isinstance(body,dict) and isinstance((body.get("hits") or {}).get("hit"),list):
                await results.put((r.url,body))
        except Exception as exc:
            failures.append(type(exc).__name__)
    page.on("response",lambda r:tasks.append(asyncio.create_task(on_response(r))))
    try:
        await page.goto(url,wait_until="domcontentloaded",timeout=45000)
        await page.wait_for_timeout(1500)
        title=await page.title()
        if "Just a moment" in title or "Access denied" in title:
            raise RuntimeError("Site requested verification: "+title+"; cannot treat as successful crawl")
        if tasks:await asyncio.gather(*tasks,return_exceptions=True)
        if results.empty():
            for attempt in range(2):
                try:source,payload=await asyncio.wait_for(results.get(),timeout=7+4*attempt)
                except asyncio.TimeoutError:
                    if attempt==0:
                        await page.reload(wait_until="domcontentloaded",timeout=35000)
                        await page.wait_for_timeout(1100)
                        if tasks:await asyncio.gather(*tasks,return_exceptions=True)
                        if not results.empty():
                            source,payload=results.get_nowait()
                            break
                else:break
            else:
                title=await page.title()
                raise RuntimeError(f"No real product-data JSON after reload; title={title}; current_url={page.url}")
        else:source,payload=results.get_nowait()
        chosen=(payload.get("hits") or {}).get("hit") or []
        payload["hits"]["hit"]=chosen[:task["requested"]]
        return {"task_id":task["id"],"url":source,
                "selected_language":evidence[:240],"title":(await page.title())[:120],
                "payload":payload}
    except Exception as exc:
        return {"task_id":task["id"],"url":url,
                "selected_language":evidence[:240],
                "title":"","payload":{},
                "error":f"{type(exc).__name__}: {str(exc)[:540]}"}
    finally:
        if tasks:await asyncio.gather(*tasks,return_exceptions=True)
        await page.close()

async def main():
    if not KEY:raise SystemExit("ADMIN_API_TOKEN required")
    LOG.info("Bounded 10-category × 4-language original-schema source verification worker booted")
    try:
        started=await api("/manager/api/ktaxback/pilot/start","POST")
    except Exception:
        LOG.exception("Could not prepare pilot tasks");raise
    LOG.info("Requested categories=%d langs=%s entries/task=%d",
             len(started["categories"]),started["languages"],started["per_task"])
    try:
        retry=await api("/manager/api/ktaxback/pilot/retry-selector-v2","POST")
        LOG.info("VISIBLE_LANGUAGE_SELECTOR_RETRY %s",retry)
    except Exception as exc:
        LOG.warning("Language selector retry planning unavailable: %s",str(exc)[:300])
    try:
        smoke=await api("/manager/api/ktaxback/pilot/retry-fish-preferences","POST")
        LOG.info("FISH_SAVED_COUNTRY_LANGUAGE_SMOKE %s",smoke)
    except Exception as exc:
        LOG.warning("Preference smoke-test scheduler unavailable: %s",str(exc)[:250])
    restricted=0
    contexts={}; locale_evidence={}
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=["--disable-dev-shm-usage"])
        try:
            while not STOP:
                task=(await api("/manager/api/ktaxback/pilot/next")).get("task")
                if not task:
                    LOG.info("Pilot queue empty. Remain idle; no automatic full category crawl.")
                    break
                LOG.info("FETCH %s %s requested=%s",task["category_id"],task["lang_code"],task["requested"])
                lang=task["lang_code"]
                if lang not in LANG_LOCALE:
                    LOG.warning("Unsupported locale excluded from collector: %s",lang)
                    continue
                if lang not in locale_evidence:
                    if lang not in contexts:
                        contexts[lang]=await browser.new_context(
                            locale=LANG_LOCALE[lang],
                            extra_http_headers={"Accept-Language":LANG_LOCALE[lang]+",en;q=0.7"})
                    try:
                        locale_evidence[lang]=await set_preferences(contexts[lang],lang)
                        LOG.info("FISH_CONFIRMED_PREFERENCES %s %s",lang,locale_evidence[lang])
                    except Exception as exc:
                        locale_evidence[lang]="PREFERENCES_FAILED:"+str(exc)[:160]
                        LOG.warning("Preference setup for %s failed: %s",lang,exc)
                evidence=locale_evidence[lang]
                if evidence.startswith("PREFERENCES_FAILED"):
                    data={"task_id":task["id"],
                          "url":"https://global.oliveyoung.com/display/category?"+
                                urlencode({"ctgrNo":task["category_id"]}),
                          "selected_language":evidence[:240],
                          "payload":{},"error":evidence[:500]}
                else:
                    data=await read_category(contexts[lang],task,evidence)
                error=data.get("error","")
                if any(flag in error for flag in (
                        "Access restricted", "Just a moment", "しばらくお待ち",
                        "requested verification", "Shopping Preferences unavailable")):
                    restricted+=1
                elif not error:
                    restricted=0
                try:
                    result=await api("/manager/api/ktaxback/pilot/result","POST",data)
                    LOG.info("SAVE cat=%s lang=%s selected=%s verified=%s untranslated=%s state=%s",
                        task["category_id"],task["lang_code"],
                        result.get("selected"),result.get("verified"),
                        result.get("untranslated"),result.get("state"))
                except Exception as exc:
                    LOG.error("SAVE_FAIL cat=%s lang=%s err=%s",task["category_id"],task["lang_code"],str(exc)[:600])
                    try:
                        await api("/manager/api/ktaxback/pilot/result","POST",{
                            "task_id":task["id"],
                            "url":"https://global.oliveyoung.com/display/category?"+urlencode({"ctgrNo":task["category_id"]}),
                            "selected_language":"","payload":{},
                            "error":"DB ingest error: "+str(exc)[:450]})
                    except Exception:
                        LOG.exception("Failed persisting ingest error; task will be recovered")
                if restricted>=3:
                    LOG.warning("Source site denied three consecutive requests. Ending bounded pilot without retrying access restrictions.")
                    try:
                        blocked=await api("/manager/api/ktaxback/pilot/stop-on-restriction","POST",{
                            "reason":"Three consecutive browser responses requested verification or access restriction"})
                        LOG.warning("RESTRICTION_STOP %s",blocked)
                    except Exception:LOG.exception("Could not persist source restriction stop")
                    break
                await asyncio.sleep(0.8)
            # The ORIGINAL C:\\tour\\batch_translate.py independently calls
            # translation.oliveyoung.com with source/target/texts and captures
            # each response pair; locale flags alone do not localize catalogue.
            try:
                from source_translations import probe,probe_categories
                translated=await probe(browser, api)
                LOG.info("LIVE_TRANSLATION_SOURCE_DB_REPORT %s",
                         json.dumps(translated,ensure_ascii=False)[:2400])
                labels=await probe_categories(browser,api)
                LOG.info("LIVE_CATEGORY_I18N_DB_REPORT %s",
                         json.dumps(labels,ensure_ascii=False)[:1800])
                from source_translations import probe_filters
                filters=await probe_filters(browser,api)
                LOG.info("LIVE_FILTER_I18N_DB_REPORT %s",
                         json.dumps(filters,ensure_ascii=False)[:2200])
                from source_translations import probe_details
                details=await probe_details(browser,api)
                LOG.info("LIVE_PRODUCT_DETAILS_I18N_DB_REPORT %s",
                         json.dumps(details,ensure_ascii=False)[:1400])
            except Exception as exc:
                LOG.exception("Original translate-texts probe failed (will not fabricate strings): %s",exc)
        finally:
            for context in contexts.values():await context.close()
            await browser.close()
    report=await api("/manager/api/ktaxback/pilot/report")
    summary={}
    for t in report.get("tasks",[]):
        lang=t["lang_code"]
        d=summary.setdefault(lang,{"verified":0,"untranslated":0,"failed":0,"pending":0})
        st=t["state"]
        if st=="verified":d["verified"]+=t["verified"]
        elif st=="untranslated":d["untranslated"]+=t["untranslated"]
        else:d["failed" if st=="failed" else "pending"]+=1
    LOG.info("FINAL_SUMMARY %s",json.dumps(summary,ensure_ascii=False))
    LOG.info("ORIGINAL_DB_COUNTS %s",json.dumps(report["db_counts"],ensure_ascii=False))
    # The separate price/detail collector updates English product rows.
    # Periodically re-check the source_text version; translate only absent or
    # stale product translations. PostgreSQL leases prevent overlap on deploys.
    poll_hours=max(1,int(os.getenv("TRANSLATION_REFRESH_HOURS","6")))
    last_translation=time.monotonic()
    while not STOP:
        await asyncio.sleep(60)
        if time.monotonic()-last_translation >= poll_hours*3600 and not STOP:
            last_translation=time.monotonic()
            LOG.info("PERIODIC_ORIGINAL_TRANSLATION_REFRESH starting")
            try:
                from source_translations import probe
                async with async_playwright() as p:
                    browser=await p.chromium.launch(
                        headless=True,args=["--disable-dev-shm-usage"])
                    try:
                        result=await probe(browser,api)
                        LOG.info("PERIODIC_ORIGINAL_TRANSLATION_REFRESH %s",
                                 json.dumps(result,ensure_ascii=False)[:2500])
                        from source_translations import probe_categories
                        labels=await probe_categories(browser,api)
                        LOG.info("PERIODIC_CATEGORY_I18N_REFRESH %s",
                                 json.dumps(labels,ensure_ascii=False)[:1600])
                        from source_translations import probe_filters
                        filters=await probe_filters(browser,api)
                        LOG.info("PERIODIC_FILTER_I18N_REFRESH %s",
                                 json.dumps(filters,ensure_ascii=False)[:1600])
                        from source_translations import probe_details
                        details=await probe_details(browser,api)
                        LOG.info("PERIODIC_PRODUCT_DETAILS_I18N_REFRESH %s",
                                 json.dumps(details,ensure_ascii=False)[:1500])
                    finally:
                        await browser.close()
            except Exception:
                LOG.exception("Periodic source translation failed; original values preserved")

if __name__=="__main__":
    asyncio.run(main())
