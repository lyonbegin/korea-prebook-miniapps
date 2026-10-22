"""Channel management and official-miniapp test job API.

All management actions require ADMIN_API_TOKEN; public read endpoints are separate.
Only new korea_prebook_* tables are created in the shared database.
"""
import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

CHANNELS = ("wechat", "alipay")
DEFAULT_KINDS = (
    "motel_early_checkin", "clinic_visit", "korea_online_shopping",
    "airport_goods_handoff", "airport_luggage_delivery",
)


class ChannelSetting(BaseModel):
    title_zh: str = Field(default="韩国行前预约 · 预购", max_length=100)
    subtitle_zh: str = Field(default="抵韩前预约入住、诊所和网购配送", max_length=200)
    enabled_kinds: list[str] = Field(default_factory=lambda: list(DEFAULT_KINDS), max_length=25)
    source_ids: list[str] = Field(default_factory=list, max_length=100)


class SourceItem(BaseModel):
    title_zh: str = Field(min_length=1, max_length=140)
    category: str = Field(min_length=1, max_length=80)
    source_name: str = Field(default="manual", max_length=60)
    source_url: str = Field(default="", max_length=500)
    supplier: str = Field(default="", max_length=140)


class JobRequest(BaseModel):
    channel: str
    action: str = "preview"
    confirm_upload: bool = False


class JobResult(BaseModel):
    status: str
    log: str = Field(default="", max_length=8000)
    screenshot_base64: str = Field(default="", max_length=1500000)


