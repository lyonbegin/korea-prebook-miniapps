"""Provider-authenticated miniapp identity and product-ownership contract tests."""
import base64
import hashlib
import json
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.miniapp_identity import mount_miniapp_identity
from app.offers import mount_offers
from app.product_consultations import mount_product_consultations


class ProviderResponse:
    def __init__(self, data=None, raw=None):
        self.payload = data
        self.text = raw

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def secured(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("ADMIN_API_TOKEN", "admin-test-token")
    monkeypatch.setenv("PRODUCT_CONSULTATIONS_ENABLED", "true")
    monkeypatch.setenv("MINIAPP_IDENTITY_EXCHANGE_ENABLED", "true")
    monkeypatch.setenv("MINIAPP_IDENTITY_PEPPER", "a-long-secret-pepper-for-test-is-at-least-32-characters")
    monkeypatch.setenv("WECHAT_APP_ID", "wxrealtestappid")
    monkeypatch.setenv("WECHAT_APP_SECRET", "server-only-test-secret")
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    app = FastAPI()
    mount_offers(app, engine)
    identity = mount_miniapp_identity(app, engine)
    mount_product_consultations(app, engine, identity_resolver=identity)
    c = TestClient(app)
    offer = c.post(
        "/manager/api/offers",
        json={
            "category_id": "botox", "title_zh": "可咨询的服务",
            "counselor_id": "counselor-one", "status": "published",
        }, headers={"Authorization": "Bearer admin-test-token"},
    ).json()["id"]
    return c, engine, offer


def test_wechat_verified_identity_is_owner_and_cross_user_blocked(monkeypatch):
    import app.miniapp_identity as mod

    codes = {
        "first-code": "openid-first-person",
        "second-code": "openid-second-person",
    }
    def fake_wechat(url, params, timeout):
        assert url == "https://api.weixin.qq.com/sns/jscode2session"
        assert params["secret"] == "server-only-test-secret"
        return ProviderResponse({
            "openid": codes[params["js_code"]],
            "session_key": "never-store-or-return-this-secret",
        })
    monkeypatch.setattr(mod.httpx, "get", fake_wechat)
    c, engine, offer = secured(monkeypatch)
    api = "/v1/miniapp-auth/exchange"
    one = c.post(api, json={"platform": "wechat", "code": "first-code"})
    assert one.status_code == 200
    token1 = one.json()["access_token"]
    assert one.json()["verified_by_provider"] is True
    assert "openid" not in str(one.json())
    assert "session_key" not in str(one.json())
    first = {"Authorization": "Bearer " + token1}
    assert c.get("/v1/miniapp-auth/me", headers=first).json()["authenticated"]

    assert c.post("/v1/product-consultations", json={
        "platform": "wechat", "source": "offer", "item_id": offer
    }).status_code == 401
    wrong_platform = c.post("/v1/product-consultations", json={
        "platform": "alipay", "source": "offer", "item_id": offer
    }, headers=first)
    assert wrong_platform.status_code == 403
    response = c.post("/v1/product-consultations", json={
        "platform": "wechat", "source": "offer", "item_id": offer
    }, headers=first)
    assert response.status_code == 201
    rid = response.json()["request_id"]
    assert "access_token" not in response.json()
    assert c.get("/v1/product-consultations/mine", headers=first).json()[
        "requests"][0]["request_id"] == rid
    assert c.get("/v1/product-consultations/" + rid, headers=first).status_code == 200
    assert c.get("/v1/product-consultations/" + rid).status_code == 401

    second = c.post(api, json={"platform": "wechat", "code": "second-code"})
    other = {"Authorization": "Bearer " + second.json()["access_token"]}
    assert c.get("/v1/product-consultations/mine", headers=other).json()["requests"] == []
    assert c.get("/v1/product-consultations/" + rid, headers=other).status_code == 404
    with engine.connect() as conn:
        row = conn.execute(text(
            "SELECT platform,subject_hash FROM korea_prebook_miniapp_sessions LIMIT 1"
        )).mappings().first()
    assert row["platform"] == "wechat"
    assert "openid-first-person" not in row["subject_hash"]
    assert len(row["subject_hash"]) == 64

    assert c.post("/v1/miniapp-auth/logout", headers=first).status_code == 200
    assert c.get("/v1/miniapp-auth/me", headers=first).status_code == 401
    assert c.get("/v1/product-consultations/" + rid, headers=first).status_code == 401


def test_exchanges_fail_closed_when_unconfigured_or_rejected(monkeypatch):
    import app.miniapp_identity as mod

    c, _, _ = secured(monkeypatch)
    monkeypatch.delenv("MINIAPP_IDENTITY_EXCHANGE_ENABLED")
    assert c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "first-code"
    }).status_code == 503
    monkeypatch.setenv("MINIAPP_IDENTITY_EXCHANGE_ENABLED", "true")
    monkeypatch.setattr(mod.httpx, "get", lambda *a, **k: ProviderResponse({
        "errcode": 40029, "errmsg": "invalid code"
    }))
    assert c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "first-code"
    }).status_code == 401
    assert c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "aa?invalid"
    }).status_code == 422


