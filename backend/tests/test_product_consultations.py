"""Security, product binding and lifecycle tests for consultation handoff."""
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.offers import mount_offers
from app.product_consultations import mount_product_consultations


def setup(monkeypatch, enabled=True):
    monkeypatch.setenv("ADMIN_API_TOKEN", "unit-admin-key")
    if enabled:
        monkeypatch.setenv("PRODUCT_CONSULTATIONS_ENABLED", "true")
    else:
        monkeypatch.delenv("PRODUCT_CONSULTATIONS_ENABLED", raising=False)
    monkeypatch.setenv(
        "HITEL_PRIVATE_CONSULT_URL",
        "https://hitel-room-production-ecce.up.railway.app/private-consultation",
    )
    engine = create_engine("sqlite:///:memory:",
                           connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    app = FastAPI()
    mount_offers(app, engine)
    mount_product_consultations(app, engine)
    admin = {"Authorization": "Bearer unit-admin-key"}
    c = TestClient(app)
    body = {
        "category_id": "botox", "title_zh": "第一种优惠",
        "treatment_key": "botox-A", "counselor_id": "real-test-counselor",
        "status": "published",
    }
    first = c.post("/manager/api/offers", json=body, headers=admin).json()["id"]
    second = c.post("/manager/api/offers", json={
        **body, "title_zh": "第二种优惠"
    }, headers=admin).json()["id"]
    return c, engine, admin, first, second


def payload(item_id, source="offer"):
    return {"source": source, "item_id": item_id, "platform": "wechat",
            "desired_date": "2027-06-10", "desired_time": "14:00"}


def test_request_is_independent_of_marketing_variant(monkeypatch):
    c, _, admin, a, b = setup(monkeypatch)
    r1 = c.post("/v1/product-consultations", json=payload(a))
    r2 = c.post("/v1/product-consultations", json=payload(b))
    assert r1.status_code == r2.status_code == 201
    one, two = r1.json(), r2.json()
    assert one["request_id"] != two["request_id"]
    assert one["status"] == "requested"
    assert one["video_url"] is None
    assert one["video_connected"] is False
    assert one["booking_confirmed"] is False
    assert "access_token" in one
    assert "access_token" not in str(c.get(
        "/manager/api/product-consultations", headers=admin
    ).json())
    url = "/v1/product-consultations/" + one["request_id"]
    assert c.get(url).status_code == 403
    assert c.get(url, headers={"X-Consultation-Token": "wrong"}).status_code == 404
    ok = c.get(url, headers={"X-Consultation-Token": one["access_token"]})
    assert ok.status_code == 200
    assert "access_token" not in ok.json()
    rows = c.get("/manager/api/product-consultations", headers=admin).json()["requests"]
    assert len(rows) == 2
    assert {row["item_id"] for row in rows} == {a, b}
    assert {row["counselor_id"] for row in rows} == {"real-test-counselor"}


def test_cannot_forge_assignment_and_requires_private_session(monkeypatch):
    c, _, admin, offer, _ = setup(monkeypatch)
    created = c.post("/v1/product-consultations", json=payload(offer)).json()
    base = "/manager/api/product-consultations/" + created["request_id"]
    valid_room = str(uuid.uuid4())
    assert c.put(base, json={
        "status": "ready", "counselor_id": "real-test-counselor",
        "hitel_session_id": valid_room
    }).status_code == 401
    assert c.put(base, json={
        "status": "ready", "counselor_id": "real-test-counselor",
        "hitel_session_id": "fake-room"
    }, headers=admin).status_code == 422
    response = c.put(base, json={
        "status": "ready", "counselor_id": "real-test-counselor",
        "hitel_session_id": valid_room
    }, headers=admin)
    assert response.status_code == 200
    assert response.json()["video_connected"] is False
    status = c.get("/v1/product-consultations/" + created["request_id"],
                   headers={"X-Consultation-Token": created["access_token"]}).json()
    assert status["video_url"] == (
        "https://hitel-room-production-ecce.up.railway.app/"
        "private-consultation?consultation=" + valid_room
    )
    assert status["booking_confirmed"] is False
    assert c.put(base, json={"status": "closed"}, headers=admin).status_code == 200
    assert c.put(base, json={"status": "assigned"}, headers=admin).status_code == 409


def test_cosmetics_no_fictitious_counselor(monkeypatch):
    c, engine, admin, _, _ = setup(monkeypatch)
    with engine.begin() as con:
        con.execute(text(
            "CREATE TABLE korea_prebook_kt_products "
            "(prdt_no VARCHAR(40) PRIMARY KEY, prdt_name TEXT)"
        ))
        con.execute(text(
            "INSERT INTO korea_prebook_kt_products VALUES ('REAL-123','Real item')"
        ))
    r = c.post("/v1/product-consultations",
               json=payload("REAL-123", "cosmetics"))
    assert r.status_code == 201
    row = c.get("/manager/api/product-consultations",
                headers=admin).json()["requests"][0]
    assert row["counselor_id"] == ""
    assert c.put("/manager/api/product-consultations/" + row["id"],
                 json={"status": "assigned"}, headers=admin).status_code == 422
    assert c.post("/v1/product-consultations",
                  json=payload("NOT-REAL", "cosmetics")).status_code == 404


def test_feature_gate_and_validation(monkeypatch):
    c, _, _, a, _ = setup(monkeypatch, enabled=False)
    assert c.post("/v1/product-consultations",
                  json=payload(a)).status_code == 503
    monkeypatch.setenv("PRODUCT_CONSULTATIONS_ENABLED", "true")
    assert c.post("/v1/product-consultations",
                  json=payload("fake-offer")).status_code == 404
    assert c.post("/v1/product-consultations", json={
        **payload(a), "platform": "web"
    }).status_code == 422
    assert c.post("/v1/product-consultations", json={
        **payload(a), "desired_date": "2020-01-01"
    }).status_code == 422



def test_private_room_cannot_be_assigned_to_two_active_requests(monkeypatch):
    c, _, admin, offer, other_offer = setup(monkeypatch)
    one = c.post("/v1/product-consultations", json=payload(offer)).json()
    two = c.post("/v1/product-consultations", json=payload(other_offer)).json()
    room = str(uuid.uuid4())
    assigned = {
        "status": "ready",
        "counselor_id": "real-test-counselor",
        "hitel_session_id": room,
    }
    url = "/manager/api/product-consultations/"
    assert c.put(url + one["request_id"], json=assigned, headers=admin).status_code == 200
    duplicate = c.put(url + two["request_id"], json=assigned, headers=admin)
    assert duplicate.status_code == 409
    assert "already belongs" in duplicate.json()["detail"]
    assert c.put(url + one["request_id"], json={"status": "closed"}, headers=admin).status_code == 200
    # A closed request does not reserve its session forever.
    assert c.put(url + two["request_id"], json=assigned, headers=admin).status_code == 200


def test_room_id_must_be_canonical_uuid(monkeypatch):
    c, _, admin, offer, _ = setup(monkeypatch)
    record = c.post("/v1/product-consultations", json=payload(offer)).json()
    room = str(uuid.uuid4()).upper()
    result = c.put(
        "/manager/api/product-consultations/" + record["request_id"],
        json={
            "status": "ready",
            "counselor_id": "real-test-counselor",
            "hitel_session_id": room,
        },
        headers=admin,
    )
    assert result.status_code == 422
