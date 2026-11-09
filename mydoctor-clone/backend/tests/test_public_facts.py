import unittest
import json
from pathlib import Path
from app.public_facts import extract_public_facts,safe_route,SEED,merge_public_facts

class PublicFactsTests(unittest.TestCase):
    def test_extract_price_rows_and_not_full_page_html(self):
        raw=b'<html><head><title>Price</title></head><body><main><h1>Public Clinic</h1><table><thead><tr><th>Product</th><th>Cost</th></tr></thead><tbody><tr><td>MRI</td><td>20,000 KRW</td></tr></tbody></table><article>EXCLUDED FULL COPYRIGHTED ARTICLE BODY</article><a href="/hospital/detail?hospital_id=123">Clinic</a></main></body></html>'
        model=extract_public_facts(raw,"https://my-doctor.io/hospital/detail?hospital_id=123")
        self.assertEqual(model["headline"],"Public Clinic")
        self.assertEqual(model["tables"][0]["rows"][0],["MRI","20,000 KRW"])
        self.assertNotIn("EXCLUDED FULL COPYRIGHTED ARTICLE BODY",json.dumps(model))
        self.assertEqual(model["links"][0]["path"],"/hospital/detail?hospital_id=123")
    def test_route_validation(self):
        self.assertIsNone(safe_route("//evil.test"))
        self.assertIsNone(safe_route("/hospital?patient_id=secret"))
        self.assertIsNotNone(safe_route("/hospital/detail?hospital_id=323"))
    def test_seed_and_live_fact_merging_preserves_browser_links_and_prices(self):
        old={"title":"Clinic","headline":"Clinic","links":[{"path":"/hospital/detail?hospital_id=1","label":"First"}],
             "headings":["Hospital"],"tables":[{"rows":[["A","5,000원"],["B","9,000원"]]}],
             "quality":"public_facts","observed_at":"2026-11-09T15:01:00Z"}
        newer={"title":"Clinic","headline":"Clinic","links":[{"path":"/hospital/detail?hospital_id=1","label":"First"},
            {"path":"/hospital/detail?hospital_id=2","label":"Second"}],"headings":["Hospital","Location"],
            "tables":[{"rows":[["A","5,000원"]]}],"quality":"verified_public_facts_from_browser",
            "observed_at":"2026-11-09T14:30:00Z"}
        merged=merge_public_facts(old,newer)
        self.assertEqual(len(merged["links"]),2)
        self.assertEqual(len(merged["tables"][0]["rows"]),2)
        self.assertEqual(merged["quality"],"verified_public_facts_from_browser")
        self.assertEqual(merged["observed_at"],"2026-11-09T15:01:00Z")
    def test_seed_observations(self):
        rows=json.loads(SEED.read_text(encoding="utf-8"))
        self.assertEqual(len(rows),29)
        self.assertTrue(all(x["source_evidence"].startswith("github-actions") for x in rows))
        self.assertTrue(all(x["title"] for x in rows))
        self.assertFalse(any("body_html" in x for x in rows))
if __name__=="__main__":unittest.main()