def test_alipay_exchange_requires_valid_rsa2_response_signature(monkeypatch):
    import app.miniapp_identity as mod

    merchant_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    platform_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    merchant_pem = merchant_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode()
    platform_public_pem = platform_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    monkeypatch.setenv("ALIPAY_MINIPROGRAM_ID", "2026123456789012")
    monkeypatch.setenv("ALIPAY_RSA_PRIVATE_KEY", merchant_pem)
    monkeypatch.setenv("ALIPAY_PLATFORM_PUBLIC_KEY", platform_public_pem)
    c, _, _ = secured(monkeypatch)
    body = '{"user_id":"2088102150477652","access_token":"server-only","expires_in":"3600"}'
    def alipay_post(url, data, headers, timeout):
        assert url == "https://openapi.alipay.com/gateway.do"
        assert data["method"] == "alipay.system.oauth.token"
        assert data["grant_type"] == "authorization_code"
        assert data["code"] == "valid-alipay-code"
        canonical = "&".join(f"{k}={v}" for k, v in sorted(data.items()) if k != "sign" and v != "")
        merchant_key.public_key().verify(
            base64.b64decode(data["sign"]),
            canonical.encode(), padding.PKCS1v15(), hashes.SHA256()
        )
        sig = platform_key.sign(body.encode(), padding.PKCS1v15(), hashes.SHA256())
        raw = '{"alipay_system_oauth_token_response":' + body + ',"sign":"' + (
            base64.b64encode(sig).decode()) + '"}'
        return ProviderResponse(raw=raw)
    monkeypatch.setattr(mod.httpx, "post", alipay_post)
    r = c.post("/v1/miniapp-auth/exchange", json={
        "platform": "alipay", "code": "valid-alipay-code"
    })
    assert r.status_code == 200
    assert r.json()["platform"] == "alipay"
    assert "user_id" not in str(r.json())
    assert c.get("/v1/miniapp-auth/me", headers={
        "Authorization": "Bearer " + r.json()["access_token"]
    }).status_code == 200

    def tampered(*args, **kwargs):
        result = alipay_post(*args, **kwargs)
        result.text = result.text.replace('2088102150477652', '2088102150477653')
        return result
    monkeypatch.setattr(mod.httpx, "post", tampered)
    failed = c.post("/v1/miniapp-auth/exchange", json={
        "platform": "alipay", "code": "valid-alipay-code"
    })
    assert failed.status_code == 401


def test_expired_session_is_rejected(monkeypatch):
    import app.miniapp_identity as mod
    c, engine, _ = secured(monkeypatch)
    monkeypatch.setattr(mod.httpx, "get", lambda *a, **kw: ProviderResponse({
        "openid": "openid-expired-test"
    }))
    issued = c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "one-code"
    }).json()["access_token"]
    with engine.begin() as conn:
        conn.execute(text(
            "UPDATE korea_prebook_miniapp_sessions SET expires_at=:expires_at"
        ), {"expires_at": (datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()})
    assert c.get("/v1/miniapp-auth/me", headers={
        "Authorization": "Bearer " + issued
    }).status_code == 401



def test_same_account_same_product_is_idempotent_and_reopens_after_close(monkeypatch):
    import app.miniapp_identity as mod

    def auth_code(url, params, timeout):
        identity = "openid-first-person" if params["js_code"] != "another-user" else "openid-second-person"
        return ProviderResponse({"openid": identity})
    monkeypatch.setattr(mod.httpx, "get", auth_code)
    c, _, offer = secured(monkeypatch)
    first_auth = c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "first-user"
    }).json()["access_token"]
    first_headers = {"Authorization": "Bearer " + first_auth}
    payload = {"platform": "wechat", "source": "offer", "item_id": offer}
    first = c.post("/v1/product-consultations", json=payload, headers=first_headers)
    repeat = c.post("/v1/product-consultations", json=payload, headers=first_headers)
    assert first.status_code == repeat.status_code == 201
    assert first.json()["request_id"] == repeat.json()["request_id"]
    assert len(c.get("/v1/product-consultations/mine", headers=first_headers).json()["requests"]) == 1
    second_auth = c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "another-user"
    }).json()["access_token"]
    other_headers = {"Authorization": "Bearer " + second_auth}
    other = c.post("/v1/product-consultations", json=payload, headers=other_headers)
    assert other.status_code == 201
    assert other.json()["request_id"] != first.json()["request_id"]
    admin = {"Authorization": "Bearer admin-test-token"}
    assert c.put("/manager/api/product-consultations/" + first.json()["request_id"],
                 headers=admin, json={"status": "closed"}).status_code == 200
    again = c.post("/v1/product-consultations", json=payload, headers=first_headers)
    assert again.status_code == 201
    assert again.json()["request_id"] != first.json()["request_id"]


def test_one_account_can_request_two_independent_marketing_offers(monkeypatch):
    import app.miniapp_identity as mod
    monkeypatch.setattr(mod.httpx, "get", lambda *a, **k: ProviderResponse({
        "openid": "openid-first-person"
    }))
    c, _, offer = secured(monkeypatch)
    other = c.post("/manager/api/offers", json={
        "category_id": "botox", "title_zh": "另一种活动",
        "treatment_key": "same-botox", "counselor_id": "counselor-one",
        "status": "published",
    }, headers={"Authorization": "Bearer admin-test-token"}).json()["id"]
    token = c.post("/v1/miniapp-auth/exchange", json={
        "platform": "wechat", "code": "valid-code"
    }).json()["access_token"]
    headers = {"Authorization": "Bearer " + token}
    one = c.post("/v1/product-consultations", json={
        "platform": "wechat", "source": "offer", "item_id": offer
    }, headers=headers)
    two = c.post("/v1/product-consultations", json={
        "platform": "wechat", "source": "offer", "item_id": other
    }, headers=headers)
    assert one.status_code == two.status_code == 201
    assert one.json()["request_id"] != two.json()["request_id"]
