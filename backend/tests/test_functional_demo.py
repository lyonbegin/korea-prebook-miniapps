"""Keyless demo: actual database transitions and two browser signaling clients."""
import re
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import create_app


@pytest.fixture
def client():
    app = create_app(db_url="sqlite:///:memory:", app_env="demo")
    with TestClient(app) as c:
        yield c


def create(client, platform="wechat", item_id="demo-skin-a"):
    res = client.post("/demo/api/consultations", json={
        "platform": platform, "item_id": item_id,
        "desired_date": "2027-06-10", "desired_time": "14:00",
    })
    assert res.status_code == 201, res.text
    return res.json()


def assign(client, request_id):
    response = client.post(f"/demo/api/consultations/{request_id}/assign")
    assert response.status_code == 200, response.text
    return response.json()


def test_test_only_endpoint_no_keys_required_and_product_variants(client):
    html = client.get("/demo")
    assert html.status_code == 200
    assert "실험실" in html.text
    catalog = client.get("/demo/api/products")
    assert catalog.status_code == 200
    assert len(catalog.json()["products"]) >= 4
    a = create(client, "wechat", "demo-skin-a")
    b = create(client, "wechat", "demo-skin-b")
    c = create(client, "alipay", "demo-cosmetics")
    assert len({a["id"], b["id"], c["id"]}) == 3
    assert a["counselor_id"] == b["counselor_id"]
    assert a["item_id"] != b["item_id"]
    assert a["status"] == "requested"
    assert a["room_id"] is None and a["booking_confirmed"] is False
    assert a["video_connected"] is False
    assert client.get("/demo/api/products/demo-skin-a").json()["product"]["id"] == "demo-skin-a"
    listing = client.get("/demo/api/consultations").json()["requests"]
    assert {r["platform"] for r in listing} == {"wechat", "alipay"}


def test_automatic_room_assignment_and_close(client):
    request = create(client)
    rid = request["id"]
    assert client.get(f"/demo/rooms/{rid}").status_code == 404
    assigned = assign(client, rid)
    room = assigned["room_id"]
    assert re.fullmatch(r"[0-9a-f-]{36}", room)
    assert assigned["status"] == "ready"
    assert assigned["customer_room_url"].endswith("?role=customer")
    assert assigned["counselor_room_url"].endswith("?role=counselor")
    assert client.get(assigned["customer_room_url"]).status_code == 200
    assert client.get(assigned["counselor_room_url"]).status_code == 200
    assert "RTCPeerConnection" in client.get(assigned["customer_room_url"]).text
    assert assign(client, rid)["room_id"] == room
    closed = client.post(f"/demo/api/consultations/{rid}/close").json()
    assert closed["status"] == "closed"
    assert closed["customer_room_url"] is None
    assert client.get(f"/demo/rooms/{room}").status_code == 404


def test_websocket_signaling_two_real_participant_connections(client):
    request = create(client)
    room = assign(client, request["id"])["room_id"]
    customer = f"/demo/rooms/{room}/signal?role=customer"
    counselor = f"/demo/rooms/{room}/signal?role=counselor"
    with client.websocket_connect(customer) as a:
        arrived = a.receive_json()
        assert arrived["type"] == "joined"
        assert arrived["role"] == "customer"
        assert arrived["peer_present"] is False
        with client.websocket_connect(counselor) as b:
            arrived2 = b.receive_json()
            assert arrived2["type"] == "joined"
            assert arrived2["peer_present"] is True
            assert a.receive_json()["type"] == "peer-joined"
            a.send_json({"type": "ready"})
            assert b.receive_json()["type"] == "peer-ready"
            b.send_json({"type": "ready"})
            assert a.receive_json()["type"] == "peer-ready"
            b.send_json({"type": "signal", "data": {
                "description": {"type": "offer", "sdp": "v=0"}
            }})
            received = a.receive_json()
            assert received["type"] == "signal"
            assert received["data"]["description"]["type"] == "offer"
            a.send_json({"type": "signal", "data": {
                "description": {"type": "answer", "sdp": "v=0"}
            }})
            assert b.receive_json()["data"]["description"]["type"] == "answer"
        assert a.receive_json()["type"] == "peer-left"


def test_no_production_mode_and_bad_requests():
    app = create_app(db_url="sqlite:///:memory:", app_env="development")
    with TestClient(app) as client:
        assert client.get("/demo").status_code == 404
        assert client.get("/demo/api/products").status_code == 404
    with TestClient(create_app(db_url="sqlite:///:memory:", app_env="demo")) as client:
        assert client.post("/demo/api/consultations", json={
            "platform": "web", "item_id": "demo-skin-a"
        }).status_code == 422
        assert client.post("/demo/api/consultations", json={
            "platform": "wechat", "item_id": "not-a-demo-product"
        }).status_code == 422
        assert client.get("/demo/rooms/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee").status_code == 404
        assert client.post("/demo/api/consultations/not-a-uuid/assign").status_code == 404


def test_closing_room_notifies_current_video_participant(client):
    request = create(client, "wechat", "demo-skin-a")
    room = assign(client, request["id"])["room_id"]
    url = f"/demo/rooms/{room}/signal?role=customer"
    with client.websocket_connect(url) as socket:
        assert socket.receive_json()["type"] == "joined"
        response = client.post(f"/demo/api/consultations/{request['id']}/close")
        assert response.status_code == 200
        assert socket.receive_json()["type"] == "closed"
    assert client.get(f"/demo/rooms/{room}").status_code == 404
