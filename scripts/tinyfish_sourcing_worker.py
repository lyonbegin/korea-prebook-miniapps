"""ProcureFlow-style external worker for Korea Prebook TinyFish sourcing.

Railway service: same existing thriving-education project, *separate* worker process.
Requires TINYFISH_API_KEY, ADMIN_API_TOKEN and MANAGER_BASE. Does not need Chrome,
local C:\\tour data, cookies, user passwords or direct PostgreSQL access.
"""
import json
import logging
import os
import signal
import time
import urllib.error
import urllib.request

LOG = logging.getLogger("tinyfish_sourcing")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
BASE = os.getenv("MANAGER_BASE", "https://prebook-api-production-9b80.up.railway.app").rstrip("/")
TF_BASE = "https://agent.tinyfish.ai"
ADMIN = os.getenv("ADMIN_API_TOKEN", "")
KEY = os.getenv("TINYFISH_API_KEY", "")
HALT = False
SOURCES = {
    "rednote": "https://www.rednote.com/",
    "bilibili": "https://search.bilibili.com/",
    "google_shopping": "https://www.google.com/search?tbm=shop",
    "trip": "https://www.trip.com/",
    "agoda": "https://www.agoda.com/",
    "klook": "https://www.klook.com/",
    "kkday": "https://www.kkday.com/",
}
ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array", "items": {
                "type": "object",
                "properties": {
                    "title": {"type":"string"},
                    "url": {"type":"string"},
                    "description": {"type":"string"},
                    "price": {"type":"string"},
                    "location": {"type":"string"}
                },
                "required": ["title", "url"]
            }
        }
    },
    "required": ["items"]
}

def stop(*_):
    global HALT
    HALT = True

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)

def req(base, endpoint, token, method="GET", payload=None):
    if not base.startswith("https://"):
        raise RuntimeError("HTTPS required for remote API")
    url = base + endpoint
    headers = {"Accept": "application/json"}
    headers.update({"Authorization": "Bearer " + token} if base == BASE else {"X-API-Key": token})
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=40) as resp:
            result = json.loads(resp.read(8_000_000))
            return result
    except urllib.error.HTTPError as exc:
        description = exc.read(1200).decode("utf-8", "replace")
        raise RuntimeError("%s HTTP %s: %s" % (base, exc.code, description[:500])) from exc

def api(endpoint, method="GET", payload=None):
    return req(BASE, endpoint, ADMIN, method, payload)

def tiny(endpoint, method="GET", payload=None):
    return req(TF_BASE, endpoint, KEY, method, payload)

def update(jid, state, run_id="", message="", result=None):
    payload = {"state":state, "run_id":run_id, "message":message[:1800]}
    if result is not None:
        payload["result"] = result
    return api("/manager/api/sourcing/worker/jobs/" + jid, "POST", payload)

def submit(job):
    url = SOURCES[job["source"]]
    goal = (
        "READ ONLY. Search this site for the Korean travel, shopping or tourism topic "
        + json.dumps(job["query"], ensure_ascii=False)
        + ". Extract up to " + str(job["max_items"])
        + " real matching product, lodging, tourist-activity or creator-post cards. "
        "Open result details if necessary. For each item return its actual complete "
        "source URL, exact title, brief description, visible price if any, location if any. "
        "Never invent products, prices or URLs. Do not submit forms, purchase, book, "
        "message sellers, reveal personal information, or change account settings. "
        "If login is needed and no authenticated session is available, stop and report. "
        "Return JSON object with items array; empty array if nothing verifiable."
    )
    payload = {
        "url": url,
        "goal": goal,
        "output_schema": ITEM_SCHEMA,
        "agent_config": {"max_duration_seconds": 240}
    }
    if job.get("profile_id"):
        payload["use_profile"] = True
        payload["profile_id"] = job["profile_id"]
    answer = tiny("/v1/automation/run-async", "POST", payload)
    run_id = answer.get("run_id")
    if not run_id:
        raise RuntimeError("No TinyFish run_id: " + str(answer.get("error") or "unknown"))
    update(job["id"], "running", run_id, "TinyFish 원격 브라우저 수집 시작")
    LOG.info("Started %s: %s/%s", job["id"], job["source"], run_id)

def poll():
    active = api("/manager/api/sourcing/worker/active").get("jobs", [])
    if not active:
        return False
    for job in active:
        try:
            result = tiny("/v1/runs/" + job["run_id"])
            state = result.get("status", "")
            if state == "COMPLETED":
                items = result.get("result")
                if not isinstance(items, dict):
                    raise RuntimeError("TinyFish result should be JSON object")
                if not isinstance(items.get("items"), list):
                    raise RuntimeError("TinyFish result missing items array")
                update(job["id"], "completed", job["run_id"],
                       "완료: %d건 (검수 후 등록)" % len(items["items"]), items)
                LOG.info("Completed %s: %d candidates", job["id"], len(items["items"]))
            elif state in ("FAILED", "CANCELLED"):
                err = result.get("error") or {}
                detail = err.get("message") if isinstance(err, dict) else str(err)
                update(job["id"], "failed", job["run_id"], str(detail or state))
                LOG.warning("Failed %s: %s", job["id"], str(detail)[:200])
            else:
                LOG.debug("Waiting for %s: %s", job["id"], state)
        except Exception as exc:
            LOG.exception("TinyFish status check failed for %s; will retry: %s", job["id"], exc)
    return True

def main():
    if not ADMIN or not KEY:
        raise SystemExit("ADMIN_API_TOKEN and TINYFISH_API_KEY must be set on the worker")
    LOG.info("Sourcing worker online; manager=%s", BASE)
    while not HALT:
        try:
            busy = poll()
            if not busy:
                job = api("/manager/api/sourcing/worker/next").get("job")
                if job:
                    try:
                        submit(job)
                    except Exception as exc:
                        LOG.exception("Job %s rejected", job["id"])
                        update(job["id"], "failed", message=str(exc)[:1800])
        except Exception as exc:
            LOG.error("Worker loop error: %s", exc)
        for _ in range(8):
            if HALT:
                break
            time.sleep(1)
    LOG.info("Sourcing worker stopped")

if __name__ == "__main__":
    main()
