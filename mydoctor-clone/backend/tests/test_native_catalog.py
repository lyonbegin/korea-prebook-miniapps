"""Native APK public API safety + DB-first ordering regression tests.
Run: cd mydoctor-clone/backend && python -m unittest discover -s tests -p 'test_native_catalog.py'
"""
import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import BackgroundTasks
from starlette.datastructures import QueryParams
from app.native_catalog import (
    NATIVE_RESOURCES, sanitize_public_json, safe_parameters,
    get_native_public_catalog, public_inventory,
)


class FakePool:
    def __init__(self, found=None):
        self.found = found
        self.queries = []
        self.writes = []

    async def fetchrow(self, sql, key):
        self.queries.append((sql, key))
        return self.found

    async def execute(self, sql, *args):
        self.writes.append(args)


class FakeHTTPResponse:
    def __init__(self, status=200, data=None, headers=None):
        self.status_code = status
        self.headers = {"content-type": "application/json", **(headers or {})}
        self.content = json.dumps(data or {"data": [{"name": "확인된 공개 항목", "price": 9000}]}, ensure_ascii=False).encode()

    def json(self):
        return json.loads(self.content)


class FakeClient:
    def __init__(self, response):
        self.response = response
        self.seen = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def get(self, url, headers):
        self.seen.append((url, headers))
        return self.response


def req(pool, query="", headers=None):
    return SimpleNamespace(
        app=SimpleNamespace(state=SimpleNamespace(pool=pool)),
        query_params=QueryParams(query),
        headers=headers or {},
    )


