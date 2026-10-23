import pytest
from fastapi.testclient import TestClient
from app.main import create_app

AUTH={"Authorization":"Bearer unit-only-ktaxback"}

def schema(name, names, key):
    return {
        "name":name,
        "columns":[{"name":k,"type":typ,"notnull":0,"pk":key.index(k)+1 if k in key else 0}
                   for k,typ in names]
    }

@pytest.fixture()
def cli(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","unit-only-ktaxback")
    return TestClient(create_app(db_url="sqlite:///:memory:",app_env="development"))

def register(cli,name,columns,pk):
    result=cli.post("/manager/api/ktaxback/schema",headers=AUTH,json=schema(name,columns,pk))
    assert result.status_code==200,result.text

def load(cli,name,rows):
    result=cli.post("/manager/api/ktaxback/import/"+name,headers=AUTH,json={"rows":rows})
    assert result.status_code==200,result.text

def test_import_auth_schema_and_legacy_compatibility(cli):
    assert cli.get("/manager/api/ktaxback/status").status_code==401
    assert cli.get("/detail-data.json",params={"prdtNo":"GA123"}).status_code==503
    register(cli,"brands",[("brand_no","TEXT"),("brand_name","TEXT"),("kor_brand_name","TEXT")],["brand_no"])
    register(cli,"categories",[("category_id","TEXT"),("category_name","TEXT"),("parent_id","TEXT"),("depth","INTEGER"),("product_count","INTEGER")],["category_id"])
    register(cli,"products",[
        ("prdt_no","TEXT"),("brand_no","TEXT"),("category_id","TEXT"),("prdt_name","TEXT"),
        ("prdt_name_kor","TEXT"),("nrml_amt","REAL"),("sale_amt","REAL"),
        ("image_path","TEXT"),("best_yn","TEXT"),("review_cnt","INTEGER"),
    ],["prdt_no"])
    register(cli,"product_options",[("option_id","INTEGER"),("prdt_no","TEXT"),("option_name","TEXT"),("sale_amt","REAL"),("in_stock","INTEGER"),("is_default","INTEGER")],["option_id"])
    register(cli,"product_images",[("image_id","INTEGER"),("prdt_no","TEXT"),("image_path","TEXT"),("image_type","TEXT"),("sort_order","INTEGER"),("lang_code","TEXT")],["image_id"])
    register(cli,"product_details",[("prdt_no","TEXT"),("lang_code","TEXT"),("why_we_love_it","TEXT"),("featured_ingredients","TEXT"),("how_to_use","TEXT")],["prdt_no","lang_code"])
    register(cli,"product_translations",[("prdt_no","TEXT"),("lang_code","TEXT"),("field_key","TEXT"),("translated_text","TEXT")],["prdt_no","lang_code","field_key"])
    register(cli,"category_filters",[("filter_id","INTEGER"),("category_id","TEXT"),("filter_group","TEXT"),("option_name","TEXT"),("option_count","INTEGER")],["filter_id"])
    register(cli,"product_attributes",[("prdt_no","TEXT"),("attr_name","TEXT")],["prdt_no","attr_name"])

    load(cli,"brands",[{"brand_no":"B1","brand_name":"Test K-Beauty","kor_brand_name":"테스트 뷰티"}])
    load(cli,"categories",[{"category_id":"C1","category_name":"Skincare","parent_id":None,"depth":1,"product_count":1}])
    load(cli,"products",[{
        "prdt_no":"GA123","brand_no":"B1","category_id":"C1","prdt_name":"Cleanser",
        "nrml_amt":25.0,"sale_amt":19.99,"image_path":"prd/test.jpg","best_yn":"Y","review_cnt":100
    }])
    load(cli,"product_options",[{"option_id":1,"prdt_no":"GA123","option_name":"200ml","sale_amt":19.99,"in_stock":1,"is_default":1}])
    load(cli,"product_images",[{"image_id":1,"prdt_no":"GA123","image_path":"prd/gallery.jpg","image_type":"gallery","sort_order":0,"lang_code":"en"}])
    load(cli,"product_details",[{"prdt_no":"GA123","lang_code":"en","why_we_love_it":"Sensitive skin","featured_ingredients":"Ceramide","how_to_use":"Apply"}])
    load(cli,"product_translations",[{"prdt_no":"GA123","lang_code":"zh_cn","field_key":"detail-data.product.prdtNameEn","translated_text":"洁面产品"}])
    load(cli,"category_filters",[{"filter_id":1,"category_id":"C1","filter_group":"Skin concern","option_name":"Dry","option_count":1}])
    load(cli,"product_attributes",[{"prdt_no":"GA123","attr_name":"Dry"}])

    detail=cli.get("/detail-data.json",params={"prdtNo":"GA123","lang":"zh_cn"})
    assert detail.status_code==200,detail.text
    prod=detail.json()["product"]
    assert prod["prdtName"]=="洁面产品"
    assert prod["brandName"]=="Test K-Beauty"
    assert prod["optionList"][0]["snglOptnNameEn"]=="200ml"
    assert prod["thumbnailList"][0]["imagePath"]=="prd/gallery.jpg"
    assert cli.get("/details-info.json",params={"prdtNo":"GA123"}).json()["details"]["howToUseText"]=="Apply"
    assert cli.get("/brand-list.json").json()[0]["brandNo"]=="B1"
    assert cli.get("/order-best.json").json()[0]["prdtNo"]=="GA123"
    cat=cli.get("/oliveyoung_json_data/ctgr_C1/page_1.json")
    assert cat.status_code==200,cat.text
    assert cat.json()["hits"]["hit"][0]["fields"]["attrValList"]==["Dry"]
    assert cli.get("/oliveyoung_json_data/ctgr_C1/page_2.json").status_code==404
    assert cli.get("/FINAL_category_with_real_filters.json").json()[0]["categoryName"]=="Skincare"

    # Re-import updates by primary key rather than duplicating catalog records.
    load(cli,"products",[{"prdt_no":"GA123","brand_no":"B1","category_id":"C1",
                           "prdt_name":"Cleanser updated","nrml_amt":25.0,"sale_amt":18.5}])
    assert cli.get("/detail-data.json",params={"prdtNo":"GA123"}).json()["product"]["saleAmt"]==18.5
    status=cli.get("/manager/api/ktaxback/status",headers=AUTH).json()
    assert status["counts"]["products"]==1

def test_catalog_import_rejects_private_tables_and_invalid_fields(cli):
    assert cli.post("/manager/api/ktaxback/schema",headers=AUTH,
                    json=schema("orders",[("id","INTEGER")],["id"])).status_code==404
    assert cli.post("/manager/api/ktaxback/schema",headers=AUTH,
                    json=schema("products",[("id;DROP","TEXT")],["id;DROP"])).status_code==422
    register(cli,"products",[("prdt_no","TEXT"),("prdt_name","TEXT")],["prdt_no"])
    assert cli.post("/manager/api/ktaxback/import/products",
                    json={"rows":[{"prdt_no":"T1","prdt_name":"X"}]}).status_code==401
    assert cli.post("/manager/api/ktaxback/import/products",headers=AUTH,
                    json={"rows":[{"prdt_no":"T1","prdt_name":"X","user_id":1}]}).status_code==422
