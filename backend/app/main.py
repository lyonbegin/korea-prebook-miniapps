"""Korea Prebook: pre-arrival reservation and shopping inquiry API.

No live inventory, booking confirmation, payment collection, hospital referral,
or parcel handoff is performed by this prototype.
"""
from __future__ import annotations

import os
import uuid
from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import DateTime, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool

ServiceKind = Literal[
    "motel_early_checkin",
    "clinic_visit",
    "korea_online_shopping",
    "airport_goods_handoff",
    "airport_luggage_delivery",
]
Platform = Literal["wechat", "alipay", "web_preview"]

CATALOG = [
    {"kind": "motel_early_checkin", "name_ko": "모텔 얼리 체크인", "name_zh": "韩国汽车旅馆提前入住", "mode": "advance_reservation"},
    {"kind": "clinic_visit", "name_ko": "한국 의원 방문", "name_zh": "韩国诊所预约", "mode": "advance_reservation"},
    {"kind": "korea_online_shopping", "name_ko": "한국 온라인 사전구매", "name_zh": "韩国网购预购", "mode": "advance_purchase_inquiry"},
    {"kind": "airport_goods_handoff", "name_ko": "출국일 상품 공항수령", "name_zh": "离境时机场取货", "mode": "advance_reservation"},
    {"kind": "airport_luggage_delivery", "name_ko": "숙소→공항 캐리어 배송", "name_zh": "酒店至机场行李配送", "mode": "advance_reservation"},
]


class Base(DeclarativeBase):
    pass


class InquiryRow(Base):
    __tablename__ = "korea_prebook_inquiries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    customer_ref: Mapped[str] = mapped_column(String(80), nullable=False)
    platform: Mapped[str] = mapped_column(String(24), nullable=False)
    service_kind: Mapped[str] = mapped_column(String(48), nullable=False)
    arrival_date: Mapped[str] = mapped_column(String(10), nullable=False)
    departure_date: Mapped[str] = mapped_column(String(10), nullable=False)
    lodging_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    requested_checkin_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="inquiry_received")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class InquiryIn(BaseModel):
    customer_ref: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.:-]+$")
    platform: Platform
    service_kind: ServiceKind
    arrival_date: date
    departure_date: date
    lodging_name: str | None = Field(default=None, max_length=120)
    requested_checkin_time: time | None = None
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def validate_dates_and_delivery(self):
        if self.departure_date < self.arrival_date:
            raise ValueError("departure_date must not precede arrival_date")
        if self.service_kind == "korea_online_shopping" and not self.lodging_name:
            raise ValueError("lodging_name is required for lodging delivery")
        if self.requested_checkin_time and self.service_kind != "motel_early_checkin":
            raise ValueError("requested_checkin_time is only for motel_early_checkin")
        return self


class InquiryOut(BaseModel):
    inquiry_id: str
    status: str
    booking_confirmed: bool = False
    payment_collected: bool = False


def create_app(
    db_url: str | None = None,
    demo_key: str | None = None,
    app_env: str | None = None,
) -> FastAPI:
    environment = (app_env or os.getenv("APP_ENV") or "development").lower()
    url = db_url or os.getenv("DATABASE_URL") or "sqlite:///./korea_prebook_demo.db"
    key = demo_key if demo_key is not None else os.getenv("DEMO_WRITE_KEY", "")
    if environment == "production" and url.startswith("sqlite"):
        raise RuntimeError("Production requires managed PostgreSQL DATABASE_URL")

    options = (
        {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
        if url == "sqlite:///:memory:"
        else ({"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {})
    )
    engine = create_engine(url, **options)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(engine, expire_on_commit=False)

    app = FastAPI(
        title="Korea Prebook API", version="0.1.0",
        description="Prototype inquiry API only. Not an official reservation/payment service.",
    )

    def require_demo_key(x_demo_key: str | None = Header(default=None)):
        if environment == "production":
            raise HTTPException(status_code=503, detail="Production identity verification is not configured")
        if not key or x_demo_key != key:
            raise HTTPException(status_code=403, detail="Demo API key required")

    @app.get("/health")
    def health():
        return {"ok": True, "environment": environment, "transaction_mode": "disabled"}

    @app.get("/v1/catalog")
    def catalog():
        return {"services": CATALOG, "inventory_live": False, "payments_enabled": False}

    @app.post(
        "/v1/inquiries", response_model=InquiryOut, status_code=201,
        dependencies=[Depends(require_demo_key)],
    )
    def create_inquiry(data: InquiryIn):
        inquiry_id = str(uuid.uuid4())
        row = InquiryRow(
            id=inquiry_id, customer_ref=data.customer_ref, platform=data.platform,
            service_kind=data.service_kind, arrival_date=data.arrival_date.isoformat(),
            departure_date=data.departure_date.isoformat(), lodging_name=data.lodging_name,
            requested_checkin_time=(
                data.requested_checkin_time.strftime("%H:%M")
                if data.requested_checkin_time else None
            ),
            notes=data.notes, status="inquiry_received",
        )
        with session_factory() as session:
            session.add(row)
            session.commit()
        return InquiryOut(inquiry_id=inquiry_id, status=row.status)

    @app.get(
        "/v1/inquiries/{inquiry_id}", response_model=InquiryOut,
        dependencies=[Depends(require_demo_key)],
    )
    def get_inquiry(inquiry_id: str):
        with session_factory() as session:
            row = session.get(InquiryRow, inquiry_id)
            if not row:
                raise HTTPException(status_code=404, detail="Inquiry not found")
            return InquiryOut(inquiry_id=row.id, status=row.status)

    from app.manager import mount_manager
    mount_manager(app, engine, CATALOG)
    from app.sourcing import mount_sourcing
    mount_sourcing(app, engine)
    from app.ktaxback import mount_ktaxback
    mount_ktaxback(app, engine)
    from app.ktaxback_bootstrap import bootstrap
    bootstrap(engine)  # empty original-schema tables and 150 collection targets only
    from app.oliveyoung_refresh import mount_oliveyoung_refresh
    mount_oliveyoung_refresh(app, engine)
    from app.ktaxback_pilot import mount_pilot
    mount_pilot(app, engine)
    return app


app = create_app()
