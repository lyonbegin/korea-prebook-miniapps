"""KOREA-PREBOOK unified, first-level marketplace category and marketing-offer API.

A marketing offer is not a medical procedure master record: multiple offers can
share treatment_key and counselor_id while retaining separate independent IDs.
No fabricated providers, consultation sessions, prices or bookings are seeded.
"""
from __future__ import annotations
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Literal
from fastapi import Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

CATEGORIES = (
    ("lifting","提升紧致","리프팅"),
    ("skin","皮肤治疗","피부 시술"),
    ("botox","肉毒素","보톡스"),
    ("filler","填充","필러"),
    ("rhinoplasty","鼻部整形","코성형"),
    ("eye","眼部整形","눈성형"),
    ("face_contour","面部轮廓","안면윤곽"),
    ("breast","胸部整形","가슴성형"),
    ("body","身体塑形","바디"),
    ("hair_treatment","植发与头皮","모발이식·두피"),
    ("hair_removal","脱毛","제모"),
    ("kmed","韩医","한방"),
    ("dental","牙科","치과"),
    ("others","其他项目","기타"),
    ("cosmetics","韩国美妆商品","화장품"),
    ("aesthetic","皮肤美容护理","에스테틱"),
    ("nail","美甲","네일"),
    ("hair_salon","美发造型","헤어·미용실"),
    ("guide","韩国旅游向导","관광 가이드")
)
CATEGORY_IDS = {row[0] for row in CATEGORIES}
CATEGORY_PUBLIC = [
    {"id": key, "name_zh": zh, "name_ko": ko, "level": 1}
    for key, zh, ko in CATEGORIES
]

class OfferInput(BaseModel):
    category_id: str = Field(max_length=48)
    treatment_key: str = Field(default="", max_length=80)
    title_zh: str = Field(min_length=1, max_length=140)
    summary_zh: str = Field(default="", max_length=2000)
    image_url: str = Field(default="", max_length=1000)
    provider_name: str = Field(default="", max_length=120)
    counselor_id: str = Field(min_length=1, max_length=120)
    price_krw: int | None = Field(default=None, ge=0)
    status: Literal["draft", "published"] = "draft"

