"""Isolated, keyless functional demonstration of product-bound consultation and WebRTC signaling.

Registered ONLY when APP_ENV=demo. Not an authentication or medical service.
No patient info, phone numbers, notes, payment or real bookings are accepted.
"""
from __future__ import annotations

import asyncio
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

DEMO_PRODUCTS = [
    {"id": "demo-skin-a", "category": "skin", "name": "皮肤护理体验 A · 데모",
     "provider": "테스트 상품", "counselor_id": "counselor-demo-1", "price_krw": 80000},
    {"id": "demo-skin-b", "category": "skin", "name": "皮肤护理体验 B · 데모",
     "provider": "테스트 상품", "counselor_id": "counselor-demo-1", "price_krw": 120000},
    {"id": "demo-nail", "category": "nail", "name": "美甲咨询 · 데모",
     "provider": "테스트 상품", "counselor_id": "counselor-demo-2", "price_krw": 35000},
    {"id": "demo-cosmetics", "category": "cosmetics", "name": "韩国化妆品 · 데모",
     "provider": "테스트 상품", "counselor_id": "counselor-demo-3", "price_krw": 19000},
    {"id": "demo-guide", "category": "guide", "name": "旅游向导 · 데모",
     "provider": "테스트 상품", "counselor_id": "counselor-demo-4", "price_krw": None},
]
BY_ID = {p["id"]: p for p in DEMO_PRODUCTS}
UUID = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$")
MAX_SIGNAL = 24000


class DemoConsultationIn(BaseModel):
    platform: str = Field(pattern="^(wechat|alipay)$")
    item_id: str = Field(pattern="^demo-[a-z-]+$")
    desired_date: str = Field(default="", max_length=10)
    desired_time: str = Field(default="", max_length=5)


class DemoContext:
    def __init__(self):
        self.peers: dict[str, dict[str, dict]] = {}
        self.lock = asyncio.Lock()


