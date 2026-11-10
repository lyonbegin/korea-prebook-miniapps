"""Public facts, not cached source HTML. A no-store source can be parsed transiently.
Only headings, verified public navigation labels/URLs, clinic contact location,
and factual price table cells are retained. Do not store accounts, patient data,
narrative article bodies, full reviews, images, or medical advice.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urljoin,urlsplit,parse_qsl,unquote
from bs4 import BeautifulSoup
from .source_parser import page_kind

LOG=logging.getLogger("mydoctor.facts")
ROOT="https://my-doctor.io"
SEED=Path(__file__).resolve().parents[1]/"data"/"public_source_facts_20261109.json"
MAX_LINKS=180
MAX_TABLES=12
MAX_ROWS=100

def safe_route(value:str)->str|None:
    """One stable Unicode route for both browser %-encoding and PostgreSQL keys.

    Decode only the path, not query parameters; reject escaped traversal and
    network-path references after decoding, before DB lookup or origin GET.
    """
    if not isinstance(value,str) or len(value)>1500 or not value.startswith("/") or value.startswith("//"):
        return None
    u=urlsplit(value)
    decoded=unquote(u.path)
    if (u.scheme or u.netloc or not decoded.startswith("/") or decoded.startswith("//")
          or "//" in decoded or "\\" in decoded or "\x00" in decoded or ".." in decoded.split("/")
          or any(s in decoded.lower() for s in ("%2e","%2f","%5c","%00"))):
        return None
    if any(any(s in k.lower() for s in ("token","auth","session","patient","user","password","email","cookie","private","secret","order","payment","reservation"))
           for k,v in parse_qsl(u.query,keep_blank_values=True)):
        return None
    return decoded+("?" +u.query if u.query else "")

def extract_public_facts(raw:bytes,original_url:str)->dict:
    """Parses strictly public factual fields from a successfully accessed HTML page."""
    u=urlsplit(original_url)
    if u.scheme!="https" or u.netloc!="my-doctor.io":
        raise ValueError("Unsupported host")
    html=BeautifulSoup(raw,"html.parser")
    main=html.find("main") or html.body or html
    title=html.title.get_text(" ",strip=True)[:250] if html.title else ""
    h1=main.find("h1")
    headline=h1.get_text(" ",strip=True)[:250] if h1 else ""
    headings=[x.get_text(" ",strip=True)[:100] for x in main.select("h2,h3") if x.get_text(" ",strip=True)]
    links=[];seen=set()
    for a in main.find_all("a",href=True):
        if a.find_parent(["nav","header","footer"]):
            continue
        url=urljoin(ROOT,a["href"])
        v=urlsplit(url)
        route=safe_route(v.path+("?" +v.query if v.query else ""))
        label=a.get_text(" ",strip=True)[:90]
        if v.netloc!="my-doctor.io" or not route or not label or route in seen:
            continue
        seen.add(route)
        links.append({"path":route,"label":label,"evidence":"original_page_link"})
        if len(links)>=MAX_LINKS:break
    tables=[]
    # Keep purely factual tables, not full health editorials or testimonials.
    eligible=u.path.startswith(("/medical-cost","/hospital","/pharmacy","/map","/medicine"))
    if eligible:
        for table in main.select("table")[:MAX_TABLES]:
            heads=[th.get_text(" ",strip=True)[:90] for th in table.select("thead th")][:12]
            rows=[]
            for row in table.select("tbody tr")[:MAX_ROWS]:
                fields=[td.get_text(" ",strip=True)[:90] for td in row.select("td,th")][:12]
                if len(fields)>=2 and any(any(ch.isdigit() for ch in cell) for cell in fields):
                    rows.append(fields)
            if rows:tables.append({"headers":heads,"rows":rows})
    address=""
    if u.path.startswith("/hospital/detail"):
        candidates=[e.get_text(" ",strip=True) for e in main.find_all(["p","span"],limit=70)]
        import re
        address=next((x[:180] for x in candidates if len(x)<180 and re.search(r"([시군구].*(로|길)|도로명)",x)), "")
    quality="public_facts" if headline or title else "empty"
    return {"original_url":original_url,"path":u.path+("?" +u.query if u.query else ""),
      "title":title,"headline":headline,"headings":headings[:45],
      "links":links,"tables":tables,"address":address,
      "quality":quality,"source_evidence":"origin_http_200_public_metadata",
      "observed_at":datetime.now(timezone.utc).isoformat()}

def merge_public_facts(old:dict|None,new:dict)->dict:
    """Preserve source-backed fields across partial API reads and browser captures.
    The original's static HTML can expose fewer public links than JS rendering.
    Never let a newer but narrower response erase observed original URLs/price rows.
    """
    if not old:return dict(new)
    merged={**old,**new}
    for field in ("headline","title","address"):
        if not new.get(field):
            merged[field]=old.get(field,"")
    for field in ("links","headings"):
        a=old.get(field,[]) or []
        b=new.get(field,[]) or []
        out=[];seen=set()
        for v in b+a:
            key=v.get("path") if isinstance(v,dict) else v
            if key in seen:continue
            seen.add(key);out.append(v)
        merged[field]=out[:180 if field=="links" else 90]
    old_tables=old.get("tables",[]) or []
    new_tables=new.get("tables",[]) or []
    count=lambda ts:sum(len(t.get("rows",[])) for t in ts)
    merged["tables"]=new_tables if count(new_tables)>=count(old_tables) else old_tables
    merged["quality"]="verified_public_facts_from_browser" if (
        old.get("quality")=="verified_public_facts_from_browser" or
        new.get("quality")=="verified_public_facts_from_browser") else new.get("quality",old.get("quality","public_facts"))
    merged["source_evidence"]="github-actions-and-live-original-public-facts" if merged["quality"]=="verified_public_facts_from_browser" else new.get("source_evidence","unknown")
    a=old.get("observed_at") or ""
    b=new.get("observed_at") or ""
    merged["observed_at"]=max(a,b)
    return merged

async def insert_facts(pool,facts:dict,overwrite:bool=False)->bool:
    """Atomic DB-first upsert; merge browser and origin facts without losing fields."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            previous=await conn.fetchrow("""SELECT facts FROM mydoctor_clone.public_page_facts
              WHERE original_url=$1 FOR UPDATE""",facts["original_url"])
            old=previous["facts"] if previous else None
            if isinstance(old,str):
                old=json.loads(old)
            combined=merge_public_facts(old,facts) if old and overwrite else dict(facts)
            when=datetime.fromisoformat((combined.get("observed_at") or
                 datetime.now(timezone.utc).isoformat()).replace("Z","+00:00"))
            await conn.execute("""INSERT INTO mydoctor_clone.public_page_facts
                (original_url,route_path,title,headline,facts,quality,source_evidence,observed_at)
                VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz)
                ON CONFLICT (original_url) DO UPDATE SET
                  title=EXCLUDED.title,headline=EXCLUDED.headline,
                  facts=EXCLUDED.facts,quality=EXCLUDED.quality,
                  source_evidence=EXCLUDED.source_evidence,observed_at=EXCLUDED.observed_at
                WHERE $9::boolean
            """,facts["original_url"],combined.get("path",urlsplit(facts["original_url"]).path),
                combined.get("title",""),combined.get("headline",""),
                json.dumps(combined,ensure_ascii=False),combined.get("quality","heading_only"),
                combined.get("source_evidence","unknown"),when,overwrite)
    return True

async def seed_observed_facts(pool)->int:
    """Versioned 29 original 200 response observations from GitHub mobile QA.
    Seed labels only: never claim this means full content/functional parity.
    """
    try:
        facts=json.loads(SEED.read_text(encoding="utf-8"))
    except FileNotFoundError:
        LOG.warning("No source facts seed found")
        return 0
    inserted=0
    for row in facts:
        url=row.get("original_url","")
        if not url.startswith(ROOT+"/") or not row.get("source_evidence","").startswith(("github-actions","origin_")):
            continue
        # During startup seed import must NOT overwrite richer factual records.
        try:
            await insert_facts(pool,row,overwrite=row.get("quality")=="verified_public_facts_from_browser")
            inserted+=1
        except Exception:
            LOG.exception("Public fact seeding failed for one route")
    LOG.info("Public observed fact seed records checked: %s",inserted)
    return inserted


MENU_SEED=Path(__file__).resolve().parents[1]/"data"/"public_menu_facts_20261110.json"

async def seed_menu_facts(pool)->int:
    """Import independently captured HTTP200 public menu page facts from versioned records.

    Never populate a destination just because a menu name exists. A route must
    have an actual original HTTP 200 browser observation before entering the DB.
    The 29 representative pages retain their separate baseline/test seed.
    """
    try:
        entries=json.loads(MENU_SEED.read_text(encoding="utf-8"))
    except FileNotFoundError:
        LOG.info("No validated menu destination facts yet")
        return 0
    count=0
    for item in entries:
        url=item.get("original_url","")
        path=item.get("path","")
        if (not url.startswith(ROOT+"/")
            or not urlsplit(url).path==path.split("?")[0]
            or not item.get("headline")
            or item.get("source_evidence")!="github-actions-live-origin-http-200-factual-metadata"):
            continue
        try:
            await insert_facts(pool,item,overwrite=item.get("quality")=="verified_public_facts_from_browser")
            count+=1
        except Exception:
            LOG.exception("Could not seed verified public menu page %s",path)
    LOG.info("Verified public menu destination facts imported: %s",count)
    return count
