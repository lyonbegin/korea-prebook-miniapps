"""Bounded live verification run: 10 representative categories, 10 real product
records per category, five Olive Young language preferences. No synthetic data.
Railway uses existing admin token by reference. Previous full crawler disabled
for this pilot. Every task result is persisted to the pilot DB report.
"""
from __future__ import annotations
import asyncio,json,logging,os,signal,urllib.error,urllib.request
from urllib.parse import urlencode
from playwright.async_api import async_playwright

API=os.getenv("MANAGER_BASE","https://prebook-api-production-9b80.up.railway.app").rstrip("/")
KEY=os.getenv("ADMIN_API_TOKEN","")
LANG_LOCALE={"en":"en-US","jp":"ja-JP","zh_cn":"zh-CN","zh_tw":"zh-TW","vi_vn":"vi-VN"}
DATA_CODE={"jp":"ja","zh_cn":"zh","zh_tw":"zh-TW","vi_vn":"vi"}
DISPLAY={"en":"English","jp":"日本語","zh_cn":"中文（简体）",
         "zh_tw":"中文（繁體）","vi_vn":"Tiếng Việt"}
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

async def language_switch(page,lang):
    """Use actual Olive Young Shopping Preferences selector; never infer translation from locale."""
    if lang=="en":return "English default"
    code=DATA_CODE[lang]
    await page.goto("https://global.oliveyoung.com/main-vue",
                    wait_until="domcontentloaded",timeout=45000)
    await page.wait_for_timeout(1300)
    evidence=[]
    try:
        popup=page.get_by_text("Shopping Preferences",exact=False)
        if await popup.count():
            await popup.first.click(timeout=4500)
            evidence.append("shopping-preferences-open")
    except Exception as e:
        evidence.append("preferences-click:"+type(e).__name__)
    # Olive Young popup has custom .selectbox dropdown and data-code options.
    try:
        opts=page.locator(f'[data-code="{code}"]')
        if not await opts.count():
            english=page.get_by_text("English",exact=True)
            if await english.count():
                await english.last.click(timeout=3500)
                evidence.append("language-dropdown-open")
        else:
            try:
                if not await opts.last.is_visible(timeout=1200):
                    english=page.get_by_text("English",exact=True)
                    if await english.count():await english.last.click(timeout=3500)
            except Exception:pass
        opts=page.locator(f'[data-code="{code}"]')
        if not await opts.count():
            raise ValueError("Language option data-code="+code+" absent")
        await opts.last.click(timeout=4500)
        evidence.append("selected-code="+code)
        save=page.get_by_text("Save",exact=True)
        if await save.count():
            try:
                await save.last.click(timeout=3500)
                evidence.append("save-clicked")
            except Exception as e:evidence.append("save-not-clickable:"+type(e).__name__)
    except Exception as e:
        evidence.append("SELECTOR_FAILED:"+type(e).__name__+":"+str(e)[:80])
        return "|".join(evidence)
    return "|".join(evidence)

async def read_category(browser,task):
    lang=task["lang_code"];cat=task["category_id"]
    url="https://global.oliveyoung.com/display/category?"+urlencode({"ctgrNo":cat})
    kwargs={"locale":LANG_LOCALE[lang],
            "extra_http_headers":{"Accept-Language":LANG_LOCALE[lang].replace("-","-")+",en;q=0.7"}}
    context=await browser.new_context(**kwargs)
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
    evidence=""
    try:
        evidence=await language_switch(page,lang)
        await page.goto(url,wait_until="domcontentloaded",timeout=45000)
        await page.wait_for_timeout(1500)
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
                "selected_language":evidence[:32],"title":(await page.title())[:120],
                "payload":payload}
    except Exception as exc:
        return {"task_id":task["id"],"url":url,
                "selected_language":evidence[:32],
                "title":"","payload":{},
                "error":f"{type(exc).__name__}: {str(exc)[:540]}"}
    finally:
        if tasks:await asyncio.gather(*tasks,return_exceptions=True)
        await page.close();await context.close()

async def main():
    if not KEY:raise SystemExit("ADMIN_API_TOKEN required")
    LOG.info("Bounded 10-category × 5-language original-schema source verification worker booted")
    try:
        started=await api("/manager/api/ktaxback/pilot/start","POST")
    except Exception:
        LOG.exception("Could not prepare pilot tasks");raise
    LOG.info("Requested categories=%d langs=%s entries/task=%d",
             len(started["categories"]),started["languages"],started["per_task"])
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=["--disable-dev-shm-usage"])
        try:
            while not STOP:
                task=(await api("/manager/api/ktaxback/pilot/next")).get("task")
                if not task:
                    LOG.info("Pilot queue empty. Remain idle; no automatic full category crawl.")
                    break
                LOG.info("FETCH %s %s requested=%s",task["category_id"],task["lang_code"],task["requested"])
                data=await read_category(browser,task)
                try:
                    result=await api("/manager/api/ktaxback/pilot/result","POST",data)
                    LOG.info("SAVE cat=%s lang=%s selected=%s verified=%s untranslated=%s state=%s",
                        task["category_id"],task["lang_code"],
                        result.get("selected"),result.get("verified"),
                        result.get("untranslated"),result.get("state"))
                except Exception as exc:
                    LOG.error("SAVE_FAIL cat=%s lang=%s err=%s",task["category_id"],task["lang_code"],str(exc)[:600])
                    # The task is recovered by manager endpoint after expiry,
                    # no fake success is emitted.
                await asyncio.sleep(0.8)
        finally:await browser.close()
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
    while not STOP:await asyncio.sleep(60)

if __name__=="__main__":
    asyncio.run(main())
