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
<div><span>App Download</span></div><div><span>Seungmin Yoo</span></div><p>U Line Clinic</p><p>Reviews 9,133</p>
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
    def test_source_uuid_requires_complete_shape_and_selected_option(self):
        source=EVENT.replace("<h2>Procedure Info</h2>",
                             "<h2>Procedure Info</h2><h3>Option 2</h3>")
        soup=BeautifulSoup(source,"html.parser")
        verified="d195122c-ee11-4090-94c1-29a439508bdd"
        valid=get_option_rows(soup,"70809",
             "https://unni.app/us/events/70809?optionId="+verified)
        self.assertIsNone(valid[0]["option_id"])
        self.assertEqual(valid[1]["option_id"],verified)
        malformed=get_option_rows(soup,"70809",
             "https://unni.app/us/events/70809?optionId=fake-option-id-1234567890")
        self.assertTrue(all(item["option_id"] is None for item in malformed))
        incorrect_selection=get_option_rows(BeautifulSoup(EVENT,"html.parser"),"70809",
             "https://unni.app/us/events/70809?optionId="+verified)
        self.assertTrue(all(item["option_id"] is None for item in incorrect_selection))
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
        self.assertEqual(sum("INSERT INTO unni_clone.option_price_history" in s for s in names),2)
        self.assertTrue(any("unni_clone.events" in s for s in names))
        self.assertTrue(any("unni_clone.source_provenance" in s for s in names))
    async def test_doctor_plain_text_profile(self):
        pool=FakePG()
        result=await ingest_public_metadata(pool,"/us/doctors/1502","",DOCTOR.encode())
        self.assertEqual(result,{"type":"doctor","id":"1502"})
        writes=[(s,args) for s,args in pool.conn.statements if "unni_clone.doctors" in s]
        self.assertEqual(len(writes),1)
        self.assertEqual(writes[0][1][2],"Seungmin Yoo")


class FirstPartyInquiryTest(unittest.IsolatedAsyncioTestCase):
    async def test_consented_anonymous_request_records_token_hash(self):
        from app.inquiries import CreateInquiry,create_inquiry,secret_digest
        payload=CreateInquiry(event_id="70809",event_name="Facial injection",
            option_index=5,option_name="Shoulder Slimming Botox",
            clinic_id="826",clinic_name="U Line Clinic",
            contact_method="email",contact_value="qa@example.invalid",
            message="Please provide information",consent=True)
        pool=FakePG()
        req=type("Req",(),{"app":type("App",(),{"state":type("State",(),{"pg":pool})()})()})()
        out=await create_inquiry(payload,req)
        self.assertTrue(out["token"])
        self.assertEqual(out["status"],"pending_assignment")
        self.assertTrue(out["clinic_not_notified"])
        self.assertFalse(out["appointment_confirmed"])
        inserts=[(sql,args) for sql,args in pool.conn.statements if "unni_clone.inquiries" in sql]
        self.assertEqual(len(inserts),1)
        args=inserts[0][1]
        self.assertEqual(args[1],secret_digest(out["token"]))
        self.assertNotIn(out["token"],str(args))
    async def test_no_consent_means_no_write(self):
        from app.inquiries import CreateInquiry,create_inquiry
        from fastapi import HTTPException
        payload=CreateInquiry(event_name="Clinic inquiry",
            contact_method="email",contact_value="qa@example.invalid",
            message="Please advise",consent=False)
        pool=FakePG()
        req=type("Req",(),{"app":type("App",(),{"state":type("State",(),{"pg":pool})()})()})()
        with self.assertRaises(HTTPException) as ctx:
            await create_inquiry(payload,req)
        self.assertEqual(ctx.exception.status_code,400)
        self.assertEqual(pool.conn.statements,[])
    def test_preferred_time_alias(self):
        from app.inquiries import PreferredDate
        from pydantic import ValidationError
        valid=PreferredDate.model_validate({"date":"2099-12-01","time":"15:30"})
        self.assertEqual(valid.preferred_time.hour,15)
        with self.assertRaises(ValidationError):
            PreferredDate.model_validate({"date":"2020-01-01","time":"08:00"})


class OperatorAccessTest(unittest.IsolatedAsyncioTestCase):
    """No operational inquiry or contact data is accessible without operator auth."""
    async def test_missing_configuration_denies_queue_before_database_query(self):
        import os
        from unittest.mock import patch
        from fastapi import HTTPException,Response
        from app.inquiries import staff_queue
        pool=FakePG()
        req=type("Req",(),{"app":type("App",(),{"state":type("State",(),{"pg":pool})()})()})()
        with patch.dict(os.environ,{"UNNI_STAFF_TOKEN":""}):
            with self.assertRaises(HTTPException) as err:
                await staff_queue(req,Response(),x_staff_token="any")
        self.assertEqual(err.exception.status_code,503)
        self.assertEqual(pool.conn.statements,[])

    async def test_wrong_operator_token_denies_queue(self):
        import os
        from unittest.mock import patch
        from fastapi import HTTPException,Response
        from app.inquiries import staff_queue
        pool=FakePG()
        req=type("Req",(),{"app":type("App",(),{"state":type("State",(),{"pg":pool})()})()})()
        with patch.dict(os.environ,{"UNNI_STAFF_TOKEN":"known-valid-test-value"}):
            with self.assertRaises(HTTPException) as err:
                await staff_queue(req,Response(),x_staff_token="wrong-token")
        self.assertEqual(err.exception.status_code,403)
        self.assertEqual(pool.conn.statements,[])

    async def test_valid_operator_token_reads_bounded_queue_without_caching(self):
        import os
        from unittest.mock import patch
        from fastapi import Response
        from app.inquiries import staff_queue
        class ReadPool:
            def __init__(self):self.calls=[]
            async def fetch(self,sql,*args):
                self.calls.append((sql,args))
                return [{"id":"00000000-0000-4000-8000-000000000001",
                         "event_name":"Synthetic QA","contact_value":"not-real@example.invalid"}]
        pool=ReadPool()
        req=type("Req",(),{"app":type("App",(),{"state":type("State",(),{"pg":pool})()})()})()
        response=Response()
        with patch.dict(os.environ,{"UNNI_STAFF_TOKEN":"known-valid-test-value"}):
            result=await staff_queue(req,response,x_staff_token="known-valid-test-value")
        self.assertEqual(response.headers.get("cache-control"),"no-store")
        self.assertEqual(result["items"][0]["event_name"],"Synthetic QA")
        self.assertFalse(result["appointment_confirmed"])
        self.assertIn("LIMIT 50",pool.calls[0][0])
