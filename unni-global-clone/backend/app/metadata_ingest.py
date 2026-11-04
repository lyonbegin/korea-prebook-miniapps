"""Extract and persist only public factual metadata AFTER serving an upstream response.

The third-party HTML itself is never stored when Cache-Control is no-store/private.
No authentication, patient data, individual reviews, photographs, long marketing
descriptions or personalized responses are persisted here.
"""
import json
import logging
import re
from datetime import datetime, timezone
from html import unescape

from bs4 import BeautifulSoup

logger=logging.getLogger("unni.metadata")
EVENT_RE=re.compile(r"^/us/events/(\d+)$")
HOSP_RE=re.compile(r"^/us/hospitals/(\d+)$")
DOCTOR_RE=re.compile(r"^/us/doctors/(\d+)$")
MONEY_RE=re.compile(r"\$\s*([\d,]+(?:\.\d+)?)")
WON_RE=re.compile(r"₩\s*([\d,]+)")
DISCOUNT_RE=re.compile(r"(\d+(?:\.\d+)?)\s*%\s*\$\s*([\d,]+(?:\.\d+)?)")
RATING_RE=re.compile(r"(?:^|[^\d.])((?:10|[0-9])\.\d)(?=\D|$)")
REVIEWS_RE=re.compile(r"([\d,]+)\s*Reviews\b",re.I)
ATTRS={
    "area":r"Treatment area:\s*(.+?)(?=Steroid:|Product Origin:|Brand:|\d+\s*session|$)",
    "steroid":r"Steroid:\s*(.+?)(?=Treatment area:|Product Origin:|Brand:|\d+\s*session|$)",
    "product_origin":r"Product Origin:\s*(.+?)(?=Brand:|\d+\s*session|$)",
    "brand":r"Brand:\s*(.+?)(?=\d+\s*session|$)",
    "handpiece":r"Handpiece:\s*(.+?)(?=Treatment area:|\d+\s*session|$)",
}
def clean(v):
    return re.sub(r"\s+"," ",str(v or "")).strip()
def decimals(v):
    try:return float(v.replace(",","").replace("$","").replace("₩","").strip())
    except (ValueError,AttributeError):return None
def text(el):
    return clean(el.get_text(" ",strip=True)) if el is not None else ""
def first(soup,query):
    return soup.select_one(query)
def get_nearby(h,limit=12):
    out=[]
    for i,el in enumerate(h.next_siblings):
        if i>=limit:break
        name=getattr(el,"name",None)
        if name in ("h2","h3","h4"):break
        t=text(el) if name else clean(str(el))
        if t:out.append(t)
    if not out:
        for sib in h.find_next_siblings(limit=limit):
            if sib.name in ("h2","h3","h4"):break
            t=text(sib)
            if t:out.append(t)
    return " ".join(out)[:3000]
def public_stats(soup,heading):
    all_text=text(soup)
    title=text(heading)
    start=all_text.find(title)+len(title) if title else 0
    excerpt=all_text[start:start+550]
    fused=re.search(r"((?:10|[0-9])\.\d)\s*(\d{1,3}(?:,\d{3})+)\s*Reviews\b",excerpt,re.I)
    if fused:
        return decimals(fused.group(1)),int(fused.group(2).replace(",",""))
    score=re.search(r"(?<![\d.])((?:10|[0-9])\.\d)",excerpt)
    reviews=re.search(r"([\d,]+)\s*Reviews\b",excerpt,re.I) or re.search(r"\bReviews\s*([\d,]+)",excerpt,re.I)
    return (decimals(score.group(1)) if score else None,
            int(reviews.group(1).replace(",","")) if reviews else None)

def source_hospital(soup):
    link=soup.find("a",href=re.compile(r"/us/hospitals/\d+"))
    if not link:return None
    match=re.search(r"/us/hospitals/(\d+)",link.get("href",""))
    if not match:return None
    hid=match.group(1)
    heading=next((x for x in soup.find_all("h2") if re.search(r"Clinic|Hospital|Plastic Surgery|U Line",text(x),re.I)
         and not re.search(r"Reviews|About|Procedure Info",text(x),re.I)),None)
    name=text(heading) or text(link) or ("Clinic "+hid)
    return hid,name
