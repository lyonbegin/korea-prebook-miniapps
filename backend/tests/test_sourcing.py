import pytest
from fastapi.testclient import TestClient
from app.main import create_app

HEAD = {"Authorization": "Bearer prebook-local-test-only"}

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "prebook-local-test-only")
    return TestClient(create_app(db_url="sqlite:///:memory:", app_env="development"))

def test_sourcing_auth_and_legacy_video_sources_removed(client):
    assert client.get("/manager/api/sourcing/sources").status_code == 401
    sources = client.get("/manager/api/sourcing/sources", headers=HEAD).json()["sources"]
    available = {x["id"] for x in sources}
    assert "oliveyoung" in available
    assert not ({"rednote", "bilibili", "youtube"} & available)
    for legacy in ("rednote", "bilibili", "youtube"):
        assert client.post("/manager/api/sourcing/jobs", headers=HEAD,
                           json={"source":legacy,"query":"K-뷰티 스킨케어"}).status_code == 404

def test_sourcing_run_queue_result_review_and_channel_publish(client):
    connect = client.put("/manager/api/sourcing/sources/oliveyoung/connection", headers=HEAD,
                         json={"profile_id":"prof_1234567890"})
    assert connect.status_code == 200
    queued = client.post("/manager/api/sourcing/jobs", headers=HEAD,
                         json={"source":"oliveyoung","query":"K-뷰티 스킨케어","max_items":3})
    assert queued.status_code == 201
    jid = queued.json()["id"]
    again = client.post("/manager/api/sourcing/jobs", headers=HEAD,
                        json={"source":"oliveyoung","query":"K-뷰티 화장품"})
    assert again.status_code == 409
    pulled = client.get("/manager/api/sourcing/worker/next", headers=HEAD).json()["job"]
    assert pulled["id"] == jid
    assert pulled["profile_id"] == "prof_1234567890"
    pending = client.post("/manager/api/sourcing/worker/jobs/"+jid, headers=HEAD,
                          json={"state":"running","run_id":"run_fake","message":"started"})
    assert pending.status_code == 200
    active = client.get("/manager/api/sourcing/worker/active", headers=HEAD).json()["jobs"]
    assert any(x["id"] == jid for x in active)
    result = client.post("/manager/api/sourcing/worker/jobs/"+jid, headers=HEAD,
                         json={"state":"completed","run_id":"run_fake",
                               "result":{"items":[
                                 {"title":"한국 스킨케어 세럼","url":"https://example.com/item1","price":"1000 KRW"},
                                 {"title":"Bad missing link","url":"not a valid address"}]},
                               "message":"finished"})
    assert result.status_code == 200
    detail = client.get("/manager/api/sourcing/jobs/"+jid,headers=HEAD).json()
    assert len(detail["items"]) == 1
    assert client.post("/manager/api/sourcing/jobs/"+jid+"/publish",json={"indices":[0]}).status_code == 401
    promoted = client.post("/manager/api/sourcing/jobs/"+jid+"/publish",headers=HEAD,
                           json={"indices":[0]})
    assert promoted.status_code == 200
    iid = promoted.json()["items"][0]["id"]
    assert client.post("/manager/api/sourcing/jobs/"+jid+"/publish",headers=HEAD,
                       json={"indices":[0]}).json()["items"][0]["status"] == "existing"
    state = client.get("/manager/api/state",headers=HEAD).json()
    assert any(x["id"] == iid for x in state["sources"])
    cfg = client.put("/manager/api/channels/wechat",headers=HEAD,json={
        "title_zh":"韩国美妆","subtitle_zh":"购物",
        "enabled_kinds":["motel_early_checkin"],"source_ids":[iid]
    })
    assert cfg.status_code == 200
    public = client.get("/v1/channels/wechat/home").json()
    assert any(x["kind"] == "source_" + iid for x in public["services"])
    assert client.get("/v1/channels/alipay/home").json()["services"][0]["kind"] == "motel_early_checkin"

def test_invalid_source_and_profile(client):
    assert client.put("/manager/api/sourcing/sources/oliveyoung/connection",headers=HEAD,
                      json={"profile_id":"../../secrets"}).status_code == 422
    assert client.post("/manager/api/sourcing/jobs",headers=HEAD,
                       json={"source":"unknown","query":"test"}).status_code == 404
    assert client.post("/manager/api/sourcing/jobs",headers=HEAD,
                       json={"source":"klook","query":"a"}).status_code == 422
