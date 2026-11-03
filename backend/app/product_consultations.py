"""Product-bound consultation requests shared by WeChat and Alipay.

A request is not a booking, a live video connection, or proof that a counselor
is available. Only an authenticated administrator may attach an invited HITEL
private consultation session. No medical notes or personal identifiers accepted.
"""
from __future__ import annotations

import hashlib
import os
import re
import secrets
import uuid
from datetime import date, datetime, time, timezone
from urllib.parse import urlencode
from pathlib import Path

from fastapi import Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

ITEM_PATTERN = re.compile(r"^[A-Za-z0-9_-]{2,60}$")
STATUS = {"requested", "assigned", "ready", "cancelled", "closed"}


class RequestIn(BaseModel):
    source: str = Field(pattern=r"^(offer|cosmetics)$")
    item_id: str = Field(min_length=2, max_length=60)
    platform: str = Field(pattern=r"^(wechat|alipay)$")
    desired_date: date | None = None
    desired_time: time | None = None

    @model_validator(mode="after")
    def check(self):
        if not ITEM_PATTERN.fullmatch(self.item_id):
            raise ValueError("Invalid item")
        if self.desired_date and self.desired_date < date.today():
            raise ValueError("Date is in the past")
        if self.desired_time and not self.desired_date:
            raise ValueError("Date is required for a requested time")
        return self


class AssignmentIn(BaseModel):
    status: str = Field(pattern=r"^(assigned|ready|cancelled|closed)$")
    counselor_id: str = Field(default="", max_length=120)
    hitel_session_id: str = Field(default="", max_length=80)

    @model_validator(mode="after")
    def check(self):
        if self.status == "ready":
            if not self.counselor_id or not self.hitel_session_id:
                raise ValueError("A counselor and private HITEL session are required")
            try:
                canonical = str(uuid.UUID(self.hitel_session_id))
            except ValueError:
                raise ValueError("Invalid private HITEL session ID")
            if self.hitel_session_id != canonical:
                raise ValueError("Private HITEL session ID must be a canonical UUID")
        elif self.hitel_session_id:
            raise ValueError("A private HITEL session is allowed only for ready status")
        return self


