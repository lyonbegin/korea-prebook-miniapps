"""Verified miniapp identity exchange; never trust client-supplied user IDs.

WeChat CN code2Session and Alipay CN RSA2-signed OAuth exchange are performed
server-to-server. The API stores only HMAC-pseudonymized provider subjects, plus
short-lived opaque session-token hashes; no provider session_key is returned.
All provider credentials must be installed as server-side environment secrets.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

_CODE = re.compile(r"^[A-Za-z0-9_+./=-]{4,256}$")
_SUBJECT = re.compile(r"^[A-Za-z0-9_-]{4,128}$")
_PROVIDERS = ("wechat", "alipay")
_WECHAT_URL = "https://api.weixin.qq.com/sns/jscode2session"
_ALIPAY_URL = "https://openapi.alipay.com/gateway.do"
_EXPIRES = timedelta(hours=12)


class LoginExchange(BaseModel):
    platform: str = Field(pattern=r"^(wechat|alipay)$")
    code: str = Field(min_length=4, max_length=256)

    @property
    def valid_code(self):
        return bool(_CODE.fullmatch(self.code))


def _configured(*names):
    values = [os.getenv(n, "").strip() for n in names]
    if not all(values):
        raise HTTPException(503, "Platform authentication is not configured")
    return values


def _wechat_identity(code):
    app_id, secret = _configured("WECHAT_APP_ID", "WECHAT_APP_SECRET")
    try:
        response = httpx.get(
            _WECHAT_URL,
            params={"appid": app_id, "secret": secret, "js_code": code,
                    "grant_type": "authorization_code"},
            timeout=8.0,
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "WeChat identity service did not respond")
    if not isinstance(data, dict) or data.get("errcode") not in (None, 0):
        raise HTTPException(401, "WeChat login code was rejected")
    subject = data.get("openid")
    if not isinstance(subject, str) or not _SUBJECT.fullmatch(subject):
        raise HTTPException(401, "WeChat identity could not be verified")
    return app_id, subject


def _signed_payload(fields, private_key_text):
    try:
        key = serialization.load_pem_private_key(
            private_key_text.replace("\\n", "\n").encode(), password=None
        )
        canonical = "&".join(f"{k}={v}" for k, v in sorted(fields.items()) if v != "")
        signed = key.sign(
            canonical.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256()
        )
        return base64.b64encode(signed).decode("ascii")
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(503, "Alipay signing key is not configured correctly")


def _alipay_response(raw, public_key_text):
    """Verify signature over raw response JSON node, not a reserialized dict."""
    try:
        obj = json.loads(raw)
        marker = '"alipay_system_oauth_token_response"'
        pos = raw.find(marker)
        if pos < 0:
            raise ValueError("missing response")
        pos = raw.find(":", pos + len(marker))
        if pos < 0:
            raise ValueError("missing separator")
        pos += 1
        while pos < len(raw) and raw[pos].isspace():
            pos += 1
        node, _ = json.JSONDecoder().raw_decode(raw, pos)
        start = pos
        # raw_decode returns the consumed character count relative to pos
        _, consumed = json.JSONDecoder().raw_decode(raw[pos:])
        signature = obj.get("sign")
        if not isinstance(signature, str) or not signature:
            raise ValueError("missing signature")
        public_key = serialization.load_pem_public_key(
            public_key_text.replace("\\n", "\n").encode()
        )
        public_key.verify(
            base64.b64decode(signature, validate=True),
            raw[start:start + consumed].encode("utf-8"),
            padding.PKCS1v15(), hashes.SHA256(),
        )
    except (ValueError, TypeError, KeyError, InvalidSignature, AttributeError):
        raise HTTPException(401, "Alipay signed response could not be verified")
    if not isinstance(node, dict) or node.get("code") not in (None, "10000"):
        raise HTTPException(401, "Alipay login code was rejected")
    user_id = node.get("user_id")
    if not isinstance(user_id, str) or not _SUBJECT.fullmatch(user_id):
        raise HTTPException(401, "Alipay user identity could not be verified")
    return user_id


def _alipay_identity(code):
    app_id, private_key, public_key = _configured(
        "ALIPAY_MINIPROGRAM_ID", "ALIPAY_RSA_PRIVATE_KEY", "ALIPAY_PLATFORM_PUBLIC_KEY"
    )
    fields = {
        "app_id": app_id,
        "method": "alipay.system.oauth.token",
        "format": "JSON",
        "charset": "utf-8",
        "sign_type": "RSA2",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "version": "1.0",
        "grant_type": "authorization_code",
        "code": code,
    }
    signature = _signed_payload(fields, private_key)
    try:
        response = httpx.post(
            _ALIPAY_URL,
            data={**fields, "sign": signature},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=8.0,
        )
        response.raise_for_status()
        raw = response.text
    except httpx.HTTPError:
        raise HTTPException(502, "Alipay identity service did not respond")
    return app_id, _alipay_response(raw, public_key)


def mount_miniapp_identity(app, engine):
    with engine.begin() as con:
        con.execute(text("""
            CREATE TABLE IF NOT EXISTS korea_prebook_miniapp_sessions (
              token_hash VARCHAR(64) PRIMARY KEY,
              platform VARCHAR(16) NOT NULL,
              subject_hash VARCHAR(64) NOT NULL,
              expires_at VARCHAR(40) NOT NULL,
              created_at VARCHAR(40) NOT NULL
            )
        """))
        con.execute(text("""
            CREATE INDEX IF NOT EXISTS korea_prebook_miniapp_sessions_subject_idx
            ON korea_prebook_miniapp_sessions(platform,subject_hash)
        """))

    def require_identity(authorization: str | None):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Miniapp login is required")
        token = authorization[7:].strip()
        if len(token) < 32 or len(token) > 256:
            raise HTTPException(401, "Miniapp login is required")
        fingerprint = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with engine.connect() as con:
            row = con.execute(text(
                "SELECT platform,subject_hash,expires_at FROM korea_prebook_miniapp_sessions "
                "WHERE token_hash=:hash"
            ), {"hash": fingerprint}).mappings().first()
        if not row or row["expires_at"] <= datetime.now(timezone.utc).isoformat():
            raise HTTPException(401, "Miniapp login expired or invalid")
        return {"platform": row["platform"], "subject_hash": row["subject_hash"]}

    @app.post("/v1/miniapp-auth/exchange")
    def exchange(request: LoginExchange):
        if os.getenv("MINIAPP_IDENTITY_EXCHANGE_ENABLED", "").lower() != "true":
            raise HTTPException(503, "Miniapp identity service is not enabled")
        if not request.valid_code:
            raise HTTPException(422, "Invalid login code")
        pepper = _configured("MINIAPP_IDENTITY_PEPPER")[0]
        if len(pepper) < 32:
            raise HTTPException(503, "Identity HMAC key is not configured correctly")
        app_id, subject = (
            _wechat_identity(request.code) if request.platform == "wechat"
            else _alipay_identity(request.code)
        )
        subject_hash = hmac.new(
            pepper.encode(),
            f"{request.platform}:{app_id}:{subject}".encode(),
            hashlib.sha256,
        ).hexdigest()
        opaque_token = secrets.token_urlsafe(40)
        now = datetime.now(timezone.utc)
        expires_at = now + _EXPIRES
        with engine.begin() as con:
            con.execute(text(
                "INSERT INTO korea_prebook_miniapp_sessions "
                "(token_hash,platform,subject_hash,expires_at,created_at) "
                "VALUES (:token_hash,:platform,:subject_hash,:expires_at,:created_at)"
            ), {
                "token_hash": hashlib.sha256(opaque_token.encode()).hexdigest(),
                "platform": request.platform,
                "subject_hash": subject_hash,
                "expires_at": expires_at.isoformat(),
                "created_at": now.isoformat(),
            })
        return {
            "access_token": opaque_token, "platform": request.platform,
            "expires_at": expires_at.isoformat(),
            "verified_by_provider": True,
        }

    @app.get("/v1/miniapp-auth/me")
    def current_identity(authorization: str | None = Header(None)):
        identity = require_identity(authorization)
        return {"authenticated": True, "platform": identity["platform"],
                "expires_inferred": False}

    @app.post("/v1/miniapp-auth/logout")
    def logout(authorization: str | None = Header(None)):
        require_identity(authorization)
        fingerprint = hashlib.sha256(authorization[7:].strip().encode()).hexdigest()
        with engine.begin() as con:
            con.execute(text(
                "DELETE FROM korea_prebook_miniapp_sessions WHERE token_hash=:hash"
            ), {"hash": fingerprint})
        return {"logged_out": True}

    return require_identity
