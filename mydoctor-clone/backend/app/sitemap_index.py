"""Inventory publicly declared canonical sitemap URLs without scraping page content.
URLs by themselves prove neither underlying data nor feature parity.
"""
from __future__ import annotations
import asyncio
import logging
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from datetime import datetime,timezone,timedelta
import httpx

LOG=logging.getLogger("mydoctor.sitemap")
BASE="https://my-doctor.io"
INDEX=BASE+"/sitemap.xml"
MAX_DOCUMENT_BYTES=8_000_000
MAX_SITEMAPS=40
BATCH_SIZE=1500

def extract_locs(body:bytes,kind:str)->list[str]:
    if len(body)>MAX_DOCUMENT_BYTES:
        raise ValueError("XML document too large")
    root=ET.fromstring(body)
    if root.tag.split("}")[-1]!=kind:
        raise ValueError("Unexpected sitemap root")
    childkind="sitemap" if kind=="sitemapindex" else "url"
    urls=[]
    for child in root:
        if child.tag.split("}")[-1]!=childkind:
            continue
        val=next((e.text for e in child if e.tag.split("}")[-1]=="loc"),None)
        if not val:continue
        text=val.strip()
        u=urlsplit(text)
        if u.scheme!="https" or u.netloc!="my-doctor.io" or u.username or u.password:
            raise ValueError("Sitemap URL host rejected")
        if len(text)>2000:raise ValueError("Invalid sitemap URL length")
        urls.append(text)
    return list(dict.fromkeys(urls))

def section_of(url:str)->str:
    path=urlsplit(url).path.strip("/")
    segment=path.split("/")[0] if path else "home"
    if path.startswith("hospital/detail"):return "hospital-detail"
    if path.startswith("telemedicine/doctor"):return "doctor"
    if path.startswith("medicine/ingredient"):return "medicine-ingredient"
    if path.startswith("medicine/effect"):return "medicine-effect"
    return segment

async def record_run(pool,url,status,count,error=""):
    await pool.execute("""INSERT INTO mydoctor_clone.sitemap_imports
      (sitemap_url,http_status,url_count,last_attempt_at,last_success_at,error)
      VALUES($1,$2,$3,NOW(),CASE WHEN $2=200 THEN NOW() ELSE NULL END,$4)
      ON CONFLICT(sitemap_url) DO UPDATE SET
        http_status=EXCLUDED.http_status,url_count=EXCLUDED.url_count,
        last_attempt_at=NOW(),
        last_success_at=CASE WHEN EXCLUDED.http_status=200 THEN NOW()
             ELSE mydoctor_clone.sitemap_imports.last_success_at END,
        error=EXCLUDED.error
    """,url,status,count,error[:500])

async def insert_urls(pool,source_url:str,urls:list[str]):
    async with pool.acquire() as c:
        for i in range(0,len(urls),BATCH_SIZE):
            batch=urls[i:i+BATCH_SIZE]
            paths=[urlsplit(u).path+("?" +urlsplit(u).query if urlsplit(u).query else "") for u in batch]
            sections=[section_of(u) for u in batch]
            await c.execute("""INSERT INTO mydoctor_clone.original_routes
              (original_url,route_path,source_section,sitemap_url)
              SELECT * FROM UNNEST($1::TEXT[],$2::TEXT[],$3::TEXT[],$4::TEXT[])
              ON CONFLICT(original_url) DO UPDATE SET
                source_section=EXCLUDED.source_section,sitemap_url=EXCLUDED.sitemap_url
            """,batch,paths,sections,[source_url]*len(batch))

async def sync_public_index(pool,delay_seconds:float=0.7,force:bool=False):
    """One bounded pass of official XML sitemaps; stop on 429, no bypass or crawling leaf pages."""
    checked=await pool.fetchval("""SELECT last_success_at FROM mydoctor_clone.sitemap_imports
      WHERE sitemap_url=$1""",INDEX)
    if checked and not force and datetime.now(timezone.utc)-checked < timedelta(hours=12):
        LOG.info("Sitemap index already checked recently")
        return
    async with httpx.AsyncClient(timeout=httpx.Timeout(28.0,connect=10.0),
                                 follow_redirects=False) as client:
        try:
            res=await client.get(INDEX,headers={"accept":"application/xml","user-agent":"MyDoctorPublicIndexAudit/1.0"})
            if res.status_code!=200:
                await record_run(pool,INDEX,res.status_code,0,"index temporarily unavailable")
                LOG.warning("Sitemap index status %d",res.status_code)
                return
            sitemap_urls=[u for u in extract_locs(res.content,"sitemapindex")
                          if urlsplit(u).path.startswith("/sitemaps/")]
            if len(sitemap_urls)>MAX_SITEMAPS:
                raise ValueError("Unexpected sitemap document count")
            await record_run(pool,INDEX,200,len(sitemap_urls))
        except Exception as e:
            LOG.warning("Failed to access sitemap index: %s",type(e).__name__)
            await record_run(pool,INDEX,0,0,type(e).__name__)
            return
        for n,url in enumerate(sitemap_urls,1):
            await asyncio.sleep(delay_seconds)
            try:
                page=await client.get(url,headers={"accept":"application/xml","user-agent":"MyDoctorPublicIndexAudit/1.0"})
                if page.status_code!=200:
                    await record_run(pool,url,page.status_code,0,"temporarily unavailable")
                    LOG.warning("Sitemap %d/%d status %d",n,len(sitemap_urls),page.status_code)
                    if page.status_code==429:return
                    continue
                urls=extract_locs(page.content,"urlset")
                await insert_urls(pool,url,urls)
                await record_run(pool,url,200,len(urls))
                LOG.info("Indexed sitemap %d/%d: %d routes",n,len(sitemap_urls),len(urls))
            except Exception as e:
                LOG.exception("Sitemap %d/%d failed",n,len(sitemap_urls))
                await record_run(pool,url,0,0,type(e).__name__)
    LOG.info("Sitemap inventory pass ended")
