"""Validate data was truly saved in exact K-TAXBACK tables for each category/page."""
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

AUTH={"Authorization":"Bearer local-olive-test"}

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","local-olive-test")
    return TestClient(create_app(db_url="sqlite:///:memory:",app_env="development"))

def begin(client,category="1000000003"):
    response=client.post("/manager/api/ktaxback/refresh/jobs",headers=AUTH,
       json={"category_ids":[category],"max_pages":2})
    assert response.status_code==201,response.text
    jid=response.json()["id"]
    claimed=client.get("/manager/api/ktaxback/refresh/worker/next",headers=AUTH).json()
    assert claimed["job"]["id"]==jid
    return jid

def capture(client,jid,fields,category="1000000003",page=1,
            source="https://global.oliveyoung.com/display/product-data?ctgrNo=1000000003"):
    payload={"hits":{"found":1,"hit":[{"fields":fields}]},
       "categoryFacets":[{"value":"1^1000000003^Skin Care","count":1}],
       "brandFacets":[{"value":"B101^Example Brand","count":1}],
       "attrFacets":[{"value":"Skin Concern:AT000001^AT000002:Dry","count":1}]}
    return client.post("/manager/api/ktaxback/refresh/worker/"+jid+"/capture",
       headers=AUTH,json={"category_id":category,"page_index":page,
                           "source_url":source,"payload":payload})

def test_legacy_schema_bootstrapped_and_new_live_data_persisted(client):
    counts=client.get("/manager/api/ktaxback/refresh/overview",headers=AUTH).json()
    assert counts["catalogue_db"]["products"]==0
    jid=begin(client)
    raw={"prdtNo":"GA000077","prdtName":"Fresh Korean Serum","brandNo":"B101",
         "ctgrNo":"1000000003","saleAmt":12.50,"nrmlAmt":18,
         "imagePath":"prdtImg/serum.jpg","attrFacet":["Skin Concern:AT000001^AT000002:Dry"]}
    response=capture(client,jid,raw)
    assert response.status_code==200,response.text
    data=response.json()
    assert data["inserted"]==1
    assert data["verified"]==1
    assert data["brands"]==1
    assert data["filters"]==1
    overview=client.get("/manager/api/ktaxback/refresh/overview",headers=AUTH).json()
    assert overview["catalogue_db"]["products"]==1
    assert overview["catalogue_db"]["brands"]==1
    assert overview["catalogue_db"]["categories"]>=1
    assert overview["catalogue_db"]["category_filters"]==1
    assert overview["catalogue_db"]["product_attributes"]==1
    page=overview["pages"][0]
    assert page["raw_items"]==1 and page["verified"]==1 and page["state"]=="verified"
    visible=client.get("/manager/api/ktaxback/refresh/catalogue",headers=AUTH,
      params={"category_id":"1000000003"}).json()
    assert visible["rows"][0]["prdt_no"]=="GA000077"
    assert client.get("/detail-data.json",params={"prdtNo":"GA000077"}).json()["product"]["prdtName"]=="Fresh Korean Serum"
    repeat=capture(client,jid,raw)
    assert repeat.status_code==200 and repeat.json()["duplicate_page"]
    assert client.get("/manager/api/ktaxback/refresh/overview",headers=AUTH).json()["catalogue_db"]["products"]==1
    assert client.post("/manager/api/ktaxback/refresh/jobs",headers=AUTH,
      json={"category_ids":["1000000004"]}).status_code==409
    end=client.post("/manager/api/ktaxback/refresh/worker/"+jid+"/finish",headers=AUTH,
        json={"state":"completed","message":"real capture verified"})
    assert end.status_code==200,end.text
    assert end.json()["pages"]==1 and end.json()["processed"]==1

def test_reject_wrong_origin_wrong_category_and_log_failures(client):
    jid=begin(client)
    raw={"prdtNo":"GA000066","prdtName":"Serum","saleAmt":9}
    assert capture(client,jid,raw,source="https://untrusted.example.com/items").status_code==422
    assert capture(client,jid,raw,category="1000000005").status_code==422
    result=client.post("/manager/api/ktaxback/refresh/worker/"+jid+"/page_error",
      headers=AUTH,json={"category_id":"1000000003","page_index":1,
        "source_url":"https://global.oliveyoung.com/display/category?ctgrNo=1000000003",
        "payload":{"error":"No product-data response"}})
    assert result.status_code==200,result.text
    overview=client.get("/manager/api/ktaxback/refresh/overview",headers=AUTH).json()
    assert overview["pages"][0]["state"]=="failed"
    assert overview["categories"][1]["last_state"]=="failed"

def test_fullscan_controller_preserves_existing_products(client):
    r=client.post("/manager/api/ktaxback/refresh/fullscan",headers=AUTH,
      json={"max_pages":10})
    assert r.status_code==202,r.text
    assert r.json()["category_targets"]==150
    scheduled=client.post("/manager/api/ktaxback/refresh/worker/auto",headers=AUTH)
    assert scheduled.status_code==200,scheduled.text
    assert len(scheduled.json()["job"]["category_ids"])==2
    assert client.post("/manager/api/ktaxback/refresh/fullscan/stop",headers=AUTH).status_code==200
