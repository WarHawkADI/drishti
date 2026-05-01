FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY api ./api
COPY train ./train

ENV PORT=8421
ENV AUDIT_DB_PATH=/data/audit.db
RUN mkdir -p /data

EXPOSE 8421
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD curl -fsS http://localhost:8421/healthz || exit 1

# Bind a fixed port. Railway is told via env var PORT=8421 so its gateway
# proxies here. Don't use shell form — the original exec form was the only
# one that successfully promoted past Railway's healthcheck.
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8421"]
