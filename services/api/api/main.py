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
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exc(_, exc: Exception):  # pragma: no cover
    log.exception("unhandled.error", err=str(exc))
    return JSONResponse(status_code=500, content={"error": str(exc)})


app.include_router(policy.router, prefix="/policy", tags=["policy"])
app.include_router(risk.router, prefix="/risk", tags=["risk"])
app.include_router(fraud.router, prefix="/fraud", tags=["fraud"])
app.include_router(bureau.router, prefix="/bureau", tags=["bureau"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8421")))
