"""Audit router: append-only SHA-256 hash chain per session."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from api.core import audit_chain

router = APIRouter()


class AppendRequest(BaseModel):
    session_id: str
    event: str
    data: dict


@router.post("/append")
def append(req: AppendRequest):
    return audit_chain.append(req.session_id, req.event, req.data)


@router.get("/{session_id}")
def get(session_id: str):
    return {
        "session_id": session_id,
        "entries": audit_chain.get_session(session_id),
        "head_hash": audit_chain.head_hash(session_id),
    }


@router.get("/{session_id}/verify")
def verify(session_id: str):
    return audit_chain.verify(session_id)
