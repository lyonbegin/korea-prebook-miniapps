import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.fixture
def cli(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "topsecret-local-test")
    app = create_app(db_url="sqlite:///:memory:", demo_key="demo", app_env="development")
    return TestClient(app)


HEAD = {"Authorization": "Bearer topsecret-local-test"}


def test_public_preview_and_protected_admin(cli):
    assert cli.get("/manager").status_code == 200
    assert cli.get("/manager/api/state").status_code == 401
    config = cli.get("/v1/channels/wechat/home").json()
    assert len(config["services"]) == 5
    assert config["payment_enabled"] is False


def test_channel_update_and_sourcing(cli):
    src = cli.post("/manager/api/source", headers=HEAD, json={
        "title_zh": "测试旅行商品", "category": "购物", "source_name": "touranal"
    })
    assert src.status_code == 200
    source_id = src.json()["id"]
    result = cli.put("/manager/api/channels/wechat", headers=HEAD, json={
        "title_zh": "新标题", "subtitle_zh": "出国旅行",
        "enabled_kinds": ["motel_early_checkin"], "source_ids": [source_id]
    })
    assert result.status_code == 200
    homepage = cli.get("/v1/channels/wechat/home").json()
    assert homepage["title_zh"] == "新标题"
    assert len(homepage["services"]) == 2
    assert cli.get("/v1/channels/alipay/home").json()["title_zh"] != "新标题"


def test_preview_jobs_and_upload_confirm(cli):
    assert cli.post("/manager/api/jobs", headers=HEAD, json={"channel": "wechat", "action": "upload"}).status_code == 422
    assert cli.post("/manager/api/jobs", headers=HEAD, json={"channel": "wechat", "action": "preview"}).status_code == 201
    job = cli.get("/manager/api/runner/next", headers=HEAD).json()
    assert job["channel"] == "wechat"
    assert cli.post("/manager/api/runner/"+job["id"], headers=HEAD, json={
        "status": "success", "log": "simulator rendered"
    }).status_code == 200
    assert cli.get("/manager/api/jobs", headers=HEAD).json()[0]["state"] == "success"


def test_unauthenticated_write_rejected(cli):
    assert cli.post("/manager/api/source",json={"title_zh":"ABC","category":"test"}).status_code == 401
    assert cli.put("/manager/api/channels/wechat",json={}).status_code == 401
