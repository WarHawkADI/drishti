FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Build deps for some plugin wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY drishti_agent ./drishti_agent

# Pre-warm Silero VAD weights (download at build time, not at runtime)
RUN python -c "from livekit.plugins import silero; silero.VAD.load()" || true

# LiveKit Agents worker mode (long-running)
CMD ["python", "-m", "drishti_agent.main", "start"]
