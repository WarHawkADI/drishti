"""Mock CIBIL bureau."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from api.core import bureau_db

router = APIRouter()


@router.get("/lookup/{pan}")
def lookup(pan: str):
    try:
        rec = bureau_db.lookup(pan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    rec.pulled_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    return rec.to_dict()