def mount_manager(app, engine, catalog):
    admin_token = os.getenv("ADMIN_API_TOKEN", "").strip()
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS korea_prebook_channel_settings "
            "(channel VARCHAR(24) PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS korea_prebook_source_items "
            "(id VARCHAR(36) PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL)"
        ))
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS korea_prebook_test_jobs "
            "(id VARCHAR(36) PRIMARY KEY, channel VARCHAR(24) NOT NULL, "
            "action VARCHAR(24) NOT NULL, state VARCHAR(24) NOT NULL, "
            "log TEXT NOT NULL, screenshot TEXT NOT NULL, created_at TEXT NOT NULL)"
        ))

    def verify(authorization: str | None = Header(default=None)):
        if not admin_token or not authorization or not secrets.compare_digest(
            authorization, "Bearer " + admin_token
        ):
            raise HTTPException(status_code=401, detail="관리자 인증이 필요합니다")

    def check_channel(channel):
        if channel not in CHANNELS:
            raise HTTPException(status_code=404, detail="Unsupported channel")

    def get_setting(channel):
        with engine.connect() as conn:
            payload = conn.execute(
                text("SELECT payload FROM korea_prebook_channel_settings WHERE channel=:c"),
                {"c": channel},
            ).scalar_one_or_none()
        return ChannelSetting.model_validate_json(payload) if payload else ChannelSetting()

    def get_sources():
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT id,payload,created_at FROM korea_prebook_source_items ORDER BY created_at DESC LIMIT 300"
            )).mappings().all()
        return [{"id": row["id"], **json.loads(row["payload"]), "created_at": row["created_at"]} for row in rows]

    def public_config(channel):
        config = get_setting(channel)
        services = [p for p in catalog if p["kind"] in config.enabled_kinds]
        sources = {p["id"]: p for p in get_sources()}
        for sid in config.source_ids:
            if sid in sources:
                s = sources[sid]
                services.append({
                    "kind": "source_" + sid, "name_zh": s["title_zh"],
                    "mode": "source_inquiry", "category": s["category"],
                })
        return {**config.model_dump(), "channel": channel, "services": services,
                "preview_only": True, "payment_enabled": False}

    @app.get("/manager", response_class=HTMLResponse, include_in_schema=False)
    def manager_page():
        return Path(__file__).with_name("manager.html").read_text(encoding="utf-8")

    @app.get("/v1/channels/{channel}/home")
    def channel_home(channel: str):
        check_channel(channel)
        return public_config(channel)

    @app.get("/manager/api/state")
    def manager_state(authorization: str | None = Header(default=None)):
        verify(authorization)
        return {
            "channels": {c: public_config(c) for c in CHANNELS},
            "sources": get_sources(),
            "ready": {
                "wechat_appid": bool(os.getenv("WECHAT_APP_ID")),
                "alipay_mini_program_id": bool(os.getenv("ALIPAY_MINIPROGRAM_ID")),
                "alipay_workspace_id": bool(os.getenv("ALIPAY_WORKSPACE_ID")),
                "alipay_super_app_id": bool(os.getenv("ALIPAY_SUPER_APP_ID")),
                "official_runner_connected": False,
            },
        }

    @app.put("/manager/api/channels/{channel}")
    def save_channel(channel: str, data: ChannelSetting,
                     authorization: str | None = Header(default=None)):
        verify(authorization)
        check_channel(channel)
        if any(k not in DEFAULT_KINDS for k in data.enabled_kinds):
            raise HTTPException(status_code=422, detail="Unknown catalog kind")
        known_sources = {s["id"] for s in get_sources()}
        if any(sid not in known_sources for sid in data.source_ids):
            raise HTTPException(status_code=422, detail="Unknown source item")
        with engine.begin() as conn:
            conn.execute(text(
                "DELETE FROM korea_prebook_channel_settings WHERE channel=:c"
            ), {"c": channel})
            conn.execute(text(
                "INSERT INTO korea_prebook_channel_settings(channel,payload,updated_at) "
                "VALUES (:c,:p,:t)"
            ), {"c": channel, "p": data.model_dump_json(),
                "t": datetime.now(timezone.utc).isoformat()})
        return public_config(channel)

    @app.post("/manager/api/source")
    def add_source(data: SourceItem, authorization: str | None = Header(default=None)):
        verify(authorization)
        sid = str(uuid.uuid4())
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO korea_prebook_source_items(id,payload,created_at) VALUES (:i,:p,:t)"
            ), {"i": sid, "p": data.model_dump_json(),
                "t": datetime.now(timezone.utc).isoformat()})
        return {"id": sid, **data.model_dump()}

    @app.get("/manager/api/jobs")
    def list_jobs(authorization: str | None = Header(default=None)):
        verify(authorization)
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT id,channel,action,state,log,screenshot,created_at "
                "FROM korea_prebook_test_jobs ORDER BY created_at DESC LIMIT 30"
            )).mappings().all()
        return [dict(r) for r in rows]

    @app.post("/manager/api/jobs", status_code=201)
    def enqueue_job(data: JobRequest, authorization: str | None = Header(default=None)):
        verify(authorization)
        check_channel(data.channel)
        if data.action not in ("preview", "upload"):
            raise HTTPException(status_code=422, detail="Unknown action")
        if data.action == "upload" and not data.confirm_upload:
            raise HTTPException(status_code=422, detail="Uploading requires explicit confirmation")
        jid = str(uuid.uuid4())
        with engine.begin() as conn:
            conn.execute(text(
                "INSERT INTO korea_prebook_test_jobs(id,channel,action,state,log,screenshot,created_at) "
                "VALUES(:i,:c,:a,'queued','','',:t)"
            ), {"i": jid, "c": data.channel, "a": data.action,
                "t": datetime.now(timezone.utc).isoformat()})
        return {"id": jid, "state": "queued", "channel": data.channel, "action": data.action}

    @app.get("/manager/api/runner/next")
    def runner_next(authorization: str | None = Header(default=None)):
        verify(authorization)
        with engine.begin() as conn:
            row = conn.execute(text(
                "SELECT id,channel,action FROM korea_prebook_test_jobs "
                "WHERE state='queued' ORDER BY created_at ASC LIMIT 1"
            )).mappings().first()
            if row:
                conn.execute(text(
                    "UPDATE korea_prebook_test_jobs SET state='running' WHERE id=:i AND state='queued'"
                ), {"i": row["id"]})
        return dict(row) if row else {"job": None}

    @app.post("/manager/api/runner/{job_id}")
    def runner_result(job_id: str, data: JobResult,
                      authorization: str | None = Header(default=None)):
        verify(authorization)
        if data.status not in ("success", "failed"):
            raise HTTPException(status_code=422, detail="Unknown status")
        if data.screenshot_base64 and not all(
            ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
            for ch in data.screenshot_base64
        ):
            raise HTTPException(status_code=422, detail="Invalid screenshot encoding")
        with engine.begin() as conn:
            result = conn.execute(text(
                "UPDATE korea_prebook_test_jobs SET state=:s, log=:l, screenshot=:b "
                "WHERE id=:i AND state='running'"
            ), {"i": job_id, "s": data.status, "l": data.log,
                "b": data.screenshot_base64})
        if result.rowcount != 1:
            raise HTTPException(status_code=404, detail="Running job not found")
        return {"id": job_id, "state": data.status}