class NativeCatalogTest(unittest.TestCase):
    def test_static_xapk_paths_not_mistaken_for_validated_schema(self):
        inv = public_inventory()
        self.assertEqual(inv["evidence"], "static_path_only")
        self.assertEqual(len(NATIVE_RESOURCES), 15)
        self.assertTrue(all(x["method"] == "GET_UNVERIFIED" for x in inv["resources"]))

    def test_no_freeform_proxy_or_private_query_parameters(self):
        self.assertEqual(safe_parameters("home-menu", QueryParams("")), "")
        self.assertEqual(safe_parameters("home-banner", QueryParams("expose_place=home")), "expose_place=home")
        self.assertEqual(safe_parameters("lowest-price-categories", QueryParams("vertical_key=mounjaro")), "vertical_key=mounjaro")
        self.assertEqual(safe_parameters("lowest-price", QueryParams("category_id=12&variant=district")), "category_id=12&variant=district")
        with self.assertRaises(Exception):
            safe_parameters("patient-api/user/me", QueryParams(""))
        with self.assertRaises(Exception):
            safe_parameters("doctor-list", QueryParams("access_token=private"))
        with self.assertRaises(Exception):
            safe_parameters("doctor-list", QueryParams("limit=500"))

    def test_private_fields_are_redacted_before_cache_or_browser(self):
        src={"data":[{"name":"공개 병원", "patientName":"개인 환자",
                      "patient_id":3, "userId":"123", "accessToken":"secret",
                      "address":"서울", "price":5000, "doctorName":"홍길동"}]}
        clean=sanitize_public_json(src)["data"][0]
        self.assertEqual(clean["name"], "공개 병원")
        self.assertEqual(clean["address"], "서울")
        self.assertNotIn("patientName", clean)
        self.assertNotIn("patient_id", clean)
        self.assertNotIn("accessToken", clean)
        self.assertNotIn("userId", clean)
        self.assertEqual(clean["price"], 5000)

    def test_anonymous_cache_hit_never_calls_original(self):
        pool=FakePool(found={"response_json":{"data":[{"name":"DB 공개 병원"}]}})
        task=BackgroundTasks()
        result=asyncio.run(get_native_public_catalog(req(pool),task,"hospital-list"))
        body=json.loads(result.body)
        self.assertEqual(body["cache"],"HIT")
        self.assertEqual(body["data"]["data"][0]["name"],"DB 공개 병원")
        self.assertEqual(len(task.tasks),0)

    def test_origin_json_sent_before_background_insert(self):
        pool=FakePool()
        tasks=BackgroundTasks()
        client=FakeClient(FakeHTTPResponse(data={"data":[{"name":"실제 원본 응답", "patientName":"PRIVATE", "price":3000}]}))
        with patch("app.native_catalog.httpx.AsyncClient", return_value=client):
            result=asyncio.run(get_native_public_catalog(req(pool),tasks,"home-menu"))
        body=json.loads(result.body)
        self.assertEqual(body["cache"],"MISS")
        self.assertEqual(body["data"]["data"][0]["name"],"실제 원본 응답")
        self.assertNotIn("patientName",body["data"]["data"][0])
        self.assertEqual(len(pool.writes),0,"cache write must not block screen response")
        self.assertEqual(len(tasks.tasks),1)
        asyncio.run(tasks())
        self.assertEqual(len(pool.writes),1)
        self.assertEqual(client.seen[0][0],"https://api-prod.merakiplace.work/patient-api/app/home-menu/")
        self.assertNotIn("authorization",client.seen[0][1])

    def test_401_auth_required_does_not_fabricate_data_or_cache(self):
        pool=FakePool()
        tasks=BackgroundTasks()
        client=FakeClient(FakeHTTPResponse(status=401))
        with patch("app.native_catalog.httpx.AsyncClient", return_value=client):
            result=asyncio.run(get_native_public_catalog(req(pool),tasks,"doctor-list"))
        self.assertEqual(result.status_code,502)
        body=json.loads(result.body)
        self.assertEqual(body["origin_http_status"],401)
        self.assertEqual(body["error"],"NATIVE_API_AUTHENTICATION_REQUIRED")
        self.assertFalse(tasks.tasks)

    def test_native_404_is_real_path_mismatch_not_fake_503(self):
        pool=FakePool()
        tasks=BackgroundTasks()
        client=FakeClient(FakeHTTPResponse(status=404,headers={"content-type":"text/html"}))
        with patch("app.native_catalog.httpx.AsyncClient",return_value=client):
            result=asyncio.run(get_native_public_catalog(req(pool,"category_id=1"),tasks,"lowest-price"))
        self.assertEqual(result.status_code,502)
        body=json.loads(result.body)
        self.assertEqual(body["origin_http_status"],404)
        self.assertEqual(body["error"],"NATIVE_API_ENDPOINT_NOT_FOUND")
        self.assertFalse(tasks.tasks)

    def test_price_requires_original_mandatory_query_fields(self):
        with self.assertRaises(Exception):
            asyncio.run(get_native_public_catalog(
                req(FakePool()),BackgroundTasks(),"lowest-price"))
        with self.assertRaises(Exception):
            asyncio.run(get_native_public_catalog(
                req(FakePool()),BackgroundTasks(),"lowest-price-categories"))

    def test_verified_original_price_region_path_and_display_before_cache(self):
        pool=FakePool()
        tasks=BackgroundTasks()
        source={"data":{"national_lowest_price":188000,
                        "regions":[{"display_name":"서울","lowest_price":194000}]}}
        client=FakeClient(FakeHTTPResponse(data=source))
        with patch("app.native_catalog.httpx.AsyncClient",return_value=client):
            response=asyncio.run(get_native_public_catalog(
                req(pool,"category_id=12&variant=district"),tasks,"lowest-price"))
        body=json.loads(response.body)
        self.assertEqual(response.status_code,200)
        self.assertEqual(body["data"],source)
        self.assertIn("/patient-api/medical-map/lowest-price/v2/regions?",client.seen[0][0])
        self.assertIn("category_id=12",client.seen[0][0])
        self.assertEqual(len(pool.writes),0)
        self.assertEqual(len(tasks.tasks),1)

    def test_native_myd_link_is_path_segment_not_query_and_never_forwards_auth(self):
        pool=FakePool()
        tasks=BackgroundTasks()
        upstream=FakeClient(FakeHTTPResponse(data={
          "data":{"link_type":"doctor_list","key":"symptom-acneOralMedication",
                  "doctor_list_filter_rule":{"search_filter_keys":["acne"]}}
        }))
        with patch("app.native_catalog.httpx.AsyncClient",return_value=upstream):
            result=asyncio.run(get_native_public_catalog(
                req(pool,"myd_link_key=symptom-acneOralMedication"),
                tasks,"myd-link"))
        self.assertEqual(result.status_code,200)
        self.assertEqual(
          upstream.seen[0][0],
          "https://api-prod.merakiplace.work/patient-api/app/myd-link/symptom-acneOralMedication")
        self.assertEqual(len(tasks.tasks),1)
        self.assertEqual(len(pool.writes),0)

    def test_native_myd_link_rejects_untrusted_path_components(self):
        for dangerous in ("..%2Fuser%2Fme","%2Fadmin","https%3A%2F%2Fevil.com",
                          "","foo%3Ftoken%3D123"):
            pool=FakePool()
            with self.assertRaises(Exception):
                asyncio.run(get_native_public_catalog(
                    req(pool,"myd_link_key="+dangerous),BackgroundTasks(),"myd-link"))
            self.assertFalse(pool.queries)

    def test_no_store_original_never_cached(self):
        pool=FakePool()
        tasks=BackgroundTasks()
        client=FakeClient(FakeHTTPResponse(headers={"cache-control":"private, no-store"}))
        with patch("app.native_catalog.httpx.AsyncClient", return_value=client):
            result=asyncio.run(get_native_public_catalog(req(pool),tasks,"home-banner"))
        self.assertEqual(json.loads(result.body)["cache_write"],"blocked_by_origin_cache_control")
        self.assertEqual(len(tasks.tasks),0)

    def test_session_cookies_rejected_before_any_source_fetch(self):
        pool=FakePool()
        with self.assertRaises(Exception):
            asyncio.run(get_native_public_catalog(req(pool,headers={"cookie":"a=b"}),BackgroundTasks(),"home-menu"))
        self.assertFalse(pool.queries)


if __name__=="__main__":
    unittest.main()
