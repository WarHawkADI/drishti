import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from drishti_agent.state import SessionState
from drishti_agent.orchestrator import _apply_profile_args
from drishti_agent.tools import offer, session


class OfferSessionRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_evaluate_offer_requires_confirmed_profile(self):
        events = []

        async def fake_append(session_id, event, data):
            events.append((session_id, event, data))
            return {"seq": len(events), "this_hash": "h"}

        state = SessionState(session_id="s1", room_name="s1")
        state.profile.declared_age = 30
        state.profile.monthly_income = 80000
        state.profile.employment_type = "salaried"
        state.profile.loan_purpose = "other"
        state.profile.requested_amount = 300000
        state.profile.declared_city = "Pune"
        state.bureau = {
            "cibil": 780,
            "existing_loans": 0,
            "dpd_30plus_last_12m": 0,
        }

        with patch.object(offer.audit_client, "append", fake_append):
            result = await offer.evaluate_offer(state)

        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "profile_confirmation_required")
        self.assertEqual(result["decision"], "human_review")

    async def test_offer_selection_stores_complete_snapshot(self):
        events = []

        async def fake_append(session_id, event, data):
            events.append((session_id, event, data))
            return {"seq": len(events), "this_hash": "h"}

        state = SessionState(session_id="s2", room_name="s2")
        state.decision = "offer"
        state.offer_version = 3
        state.current_offers = [
            {
                "tier": "standard",
                "amount": 300000,
                "rate_pct": 14.0,
                "tenure_months": 24,
                "emi": 14400,
                "processing_fee": 3000,
                "total_cost_of_credit": 45600,
            }
        ]

        with patch.object(offer.audit_client, "append", fake_append):
            task = asyncio.create_task(offer.wait_for_offer_selection(state, timeout=1))
            await asyncio.sleep(0)
            self.assertIsNotNone(state.offer_future)
            state.offer_future.set_result({"tier": "standard"})
            result = await task

        self.assertTrue(result["ok"])
        self.assertEqual(
            state.selected_offer_snapshot,
            {**state.current_offers[0], "offer_version": 3},
        )
        self.assertEqual(events[-1][1], "offer.selected")
        self.assertEqual(events[-1][2]["offer"]["amount"], 300000)

    async def test_offer_selection_rejects_stale_version(self):
        events = []

        async def fake_append(session_id, event, data):
            events.append((session_id, event, data))
            return {"seq": len(events), "this_hash": "h"}

        state = SessionState(session_id="s4", room_name="s4")
        state.decision = "offer"
        state.offer_version = 4
        state.current_offers = [{"tier": "standard", "amount": 300000}]

        with patch.object(offer.audit_client, "append", fake_append):
            task = asyncio.create_task(offer.wait_for_offer_selection(state, timeout=1))
            await asyncio.sleep(0)
            self.assertIsNotNone(state.offer_future)
            state.offer_future.set_result({"tier": "standard", "offer_version": 3})
            result = await task

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "stale_offer_version")
        self.assertIsNone(state.selected_offer_snapshot)
        self.assertEqual(events[-1][2]["reason"], "stale_offer_version")

    async def test_offer_selection_consumes_pending_fast_click(self):
        events = []

        async def fake_append(session_id, event, data):
            events.append((session_id, event, data))
            return {"seq": len(events), "this_hash": "h"}

        state = SessionState(session_id="s6", room_name="s6")
        state.decision = "offer"
        state.offer_version = 7
        state.current_offers = [{"tier": "standard", "amount": 300000}]
        state.pending_offer_payload = {"tier": "standard", "offer_version": 7}

        with patch.object(offer.audit_client, "append", fake_append):
            result = await offer.wait_for_offer_selection(state, timeout=1)

        self.assertTrue(result["ok"])
        self.assertIsNone(state.pending_offer_payload)
        self.assertEqual(state.selected_offer_snapshot["offer_version"], 7)

    async def test_offer_selection_discards_stale_pending_click(self):
        state = SessionState(session_id="s7", room_name="s7")
        state.decision = "offer"
        state.offer_version = 9
        state.current_offers = [{"tier": "standard", "amount": 300000}]
        state.pending_offer_payload = {"tier": "standard", "offer_version": 8}

        task = asyncio.create_task(offer.wait_for_offer_selection(state, timeout=1))
        await asyncio.sleep(0)
        self.assertIsNotNone(state.offer_future)
        self.assertFalse(state.offer_future.done())
        state.offer_future.set_result({"tier": "standard", "offer_version": 9})

        async def fake_append(*_args, **_kwargs):
            return {"seq": 1}

        with patch.object(offer.audit_client, "append", fake_append):
            result = await task

        self.assertTrue(result["ok"])
        self.assertEqual(state.selected_offer_snapshot["offer_version"], 9)

    async def test_approved_session_requires_selected_offer(self):
        events = []

        async def fake_append(session_id, event, data):
            events.append((session_id, event, data))
            return {"seq": len(events), "this_hash": "h"}

        async def fake_head_hash(session_id):
            return "head"

        state = SessionState(session_id="s3", room_name="s3")
        state.decision = "offer"

        with (
            patch.object(session.audit_client, "append", fake_append),
            patch.object(session.audit_client, "head_hash", fake_head_hash),
        ):
            result = await session.end_session(state, "approved")

        self.assertEqual(result["outcome"], "human_review")
        self.assertEqual(events[0][1], "tool.failed")
        self.assertEqual(events[-1][1], "session.ended")
        self.assertIsNone(events[-1][2]["selected_offer"])

    def test_profile_args_do_not_invent_critical_values(self):
        state = SessionState(session_id="s5", room_name="s5")

        with self.assertRaises(ValueError):
            _apply_profile_args(
                state,
                age=0,
                monthly_income=0,
                employment_type="",
                loan_purpose="",
                requested_amount=0,
                declared_city="",
            )

        self.assertEqual(state.profile.monthly_income, 0)
        self.assertEqual(state.profile.requested_amount, 0)


if __name__ == "__main__":
    unittest.main()
