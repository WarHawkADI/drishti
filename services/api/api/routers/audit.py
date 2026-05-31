"""Audit router: append-only SHA-256 hash chain per session."""

from __future__ import annotations

import json

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from api.core import audit_chain

router = APIRouter()


class AppendRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=80)
    event: str = Field(..., min_length=1, max_length=80)
    data: dict


@router.post("/append")
def append(req: AppendRequest):
    return audit_chain.append(req.session_id, req.event, req.data)


# IMPORTANT: this static path MUST be declared before the dynamic
# `/{session_id}` route below, otherwise FastAPI routes `/sessions`
# to `get(session_id="sessions")`.
@router.get("/sessions")
def list_sessions(limit: int = Query(50, ge=1, le=500)):
    """Aggregate every audited session into a list — drives the Operations
    Console KPIs (real numbers, not synthetic). Each entry derives:
        decision   (offer / soft_decline / hard_decline / human_review)
        outcome    (approved / declined / fraud_block / human_review)
        cibil      (from bureau.pulled event)
        selected_offer (immutable accepted terms, when approved)
        fraud_max  (max severity across fraud.flagged events)
        latency_ms (delta from first event to session.ended, when present)
    """
    audit_chain.init_db()
    with audit_chain._conn() as c:  # noqa: SLF001
        rows = c.execute(
            """
            SELECT session_id,
                   MAX(seq)  AS last_seq,
                   COUNT(*)  AS count,
                   MIN(ts)   AS first_ts,
                   MAX(ts)   AS last_ts
            FROM audit
            GROUP BY session_id
            ORDER BY last_ts DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        sessions = []
        for r in rows:
            sid = r["session_id"]
            chain = c.execute(
                "SELECT seq, ts, event, data_json FROM audit "
                "WHERE session_id=? ORDER BY seq ASC",
                (sid,),
            ).fetchall()
            decision = None
            outcome = None
            cibil = None
            fraud_max = 0
            selected_offer = None
            for row in chain:
                ev = row["event"]
                try:
                    data = json.loads(row["data_json"])
                except Exception:
                    data = {}
                if ev == "decision.computed":
                    decision = data.get("decision")
                if ev == "session.ended":
                    outcome = data.get("outcome")
                    selected_offer = data.get("selected_offer") or selected_offer
                if ev == "offer.selected":
                    selected_offer = data.get("offer") or selected_offer
                if ev == "bureau.pulled" and cibil is None:
                    cibil = data.get("cibil")
                if ev == "fraud.flagged":
                    fraud_max = max(fraud_max, int(data.get("severity") or 0))

            # Latency: first event -> session.ended
            latency_ms = None
            if chain and outcome:
                try:
                    from datetime import datetime
                    t0 = datetime.fromisoformat(chain[0]["ts"].replace("Z", "+00:00"))
                    t1 = datetime.fromisoformat(chain[-1]["ts"].replace("Z", "+00:00"))
                    latency_ms = int((t1 - t0).total_seconds() * 1000)
                except Exception:
                    pass

            sessions.append({
                "session_id": sid,
                "count": r["count"],
                "first_ts": r["first_ts"],
                "last_ts": r["last_ts"],
                "decision": decision,
                "outcome": outcome,
                "cibil": cibil,
                "fraud_severity_max": fraud_max,
                "latency_ms": latency_ms,
                "selected_offer": selected_offer,
                "approved_amount": (
                    selected_offer.get("amount")
                    if isinstance(selected_offer, dict)
                    else None
                ),
            })

    return {"count": len(sessions), "sessions": sessions}


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
