import pytest
from fastapi.testclient import TestClient
from app.main import create_app


def client():
    return TestClient(
        create_app(db_url="sqlite:///:memory:", demo_key="local-test-key", app_env="development")
    )


def valid_payload():
    return {
        "customer_ref": "demo_customer_1",
        "platform": "wechat",
        "service_kind": "motel_early_checkin",
        "arrival_date": "2027-03-11",
        "departure_date": "2027-03-14",
        "requested_checkin_time": "08:30",
    }


def test_catalog_and_health():
    c = client()
    assert c.get("/health").json()["ok"] is True
    body = c.get("/v1/catalog").json()
    assert len(body["services"]) == 5
    assert body["inventory_live"] is False


def test_write_denied_without_demo_key():
    c = client()
    assert c.post("/v1/inquiries", json=valid_payload()).status_code == 403


def test_inquiry_is_not_confirmed_booking():
    c = client()
    response = c.post("/v1/inquiries", json=valid_payload(), headers={"X-Demo-Key": "local-test-key"})
    assert response.status_code == 201
    record = response.json()
    assert record["status"] == "inquiry_received"
    assert record["booking_confirmed"] is False
    assert record["payment_collected"] is False
    follow = c.get(
        f"/v1/inquiries/{record['inquiry_id']}", headers={"X-Demo-Key": "local-test-key"}
    )
    assert follow.status_code == 200


def test_dates_and_lodging_delivery_rules():
    c = client()
    p = valid_payload()
    p["departure_date"] = "2027-03-10"
    assert c.post("/v1/inquiries", json=p, headers={"X-Demo-Key": "local-test-key"}).status_code == 422
    p = valid_payload()
    p["service_kind"] = "korea_online_shopping"
    p.pop("requested_checkin_time")
    assert c.post("/v1/inquiries", json=p, headers={"X-Demo-Key": "local-test-key"}).status_code == 422
    p["lodging_name"] = "Demo lodging"
    assert c.post("/v1/inquiries", json=p, headers={"X-Demo-Key": "local-test-key"}).status_code == 201


def test_production_requires_managed_database():
    with pytest.raises(RuntimeError, match="Production requires managed PostgreSQL"):
        create_app(db_url="sqlite:///:memory:", demo_key="test", app_env="production")