def get_option_rows(soup,event_id,url):
    h3s=soup.find_all("h3")
    rows=[]
    info=soup.find(lambda x:x.name=="h2" and text(x).lower()=="procedure info")
    for h in h3s:
        title=text(h)
        if not title or len(title)>180 or re.match(r"Option\s+\d+$",title,re.I):continue
        if info and not (info.sourceline or 0)<(h.sourceline or 0):
            # Source line numbers may be absent for the minified original; later
            # strict price presence filters eliminate non-option headings.
            pass
        body=get_nearby(h,limit=15)
        money=list(MONEY_RE.finditer(body))
        if not money:continue
        discount=DISCOUNT_RE.search(body)
        prices=[decimals(m.group(1)) for m in money]
        sale=decimals(discount.group(2)) if discount else prices[-1]
        old=prices[0] if discount and len(prices)>1 else None
        won=WON_RE.search(body)
        fields={}
        for key,pattern in ATTRS.items():
            m=re.search(pattern,title+" "+body,re.I)
            if m:fields[key]=clean(m.group(1))[:120]
        qty=re.search(r"(\d+(?:\.\d+)?)\s*(cc|ml|unit|shot|area)\b",title+" "+body,re.I)
        if qty:fields.update(quantity=decimals(qty.group(1)),unit=qty.group(2))
        sessions=re.search(r"(\d+)\s*session\(s\)",body,re.I)
        if sessions:fields["sessions"]=int(sessions.group(1))
        option_id=None
        if "optionId=" in url:
            top=next((a for a in h3s if re.match(r"Option\s+\d+",text(a),re.I)),None)
            n=re.search(r"Option\s+(\d+)",text(top),re.I) if top else None
            if n and int(n.group(1))==len(rows)+1:
                option_id=re.search(r"optionId=([0-9a-f-]{20,})",url,re.I)
                option_id=option_id.group(1) if option_id else None
        rows.append(dict(key=event_id+":"+str(len(rows)+1),order=len(rows)+1,
            name=title,price=sale,original_price=old,discount_percent=decimals(discount.group(1)) if discount else None,
            local_price=decimals(won.group(1)) if won else None,attributes=fields,option_id=option_id))
    return rows[:150]
def hospital_info(soup):
    out={}
    main=text(soup)
    m=REVIEWS_RE.search(main[:1100])
    if m:out["review_count"]=int(m.group(1).replace(",",""))
    s=soup.find(lambda x:x.name=="h2" and text(x)=="Specialties")
    if s:
        raw=get_nearby(s,limit=7)
        if not raw:
            match=re.search(r"Specialties\s*(.+?)(?:All Doctors|Clinic Hours)",text(soup),re.I)
            raw=match.group(1) if match else ""
        allowed=["Body","Skin","Lifting","Botox","Filler","Eye","Hair","Dental"]
        out["specialties"]=[name for name in allowed if name.lower() in raw.lower()]
    highlights=soup.find(lambda x:x.name=="h2" and "Clinic Highlights" in text(x))
    if highlights:out["highlights"]=[text(h) for h in soup.find_all("h3")
      if re.search("camera|after-hours|non-surgical|credentials|post-procedure",text(h),re.I)][:12]
    hours=soup.find(lambda x:x.name=="h2" and text(x)=="Clinic Hours")
    if hours:
        table=hours.find_next("table")
        if table:out["hours"]=[[text(cell) for cell in row.select("td,th")] for row in table.select("tr")]
        m=re.search(r"Closed on[^.]+\.",main,re.I)
        if m:out["closed_notice"]=m.group(0)
    address=soup.find(lambda x:x.name=="h2" and text(x)=="Address")
    if address:
        raw=get_nearby(address,limit=4)[:350]
        if not raw:
            match=re.search(r"\b\d{1,4}\s+[A-Za-z][A-Za-z\d\s-]{2,80}-?(?:ro|gil|road|street)[^.;]{0,150}Republic of Korea[^.;]{0,100}",text(soup),re.I)
            raw=match.group(0) if match else ""
        raw=re.split(r"Clinic Info|Clinic Highlights|Procedures|Reviews|Copy|[{}]",raw,maxsplit=1)[0].strip().rstrip(",")
        out["address"]=raw
    return out
