"""Extract *observed* public factual metadata from my-doctor.io pages.
Never generate an absent hospital, price, doctor, phone or appointment.
No public HTML, photos, reviews, or patient information is persisted here.
"""
from __future__ import annotations
import hashlib
import re
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlsplit, parse_qs

BASE = "https://my-doctor.io"
PRICE_RE = re.compile(r"^\s*[₩]?\s*\d{1,3}(?:,\d{3})*(?:\s*원)?\s*$")
HOSPITAL_RE = re.compile(r"^/hospital/detail$")
BLOCKED_KEYS = ("auth", "token", "session", "patient", "private", "phone", "password")

def source_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def page_kind(path: str) -> str:
    if path == "/": return "home"
    if HOSPITAL_RE.match(path): return "hospital"
    if path.startswith("/hospital"): return "hospitals"
    if path.startswith("/medical-cost"): return "medical_cost"
    if path.startswith("/telemedicine"): return "telemedicine"
    if path.startswith("/healthLab"): return "health_article"
    return "other_public"

def visible(element) -> str:
    return element.get_text(" ", strip=True) if element else ""

def href_for(a):
    target = a.get("href") if a else None
    if not target: return None
    url = urljoin(BASE, target)
    if urlsplit(url).netloc != "my-doctor.io": return None
    return url

def extract_page(html: bytes, url: str) -> dict:
    path = urlsplit(url).path or "/"
    soup = BeautifulSoup(html, "html.parser")
    title = visible(soup.find("title"))[:300]
    h1 = visible(soup.find("h1"))[:300]
    result = dict(original_url=url, kind=page_kind(path), title=h1 or title,
                  departments=[], symptoms=[], cost_categories=[], hospital=None, hospital_prices=[])
    if path.startswith("/telemedicine"):
        for a in soup.select('a[href*="/telemedicine/"]'):
            name = visible(a)[:100]
            link = href_for(a)
            if link and name and len(name) < 90:
                result["departments"].append(dict(name=name,url=link))
    if path.startswith("/medical-cost"):
        for a in soup.select('a[href*="/medical-cost/"]'):
            name = visible(a)[:120]
            link = href_for(a)
            if link and name:
                result["cost_categories"].append(dict(name=name,url=link))
    if HOSPITAL_RE.match(path):
        identifier = parse_qs(urlsplit(url).query).get("hospital_id",[None])[0]
        if identifier and identifier.isdigit() and h1:
            main = soup.find("main") or soup
            text = visible(main)
            # An address is only recorded when immediately following the heading.
            nearest = soup.find("h1")
            address = ""
            if nearest:
                for candidate in nearest.find_all_next(["p","div"],limit=10):
                    candidate_text=visible(candidate)
                    if 5 <= len(candidate_text) <= 180 and re.search(r"(시|군|구|읍|면|동).*(로|길|번길|동|리)",candidate_text):
                        address=candidate_text
                        break
            result["hospital"]=dict(id=identifier,name=h1,address=address,phone=None)
            for table in main.select("table"):
                for tr in table.select("tbody tr"):
                    values=[visible(c) for c in tr.select("td")]
                    if len(values)>=2 and values[0] and (re.search(r"\d",values[1]) or "원" in values[1]):
                        result["hospital_prices"].append(dict(name=values[0][:150],price=values[1][:90],
                           extra={"columns":values[2:7]}))
            # Some source layouts expose tabular data as rows without <table>.
            if not result["hospital_prices"]:
                for row in main.select('[role="row"]'):
                    cells=[visible(x) for x in row.select('[role="cell"]')]
                    if len(cells)>=2 and re.search(r"\d",cells[1]):
                        result["hospital_prices"].append(dict(name=cells[0][:150],price=cells[1][:90],extra={"columns":cells[2:7]}))
    for key in ("departments","symptoms","cost_categories"):
        seen=set()
        unique=[]
        for entry in result[key]:
            if (entry["name"],entry["url"]) not in seen:
                seen.add((entry["name"],entry["url"]))
                unique.append(entry)
        result[key]=unique[:250]
    return result
