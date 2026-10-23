"""WeChat/Alipay K-TAXBACK native shopping contracts over original schema."""
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

AUTH={"Authorization":"Bearer test-manager-token"}

@pytest.fixture()
def cli(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","test-manager-token")
    app=create_app(db_url="sqlite:///:memory:",app_env="development")
    return TestClient(app)

def seed(cli,table,rows):
    r=cli.post("/manager/api/ktaxback/import/"+table,headers=AUTH,json={"rows":rows})
    assert r.status_code==200,r.text

def fixture_catalog(cli):
    seed(cli,"brands",[{"brand_no":"B01","brand_name":"Test Beauty"}])
    seed(cli,"categories",[{"category_id":"1000000008","category_name":"Skincare","depth":1}])
    seed(cli,"products",[
        {"prdt_no":"GA12345","prdt_name":"Original Serum","brand_no":"B01",
         "category_id":"1000000008","sale_amt":18,"nrml_amt":30,"best_yn":"Y",
         "review_cnt":100,"image_path":"prdtImg/catalog.jpg"},
        {"prdt_no":"GA54321","prdt_name":"Another Cream","brand_no":"B01",
         "category_id":"1000000008","sale_amt":8,"nrml_amt":10,"new_yn":"Y",
         "image_path":"prdtImg/cream.jpg"},
    ])
    seed(cli,"product_names_i18n",[{
        "prdt_no":"GA12345","lang_code":"zh_cn","prdt_name":"精华液"}])
    seed(cli,"product_options",[{
        "prdt_no":"GA12345","option_name":"50ml","sale_amt":18,
        "in_stock":1,"is_default":1}])
    seed(cli,"product_images",[{
        "prdt_no":"GA12345","lang_code":"en","image_type":"gallery",
        "image_path":"prdtImg/gallery.jpg","sort_order":0}])
    seed(cli,"product_details",[{
        "prdt_no":"GA12345","lang_code":"en","why_we_love_it":"Feels light",
        "featured_ingredients":"Ceramide","how_to_use":"Apply in morning"}])
    seed(cli,"product_translations",[{
        "prdt_no":"GA12345","lang_code":"zh_cn",
        "field_key":"details-info.details.howToUseText",
        "source_text":"Apply in morning","translated_text":"早晨使用"}])

def test_native_home_translated_source_and_category_list(cli):
    fixture_catalog(cli)
    r=cli.get("/v1/ktaxback/miniapp/home",params={"lang":"zh_cn"})
    assert r.status_code==200,r.text
    js=r.json()
    assert js["brand"]=="K-TAXBACK" and js["checkoutAvailable"] is False
    assert js["total"]==2
    assert js["products"][0]["name"]=="精华液"
    assert js["products"][0]["image"]=="https://cdn-image.oliveyoung.com/prdtImg/catalog.jpg"
    assert js["products"][0]["currency"]=="USD"
    assert js["products"][0]["discount"]==40
    assert next(c for c in js["categories"] if c["id"]=="1000000008")["count"]==2
    q=cli.get("/v1/ktaxback/miniapp/products",params={
        "lang":"en","category":"1000000008","sort":"price_asc","size":1})
    assert q.status_code==200,q.text
    assert q.json()["products"][0]["id"]=="GA54321"
    assert q.json()["hasMore"] is True
    assert cli.get("/v1/ktaxback/miniapp/home",params={"lang":"vi_vn"}).status_code==422

def test_native_detail_options_images_and_multilingual_description(cli):
    fixture_catalog(cli)
    r=cli.get("/v1/ktaxback/miniapp/products/GA12345",params={"lang":"zh_cn"})
    assert r.status_code==200,r.text
    js=r.json()
    assert js["product"]["name"]=="精华液"
    assert js["images"]==["https://cdn-image.oliveyoung.com/prdtImg/gallery.jpg"]
    assert js["options"][0]["name"]=="50ml" and js["options"][0]["available"]
    assert js["description"]["howToUse"]=="早晨使用"
    assert js["checkoutAvailable"] is False
    assert cli.get("/v1/ktaxback/miniapp/products/does-not-exist").status_code==404

def test_native_search_and_bounds(cli):
    fixture_catalog(cli)
    data=cli.get("/v1/ktaxback/miniapp/products",params={
        "lang":"en","keyword":"SERUM","sort":"all"}).json()
    assert data["total"]==1 and data["products"][0]["id"]=="GA12345"
    assert cli.get("/v1/ktaxback/miniapp/products",params={"sort":"unknown"}).status_code==422
    assert cli.get("/v1/ktaxback/miniapp/products",params={"size":500}).status_code==422
