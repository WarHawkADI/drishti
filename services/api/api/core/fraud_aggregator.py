"""
Fraud signal aggregator.

Eight signals defined in the spec; three implemented in v1:
    1) face_mismatch           - ArcFace cosine < 0.4   sev 4 (block)
    2) age_mismatch            - |declared - cv_age| > 7  sev 2 (flag)
    3) geo_mismatch            - haversine(declared, ip) > 300km  sev 2 (flag)
    4) liveness_failure        - challenge failed         sev 5 (block)   [NOT IMPLEMENTED v1]
    5) document_tamper         - ELA score > 0.7          sev 4 (block)   [NOT IMPLEMENTED v1]
    6) voice_age_mismatch      - voice age vs declared    sev 2 (flag)    [NOT IMPLEMENTED v1]
    7) answer_inconsistency    - LLM cross-check          sev 3 (probe)   [LLM-driven]
    8) coaching_detection      - >1 voice diarized        sev 3 (probe)   [NOT IMPLEMENTED v1]
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


SIGNAL_REGISTRY = {
    "face_mismatch": {"sev": 4, "action": "block"},
    "age_mismatch": {"sev": 2, "action": "flag"},
    "geo_mismatch": {"sev": 2, "action": "flag"},
    "liveness_failure": {"sev": 5, "action": "block"},
    "document_tamper": {"sev": 4, "action": "block"},
    "voice_age_mismatch": {"sev": 2, "action": "flag"},
    "answer_inconsistency": {"sev": 3, "action": "probe"},
    "coaching_detection": {"sev": 3, "action": "probe"},
}


@dataclass
class FraudSignal:
    signal: str
    severity: int
    reason: str
    evidence: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return self.__dict__


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ---------- individual detectors ----------
def detect_face_mismatch(cosine: float, threshold: float = 0.4) -> FraudSignal | None:
    if cosine < threshold:
        return FraudSignal(
            signal="face_mismatch",
            severity=4,
            reason=f"ArcFace cosine {cosine:.2f} below threshold {threshold:.2f}",
            evidence={"cosine": cosine, "threshold": threshold},
        )
    return None


def detect_age_mismatch(declared: int, cv_age: float, max_delta: int = 7) -> FraudSignal | None:
    delta = abs(declared - cv_age)
    if delta > max_delta:
        return FraudSignal(
            signal="age_mismatch",
            severity=2,
            reason=f"Declared {declared}, CV estimate {int(cv_age)} (delta {int(delta)} yr)",
            evidence={"declared": declared, "cv_age": cv_age, "delta": delta},
        )
    return None


def detect_geo_mismatch(
    declared_lat: float,
    declared_lng: float,
    actual_lat: float,
    actual_lng: float,
    max_km: float = 300.0,
) -> FraudSignal | None:
    distance = haversine_km(declared_lat, declared_lng, actual_lat, actual_lng)
    if distance > max_km:
        return FraudSignal(
            signal="geo_mismatch",
            severity=2,
            reason=f"Declared vs IP geolocation off by {int(distance)} km",
            evidence={"distance_km": round(distance, 1)},
        )
    return None


# ---------- aggregator ----------
@dataclass
class FraudVerdict:
    severity_max: int
    action: str  # "pass" | "probe" | "flag" | "block"
    signals: list[FraudSignal]

    def to_dict(self) -> dict:
        return {
            "severity_max": self.severity_max,
            "action": self.action,
            "signals": [s.to_dict() for s in self.signals],
        }


def aggregate(signals: list[FraudSignal]) -> FraudVerdict:
    if not signals:
        return FraudVerdict(severity_max=0, action="pass", signals=[])

    sev = max(s.severity for s in signals)
    if sev >= 4:
        action = "block"
    elif sev >= 3:
        action = "probe"
    elif sev >= 2:
        action = "flag"
    else:
        action = "pass"

    return FraudVerdict(severity_max=sev, action=action, signals=signals)
