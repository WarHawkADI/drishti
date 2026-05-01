"""
Append-only SHA-256 hash chain for session audit logs.

Every event (consent, document capture, tool call, decision) is a row.
Each row carries the hash of the previous row + its own payload.
Verifying a session is a simple re-hash walk.

Schema (SQLite):
    audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        ts TEXT NOT NULL,
        event TEXT NOT NULL,
        data_json TEXT NOT NULL,
        prev_hash TEXT,
        this_hash TEXT NOT NULL,
        UNIQUE(session_id, seq)
    )
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_PATH = Path(os.getenv("AUDIT_DB_PATH", "audit.db")).resolve()
_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    ts TEXT NOT NULL,
    event TEXT NOT NULL,
    data_json TEXT NOT NULL,
    prev_hash TEXT,
    this_hash TEXT NOT NULL,
    UNIQUE(session_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit(session_id);
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # `timeout=5` makes SQLite wait for a busy lock instead of failing immediately.
    c = sqlite3.connect(str(DB_PATH), timeout=5.0, isolation_level=None)
    c.row_factory = sqlite3.Row
    # WAL mode allows concurrent readers + a single writer with no global lock.
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=NORMAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


_INITIALIZED = False


def init_db():
    """Idempotent schema bootstrap. Safe to call from every request."""
    global _INITIALIZED
    if _INITIALIZED:
        return
    with _lock, _conn() as c:
        c.executescript(_SCHEMA)
    _INITIALIZED = True


def _last_row(c: sqlite3.Connection, session_id: str) -> Optional[sqlite3.Row]:
    row = c.execute(
        "SELECT seq, this_hash FROM audit WHERE session_id=? ORDER BY seq DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    return row


def append(session_id: str, event: str, data: dict) -> dict:
    """Append a new entry to the chain and return its hash.

    Concurrency: a single process-wide threading lock plus an explicit SQLite
    transaction means seq is computed and inserted atomically. If another
    process runs against the same DB file (e.g., reload spawning), WAL +
    UNIQUE(session_id, seq) plus the retry-on-locked behavior of `timeout=5`
    keep the chain consistent. On a UNIQUE-violation race we retry up to 3
    times before surfacing the error.
    """
    init_db()
    ts = datetime.now(timezone.utc).isoformat(timespec="milliseconds")
    data_json = json.dumps(data, sort_keys=True, ensure_ascii=False)

    last_err: Exception | None = None
    for attempt in range(3):
        with _lock, _conn() as c:
            try:
                c.execute("BEGIN IMMEDIATE")
                last = _last_row(c, session_id)
                seq = (last["seq"] + 1) if last else 1
                prev_hash = last["this_hash"] if last else None
                payload = json.dumps(
                    {
                        "session_id": session_id,
                        "seq": seq,
                        "ts": ts,
                        "event": event,
                        "data": data,
                        "prev": prev_hash,
                    },
                    sort_keys=True,
                    ensure_ascii=False,
                )
                this_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
                c.execute(
                    """INSERT INTO audit(session_id, seq, ts, event, data_json, prev_hash, this_hash)
                       VALUES(?, ?, ?, ?, ?, ?, ?)""",
                    (session_id, seq, ts, event, data_json, prev_hash, this_hash),
                )
                c.execute("COMMIT")
                return {
                    "session_id": session_id,
                    "seq": seq,
                    "ts": ts,
                    "event": event,
                    "prev_hash": prev_hash,
                    "this_hash": this_hash,
                }
            except sqlite3.IntegrityError as e:
                # UNIQUE(session_id, seq) violation -> someone else won the race.
                try:
                    c.execute("ROLLBACK")
                except sqlite3.OperationalError:
                    pass
                last_err = e
            except sqlite3.OperationalError as e:
                # Database is locked / busy. Retry.
                try:
                    c.execute("ROLLBACK")
                except sqlite3.OperationalError:
                    pass
                last_err = e
        # Jittered backoff (10-50 ms × 2**attempt) prevents thundering-herd
        # when multiple writers race the same session_id.
        time.sleep(random.uniform(0.01, 0.05) * (2 ** attempt))
    raise RuntimeError(f"audit_chain.append exhausted retries: {last_err}")


def get_session(session_id: str) -> list[dict]:
    init_db()
    with _conn() as c:
        rows = c.execute(
            "SELECT seq, ts, event, data_json, prev_hash, this_hash FROM audit "
            "WHERE session_id=? ORDER BY seq ASC",
            (session_id,),
        ).fetchall()
    return [
        {
            "seq": r["seq"],
            "ts": r["ts"],
            "event": r["event"],
            "data": json.loads(r["data_json"]),
            "prev_hash": r["prev_hash"],
            "this_hash": r["this_hash"],
        }
        for r in rows
    ]


def verify(session_id: str) -> dict:
    """Re-walk the chain. Returns {ok, count, broken_at} where broken_at is the seq # of the first invalid entry (or None)."""
    rows = get_session(session_id)
    expected_prev: Optional[str] = None
    for r in rows:
        if r["prev_hash"] != expected_prev:
            return {"ok": False, "count": len(rows), "broken_at": r["seq"], "reason": "prev_hash mismatch"}
        # Re-derive hash and compare
        payload = json.dumps(
            {
                "session_id": session_id,
                "seq": r["seq"],
                "ts": r["ts"],
                "event": r["event"],
                "data": r["data"],
                "prev": r["prev_hash"],
            },
            sort_keys=True,
            ensure_ascii=False,
        )
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        if digest != r["this_hash"]:
            return {"ok": False, "count": len(rows), "broken_at": r["seq"], "reason": "this_hash mismatch"}
        expected_prev = r["this_hash"]
    return {"ok": True, "count": len(rows), "broken_at": None, "head_hash": expected_prev}


def head_hash(session_id: str) -> Optional[str]:
    init_db()
    with _conn() as c:
        last = _last_row(c, session_id)
    return last["this_hash"] if last else None
