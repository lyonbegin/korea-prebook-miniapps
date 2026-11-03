import os
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from app.offers import mount_offers

def test_marketing_variants_and_category_layer(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","test-secret")
    engine = create_engine("sqlite:///:memory:",connect_args={"check_same_thread":False},poolclass=StaticPool)
    app=FastAPI()
    mount_offers(app,engine)
    client=TestClient(app)
    categories=client.get("/v1/offers/categories").json()["categories"]
    assert len(categories)==19
    assert len({x["level"] for x in categories})==1
    assert "guide" in {x["id"] for x in categories}
    assert "cosmetics" in {x["id"] for x in categories}
    assert "taxi" not in {x["id"] for x in categories}
    body={"category_id":"botox","treatment_key":"botox-main",
          "title_zh":"首诊活动方案","summary_zh":"按需要咨询",
          "counselor_id":"counselor-1","status":"published"}
    headers={"Authorization":"Bearer test-secret"}
    one=client.post("/manager/api/offers",json=body,headers=headers)
    assert one.status_code==201
    other=client.post("/manager/api/offers",json={**body,"title_zh":"不同宣传方案"},headers=headers)
    assert other.status_code==201
    assert one.json()["id"] != other.json()["id"]
    cards=client.get("/v1/offers?category_id=botox").json()["offers"]
    assert len(cards)==2
    offer=client.get("/v1/offers/"+one.json()["id"]).json()["product"]
    assert offer["counselorId"]=="counselor-1"
    assert offer["treatmentKey"]=="botox-main"
    assert client.get("/v1/offers/categories").status_code==200
    assert client.post("/manager/api/offers",json=body).status_code==401
    assert client.post("/manager/api/offers",json={**body,"category_id":"taxi"},headers=headers).status_code==422
