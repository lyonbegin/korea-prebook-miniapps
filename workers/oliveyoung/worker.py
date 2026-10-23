"""Railway hosted K-TAXBACK/OliveYoung refresh worker (former C:\\tour\\olive.py).

Public Olive Young global category page -> intercepted product-data JSON ->
K-TAXBACK PostgreSQL, with optional original detail-data/details-info captures.
No local browser, local DB, interactive input, or consumer login credentials.
"""
from __future__ import annotations
import asyncio, json, logging, os, signal, time, urllib.error, urllib.request
from urllib.parse import urlencode
from playwright.async_api import async_playwright

ROOT=os.getenv("MANAGER_BASE","https://prebook-api-production-9b80.up.railway.app").rstrip("/")
KEY=os.getenv("ADMIN_API_TOKEN","")
AUTO=os.getenv("OLIVEYOUNG_AUTO_REFRESH","0")=="1"
REFRESH_WAIT=max(15,int(os.getenv("POLL_SECONDS","40")))
DETAIL_LIMIT=max(0,min(50,int(os.getenv("DETAIL_LIMIT","10"))))
MAX_CATEGORIES=8
LOG=logging.getLogger("oliveyoung_refresh")
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
ENDPOINTS={"detail-data.json":"detail-data","details-info.json":"details-info"}
EXIT=False

def stop(*_):
    global EXIT
    EXIT=True
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)

