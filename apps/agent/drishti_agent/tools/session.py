"""Tool: end_session — finalises audit chain and returns root hash."""

from __future__ import annotations

from .. import audit_client
from ..state import SessionState


OUTCOMES = {"approved", "declined", "fraud_block", "human_review"}


async def end_session(state: SessionState, outcome: str) -> dict:
    if outcome not in OUTCOMES:
        outcome = "declined"
    if outcome == "approved":
        if (
            state.decision != "offer"
            or state.selected_tier is None
            or state.selected_offer_snapshot is None
        ):
            await audit_client.append(
                state.session_id,
                "tool.failed",
                {
                    "tool": "end_session",
                    "reason": "approval_without_selected_offer",
                    "requested_outcome": outcome,
                    "decision": state.decision,
                    "selected_tier": state.selected_tier,
                },
            )
            outcome = "human_review"

    await audit_client.append(
        state.session_id,
        "session.ended",
        {
            "outcome": outcome,
            "decision": state.decision,
            "selected_tier": state.selected_tier,
            "selected_offer": state.selected_offer_snapshot,
            "fraud_severity_max": state.fraud_severity_max,
        },
    )
    head = await audit_client.head_hash(state.session_id)
    state.outcome = outcome
    state.audit_hash = head
    return {
        "ok": True,
        "outcome": outcome,
        "audit_hash": head,
        "selected_offer": state.selected_offer_snapshot,
    }
