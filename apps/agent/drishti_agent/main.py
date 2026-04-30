"""
Drishti agent entrypoint.

Run locally (after `pip install -r requirements.txt`):
    python -m drishti_agent.main dev

Or via LiveKit's CLI:
    python -m drishti_agent.main start
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

# Load .env before importing livekit so plugins pick up the keys
load_dotenv()

from livekit.agents import WorkerOptions, cli  # noqa: E402

from .orchestrator import entrypoint  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)


def run():
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


if __name__ == "__main__":
    run()
