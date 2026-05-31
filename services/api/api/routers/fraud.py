"""Fraud router: face match + age check + geo check + aggregator."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.core import face_match, fraud_aggregator

router = APIRouter()


_MAX_DATA_URL = 6_000_000  # ~6 MB after base64 -> roughly 4.5 MB raw image


class FaceMatchRequest(BaseModel):
    pan_photo_data_url: str | None = Field(None, max_length=_MAX_DATA_URL)
    live_photo_data_url: str | None = Field(None, max_length=_MAX_DATA_URL)
    pan_number: str | None = Field(None, max_length=10)
    threshold: float = Field(0.4, ge=0.0, le=1.0)


@router.post("/face-match")
def face_match_endpoint(req: FaceMatchRequest):
    if not req.pan_photo_data_url or not req.live_photo_data_url:
        raise HTTPException(
            status_code=422,
            detail="pan_photo_data_url and live_photo_data_url are required",
        )
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


class ExtraSignal(BaseModel):
    signal: str = Field(..., min_length=1, max_length=50)
    severity: int = Field(2, ge=0, le=5)
    reason: str = Field("", max_length=500)
    evidence: dict = Field(default_factory=dict)


class AggregateRequest(BaseModel):
    declared_age: int | None = Field(None, ge=0, le=120)
    cv_age: float | None = Field(None, ge=0, le=120)
    declared_lat: float | None = Field(None, ge=-90, le=90)
    declared_lng: float | None = Field(None, ge=-180, le=180)
    actual_lat: float | None = Field(None, ge=-90, le=90)
    actual_lng: float | None = Field(None, ge=-180, le=180)
    face_cosine: float | None = Field(None, ge=0.0, le=1.0)
    face_threshold: float = Field(0.4, ge=0.0, le=1.0)
    extra_signals: list[ExtraSignal] = Field(default_factory=list, max_length=20)


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
        signals.append(
            fraud_aggregator.FraudSignal(
                signal=x.signal,
                severity=x.severity,
                reason=x.reason,
                evidence=x.evidence,
            )
        )

    verdict = fraud_aggregator.aggregate(signals)
    return verdict.to_dict()


@router.get("/registry")
def signal_registry():
    return fraud_aggregator.SIGNAL_REGISTRY
