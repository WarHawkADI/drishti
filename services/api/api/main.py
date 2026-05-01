"""
Drishti backend API.

Single FastAPI app with five routers:
  - /policy   policy engine + offer grid
  - /risk     LightGBM risk + propensity + SHAP
  - /fraud    face match + fraud aggregator
  - /bureau   mock CIBIL by PAN prefix
  - /audit    SHA-256 hash chain logger

Deployed as a single Railway service. Envs:
  AUDIT_DB_PATH   sqlite path, default ./audit.db
  CORS_ORIGINS    comma-separated origins (default: *)
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routers import audit, bureau, fraud, policy, risk

# ---------- Logging ----------
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(colors=False),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("drishti.api.startup", version="0.1.0")
    # Pre-warm risk model
    from api.core.risk_model import get_model

    try:
        get_model()
        log.info("risk_model.loaded")
    except Exception as e:  # pragma: no cover
        log.warning("risk_model.load_failed", err=str(e))
    yield
    log.info("drishti.api.shutdown")


app = FastAPI(
    title="Drishti API",
    version="0.1.0",
    description="Backend services for the Drishti agentic AI loan officer.",
    lifespan=lifespan,
)

origins_raw = os.getenv("CORS_ORIGINS", "*").strip()
if origins_raw == "*":
    # Browsers reject `Access-Control-Allow-Origin: *` with credentials,
    # so when wildcard is requested we MUST disable credentials.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins_raw.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/", tags=["meta"])
async def root():
    return {
        "service": "drishti-api",
        "version": "0.1.0",
        "routes": ["/policy", "/risk", "/fraud", "/bureau", "/audit"],
    }


@app.get("/healthz", tags=["meta"])
async def healthz():
    """Liveness — process is alive. Always 200 unless the worker is dead."""
    return {"status": "ok"}


@app.get("/readyz", tags=["meta"])
async def readyz():
    """Readiness — every dependency is loaded. 503 if anything is missing.

    Useful for k8s-style traffic gating: pod stays out of the LB until
    risk_model is loaded, audit DB is writable, and policy YAMLs parsed.
    """
    checks: dict[str, str] = {}
    overall_ok = True

    # 1. Risk model
    try:
        from api.core.risk_model import get_model
        m = get_model()
        checks["risk_model"] = "fallback" if getattr(m, "fallback", False) else "ok"
    except Exception as e:
        checks["risk_model"] = f"fail: {type(e).__name__}"
        overall_ok = False

    # 2. Policy engine (rules + grid YAMLs)
    try:
        from api.core.policy_engine import get_engine
        e = get_engine()
        if not e._grid.get("cells"):  # noqa: SLF001
            checks["policy_engine"] = "fail: empty grid"
            overall_ok = False
        else:
            checks["policy_engine"] = (
                f"ok ({len(e._grid['cells'])} cells, "  # noqa: SLF001
                f"{len(e._rules.get('rules', []))} rules)"
            )
    except Exception as e:
        checks["policy_engine"] = f"fail: {type(e).__name__}"
        overall_ok = False

    # 3. Audit DB writability
    try:
        from api.core.audit_chain import init_db
        init_db()
        checks["audit_db"] = "ok"
    except Exception as e:
        checks["audit_db"] = f"fail: {type(e).__name__}"
        overall_ok = False

    if overall_ok:
        return {"status": "ready", "checks": checks}
    return JSONResponse(
        status_code=503,
        content={"status": "not_ready", "checks": checks},
    )


@app.exception_handler(Exception)
async def unhandled_exc(_, exc: Exception):  # pragma: no cover
    """Classify exceptions to the right HTTP status, then mask internals.

    Validation/lookup errors that escape Pydantic are 4xx, not 5xx. The full
    trace always goes to logs; clients get a sanitized response with an
    error_id they can quote in support tickets.
    """
    import uuid
    err_id = uuid.uuid4().hex[:12]

    # Map common Python exceptions to appropriate 4xx codes.
    if isinstance(exc, ValueError):
        status, code = 400, "invalid_request"
    elif isinstance(exc, KeyError):
        status, code = 422, "missing_field"
    elif isinstance(exc, FileNotFoundError):
        status, code = 404, "not_found"
    elif isinstance(exc, PermissionError):
        status, code = 403, "forbidden"
    elif isinstance(exc, TimeoutError):
        status, code = 504, "upstream_timeout"
    else:
        status, code = 500, "internal_error"

    log.exception("unhandled.error", err_id=err_id, status=status, err=str(exc))
    return JSONResponse(
        status_code=status,
        content={"error": code, "error_id": err_id},
    )


app.include_router(policy.router, prefix="/policy", tags=["policy"])
app.include_router(risk.router, prefix="/risk", tags=["risk"])
app.include_router(fraud.router, prefix="/fraud", tags=["fraud"])
app.include_router(bureau.router, prefix="/bureau", tags=["bureau"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8421")))
