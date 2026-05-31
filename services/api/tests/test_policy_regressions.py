import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.core.policy_engine import Profile, RiskInput, get_engine
from api.core import audit_chain
from api.routers import fraud
from api.routers import audit as audit_router


class PolicyRegressionTests(unittest.TestCase):
    def test_high_fraud_uses_human_review_contract(self):
        decision = get_engine().evaluate(
            Profile(
                age=35,
                monthly_income=100000,
                cibil=712,
                dti=0.2,
                employment_type="salaried",
                existing_loans=0,
                dpd_30plus_last_12m=0,
                requested_amount=300000,
            ),
            RiskInput(risk_score=0.2, propensity=0.7, fraud_severity_max=4),
        )

        self.assertEqual(decision.decision, "human_review")

    def test_no_offer_exceeds_affordability_cap(self):
        profile = Profile(
            age=30,
            monthly_income=50000,
            cibil=720,
            dti=0.41,
            employment_type="salaried",
            existing_loans=0,
            dpd_30plus_last_12m=0,
            requested_amount=600000,
        )
        decision = get_engine().evaluate(profile, RiskInput(risk_score=0.4))

        self.assertEqual(decision.decision, "offer")
        self.assertTrue(decision.offers)
        self.assertTrue(all(o.emi <= profile.monthly_income * 0.4 for o in decision.offers))

    def test_cibil_900_matches_top_band(self):
        decision = get_engine().evaluate(
            Profile(
                age=35,
                monthly_income=150000,
                cibil=900,
                dti=0.1,
                employment_type="salaried",
                existing_loans=0,
                dpd_30plus_last_12m=0,
                requested_amount=500000,
            ),
            RiskInput(risk_score=0.1),
        )

        self.assertEqual(decision.decision, "offer")
        self.assertEqual(decision.matched_cell, "A1")

    def test_default_audit_db_path_is_service_local(self):
        self.assertEqual(audit_chain.DB_PATH.parent.name, "api")
        self.assertEqual(audit_chain.DB_PATH.name, "audit.db")

    def test_face_match_requires_both_images(self):
        with self.assertRaises(fraud.HTTPException):
            fraud.face_match_endpoint(
                fraud.FaceMatchRequest(
                    pan_photo_data_url="data:image/png;base64,AA==",
                    live_photo_data_url="",
                    pan_number="PRIYA1234A",
                )
            )

    def test_audit_summary_surfaces_selected_offer(self):
        rows = [
            {
                "seq": 1,
                "ts": "2026-01-01T00:00:00.000+00:00",
                "event": "decision.computed",
                "data_json": '{"decision":"offer"}',
            },
            {
                "seq": 2,
                "ts": "2026-01-01T00:00:01.000+00:00",
                "event": "offer.selected",
                "data_json": '{"offer":{"tier":"standard","amount":300000}}',
            },
            {
                "seq": 3,
                "ts": "2026-01-01T00:00:02.000+00:00",
                "event": "session.ended",
                "data_json": '{"outcome":"approved","selected_offer":{"tier":"standard","amount":300000}}',
            },
        ]

        class Conn:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql, params=()):
                if "GROUP BY session_id" in sql:
                    return self
                return Rows(rows)

            def fetchall(self):
                return [
                    {
                        "session_id": "s1",
                        "last_seq": 3,
                        "count": 3,
                        "first_ts": rows[0]["ts"],
                        "last_ts": rows[-1]["ts"],
                    }
                ]

        class Rows:
            def __init__(self, values):
                self.values = values

            def fetchall(self):
                return self.values

        original_conn = audit_router.audit_chain._conn
        original_init = audit_router.audit_chain.init_db
        try:
            audit_router.audit_chain._conn = lambda: Conn()
            audit_router.audit_chain.init_db = lambda: None
            result = audit_router.list_sessions()
        finally:
            audit_router.audit_chain._conn = original_conn
            audit_router.audit_chain.init_db = original_init

        self.assertEqual(result["sessions"][0]["approved_amount"], 300000)
        self.assertEqual(result["sessions"][0]["selected_offer"]["tier"], "standard")


if __name__ == "__main__":
    unittest.main()