def call(path,method="GET",payload=None):
    if not ROOT.startswith("https://"):raise RuntimeError("HTTPS manager required")
    data=json.dumps(payload,ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers={"Authorization":"Bearer "+KEY,"Accept":"application/json"}
    if data is not None:headers["Content-Type"]="application/json"
    req=urllib.request.Request(ROOT+path,method=method,data=data,headers=headers)
    with urllib.request.urlopen(req,timeout=90) as rsp:
        return json.loads(rsp.read().decode("utf-8"))

async def api(path,method="GET",payload=None):
    return await asyncio.to_thread(call,path,method,payload)

def extract_hits(data):
    hits=(data.get("hits") or {}).get("hit") or []
    if not isinstance(hits,list):return []
    return [x["fields"] for x in hits if isinstance(x,dict) and isinstance(x.get("fields"),dict)]

async def gather_details(context,job_id,prdt_nos):
    successes=0;errors=[]
    for no in prdt_nos[:DETAIL_LIMIT]:
        await api("/manager/api/ktaxback/refresh/worker/"+job_id+"/heartbeat","POST")
        page=await context.new_page()
        captured={}
        outstanding=[]
        async def on_response(response):
            if response.status!=200 or "global.oliveyoung.com" not in response.url:return
            for name,marker in ENDPOINTS.items():
                if marker in response.url and name not in captured:
                    try:captured[name]=await response.json()
                    except Exception:pass
        page.on("response",lambda r:outstanding.append(asyncio.create_task(on_response(r))))
        link="https://global.oliveyoung.com/product/detail?"+urlencode({"prdtNo":no})
        try:
            await page.goto(link,wait_until="domcontentloaded",timeout=40000)
            await page.wait_for_timeout(1600)
            await page.mouse.wheel(0,2400)
            await page.wait_for_timeout(1200)
            if outstanding:await asyncio.gather(*outstanding,return_exceptions=True)
            if "detail-data.json" in captured:
                result=await api("/manager/api/ktaxback/refresh/worker/"+job_id+"/detail","POST",{
                    "prdt_no":no,"source_url":link,
                    "detail_data":captured.get("detail-data.json"),
                    "details_info":captured.get("details-info.json")})
                successes+=1
                LOG.info("[detail] %s options=%s images=%s",no,result["options"],result["images"])
            else:
                errors.append(no+": missing detail-data")
        except Exception as exc:
            errors.append(no+": "+type(exc).__name__+" "+str(exc)[:140])
        finally:
            await page.close()
    return successes,errors

async def collect_category(context,jid,category,max_pages,detail_numbers):
    page=await context.new_page()
    queue=asyncio.Queue()
    pending=[]
    page_seq=0
    pages=0
    found=0
    visited=set()
    exhausted=False
    async def on_response(response):
        if "product-data" not in response.url or response.status!=200:
            return
        try:
            data=await response.json()
            if isinstance(data,dict) and isinstance(data.get("hits"),dict):
                await queue.put((response.url,data))
        except Exception as exc:
            LOG.warning("Non-JSON category response: %s",type(exc).__name__)
    page.on("response",lambda response:pending.append(asyncio.create_task(on_response(response))))
    url="https://global.oliveyoung.com/display/category?"+urlencode({"ctgrNo":category})
    try:
        await page.goto(url,wait_until="domcontentloaded",timeout=50000)
        await page.wait_for_timeout(1800)
        for _ in range(max_pages):
            if pending:await asyncio.gather(*pending,return_exceptions=True)
            if queue.empty():
                try:await asyncio.wait_for(queue.join(),timeout=0.1)
                except Exception:pass
            # Capture at least one response before proceeding. Avoid sending
            # unrelated API traffic or infinite loops on a changed website.
            if queue.empty():
                retry=0
                while queue.empty() and retry<3:
                    try:source,data=await asyncio.wait_for(queue.get(),timeout=8+retry*4)
                    except asyncio.TimeoutError:
                        retry+=1
                        if retry<3:
                            LOG.warning("[category] %s product-data absent; retry %d/2 url=%s",category,retry,page.url)
                            await page.reload(wait_until="domcontentloaded",timeout=35000)
                            await page.wait_for_timeout(1500)
                            await page.mouse.wheel(0,800)
                            if pending:await asyncio.gather(*pending,return_exceptions=True)
                        continue
                    else:break
                if not queue.empty() and retry>0:
                    source,data=queue.get_nowait()
                if queue.empty() and retry>=3:
                    title=await page.title()
                    reason=("No product-data HTTP 200 after 3 attempts"
                            +" current_url="+str(page.url)[:150]
                            +" title="+str(title)[:80])
                    LOG.warning("[category] %s %s",category,reason)
                    await api("/manager/api/ktaxback/refresh/worker/"+jid+"/page_error","POST",{
                        "category_id":category,"page_index":page_seq+1,
                        "source_url":url,"payload":{"error":reason}})
                    break
            else:
                source,data=queue.get_nowait()
            signature=json.dumps(data.get("hits",{}),ensure_ascii=False,sort_keys=True)[:400]
            if signature in visited:
                queue.task_done()
                LOG.warning("[category] %s repeated same results",category)
                break
            visited.add(signature)
            page_seq+=1
            hits=extract_hits(data)
            LOG.info("[raw] category=%s page=%d items=%d",category,page_seq,len(hits))
            await api("/manager/api/ktaxback/refresh/worker/"+jid+"/heartbeat","POST")
            result=await api("/manager/api/ktaxback/refresh/worker/"+jid+"/capture","POST",{
                "category_id":category,"page_index":page_seq,"source_url":source,"payload":data})
            pages+=1;found+=result["accepted"]
            for p in hits:
                pid=str(p.get("prdtNo") or "").strip()
                if pid:detail_numbers.add(pid)
            queue.task_done()
            more=page.locator("#pagination button.btn-page-more")
            if pages>=max_pages:
                try:exhausted=not await more.is_visible(timeout=2400)
                except Exception:exhausted=False
                break
            try:
                if not await more.is_visible(timeout=2200):
                    exhausted=True
                    break
                await more.scroll_into_view_if_needed(timeout=3000)
                await more.click(timeout=6000)
                await page.wait_for_timeout(1100)
            except Exception as exc:
                LOG.info("[category] pagination stopped: %s",str(exc)[:130])
                break
        return pages,found,exhausted
    finally:
        if pending:await asyncio.gather(*pending,return_exceptions=True)
        await page.close()

async def run_job(job):
    jid=job["id"];cats=job["categories"];pages_allowed=job["max_pages"]
    LOG.info("[job] start id=%s cats=%s pages=%s detail_limit=%s",jid,cats,pages_allowed,DETAIL_LIMIT)
    total_pages=0;total_products=0;errors=[];detail_numbers=set()
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=["--disable-dev-shm-usage"])
        try:
            context=await browser.new_context(locale="en-US",timezone_id="Asia/Seoul")
            for cid in cats[:MAX_CATEGORIES]:
                try:
                    await api("/manager/api/ktaxback/refresh/worker/"+jid+"/heartbeat","POST")
                    pages,products,exhausted=await collect_category(context,jid,cid,pages_allowed,detail_numbers)
                    total_pages+=pages;total_products+=products
                    await api("/manager/api/ktaxback/refresh/worker/"+jid+"/category_done","POST",{
                        "category_id":cid,"pages":pages,"exhausted":exhausted,
                        "message":("No product-data response" if pages==0 else
                                   "Page limit reached; more results may exist" if not exhausted else "")})
                    LOG.info("[category] %s pages=%d products=%d exhausted=%s",cid,pages,products,exhausted)
                except Exception as exc:
                    message=f"{cid}: {type(exc).__name__} {str(exc)[:220]}"
                    errors.append(message);LOG.exception(message)
                    try:
                        await api("/manager/api/ktaxback/refresh/worker/"+jid+"/page_error","POST",{
                          "category_id":cid,"page_index":1,
                          "source_url":"https://global.oliveyoung.com/display/category?"+urlencode({"ctgrNo":cid}),
                          "payload":{"error":message}})
                    except Exception:LOG.exception("Could not persist category failure %s",cid)
            if total_pages and DETAIL_LIMIT and detail_numbers:
                ok,failed=await gather_details(context,jid,sorted(detail_numbers))
                LOG.info("[detail] completed=%d failures=%d",ok,len(failed))
                errors.extend(failed[:12])
            await context.close()
        finally:
            await browser.close()
    state="completed" if total_pages else "failed"
    msg="pages=%d products=%d; %s"%(total_pages,total_products,("; ".join(errors[:5]) if errors else "OK"))
    return state,msg

