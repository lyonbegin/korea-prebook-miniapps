import unittest
from app.source_parser import extract_page,page_kind

class PublicParserTests(unittest.TestCase):
    def test_public_hospital_price_fields(self):
        html=b"""<html><head><title>Public page</title></head><body><main>
          <h1>Example Clinic</h1><p>Seoul Example 11-ro</p>
          <table><thead><tr><th>Type</th><th>Cost</th></tr></thead>
          <tbody><tr><td>Example imaging</td><td>30,000 KRW</td>
          <td>Before insurance</td></tr></tbody></table></main></body></html>"""
        v=extract_page(html,"https://my-doctor.io/hospital/detail?hospital_id=123")
        self.assertEqual(v["hospital"]["id"],"123")
        self.assertEqual(v["hospital"]["name"],"Example Clinic")
        self.assertEqual(v["hospital_prices"][0]["name"],"Example imaging")
        self.assertEqual(v["hospital_prices"][0]["price"],"30,000 KRW")
    def test_reject_unknown_hospital_id(self):
        value=extract_page(b"<h1>Fake clinic</h1>","https://my-doctor.io/hospital/detail?hospital_id=notanid")
        self.assertIsNone(value["hospital"])
    def test_public_route(self):
        self.assertEqual(page_kind("/medical-cost"),"medical_cost")
        self.assertEqual(page_kind("/telemedicine/all-department"),"telemedicine")
        self.assertEqual(page_kind("/hospital/detail"),"hospital")
if __name__=="__main__":unittest.main()
