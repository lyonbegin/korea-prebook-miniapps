"""TinyFish-based remote sourcing API.

A ProcureFlow-style worker performs collections outside the FastAPI request path.
This module creates jobs, protects results, preserves provenance, and allows
manual promotion into existing miniapp channel products.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

SOURCES = {
    "rednote": {"label": "샤오홍슈 / RedNote", "url": "https://www.rednote.com/", "category": "social_discovery", "login": True},
    "bilibili": {"label": "Bilibili", "url": "https://search.bilibili.com/", "category": "social_discovery", "login": False},
    "google_shopping": {"label": "Google Shopping", "url": "https://www.google.com/search?tbm=shop", "category": "product", "login": False},
    "trip": {"label": "Trip.com / Ctrip", "url": "https://www.trip.com/", "category": "travel", "login": False},
    "agoda": {"label": "Agoda", "url": "https://www.agoda.com/", "category": "lodging", "login": False},
    "klook": {"label": "Klook", "url": "https://www.klook.com/", "category": "activities", "login": False},
    "kkday": {"label": "KKday", "url": "https://www.kkday.com/", "category": "activities", "login": False},
    "youtube": {"label": "YouTube 관광·쇼핑 영상", "url": "https://www.youtube.com/", "category": "social_discovery", "login": False},
    "fallcent": {"label": "Fallcent 상품·가격", "url": "https://fallcent.com/product/search/", "category": "product", "login": False},
    "oliveyoung": {"label": "올리브영 K-Beauty", "url": "https://www.oliveyoung.co.kr/", "category": "product", "login": False},
    "yanolja": {"label": "야놀자 숙박·여행", "url": "https://www.yanolja.com/", "category": "lodging", "login": False},
    "coupang": {"label": "쿠팡 상품", "url": "https://www.coupang.com/", "category": "product", "login": False},
    "naver_shopping": {"label": "네이버 쇼핑", "url": "https://shopping.naver.com/", "category": "product", "login": False},
}

def utc():
    return datetime.now(timezone.utc).isoformat()

class SourceConnection(BaseModel):
    profile_id: str = Field(default="", max_length=100)
    notes: str = Field(default="", max_length=250)

class SourceJobIn(BaseModel):
    source: str
    query: str = Field(min_length=2, max_length=100)
    max_items: int = Field(default=10, ge=1, le=20)

class WorkerUpdate(BaseModel):
    state: str
    run_id: str = Field(default="", max_length=100)
    message: str = Field(default="", max_length=2000)
    result: dict | None = None

class PublishIn(BaseModel):
    indices: list[int] = Field(min_length=1, max_length=20)

def mount_sourcing(app, engine):
    def guard(authorization: str | None):
        key = os.getenv("ADMIN_API_TOKEN", "")
        if not key or not authorization or not secrets.compare_digest(
            authorization, "Bearer " + key
        ):
            raise HTTPException(401, "관리자 인증 필요")

    with engine.begin() as c:
        c.execute(text(
            "CREATE TABLE IF NOT EXISTS korea_prebook_source_connections "
            "(source VARCHAR(40) PRIMARY KEY, profile_id VARCHAR(100) NOT NULL, "
            "notes VARCHAR(250) NOT NULL, updated_at TEXT NOT NULL)"
        ))
        c.execute(text(
            "CREATE TABLE IF NOT EXISTS korea_prebook_sourcing_jobs "
            "(id VARCHAR(36) PRIMARY KEY, source VARCHAR(40) NOT NULL, "
            "query VARCHAR(100) NOT NULL, max_items INTEGER NOT NULL, "
            "profile_id VARCHAR(100) NOT NULL, state VARCHAR(24) NOT NULL, "
            "run_id VARCHAR(100) NOT NULL, result TEXT NOT NULL, "
            "message TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"
        ))
    def check_source(source):
        if source not in SOURCES:
            raise HTTPException(404, "미지원 소싱 채널")

    def connection(source):
        with engine.connect() as c:
            return c.execute(text(
                "SELECT profile_id,notes FROM korea_prebook_source_connections WHERE source=:s"
            ), {"s": source}).mappings().first()

    def db_job(jid):
        with engine.connect() as c:
            row = c.execute(text(
                "SELECT * FROM korea_prebook_sourcing_jobs WHERE id=:i"
            ), {"i": jid}).mappings().first()
        if not row:
            raise HTTPException(404, "작업을 찾을 수 없습니다")
        return dict(row)

    def public_job(row, include_result=False):
        data = {k: row[k] for k in ("id", "source", "query", "max_items", "state", "run_id", "message", "created_at", "updated_at")}
        data["profile_configured"] = bool(row["profile_id"])
        if include_result:
            data["items"] = json.loads(row["result"] or "{}").get("items", [])
        return data

    @app.get("/manager/api/sourcing/sources")
    def source_status(authorization: str | None = Header(None)):
        guard(authorization)
        with engine.connect() as c:
            rows = c.execute(text(
                "SELECT source,profile_id,notes,updated_at FROM korea_prebook_source_connections"
            )).mappings().all()
        conf = {x["source"]: dict(x) for x in rows}
        return {"sources": [{ "id": sid, **meta,
            "profile_id": conf.get(sid, {}).get("profile_id", ""),
            "notes": conf.get(sid, {}).get("notes", ""),
            "login_status": "not_verified" if conf.get(sid, {}).get("profile_id") else "not_configured"
        } for sid, meta in SOURCES.items()],
        "worker_api_configured": bool(os.getenv("TINYFISH_API_KEY")),
        "credential_notice": "관리자에는 비밀번호를 저장하지 않습니다. TinyFish Browser Context Profile에서 로그인하세요."}

    @app.put("/manager/api/sourcing/sources/{source}/connection")
    def save_connection(source: str, data: SourceConnection,
                        authorization: str | None = Header(None)):
        guard(authorization)
        check_source(source)
        profile_id = data.profile_id.strip()
        if profile_id and not re.fullmatch(r"prof_[A-Za-z0-9_-]{6,90}", profile_id):
            raise HTTPException(422, "TinyFish 프로필 ID 형식 오류")
        with engine.begin() as c:
            c.execute(text("DELETE FROM korea_prebook_source_connections WHERE source=:s"), {"s":source})
            c.execute(text(
                "INSERT INTO korea_prebook_source_connections(source,profile_id,notes,updated_at) "
                "VALUES(:s,:p,:n,:t)"
            ), {"s": source, "p": profile_id, "n": data.notes, "t": utc()})
        return {"source": source, "profile_id": profile_id, "login_status": "not_verified"}

    @app.post("/manager/api/sourcing/jobs", status_code=201)
    def queue_source(job: SourceJobIn, authorization: str | None = Header(None)):
        guard(authorization)
        check_source(job.source)
        connected = connection(job.source)
        pid = connected["profile_id"] if connected else ""
        if SOURCES[job.source]["login"] and not pid:
            raise HTTPException(422, "로그인 채널입니다. TinyFish 프로필을 먼저 연결하세요.")
        with engine.begin() as c:
            active = c.execute(text(
                "SELECT id FROM korea_prebook_sourcing_jobs "
                "WHERE source=:s AND state IN ('queued','submitting','running') LIMIT 1"
            ), {"s": job.source}).scalar_one_or_none()
            if active:
                raise HTTPException(409, "해당 채널의 수집 작업이 이미 진행 중입니다: " + active)
            jid = str(uuid.uuid4())
            c.execute(text(
                "INSERT INTO korea_prebook_sourcing_jobs "
                "(id,source,query,max_items,profile_id,state,run_id,result,message,created_at,updated_at) "
                "VALUES(:i,:s,:q,:m,:p,'queued','','{}','',:t,:t)"
            ), {"i": jid, "s":job.source, "q":job.query, "m":job.max_items,"p":pid,"t":utc()})
        return {"id": jid, "state": "queued", "source":job.source, "worker_required":True}

    @app.get("/manager/api/sourcing/jobs")
    def source_jobs(authorization: str | None = Header(None)):
        guard(authorization)
        with engine.connect() as c:
            rows = c.execute(text(
                "SELECT * FROM korea_prebook_sourcing_jobs ORDER BY created_at DESC LIMIT 40"
            )).mappings().all()
        return {"jobs": [public_job(row) for row in rows]}

    @app.get("/manager/api/sourcing/jobs/{jid}")
    def source_job_detail(jid: str, authorization: str | None = Header(None)):
        guard(authorization)
        return public_job(db_job(jid), include_result=True)

    @app.get("/manager/api/sourcing/worker/next")
    def worker_next(authorization: str | None = Header(None)):
        guard(authorization)
        with engine.begin() as c:
            sql = ("SELECT id FROM korea_prebook_sourcing_jobs WHERE state='queued' "
                   "ORDER BY created_at LIMIT 1")
            if engine.dialect.name == "postgresql":
                sql += " FOR UPDATE SKIP LOCKED"
            jid = c.execute(text(sql)).scalar_one_or_none()
            if jid:
                c.execute(text(
                    "UPDATE korea_prebook_sourcing_jobs SET state='submitting',updated_at=:t WHERE id=:i"
                ), {"i":jid,"t":utc()})
        if not jid:
            return {"job": None}
        job = db_job(jid)
        return {"job": {k:job[k] for k in ("id","source","query","max_items","profile_id")}}

    @app.get("/manager/api/sourcing/worker/active")
    def worker_active(authorization: str | None = Header(None)):
        guard(authorization)
        with engine.connect() as c:
            rows=c.execute(text(
                "SELECT id,run_id FROM korea_prebook_sourcing_jobs "
                "WHERE state='running' AND run_id<>'' ORDER BY created_at"
            )).mappings().all()
        return {"jobs":[dict(row) for row in rows]}

    @app.post("/manager/api/sourcing/worker/jobs/{jid}")
    def worker_update(jid: str, data: WorkerUpdate,
                      authorization: str | None = Header(None)):
        guard(authorization)
        if data.state not in ("running","completed","failed"):
            raise HTTPException(422, "작업 상태 오류")
        old=db_job(jid)
        if old["state"] not in ("submitting","running"):
            raise HTTPException(409, "작업 상태 전환 불가")
        if data.state == "running" and not (data.run_id or old["run_id"]):
            raise HTTPException(422, "TinyFish run_id가 필요합니다")
        if data.state == "completed":
            items = (data.result or {}).get("items")
            if not isinstance(items,list):
                raise HTTPException(422, "items 목록이 필요합니다")
            safe = []
            for item in items[:old["max_items"]]:
                if not isinstance(item,dict):
                    continue
                title=str(item.get("title") or "").strip()[:140]
                link=str(item.get("url") or "")[:600]
                if not title or not link.startswith("https://"):
                    continue
                safe.append({"title":title, "url":link,
                             "description":str(item.get("description") or "")[:1000],
                             "price":str(item.get("price") or "")[:100],
                             "location":str(item.get("location") or "")[:100]})
            payload=json.dumps({"items":safe},ensure_ascii=False)
        else:
            payload=old["result"]
        with engine.begin() as c:
            c.execute(text(
                "UPDATE korea_prebook_sourcing_jobs SET state=:s,run_id=:r,"
                "message=:m,result=:j,updated_at=:t WHERE id=:i"
            ), {"s":data.state,"r":data.run_id or old["run_id"],
                "m":data.message[:2000],"j":payload,"t":utc(),"i":jid})
        return {"id":jid,"state":data.state, "items":len(json.loads(payload).get("items",[]))}

    @app.post("/manager/api/sourcing/jobs/{jid}/publish")
    def publish_sourced(jid: str, data: PublishIn,
                        authorization: str | None = Header(None)):
        guard(authorization)
        row=db_job(jid)
        if row["state"]!="completed":
            raise HTTPException(409, "수집 완료 후 검수·등록 가능합니다")
        items=json.loads(row["result"]).get("items", [])
        indexes=list(dict.fromkeys(data.indices))
        if any(idx<0 or idx>=len(items) for idx in indexes):
            raise HTTPException(422,"존재하지 않는 상품 번호")
        created=[]
        with engine.begin() as c:
            for idx in indexes:
                item=items[idx]
                identity=row["source"]+":"+item["url"]
                duplicate=c.execute(text(
                    "SELECT id,payload FROM korea_prebook_source_items"
                )).mappings().all()
                exists=next((x["id"] for x in duplicate if json.loads(x["payload"]).get("identity")==identity),None)
                if exists:
                    created.append({"id":exists,"status":"existing"})
                    continue
                iid=str(uuid.uuid4())
                record={
                    "title_zh":item["title"], "category":SOURCES[row["source"]]["category"],
                    "source_name":row["source"], "source_url":item["url"], "supplier":"",
                    "identity":identity,"description":item["description"],"price":item["price"],
                    "location":item["location"],"review_status":"selected"
                }
                c.execute(text(
                    "INSERT INTO korea_prebook_source_items(id,payload,created_at) VALUES(:i,:p,:t)"
                ), {"i":iid,"p":json.dumps(record,ensure_ascii=False),"t":utc()})
                created.append({"id":iid,"status":"created"})
        return {"items":created,"next_step":"관리자 채널 설정에서 상품 노출 선택"}