async def ingest_public_metadata(pool,path,query,body):
    if pool is None or not body or len(body)>5_000_000:return None
    match=EVENT_RE.match(path) or HOSP_RE.match(path) or DOCTOR_RE.match(path)
    if not match:return None
    kind="event" if EVENT_RE.match(path) else "hospital" if HOSP_RE.match(path) else "doctor"
    identifier=match.group(1)
    url="https://unni.app"+path+("?"+query if query else "")
    soup=BeautifulSoup(body.decode("utf-8","replace"),"html.parser")
    main=soup.find_all("main")[-1] if soup.find_all("main") else soup
    heading=main.find("h1")
    title=text(heading)
    if kind == "doctor":
        # Global doctor pages often have no h1. Prefer a short proper name
        # in the main paragraphs, never navigation, legal or marketing labels.
        blocked=re.compile(r"scan qr|sign up|app download|original|contact us|healing paper|company|terms|"
                           r"privacy|clinic|hospital|review|follow|about|favorite|procedure|"
                           r"patient|medical|service|rights reserved|global|experience",re.I)
        # The source renders the doctor name in a plain text node (not always <p>).
        # Prefer actual stripped strings before fallback heading matches.
        paragraphs=[clean(v) for v in main.stripped_strings]
        candidates=[v for v in paragraphs if v and len(v)<=70 and
            not blocked.search(v) and re.fullmatch(
                r"[A-Z][a-z'-]{2,25}(?:\s+[A-Z][a-z'-]{2,25}){1,3}(?:\s+Dr\.)?",v)]
        if not candidates:
            # h1 or h2 is a backup only when no paragraph provides a verified name.
            candidates=[text(el) for el in main.find_all(["h1","h2"])
                if text(el) and not blocked.search(text(el)) and
                re.fullmatch(r"[A-Z][a-z'-]{2,25}(?:\s+[A-Z][a-z'-]{2,25}){1,3}",text(el))]
        title=candidates[0] if candidates else ""
    if not title:return None
    rating,reviews=public_stats(main,heading)
    if kind=="doctor":rating=None  # Clinic rating lower on this page is not a doctor rating.
    now=datetime.now(timezone.utc)
    async with pool.acquire() as conn:
      async with conn.transaction():
        if kind=="event":
            clinic=source_hospital(main)
            hid=None
            if clinic:
                hid,clinic_name=clinic
                await conn.execute("""INSERT INTO unni_clone.hospitals
                  (original_hospital_id,name,source_url,rights_status,fetched_at)
                  VALUES($1,$2,$3,'metadata_only',$4)
                  ON CONFLICT (original_hospital_id) DO NOTHING""",
                  hid,clinic_name,"https://unni.app/us/hospitals/"+hid,now)
            options=get_option_rows(main,identifier,url)
            minimum=min([o["price"] for o in options if o["price"] is not None],default=None)
            await conn.execute("""INSERT INTO unni_clone.events
             (original_event_id,original_hospital_id,public_title,source_url,public_rating,public_review_count,min_price,currency,public_attributes,fetched_at,rights_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'USD',$8::jsonb,$9,'metadata_only')
             ON CONFLICT(original_event_id) DO UPDATE SET
             original_hospital_id=COALESCE(EXCLUDED.original_hospital_id,unni_clone.events.original_hospital_id),
             public_title=EXCLUDED.public_title,public_rating=EXCLUDED.public_rating,
             min_price=EXCLUDED.min_price,public_attributes=EXCLUDED.public_attributes,fetched_at=EXCLUDED.fetched_at""",
             identifier,hid,title,url,rating,reviews,minimum,json.dumps({"option_count":len(options),"factual_source":"public_source"}),now)
            for o in options:
                await conn.execute("""INSERT INTO unni_clone.event_options
                  (source_option_key,original_event_id,original_option_id,display_order,public_name,local_price,currency,public_attributes,fetched_at,rights_status)
                  VALUES ($1,$2,$3,$4,$5,$6,'USD',$7::jsonb,$8,'metadata_only')
                  ON CONFLICT(source_option_key) DO UPDATE SET
                  original_option_id=COALESCE(EXCLUDED.original_option_id,unni_clone.event_options.original_option_id),
                  public_name=EXCLUDED.public_name,local_price=EXCLUDED.local_price,
                  public_attributes=EXCLUDED.public_attributes,fetched_at=EXCLUDED.fetched_at""",
                  o["key"],identifier,o["option_id"],o["order"],o["name"],o["price"],
                  json.dumps({"discountPercent":o["discount_percent"],"originalPrice":o["original_price"],
                    "localKRW":o["local_price"],"attributes":o["attributes"]}),now)
        elif kind=="hospital":
            info=hospital_info(main)
            await conn.execute("""INSERT INTO unni_clone.hospitals
              (original_hospital_id,name,source_url,address,public_rating,public_review_count,attributes,fetched_at,rights_status)
              VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'metadata_only')
              ON CONFLICT(original_hospital_id) DO UPDATE SET
              name=EXCLUDED.name,address=EXCLUDED.address,public_rating=EXCLUDED.public_rating,
              public_review_count=EXCLUDED.public_review_count,attributes=EXCLUDED.attributes,fetched_at=EXCLUDED.fetched_at""",
              identifier,title,url,info.get("address"),rating,reviews,json.dumps(info),now)
        else:
            clinic=source_hospital(main)
            hid=None
            if clinic:
                hid,name=clinic
                await conn.execute("""INSERT INTO unni_clone.hospitals
                  (original_hospital_id,name,source_url,rights_status,fetched_at)
                  VALUES($1,$2,$3,'metadata_only',$4)
                  ON CONFLICT(original_hospital_id) DO NOTHING""",hid,name,"https://unni.app/us/hospitals/"+hid,now)
            await conn.execute("""INSERT INTO unni_clone.doctors
               (original_doctor_id,original_hospital_id,display_name,source_url,public_attributes,fetched_at,rights_status)
               VALUES($1,$2,$3,$4,$5::jsonb,$6,'metadata_only')
               ON CONFLICT(original_doctor_id) DO UPDATE SET
               display_name=EXCLUDED.display_name,public_attributes=EXCLUDED.public_attributes,fetched_at=EXCLUDED.fetched_at""",
               identifier,hid,title,url,json.dumps({"rating":rating,"reviews":reviews}),now)
        await conn.execute("""INSERT INTO unni_clone.source_provenance
          (source_key,entity_type,original_entity_id,canonical_url,reviewed_permission,observed_at,notes)
          VALUES($1,$2,$3,$4,'not_reviewed',$5,'Factual metadata only; source no-store HTML was not retained')
          ON CONFLICT(source_key) DO UPDATE SET observed_at=EXCLUDED.observed_at""",
          kind+":"+identifier,kind,identifier,"https://unni.app"+path,now)
    return {"type":kind,"id":identifier}
