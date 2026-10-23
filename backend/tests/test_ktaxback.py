"""Original K-TAXBACK schema is created EMPTY and remains compatible with real
Olive Young captures; importing old DB is not a prerequisite."""
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.ktaxback_bootstrap import ORIGINAL_CATEGORIES,SCHEMA

AUTH={"Authorization":"Bearer local-ktaxback-test"}

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","local-ktaxback-test")
    return TestClient(create_app(db_url="sqlite:///:memory:",app_env="development"))

def post(client,table,rows):
    r=client.post("/manager/api/ktaxback/import/"+table,headers=AUTH,json={"rows":rows})
    assert r.status_code==200,r.text
    return r.json()

def test_original_schema_is_empty_and_available_without_legacy_database(client):
    counts=client.get("/manager/api/ktaxback/status",headers=AUTH).json()["counts"]
    for name in SCHEMA:
        assert name in counts
        assert counts[name]==0, (name,counts[name])
    assert len(ORIGINAL_CATEGORIES)==150
    assert client.get("/detail-data.json",params={"prdtNo":"GA000001"}).status_code==404
    overview=client.get("/manager/api/ktaxback/refresh/overview",headers=AUTH).json()
    assert overview["original_category_targets"]==150
    assert overview["catalogue_db"]["products"]==0

def test_original_product_fields_and_api_compatibility(client):
    post(client,"brands",[{"brand_no":"B1","brand_name":"Beauty Brand"}])
    post(client,"categories",[{"category_id":"1000000003","category_name":"Skincare","depth":1}])
    post(client,"products",[{"prdt_no":"GA000001","prdt_name":"Cream",
        "nrml_amt":20.0,"sale_amt":12.5,"brand_no":"B1",
        "category_id":"1000000003","best_yn":"Y","review_cnt":13}])
    post(client,"product_options",[{"option_id":1,"prdt_no":"GA000001","option_name":"50ml",
                                    "sale_amt":12.5,"in_stock":1,"is_default":1}])
    post(client,"product_images",[{"image_id":1,"prdt_no":"GA000001",
                                    "image_path":"prdtImg/sample.jpg",
                                    "image_type":"gallery","sort_order":0,"lang_code":"en"}])
    post(client,"product_details",[{"prdt_no":"GA000001","lang_code":"en",
        "why_we_love_it":"Sensitive skincare","how_to_use":"Apply"}])
    post(client,"product_translations",[{"prdt_no":"GA000001","lang_code":"zh_cn",
        "field_key":"detail-data.product.prdtNameEn","translated_text":"护肤霜"}])
    r=client.get("/detail-data.json",params={"prdtNo":"GA000001","lang":"zh_cn"})
    assert r.status_code==200,r.text
    data=r.json()["product"]
    assert data["prdtName"]=="护肤霜"
    assert data["optionList"][0]["snglOptnNameEn"]=="50ml"
    assert data["thumbnailList"][0]["imagePath"]=="prdtImg/sample.jpg"
    assert client.get("/details-info.json",params={"prdtNo":"GA000001"}).json()["details"]["howToUseText"]=="Apply"
    assert client.get("/brand-list.json").json()[0]["brandNo"]=="B1"
    assert client.get("/order-best.json").json()[0]["prdtNo"]=="GA000001"
    assert client.get("/oliveyoung_json_data/ctgr_1000000003/page_1.json").status_code==200
    post(client,"products",[{"prdt_no":"GA000001","prdt_name":"Cream updated","sale_amt":10.0}])
    assert client.get("/detail-data.json",params={"prdtNo":"GA000001"}).json()["product"]["saleAmt"]==10.0
    assert client.get("/manager/api/ktaxback/status",headers=AUTH).json()["counts"]["products"]==1

def test_auth_private_data_and_schema_guards(client):
    assert client.get("/manager/api/ktaxback/status").status_code==401
    assert client.post("/manager/api/ktaxback/schema",headers=AUTH,
      json={"name":"orders","columns":[{"name":"id","type":"INTEGER","pk":1}]}).status_code==404
    assert client.post("/manager/api/ktaxback/import/products",headers=AUTH,
      json={"rows":[{"prdt_no":"GA000002","user_password":"wrong"}]}).status_code==422
