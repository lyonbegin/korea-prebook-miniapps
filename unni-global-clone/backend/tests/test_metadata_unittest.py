"""Local pure-Python tests run at Docker build; never call the original API."""
import asyncio
import unittest
from bs4 import BeautifulSoup
from app.metadata_ingest import get_option_rows, source_hospital, hospital_info, ingest_public_metadata
from app.inquiries import INQUIRY_SCHEMA

EVENT="""<html><main><h1>Fat Dissolving Injection</h1><p>9.9</p>
<h2>Procedure Info</h2><p>VATIncluded</p>
<h3>Shoulder Slimming Botox</h3><p>Shoulder Slimming Botox100UnitProduct Origin: KoreanBrand: LIZTOX1 session(s)</p>
<p><del>$204.60</del>(VAT included)</p><p>20%$163.68</p>
<p>Converted to USD(local currency: ₩220,000)</p>
<h3>Calf Botox</h3><p>Calf Botox200UnitProduct Origin: KoreanBrand: LIZTOX1 session(s)</p>
<p><del>$327.36</del>12%$286.44</p><p>₩385,000</p>
<h2>U Line Clinic</h2><a href="/us/hospitals/826">U Line Clinic</a>
</main></html>"""
DOCTOR="""<html><main><p>Scan QR for details in the app</p><main><p>Sign up now and enjoy exclusive benefits</p>
<p>Seungmin Yoo</p><p>U Line Clinic</p><p>Reviews 9,133</p>
<h2>Works at</h2><p>U Line Clinic</p></main></main></html>"""
HOSPITAL="""<html><main><h1>U Line Clinic</h1><p>9.7</p><p>10,668 Reviews</p>
<h2>Clinic Hours</h2><table><tr><td>Mon</td><td>Tue</td></tr>
<tr><td>10:00 ~ 20:00</td><td>Closed</td></tr></table>
<p>Closed on Wednesdays, Sundays, and public holidays.</p>
<h2>Address</h2><p>7 Seolleung-ro 160-gil, Gangnam-gu, Seoul, Republic of Korea</p>
</main></html>"""

class Ctx:
    def __init__(self,result):self.result=result
    async def __aenter__(self):return self.result
    async def __aexit__(self,*args):return False

class FakeConn:
    def __init__(self):self.statements=[]
    def transaction(self):return Ctx(self)
    async def execute(self,sql,*args):
        self.statements.append((sql,args))
        return "INSERT 0 1"
class FakePG:
    def __init__(self):self.conn=FakeConn()
    def acquire(self):return Ctx(self.conn)

class PublicMetadataTest(unittest.TestCase):
    def test_discount_and_option_facts(self):
        options=get_option_rows(BeautifulSoup(EVENT,"html.parser"),"70809",
           "https://unni.app/us/events/70809?optionId=example")
        self.assertEqual(len(options),2)
        self.assertEqual(options[0]["name"],"Shoulder Slimming Botox")
        self.assertAlmostEqual(options[0]["price"],163.68)
        self.assertAlmostEqual(options[0]["original_price"],204.60)
        self.assertEqual(options[0]["discount_percent"],20.0)
        self.assertEqual(options[0]["local_price"],220000.0)
        self.assertEqual(options[0]["attributes"]["brand"],"LIZTOX")
        self.assertEqual(options[1]["price"],286.44)
    def test_clinic_link_and_hours(self):
        doc=BeautifulSoup(EVENT,"html.parser")
        self.assertEqual(source_hospital(doc),("826","U Line Clinic"))
        clinic=BeautifulSoup(HOSPITAL,"html.parser")
        data=hospital_info(clinic)
        self.assertTrue(data["hours"])
        self.assertIn("Wednesdays",data["closed_notice"])
        self.assertIn("Gangnam-gu",data["address"])
    def test_independent_inquiry_schema_isolated(self):
        self.assertIn("unni_clone.inquiries",INQUIRY_SCHEMA)
        self.assertIn("secret_hash TEXT UNIQUE NOT NULL",INQUIRY_SCHEMA)
        self.assertIn("ON DELETE CASCADE",INQUIRY_SCHEMA)

class AsyncMetadataTest(unittest.IsolatedAsyncioTestCase):
    async def test_event_and_options_persist_after_stream(self):
        pool=FakePG()
        output=await ingest_public_metadata(pool,"/us/events/70809",
             "optionId=d195122c-ee11-4090-94c1-29a439508bdd",EVENT.encode())
        self.assertEqual(output["type"],"event")
        names=[sql for sql,args in pool.conn.statements]
        self.assertEqual(sum("unni_clone.event_options" in s for s in names),2)
        self.assertTrue(any("unni_clone.events" in s for s in names))
        self.assertTrue(any("unni_clone.source_provenance" in s for s in names))
    async def test_doctor_plain_text_profile(self):
        pool=FakePG()
        result=await ingest_public_metadata(pool,"/us/doctors/1502","",DOCTOR.encode())
        self.assertEqual(result,{"type":"doctor","id":"1502"})
        writes=[(s,args) for s,args in pool.conn.statements if "unni_clone.doctors" in s]
        self.assertEqual(len(writes),1)
        self.assertEqual(writes[0][1][2],"Seungmin Yoo")