def mount_product_consultations(app, engine, identity_resolver=None):
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS korea_prebook_product_consultations (
                id VARCHAR(36) PRIMARY KEY,
                access_hash VARCHAR(64) NOT NULL,
                platform VARCHAR(16) NOT NULL,
                source VARCHAR(16) NOT NULL,
                item_id VARCHAR(60) NOT NULL,
                title_snapshot VARCHAR(180) NOT NULL,
                counselor_id VARCHAR(120) NOT NULL,
                desired_date VARCHAR(10),
                desired_time VARCHAR(5),
                status VARCHAR(16) NOT NULL,
                hitel_session_id VARCHAR(80) NOT NULL,
                created_at VARCHAR(50) NOT NULL,
                updated_at VARCHAR(50) NOT NULL
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS korea_prebook_consultation_owners (
                request_id VARCHAR(36) PRIMARY KEY,
                platform VARCHAR(16) NOT NULL,
                subject_hash VARCHAR(64) NOT NULL,
                active_slot VARCHAR(64) NULL
            )
        """))
        # Reversible, additive migration for any preexisting feature-branch table.
        from sqlalchemy import inspect
        owner_cols = {c["name"] for c in inspect(engine).get_columns(
            "korea_prebook_consultation_owners"
        )}
        if "active_slot" not in owner_cols:
            conn.execute(text(
                "ALTER TABLE korea_prebook_consultation_owners "
                "ADD COLUMN active_slot VARCHAR(64) NULL"
            ))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS korea_prebook_consultation_owners_unique_slot
            ON korea_prebook_consultation_owners(active_slot)
            WHERE active_slot IS NOT NULL
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS korea_prebook_consultation_owners_subject_idx
            ON korea_prebook_consultation_owners(platform, subject_hash)
        """))
        conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS korea_prebook_unique_ready_hitel_session
            ON korea_prebook_product_consultations(hitel_session_id)
            WHERE hitel_session_id <> '' AND status = 'ready'
        """))

    def admin_only(authorization):
        key = os.getenv("ADMIN_API_TOKEN", "").strip()
        if not key or not authorization or not secrets.compare_digest(
            authorization, "Bearer " + key
        ):
            raise HTTPException(401, "Administrator authentication required")

    def identity_required():
        return (os.getenv("APP_ENV", "development").lower() == "production"
                or os.getenv("MINIAPP_CONSULTATION_AUTH_REQUIRED", "").lower() == "true")

    def resolve_identity(authorization: str | None, required=False):
        if not authorization:
            if required or identity_required():
                raise HTTPException(401, "Verified miniapp login required")
            return None
        if identity_resolver is None:
            raise HTTPException(503, "Miniapp identity verification unavailable")
        return identity_resolver(authorization)

    def resolve_item(source, item_id):
        if source == "offer":
            with engine.connect() as conn:
                row = conn.execute(text(
                    "SELECT title_zh,counselor_id FROM korea_prebook_marketing_offers "
                    "WHERE id=:id AND status='published'"
                ), {"id": item_id}).mappings().first()
            if not row:
                raise HTTPException(404, "Published offer not found")
            return row["title_zh"], row["counselor_id"]
        # A catalogue product is NOT automatically associated with a real counselor.
        if not inspect(engine).has_table("korea_prebook_kt_products"):
            raise HTTPException(404, "Cosmetic product not found")
        with engine.connect() as conn:
            row = conn.execute(text(
                "SELECT prdt_name FROM korea_prebook_kt_products WHERE prdt_no=:id"
            ), {"id": item_id}).mappings().first()
        if not row:
            raise HTTPException(404, "Cosmetic product not found")
        return row["prdt_name"] or item_id, ""

    def public_row(row):
        # Never expose the counselor's internal identifier or the access hash.
        url = None
        platform_enabled = os.getenv(
            row["platform"].upper() + "_HITEL_VIDEO_ENABLED", ""
        ).lower() == "true"
        if row["status"] == "ready" and row["hitel_session_id"] and platform_enabled:
            base = os.getenv("HITEL_PRIVATE_CONSULT_URL", "").strip().rstrip("/")
            # Only the specifically audited native miniapp webview host is permitted.
            # Other https:// endpoints must never become external redirect links.
            if base == "https://hitel-room-production-ecce.up.railway.app/private-consultation":
                url = base + "?" + urlencode(
                    {"consultation": row["hitel_session_id"]}
                )
        return {
            "request_id": row["id"], "source": row["source"],
            "item_id": row["item_id"], "title": row["title_snapshot"],
            "status": row["status"], "video_url": url,
            "video_connected": False, "booking_confirmed": False,
        }

    @app.post("/v1/product-consultations", status_code=201)
    def request_consultation(data: RequestIn, authorization: str | None = Header(None)):
        if os.getenv("PRODUCT_CONSULTATIONS_ENABLED", "").lower() != "true":
            raise HTTPException(503, "Consultation requests are not enabled")
        identity = resolve_identity(authorization)
        if identity and identity["platform"] != data.platform:
            raise HTTPException(403, "Miniapp session platform mismatch")
        # The API deliberately accepts no free-text medical or identifying data.
        title, counselor = resolve_item(data.source, data.item_id)
        token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": str(uuid.uuid4()), "access_hash": hashlib.sha256(token.encode()).hexdigest(),
            "platform": data.platform, "source": data.source, "item_id": data.item_id,
            "title_snapshot": title, "counselor_id": counselor,
            "desired_date": data.desired_date.isoformat() if data.desired_date else None,
            "desired_time": data.desired_time.strftime("%H:%M") if data.desired_time else None,
            "status": "requested", "hitel_session_id": "",
            "created_at": now, "updated_at": now,
        }
        slot = None
        if identity:
            slot = hashlib.sha256(
                f"{identity['platform']}:{identity['subject_hash']}:{data.source}:{data.item_id}".encode()
            ).hexdigest()

        def existing_active():
            if not slot:
                return None
            with engine.connect() as conn:
                return conn.execute(text(
                    "SELECT c.* FROM korea_prebook_product_consultations c "
                    "JOIN korea_prebook_consultation_owners o ON o.request_id=c.id "
                    "WHERE o.active_slot=:slot AND c.status NOT IN ('closed','cancelled')"
                ), {"slot": slot}).mappings().first()

        previous = existing_active()
        if previous:
            return public_row(previous)
        try:
            with engine.begin() as conn:
                conn.execute(text(
                    "INSERT INTO korea_prebook_product_consultations ("
                    + ",".join(row) + ") VALUES (" + ",".join(":" + key for key in row) + ")"
                ), row)
                if identity:
                    conn.execute(text(
                        "INSERT INTO korea_prebook_consultation_owners "
                        "(request_id,platform,subject_hash,active_slot) "
                        "VALUES (:request_id,:platform,:subject_hash,:active_slot)"
                    ), {"request_id": row["id"], **identity, "active_slot": slot})
        except IntegrityError:
            # Concurrent requests from two authenticated devices lose the unique-slot race.
            previous = existing_active()
            if previous:
                return public_row(previous)
            raise HTTPException(409, "Consultation request already being created")
        if identity:
            return public_row(row)
        return {**public_row(row), "access_token": token}

    @app.get("/v1/product-consultations/mine")
    def my_consultations(authorization: str | None = Header(None)):
        identity = resolve_identity(authorization, required=True)
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT c.* FROM korea_prebook_product_consultations c "
                "JOIN korea_prebook_consultation_owners o ON o.request_id=c.id "
                "WHERE o.platform=:platform AND o.subject_hash=:subject_hash "
                "ORDER BY c.created_at DESC LIMIT 50"
            ), identity).mappings().all()
        return {"requests": [public_row(r) for r in rows]}

    @app.get("/v1/product-consultations/{request_id}")
    def consultation_status(
        request_id: str,
        x_consultation_token: str | None = Header(None),
        authorization: str | None = Header(None),
    ):
        if not ITEM_PATTERN.fullmatch(request_id) and not re.fullmatch(
            r"[0-9a-f-]{36}", request_id
        ):
            raise HTTPException(404, "Request not found")
        with engine.connect() as conn:
            row = conn.execute(text(
                "SELECT * FROM korea_prebook_product_consultations WHERE id=:id"
            ), {"id": request_id}).mappings().first()
            owner = conn.execute(text(
                "SELECT platform,subject_hash FROM korea_prebook_consultation_owners "
                "WHERE request_id=:id"
            ), {"id": request_id}).mappings().first()
        if not row:
            raise HTTPException(404, "Request not found")
        if owner:
            identity = resolve_identity(authorization, required=True)
            if (identity["platform"] != owner["platform"]
                    or not secrets.compare_digest(identity["subject_hash"], owner["subject_hash"])):
                raise HTTPException(404, "Request not found")
        else:
            if identity_required():
                raise HTTPException(403, "Legacy anonymous request is not supported")
            if not x_consultation_token or len(x_consultation_token) > 128:
                raise HTTPException(403, "Consultation access token required")
            if not secrets.compare_digest(
                row["access_hash"], hashlib.sha256(x_consultation_token.encode()).hexdigest()
            ):
                raise HTTPException(404, "Request not found")
        return public_row(row)

    @app.get("/manager/product-consultations", response_class=HTMLResponse, include_in_schema=False)
    def consultation_manager_ui():
        return Path(__file__).with_name("consultations_manager.html").read_text(
            encoding="utf-8"
        )

    @app.get("/manager/api/product-consultations/readiness", include_in_schema=False)
    def readiness(authorization: str | None = Header(None)):
        admin_only(authorization)
        base = os.getenv("HITEL_PRIVATE_CONSULT_URL", "").strip().rstrip("/")
        expected = "https://hitel-room-production-ecce.up.railway.app/private-consultation"
        return {
            "request_api_enabled": os.getenv("PRODUCT_CONSULTATIONS_ENABLED", "").lower() == "true",
            "wechat_video_enabled": os.getenv("WECHAT_HITEL_VIDEO_ENABLED", "").lower() == "true",
            "alipay_video_enabled": os.getenv("ALIPAY_HITEL_VIDEO_ENABLED", "").lower() == "true",
            "private_video_origin_valid": base == expected,
            "hitel_identity_verified": False,
            "physical_device_video_verified": False,
            "meaning": "Configuration only; no actual call or identity was verified",
        }

    @app.get("/manager/api/product-consultations")
    def list_requests(authorization: str | None = Header(None)):
        admin_only(authorization)
        with engine.connect() as conn:
            rows = conn.execute(text(
                "SELECT id,platform,source,item_id,title_snapshot,counselor_id,"
                "desired_date,desired_time,status,hitel_session_id,created_at,updated_at "
                "FROM korea_prebook_product_consultations "
                "ORDER BY created_at DESC LIMIT 500"
            )).mappings().all()
        return {"requests": [dict(row) for row in rows]}

    @app.put("/manager/api/product-consultations/{request_id}")
    def assign(request_id: str, body: AssignmentIn,
               authorization: str | None = Header(None)):
        admin_only(authorization)
        now = datetime.now(timezone.utc).isoformat()
        try:
            with engine.begin() as conn:
                found = conn.execute(text(
                    "SELECT id,counselor_id,status FROM korea_prebook_product_consultations "
                    "WHERE id=:id"
                ), {"id": request_id}).mappings().first()
                if not found:
                    raise HTTPException(404, "Request not found")
                if found["status"] in ("cancelled", "closed"):
                    raise HTTPException(409, "Request is final")
                if body.status in ("assigned", "ready") and not (
                    body.counselor_id or found["counselor_id"]
                ):
                    raise HTTPException(422, "A real counselor must be assigned")
                counselor = body.counselor_id or found["counselor_id"]
                conn.execute(text(
                    "UPDATE korea_prebook_product_consultations SET "
                    "status=:status,counselor_id=:counselor_id,"
                    "hitel_session_id=:hitel_session_id,updated_at=:updated_at "
                    "WHERE id=:id"
                ), {
                    "id": request_id, "status": body.status, "counselor_id": counselor,
                    "hitel_session_id": body.hitel_session_id, "updated_at": now,
                })
                if body.status in ("closed", "cancelled"):
                    conn.execute(text(
                        "UPDATE korea_prebook_consultation_owners "
                        "SET active_slot=NULL WHERE request_id=:id"
                    ), {"id": request_id})
        except IntegrityError:
            raise HTTPException(409, "HITEL private session already belongs to another request")
        return {"request_id": request_id, "status": body.status,
                "video_link_assigned": bool(body.hitel_session_id),
                "video_connected": False, "booking_confirmed": False}
