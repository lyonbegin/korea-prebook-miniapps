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
from urllib.parse import urljoin,urlsplit,parse_qsl
from bs4 import BeautifulSoup
from .source_parser import page_kind

LOG=logging.getLogger("mydoctor.facts")
ROOT="https://my-doctor.io"
SEED=Path(__file__).resolve().parents[1]/"data"/"public_source_facts_20261109.json"
MAX_LINKS=180
MAX_TABLES=12
MAX_ROWS=100

def safe_route(value:str)->str|None:
    if not isinstance(value,str) or len(value)>1500 or not value.startswith("/") or value.startswith("//"):
        return None
    u=urlsplit(value)
    if u.scheme or u.netloc or "\\" in value or "\x00" in value or ".." in u.path.split("/"):
        return None
    if any(any(s in k.lower() for s in ("token","auth","session","patient","user","password","email","cookie","private","secret","order","payment","reservation"))
           for k,v in parse_qsl(u.query,keep_blank_values=True)):
        return None
    return value

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

async def insert_facts(pool,facts:dict,overwrite:bool=False)->bool:
    """A successful live fetch may enrich old title-only seed, never downgrades facts."""
    async with pool.acquire() as conn:
        res=await conn.execute("""INSERT INTO mydoctor_clone.public_page_facts
         (original_url,route_path,title,headline,facts,quality,source_evidence,observed_at)
         VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz)
         ON CONFLICT (original_url) DO UPDATE SET
           title=EXCLUDED.title,headline=EXCLUDED.headline,
           facts=EXCLUDED.facts,quality=EXCLUDED.quality,
           source_evidence=EXCLUDED.source_evidence,observed_at=EXCLUDED.observed_at
         WHERE $9::boolean AND (
           mydoctor_clone.public_page_facts.quality='heading_only'
           OR mydoctor_clone.public_page_facts.quality='verified_title_and_global_navigation'
           OR mydoctor_clone.public_page_facts.observed_at < EXCLUDED.observed_at)
         """,facts["original_url"],facts.get("path",urlsplit(facts["original_url"]).path),
             facts.get("title",""),facts.get("headline",""),
             json.dumps(facts,ensure_ascii=False),facts.get("quality","heading_only"),
             facts.get("source_evidence","unknown"),
             facts.get("observed_at") or datetime.now(timezone.utc).isoformat(),overwrite)
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
            await insert_facts(pool,row,overwrite=False)
            inserted+=1
        except Exception:
            LOG.exception("Public fact seeding failed for one route")
    LOG.info("Public observed fact seed records checked: %s",inserted)
    return inserted
