"""Original tour olive.py -> remote category capture -> product DB update regression."""
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

AUTH={"Authorization":"Bearer ktax-refresh-local"}

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN","ktax-refresh-local")
    return TestClient(create_app(db_url="sqlite:///:memory:",app_env="development"))

def register(cli,name,cols,pk):
    rows=[{"name":k,"type":typ,"notnull":0,"pk":pk.index(k)+1 if k in pk else 0}
          for k,typ in cols]
    r=cli.post("/manager/api/ktaxback/schema",headers=AUTH,json={"name":name,"columns":rows})
    assert r.status_code==200,r.text

def import_rows(cli,name,rows):
    r=cli.post("/manager/api/ktaxback/import/"+name,headers=AUTH,json={"rows":rows})
    assert r.status_code==200,r.text

def prepare(cli):
    register(cli,"products",[
        ("prdt_no","TEXT"),("prdt_name","TEXT"),("brand_no","TEXT"),
        ("category_id","TEXT"),("nrml_amt","REAL"),("sale_amt","REAL"),
        ("image_path","TEXT"),("review_cnt","INTEGER"),
    ],["prdt_no"])
    register(cli,"categories",[
        ("category_id","TEXT"),("category_name","TEXT")],["category_id"])
    import_rows(cli,"categories",[
        {"category_id":"1000000003","category_name":"Skin"},
        {"category_id":"1000000004","category_name":"Cream"},
    ])

def test_queue_capture_price_update_and_logs(client):
    prepare(client)
    r=client.post("/manager/api/ktaxback/refresh/jobs",json={"category_ids":["1000000003"],"max_pages":2})
    assert r.status_code==401
    r=client.post("/manager/api/ktaxback/refresh/jobs",headers=AUTH,
                  json={"category_ids":["1000000003"],"max_pages":2})
    assert r.status_code==201,r.text
    jid=r.json()["id"]
    assert client.post("/manager/api/ktaxback/refresh/jobs",headers=AUTH,
                       json={"category_ids":["1000000004"]}).status_code==409
    claimed=client.get("/manager/api/ktaxback/refresh/worker/next",headers=AUTH).json()["job"]
    assert claimed["id"]==jid
    payload={"hits":{"found":1,"hit":[{"fields":{
        "prdtNo":"ABC001","prdtName":"Olive Young Serum",
        "nrmlAmt":30,"saleAmt":25,"ctgrNo":"1000000003","imagePath":"/serum.jpg"
    }}]}}
    def capture(p):
        return client.post(f"/manager/api/ktaxback/refresh/worker/{jid}/capture",
            headers=AUTH,json={"category_id":"1000000003","page_index":1,
              "source_url":"https://global.oliveyoung.com/display/product-data?ctgrNo=1000000003",
              "payload":p})
    first=capture(payload)
    assert first.status_code==200,first.text
    assert first.json()["accepted"]==1
    price=payload["hits"]["hit"][0]["fields"]
    price["saleAmt"]=24
    second=capture(payload)
    assert second.status_code==200,second.text
    assert second.json()["changed_prices"]==1
    detail=client.get("/detail-data.json",params={"prdtNo":"ABC001"})
    assert detail.status_code==200,detail.text
    assert detail.json()["product"]["saleAmt"]==24
    finish=client.post(f"/manager/api/ktaxback/refresh/worker/{jid}/finish",
        headers=AUTH,json={"state":"completed","message":"2 pages collected"})
    assert finish.status_code==200,finish.text
    assert finish.json()["processed"]==2
    assert finish.json()["changed_prices"]==1
    jobs=client.get("/manager/api/ktaxback/refresh/jobs",headers=AUTH).json()["jobs"]
    assert jobs[0]["state"]=="completed"

def test_block_untrusted_source_and_missing_schema(client):
    assert client.post("/manager/api/ktaxback/refresh/jobs",headers=AUTH,json={}).status_code==409
    prepare(client)
    a=client.post("/manager/api/ktaxback/refresh/jobs",headers=AUTH,
                  json={"category_ids":["1000000003"]}).json()
    jid=a["id"]
    client.get("/manager/api/ktaxback/refresh/worker/next",headers=AUTH)
    bad=client.post(f"/manager/api/ktaxback/refresh/worker/{jid}/capture",
        headers=AUTH,json={"category_id":"1000000003","page_index":1,
                           "source_url":"https://evil.example.net/data",
                           "payload":{"hits":{"hit":[]}}})
    assert bad.status_code==422
    bad2=client.post(f"/manager/api/ktaxback/refresh/worker/{jid}/capture",
        headers=AUTH,json={"category_id":"1000000004","page_index":1,
                           "source_url":"https://global.oliveyoung.com/data",
                           "payload":{"hits":{"hit":[]}}})
    assert bad2.status_code==422