async def main():
    if not KEY:raise SystemExit("ADMIN_API_TOKEN required; worker cannot start without manager authentication")
    LOG.info("Worker started. Automatic category refresh=%s, details/job=%d, server=%s",AUTO,DETAIL_LIMIT,ROOT)
    last_auto=0
    while not EXIT:
        try:
            # A deploy/rolling restart may leave an old job marked 'running'.
            # Only recover after an expired heartbeat; keep verified DB data.
            try:
                recovered=await api("/manager/api/ktaxback/refresh/worker/recover","POST")
                if recovered.get("recovered"):LOG.warning("[recover] %s",recovered)
            except urllib.error.HTTPError as exc:
                LOG.warning("[recover] HTTP %s",exc.code)
            if AUTO and time.monotonic()-last_auto>90:
                try:
                    outcome=await api("/manager/api/ktaxback/refresh/worker/auto","POST")
                    LOG.info("[auto] %s",outcome)
                except urllib.error.HTTPError as exc:
                    LOG.warning("[auto] HTTP %s: source collection planner is unavailable",exc.code)
                last_auto=time.monotonic()
            try:
                response=await api("/manager/api/ktaxback/refresh/worker/next")
            except urllib.error.HTTPError as exc:
                if exc.code==409:
                    LOG.info("Fresh K-TAXBACK original-schema tables are bootstrapping; idle")
                    response={"job":None}
                else:raise
            job=response.get("job")
            if job:
                try:
                    state,msg=await run_job(job)
                except Exception as exc:
                    LOG.exception("Collector run failed: %s",exc)
                    state,msg="failed",str(exc)[:1000]
                outcome=await api("/manager/api/ktaxback/refresh/worker/"+job["id"]+"/finish","POST",{
                    "state":state,"message":msg})
                LOG.info("[job] finished %s",outcome)
        except Exception as exc:
            LOG.exception("Worker poll error (will retry): %s",exc)
        for _ in range(REFRESH_WAIT):
            if EXIT:break
            await asyncio.sleep(1)
    LOG.info("Worker stopped")

if __name__=="__main__":
    asyncio.run(main())
