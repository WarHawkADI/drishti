"""Thin async client over /audit endpoints in the Drishti API.

All methods are best-effort: a transient API outage must NOT crash a tool.
On failure we log and return a sentinel value, the caller continues.
"""

from __future__ import annotations

import logging
import os

import httpx

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")
log = logging.getLogger("drishti.audit")


async def append(session_id: str, event: str, data: dict) -> dict:
    """Append an event to the session's audit chain. Returns row dict.

    Never raises — on failure, logs and returns a sentinel so callers can keep going.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                f"{API_BASE}/audit/append",
                json={"session_id": session_id, "event": event, "data": data},
            )
            r.raise_for_status()
            return r.json()
    except Exception as e:
        log.warning("audit.append failed event=%s err=%s", event, e)
        return {"ok": False, "error": "audit_unavailable"}


async def head_hash(session_id: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{API_BASE}/audit/{session_id}")
            r.raise_for_status()
            return r.json().get("head_hash")
    except Exception as e:
        log.warning("audit.head_hash failed sid=%s err=%s", session_id, e)
        return None