def mount_functional_demo(app, engine):
    state = DemoContext()
    with engine.begin() as con:
        con.execute(text("""
            CREATE TABLE IF NOT EXISTS korea_prebook_functional_demo (
              id VARCHAR(36) PRIMARY KEY,
              platform VARCHAR(16) NOT NULL,
              item_id VARCHAR(48) NOT NULL,
              title VARCHAR(140) NOT NULL,
              counselor_id VARCHAR(120) NOT NULL,
              desired_date VARCHAR(10) NOT NULL,
              desired_time VARCHAR(5) NOT NULL,
              status VARCHAR(16) NOT NULL,
              room_id VARCHAR(36),
              created_at VARCHAR(50) NOT NULL
            )
        """))

    def get_record(request_id):
        if not UUID.fullmatch(request_id):
            raise HTTPException(404, "Demo consultation not found")
        with engine.connect() as con:
            row = con.execute(text(
                "SELECT * FROM korea_prebook_functional_demo WHERE id=:id"
            ), {"id": request_id}).mappings().first()
        if not row:
            raise HTTPException(404, "Demo consultation not found")
        return dict(row)

    def get_room(room_id):
        if not UUID.fullmatch(room_id):
            raise HTTPException(404, "Demo room not found")
        with engine.connect() as con:
            row = con.execute(text(
                "SELECT * FROM korea_prebook_functional_demo WHERE room_id=:room_id"
            ), {"room_id": room_id}).mappings().first()
        if not row or row["status"] != "ready":
            raise HTTPException(404, "Demo room not active")
        return dict(row)

    def respond(row):
        # No personal details: all demo data is openly observable.
        return {
            **row,
            "demo": True,
            "booking_confirmed": False,
            "video_connected": False,
            "customer_room_url": (
                f"/demo/rooms/{row['room_id']}?role=customer"
                if row["status"] == "ready" and row["room_id"] else None
            ),
            "counselor_room_url": (
                f"/demo/rooms/{row['room_id']}?role=counselor"
                if row["status"] == "ready" and row["room_id"] else None
            ),
        }

    @app.get("/demo", response_class=HTMLResponse, include_in_schema=False)
    def demo_index():
        return Path(__file__).with_name("functional_demo.html").read_text("utf-8")

    @app.get("/demo/api/products")
    def demo_products():
        return {"demo": True, "products": DEMO_PRODUCTS}

    @app.get("/demo/api/products/{item_id}")
    def demo_product(item_id: str):
        product = BY_ID.get(item_id)
        if not product:
            raise HTTPException(404, "Demo product not found")
        return {
            "product": {
                "id": product["id"], "name": product["name"], "brand": product["provider"],
                "price": product["price_krw"], "currency": "KRW", "image": "",
                "source": "cosmetics" if product["category"] == "cosmetics" else "offer",
                "counselorId": product["counselor_id"], "soldOut": False,
            },
            "images": [], "options": [], "description": {
                "summary": "데모 전용 가상 상품이며 실제 시술·예약이 아닙니다.",
                "ingredients": "", "howToUse": "",
            },
        }

    @app.get("/demo/api/consultations")
    def demo_requests():
        with engine.connect() as con:
            records = con.execute(text(
                "SELECT * FROM korea_prebook_functional_demo "
                "ORDER BY created_at DESC LIMIT 100"
            )).mappings().all()
        return {"demo": True, "requests": [respond(dict(r)) for r in records]}

    @app.post("/demo/api/consultations", status_code=201)
    def demo_request(data: DemoConsultationIn):
        product = BY_ID.get(data.item_id)
        if not product:
            raise HTTPException(404, "Demo product not found")
        now = datetime.now(timezone.utc).isoformat()
        rid = str(uuid.uuid4())
        row = {
            "id": rid, "platform": data.platform, "item_id": product["id"],
            "title": product["name"], "counselor_id": product["counselor_id"],
            "desired_date": data.desired_date, "desired_time": data.desired_time,
            "status": "requested", "room_id": None, "created_at": now,
        }
        with engine.begin() as con:
            con.execute(text(
                "INSERT INTO korea_prebook_functional_demo "
                "(id,platform,item_id,title,counselor_id,desired_date,desired_time,"
                "status,room_id,created_at) VALUES "
                "(:id,:platform,:item_id,:title,:counselor_id,:desired_date,:desired_time,"
                ":status,:room_id,:created_at)"
            ), row)
        return respond(row)

    @app.get("/demo/api/consultations/{request_id}")
    def demo_request_status(request_id: str):
        return respond(get_record(request_id))

    @app.post("/demo/api/consultations/{request_id}/assign")
    def demo_assign(request_id: str):
        get_record(request_id)
        new_room = str(uuid.uuid4())
        with engine.begin() as con:
            con.execute(text(
                "UPDATE korea_prebook_functional_demo SET status='ready',room_id=:room_id "
                "WHERE id=:id AND status='requested'"
            ), {"room_id": new_room, "id": request_id})
        updated = get_record(request_id)
        if updated["status"] != "ready":
            raise HTTPException(409, "Cannot assign an inactive demo consultation")
        return respond(updated)

    @app.post("/demo/api/consultations/{request_id}/close")
    def demo_close(request_id: str):
        current = get_record(request_id)
        with engine.begin() as con:
            con.execute(text(
                "UPDATE korea_prebook_functional_demo SET status='closed' "
                "WHERE id=:id"
            ), {"id": request_id})
        # A browser that is already connected will be disconnected on its next signal.
        return respond(get_record(request_id))

    @app.get("/demo/rooms/{room_id}", response_class=HTMLResponse, include_in_schema=False)
    def demo_video_room(room_id: str, role: str = "customer"):
        get_room(room_id)
        if role not in ("customer", "counselor"):
            raise HTTPException(404, "Role not supported")
        return Path(__file__).with_name("functional_demo_call.html").read_text("utf-8")

    @app.websocket("/demo/rooms/{room_id}/signal")
    async def demo_signal(ws: WebSocket, room_id: str):
        role = ws.query_params.get("role")
        if role not in ("customer", "counselor") or not UUID.fullmatch(room_id):
            await ws.close(code=1008)
            return
        try:
            get_room(room_id)
        except HTTPException:
            await ws.close(code=1008)
            return

        other_role = "counselor" if role == "customer" else "customer"
        async with state.lock:
            peers = state.peers.setdefault(room_id, {})
            if role in peers:
                await ws.close(code=1008)
                return
            await ws.accept()
            peer = {"ws": ws, "ready": False}
            peers[role] = peer
            other = peers.get(other_role)
            await ws.send_json({
                "type": "joined", "role": role,
                "peer_present": bool(other),
                "peer_ready": bool(other and other["ready"]),
            })
            if other:
                try:
                    await other["ws"].send_json({"type": "peer-joined"})
                except Exception:
                    pass

        try:
            while True:
                data = await ws.receive_json()
                if not isinstance(data, dict):
                    continue
                kind = data.get("type")
                if kind not in ("ready", "signal", "ping"):
                    continue
                if len(str(data)) > MAX_SIGNAL:
                    await ws.close(code=1009)
                    break
                try:
                    get_room(room_id)
                except HTTPException:
                    await ws.send_json({"type": "closed"})
                    break
                async with state.lock:
                    if kind == "ping":
                        await ws.send_json({"type": "pong"})
                        continue
                    peers = state.peers.get(room_id, {})
                    if peers.get(role) is not peer:
                        break
                    if kind == "ready":
                        peer["ready"] = True
                        message = {"type": "peer-ready"}
                    else:
                        signal = data.get("data")
                        if not isinstance(signal, dict) or not any(
                            k in signal for k in ("description", "candidate")
                        ):
                            continue
                        message = {"type": "signal", "data": signal}
                    recipient = peers.get(other_role)
                    if recipient:
                        try:
                            await recipient["ws"].send_json(message)
                        except Exception:
                            pass
        except (WebSocketDisconnect, RuntimeError, ValueError):
            pass
        finally:
            async with state.lock:
                peers = state.peers.get(room_id, {})
                if peers.get(role) is peer:
                    del peers[role]
                    recipient = peers.get(other_role)
                    if recipient:
                        try:
                            await recipient["ws"].send_json({"type": "peer-left"})
                        except Exception:
                            pass
                if not peers:
                    state.peers.pop(room_id, None)
