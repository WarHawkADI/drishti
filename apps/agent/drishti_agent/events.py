"""
Typed events flowing over the LiveKit data channel.
Mirrors apps/web/lib/events.ts on the agent side.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Any, Literal


# ---------------- agent -> ui ----------------
@dataclass
class StepChange:
    type: Literal["step.change"] = "step.change"
    step: str = "greet"


@dataclass
class CaptionEvent:
    speaker: Literal["drishti", "customer"] = "drishti"
    text: str = ""
    is_final: bool = True
    # Server-side wall-clock millis at the moment the caption is emitted.
    # The UI sorts captions by this so even if reliable-data delivery shuffles
    # arrival order, the displayed sequence matches the spoken sequence.
    ts_ms: int = 0
    type: Literal["caption"] = "caption"


@dataclass
class SignalsUpdate:
    signals: dict[str, Any] = field(default_factory=dict)
    type: Literal["signals.update"] = "signals.update"


@dataclass
class PanRequest:
    prompt: str = "Please upload a clear photo of your PAN card."
    type: Literal["pan.request"] = "pan.request"


@dataclass
class ConsentRequest:
    consent_type: str = "data_processing"
    prompt: str = ""
    type: Literal["consent.request"] = "consent.request"


@dataclass
class ProfileConfirmRequest:
    profile: dict[str, Any] = field(default_factory=dict)
    profile_version: int = 0
    type: Literal["profile.confirm.request"] = "profile.confirm.request"


@dataclass
class OfferShow:
    decision: str = "offer"
    offers: list[dict] = field(default_factory=list)
    offer_version: int = 0
    reason: str | None = None
    next_best_action: str | None = None
    shap_top3: list[dict] = field(default_factory=list)
    type: Literal["offer.show"] = "offer.show"


@dataclass
class FraudFlag:
    signal: str = ""
    severity: int = 2
    reason: str = ""
    type: Literal["fraud.flag"] = "fraud.flag"


@dataclass
class SessionEnded:
    outcome: str = "approved"
    audit_hash: str | None = None
    selected_offer: dict[str, Any] | None = None
    type: Literal["session.ended"] = "session.ended"


@dataclass
class UiAck:
    event_id: str = ""
    ok: bool = True
    type: Literal["ui.ack"] = "ui.ack"


@dataclass
class StateSnapshot:
    step: str = "greet"
    offer: dict[str, Any] = field(default_factory=dict)
    selected_offer: dict[str, Any] | None = None
    ended: dict[str, Any] | None = None
    type: Literal["state.snapshot"] = "state.snapshot"


# ---------------- helpers ----------------
def encode(event) -> bytes:
    """Serialize an event dataclass for publishing on the data channel.

    `ensure_ascii=False` so the rupee symbol and Hindi captions survive the
    round trip without being mangled into \\uXXXX escapes.
    """
    return json.dumps(
        asdict(event), separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def decode(payload: bytes) -> dict | None:
    try:
        return json.loads(payload.decode("utf-8"))
    except Exception:
        return None
