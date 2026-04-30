"""Fraud router: face match + age check + geo check + aggregator."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.core import face_match, fraud_aggregator

router = APIRouter()


class FaceMatchRequest(BaseModel):
    pan_photo_data_url: str | None = None
    live_photo_data_url: str | None = None
    pan_number: str | None = None
    threshold: float = 0.4


@router.post("/face-match")
def face_match_endpoint(req: FaceMatchRequest):
    r = face_match.match(
        pan_photo=req.pan_photo_data_url,
        live_photo=req.live_photo_data_url,
        pan_number=req.pan_number,
        threshold=req.threshold,
    )
    return {
        "cosine": r.cosine,
        "passed": r.passed,
        "threshold": r.threshold,
        "backend": r.backend,
    }


class AggregateRequest(BaseModel):
    declared_age: int | None = None
    cv_age: float | None = None
    declared_lat: float | None = None
    declared_lng: float | None = None
    actual_lat: float | None = None
    actual_lng: float | None = None
    face_cosine: float | None = None
    face_threshold: float = 0.4
    extra_signals: list[dict] = Field(default_factory=list)


@router.post("/aggregate")
def aggregate(req: AggregateRequest):
    """Run the standard 3-detector pipeline + accept extra signals."""
    signals: list[fraud_aggregator.FraudSignal] = []

    if req.face_cosine is not None:
        s = fraud_aggregator.detect_face_mismatch(req.face_cosine, req.face_threshold)
        if s:
            signals.append(s)

    if req.declared_age is not None and req.cv_age is not None:
        s = fraud_aggregator.detect_age_mismatch(req.declared_age, req.cv_age)
        if s:
            signals.append(s)

    if all(
        v is not None
        for v in (req.declared_lat, req.declared_lng, req.actual_lat, req.actual_lng)
    ):
        s = fraud_aggregator.detect_geo_mismatch(
            req.declared_lat, req.declared_lng, req.actual_lat, req.actual_lng  # type: ignore[arg-type]
        )
        if s:
            signals.append(s)

    # Tack on caller-supplied extra signals (e.g., LLM-detected answer inconsistency)
    for x in req.extra_signals:
        if not x.get("signal"):
            continue
        signals.append(
            fraud_aggregator.FraudSignal(
                signal=x["signal"],
                severity=int(x.get("severity", 2)),
                reason=str(x.get("reason", "")),
                evidence=x.get("evidence", {}),
            )
        )

    verdict = fraud_aggregator.aggregate(signals)
    return verdict.to_dict()


@router.get("/registry")
def signal_registry():
    return fraud_aggregator.SIGNAL_REGISTRY
