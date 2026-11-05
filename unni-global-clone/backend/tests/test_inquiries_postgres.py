"""Real DB-only integration test: disposable GitHub Actions PostgreSQL, no production writes.

No clinic contact is sent. All identities and messages below are synthetic.
Never run this test with a production DATABASE_URL.
"""
import os
import uuid
import unittest
from datetime import date, timedelta
from types import SimpleNamespace

import asyncpg
from fastapi import HTTPException

from app.inquiries import (
    INQUIRY_SCHEMA,
    CreateInquiry,
    AddMessage,
    PreferredDate,
    add_message,
    create_inquiry,
    delete_inquiry,
    inquiry_health,
    inquiry_status,
    preferred_time,
    secret_digest,
)


@unittest.skipUnless(os.getenv("TEST_DATABASE_URL"), "Requires isolated TEST_DATABASE_URL")
class IndependentInquiryPostgresE2E(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = os.environ["TEST_DATABASE_URL"]
        if "uni-mobile-api" in url or "railway" in url.lower():
            raise AssertionError("Refusing a possible production database")
        self.pool = await asyncpg.create_pool(url, min_size=1, max_size=2)
        async with self.pool.acquire() as conn:
            await conn.execute(INQUIRY_SCHEMA)
        self.request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(pg=self.pool)))

    async def asyncTearDown(self):
        await self.pool.close()

    async def test_complete_visitor_lifecycle_without_staff_or_original_clinic(self):
        health = await inquiry_health(self.request)
        self.assertTrue(health["ok"])
        self.assertFalse(health["original_clinic_connected"])
        self.assertFalse(health["reservations_confirmed"])
        self.assertFalse(health["staff_delivery_configured"])

        payload = CreateInquiry(
            event_id="70809",
            event_name="Synthetic treatment inquiry — no actual client",
            option_index=5,
            source_option_id="d195122c-ee11-4090-94c1-29a439508bdd",
            option_name="Shoulder Slimming Botox",
            clinic_id="826",
            clinic_name="U Line Clinic",
            contact_method="email",
            contact_value="synthetic-test@example.invalid",
            language="en",
            message="Test message. Never contact any clinic.",
            consent=True,
        )
        created = await create_inquiry(payload, self.request)
        inquiry_id = uuid.UUID(created["id"])
        token = created["token"]
        self.assertEqual(created["status"], "pending_assignment")
        self.assertTrue(created["clinic_not_notified"])
        self.assertFalse(created["appointment_confirmed"])

        row = await self.pool.fetchrow(
            "SELECT secret_hash, source_option_id, clinic_id, contact_value "
            "FROM unni_clone.inquiries WHERE id=$1", inquiry_id)
        self.assertEqual(row["secret_hash"], secret_digest(token))
        self.assertNotEqual(row["secret_hash"], token)
        self.assertEqual(row["source_option_id"],
                         "d195122c-ee11-4090-94c1-29a439508bdd")
        self.assertEqual(row["clinic_id"], "826")
        self.assertEqual(row["contact_value"], "synthetic-test@example.invalid")

        opened = await inquiry_status(inquiry_id, self.request, token)
        self.assertEqual(len(opened["messages"]), 1)
        self.assertEqual(opened["messages"][0]["role"], "visitor")
        self.assertFalse(opened["appointment_confirmed"])

        with self.assertRaises(HTTPException) as invalid_token:
            await inquiry_status(inquiry_id, self.request, "another-fake-token")
        self.assertEqual(invalid_token.exception.status_code, 404)
        with self.assertRaises(HTTPException) as no_token:
            await inquiry_status(inquiry_id, self.request, None)
        self.assertEqual(no_token.exception.status_code, 401)

        posted = await add_message(
            inquiry_id,
            AddMessage(text="Second synthetic visitor question."),
            self.request,
            token,
        )
        self.assertTrue(posted["not_delivered_to_clinic"])
        messages = (await inquiry_status(inquiry_id, self.request, token))["messages"]
        self.assertEqual([m["role"] for m in messages], ["visitor", "visitor"])
        self.assertIn("Second synthetic", messages[-1]["content"])

        requested = date.today() + timedelta(days=14)
        pref = PreferredDate.model_validate({
            "date": requested.isoformat(), "time": "15:30"})
        out = await preferred_time(inquiry_id, pref, self.request, token)
        self.assertFalse(out["appointment_confirmed"])
        stored = await self.pool.fetchrow(
            "SELECT preferred_date,preferred_time,status "
            "FROM unni_clone.inquiries WHERE id=$1", inquiry_id)
        self.assertEqual(stored["preferred_date"], requested)
        self.assertEqual(stored["preferred_time"].hour, 15)
        self.assertEqual(stored["status"], "pending_assignment")

        gone = await delete_inquiry(inquiry_id, self.request, token)
        self.assertTrue(gone["deleted"])
        self.assertIsNone(await self.pool.fetchval(
            "SELECT id FROM unni_clone.inquiries WHERE id=$1", inquiry_id))
        self.assertEqual(await self.pool.fetchval(
            "SELECT count(*) FROM unni_clone.inquiry_messages WHERE inquiry_id=$1",
            inquiry_id), 0)

        with self.assertRaises(HTTPException) as missing:
            await inquiry_status(inquiry_id, self.request, token)
        self.assertEqual(missing.exception.status_code, 404)