def mount_offers(app, engine):
    with engine.begin() as con:
        con.execute(text("""
            CREATE TABLE IF NOT EXISTS korea_prebook_marketing_offers (
                id VARCHAR(36) PRIMARY KEY,
                category_id VARCHAR(48) NOT NULL,
                treatment_key VARCHAR(80) NOT NULL,
                title_zh VARCHAR(140) NOT NULL,
                summary_zh TEXT NOT NULL,
                image_url TEXT NOT NULL,
                provider_name VARCHAR(120) NOT NULL,
                counselor_id VARCHAR(120) NOT NULL,
                price_krw INTEGER NULL,
                status VARCHAR(16) NOT NULL,
                created_at VARCHAR(50) NOT NULL,
                updated_at VARCHAR(50) NOT NULL
            )
        """))

    admin_token = os.getenv("ADMIN_API_TOKEN", "").strip()

    def check_admin(authorization: str | None):
        if not admin_token or not authorization or not secrets.compare_digest(
            authorization, "Bearer " + admin_token
        ):
            raise HTTPException(401, "관리자 인증이 필요합니다")

    def validate(body: OfferInput):
        if body.category_id not in CATEGORY_IDS:
            raise HTTPException(422, "Unknown category")
        if body.category_id == "cosmetics":
            raise HTTPException(422, "Cosmetics use the existing K-TAXBACK product catalogue")
        if body.image_url and not body.image_url.startswith("https://"):
            raise HTTPException(422, "Only HTTPS image URLs are allowed")
        return body.model_dump()

    def public(row):
        return {
            "id": row["id"], "source": "offer",
            "category_id": row["category_id"],
            "name": row["title_zh"],
            "title_zh": row["title_zh"],
            "summary_zh": row["summary_zh"],
            "image": row["image_url"],
            "provider_name": row["provider_name"],
            "price_krw": row["price_krw"],
            "currency": "KRW",
            "status": row["status"],
        }

    @app.get("/v1/offers/categories")
    def offer_categories():
        return {"categories": CATEGORY_PUBLIC, "count": len(CATEGORY_PUBLIC)}

    @app.get("/v1/offers")
    def offer_list(category_id: str = Query("all", max_length=48),
                   q: str = Query("", max_length=100),
                   size: int = Query(40, ge=1, le=100)):
        if category_id != "all" and category_id not in CATEGORY_IDS:
            raise HTTPException(422, "Unknown category")
        params = {"size": size}
        cond = "WHERE status='published'"
        if category_id != "all":
            cond += " AND category_id=:category"
            params["category"] = category_id
        if q:
            cond += " AND (LOWER(title_zh) LIKE :term OR LOWER(summary_zh) LIKE :term)"
            params["term"] = "%" + q.strip().lower() + "%"
        with engine.connect() as con:
            rows = con.execute(text(
                "SELECT * FROM korea_prebook_marketing_offers " + cond +
                " ORDER BY updated_at DESC, id DESC LIMIT :size"
            ), params).mappings().all()
        return {"offers": [public(dict(r)) for r in rows], "category_id": category_id}

    @app.get("/v1/offers/{offer_id}")
    def offer_detail(offer_id: str):
        if not isinstance(offer_id, str) or len(offer_id) > 60:
            raise HTTPException(404, "Offer not found")
        with engine.connect() as con:
            row = con.execute(text(
                "SELECT * FROM korea_prebook_marketing_offers WHERE id=:id AND status='published'"
            ), {"id": offer_id}).mappings().first()
        if row is None:
            raise HTTPException(404, "Offer not found")
        r = dict(row)
        item = public(r)
        # Counselor assignment is intentionally server-owned, not chosen by the client.
        return {
            "product": {
                "id": item["id"], "name": item["name"], "brand": item["provider_name"],
                "image": item["image"], "categoryId": item["category_id"],
                "price": item["price_krw"], "currency": "KRW",
                "counselorId": r["counselor_id"], "treatmentKey": r["treatment_key"],
                "marketingOfferId": item["id"], "source": "offer", "soldOut": False
            },
            "images": [item["image"]] if item["image"] else [],
            "description": {
                "summary": item["summary_zh"], "ingredients": "", "howToUse": ""
            },
            "options": []
        }

    @app.post("/manager/api/offers", status_code=201)
    def create_offer(body: OfferInput, authorization: str | None = Header(default=None)):
        check_admin(authorization)
        values = validate(body)
        values["id"] = str(uuid.uuid4())
        values["created_at"] = values["updated_at"] = datetime.now(timezone.utc).isoformat()
        cols = list(values)
        with engine.begin() as con:
            con.execute(text(
                "INSERT INTO korea_prebook_marketing_offers (" + ",".join(cols) +
                ") VALUES (" + ",".join(":"+c for c in cols) + ")"
            ), values)
        return {"id": values["id"], "status": values["status"]}

    @app.put("/manager/api/offers/{offer_id}")
    def update_offer(offer_id: str, body: OfferInput,
                     authorization: str | None = Header(default=None)):
        check_admin(authorization)
        values = validate(body)
        values["id"] = offer_id
        values["updated_at"] = datetime.now(timezone.utc).isoformat()
        with engine.begin() as con:
            result = con.execute(text(
                "UPDATE korea_prebook_marketing_offers SET " +
                ",".join(k+"=:"+k for k in values if k!="id") + " WHERE id=:id"
            ), values)
            if not result.rowcount:
                raise HTTPException(404, "Offer not found")
        return {"id": offer_id, "status": values["status"]}

    @app.get("/manager/api/offers")
    def admin_offers(authorization: str | None = Header(default=None)):
        check_admin(authorization)
        with engine.connect() as con:
            rows = con.execute(text(
                "SELECT * FROM korea_prebook_marketing_offers ORDER BY updated_at DESC LIMIT 500"
            )).mappings().all()
        return {"offers": [dict(r) for r in rows]}
