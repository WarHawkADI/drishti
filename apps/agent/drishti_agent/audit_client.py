"""Thin async client over /audit endpoints in the Drishti API."""

from __future__ import annotations

import os

import httpx

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8421")


async def append(session_id: str, event: str, data: dict) -> dict:
    """Append an event to the session's audit chain. Returns row dict."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{API_BASE}/audit/append",
            json={"session_id": session_id, "event": event, "data": data},
        )
        r.raise_for_status()
        return r.json()


async def head_hash(session_id: str) -> str | None:
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            r = await client.get(f"{API_BASE}/audit/{session_id}")
            r.raise_for_status()
            return r.json().get("head_hash")
        except Exception:
            return None
