"""Mock CIBIL bureau."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Path

from api.core import bureau_db

router = APIRouter()

# Indian PAN format: AAAAA9999A (5 letters, 4 digits, 1 letter).
PAN_REGEX = r"^[A-Z]{5}[0-9]{4}[A-Z]$"
PAN_PATTERN = re.compile(PAN_REGEX)


@router.get("/lookup/{pan}")
def lookup(pan: str = Path(..., min_length=10, max_length=10, description="10-char PAN")):
    pan = pan.upper().strip()
    if not PAN_PATTERN.match(pan):
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_pan_format",
                    "expected": "AAAAA9999A (5 letters, 4 digits, 1 letter)"},
        )
    try:
        rec = bureau_db.lookup(pan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    rec.pulled_at = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    return rec.to_dict()
