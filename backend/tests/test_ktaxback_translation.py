"""Original K-TAXBACK translation capture: only paired actual Olive Young responses enter DB."""
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

AUTH={"Authorization":"Bearer local-test"}
SOURCE="https://translation.oliveyoung.com/public/translate-texts"
FIELD="detail-data.product.prdtNameEn"

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","local-test")
    return TestClient(create_app(db_url="sqlite:///:memory:",app_env="development"))

def prepare(client):
    response=client.post("/manager/api/ktaxback/import/categories",headers=AUTH,
        json={"rows":[{"category_id":"1000000008","category_name":"Skincare","depth":1}]})
    assert response.status_code==200,response.text
    response=client.post("/manager/api/ktaxback/import/products",headers=AUTH,
        json={"rows":[{"prdt_no":"GA10001","prdt_name":"Hydrating Cream",
          "category_id":"1000000008","sale_amt":20,"nrml_amt":30}]})
    assert response.status_code==200,response.text

def payload(lang="zh_cn",target="zh",source="Hydrating Cream",answer="保湿霜",status=200):
    return {"lang_code":lang,"source_url":SOURCE,
        "response_status":status,
        "request_payload":{"source_language":"en","target_language":target,"texts":[source]},
        "response_payload":{"translations":[{"text":answer}]},
        "assignments":[{"prdt_no":"GA10001","field_key":FIELD,"source_text":source}]}

def test_real_source_pair_saved_with_readback_and_original_format(client):
    prepare(client)
    r=client.post("/manager/api/ktaxback/translation/capture",json=payload())
    assert r.status_code==401
    r=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=payload())
    assert r.status_code==200,r.text
    assert r.json()["db_verified"]==1
    detail=client.get("/detail-data.json",params={"prdtNo":"GA10001","lang":"zh_cn"})
    assert detail.status_code==200,detail.text
    assert detail.json()["product"]["prdtName"]=="保湿霜"
    from sqlalchemy import create_engine, text
    # Dedicated original product_names_i18n is also populated by the same
    # validated HTTP translation transaction; query via the public manager
    # count rather than silently assuming a translated product name.
    counts=client.get("/v1/ktaxback/pilot/summary").json()["table_counts"]
    assert counts["product_names_i18n"]==1
    summary=client.get("/manager/api/ktaxback/translation/status",headers=AUTH).json()
    assert summary["persisted_rows_by_language"]==[{"lang_code":"zh_cn","rows":1}]
    assert summary["events"][0]["verified"]==1
    r=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=payload())
    assert r.json()["db_verified"]==1
    assert client.get("/manager/api/ktaxback/translation/status",headers=AUTH).json()["persisted_rows_by_language"][0]["rows"]==1

def test_language_not_translated_and_rejected_source_do_not_pollute_db(client):
    prepare(client)
    r=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,
        json=payload(answer="Hydrating Cream"))
    assert r.status_code==200 and r.json()["db_verified"]==0
    assert r.json()["rejection_reasons"]["unchanged_or_wrong_script"]==1
    assert client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,
        json=payload(lang="vi_vn",target="vi")).status_code==422
    x=payload();x["source_url"]="https://untrusted.example.com/public/translate-texts"
    assert client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=x).status_code==422
    x=payload();x["request_payload"]["target_language"]="vi"
    assert client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=x).status_code==422
    x=payload();x["response_status"]=403
    r=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=x)
    assert r.status_code==200 and r.json()["db_inserted"]==0
    assert client.get("/manager/api/ktaxback/translation/status",headers=AUTH).json()["persisted_rows_by_language"]==[]

def test_original_translation_rejection_is_audited_and_locale_data_is_not_overwritten(client):
    prepare(client)
    # Japanese source API 200 can still return the unchanged source string.
    bad=payload(lang="jp",target="ja",answer="Hydrating Cream")
    result=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=bad)
    assert result.status_code==200,result.text
    assert result.json()["db_inserted"]==0
    assert result.json()["rejection_reasons"]["unchanged_or_wrong_script"]==1
    assert "unchanged_or_wrong_script=1" in result.json()["error"]
    good=payload(lang="jp",target="ja",answer="保湿クリーム")
    result=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=good)
    assert result.status_code==200,result.text
    assert result.json()["db_verified"]==1
    # Wrong original source cannot silently overwrite the verified translation.
    mismatch=payload(lang="jp",target="ja",source="Wrong product",answer="間違った商品")
    result=client.post("/manager/api/ktaxback/translation/capture",headers=AUTH,json=mismatch)
    assert result.status_code==200,result.text
    assert result.json()["rejection_reasons"]["source_mismatch"]==1
    assert client.get("/detail-data.json",params={"prdtNo":"GA10001","lang":"jp"}).json()["product"]["prdtName"]=="保湿クリーム"
