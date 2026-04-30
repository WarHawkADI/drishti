"""
Per-session state for the Drishti agent.

The orchestrator and every tool share a single SessionState instance.
Tools update it and the orchestrator publishes derived UI events.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CustomerProfile:
    name: str = ""
    pan_number: str = ""
    declared_age: int = 0
    monthly_income: int = 0
    employment_type: str = ""
    loan_purpose: str = ""
    requested_amount: int = 0
    declared_city: str = ""
    declared_lat: float | None = None
    declared_lng: float | None = None

    def is_complete(self) -> bool:
        return all(
            [
                self.pan_number,
                self.declared_age > 0,
                self.monthly_income > 0,
                self.employment_type,
                self.loan_purpose,
                self.requested_amount > 0,
            ]
        )


@dataclass
class SessionState:
    session_id: str
    room_name: str

    # Profile gradually filled during conversation
    profile: CustomerProfile = field(default_factory=CustomerProfile)

    # Bureau pulled
    bureau: dict[str, Any] | None = None

    # Risk scoring
    risk_score: float | None = None
    risk_band: str | None = None
    propensity: float | None = None
    shap_top3: list[dict] = field(default_factory=list)

    # Fraud accumulator
    fraud_signals: list[dict] = field(default_factory=list)
    fraud_severity_max: int = 0

    # Outcome
    decision: str | None = None
    selected_tier: str | None = None
    audit_hash: str | None = None

    # Async coordination ----------------------------------------------------
    # Tools use these futures to wait for UI-driven events such as PAN upload,
    # consent acknowledgement, or offer selection.
    pan_future: asyncio.Future | None = None
    consent_futures: dict[str, asyncio.Future] = field(default_factory=dict)
    offer_future: asyncio.Future | None = None
    geo_actual: dict[str, float] | None = None  # {lat, lng}
    live_face_data_url: str | None = None

    # Step tracker
    step: str = "greet"

    # Room handle (set by orchestrator after connect; tools publish data via this)
    room: Any | None = None
    local_pub: Any | None = None

    def to_audit_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "profile": self.profile.__dict__,
            "bureau_pulled": self.bureau is not None,
            "risk_band": self.risk_band,
            "fraud_severity_max": self.fraud_severity_max,
            "decision": self.decision,
            "selected_tier": self.selected_tier,
        }
