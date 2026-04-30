"""
Face match — prototype.

In production: ArcFace ONNX (buffalo_s) embeddings + cosine similarity.
For prototype: deterministic synthetic match score derived from the
declared 'context' string so demo scenarios are reproducible without
needing to ship a 16 MB ArcFace ONNX in the repo.

If `arcface.onnx` is present in artifacts/, real ArcFace is used.
"""

from __future__ import annotations

import base64
import hashlib
import io
import logging
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)
ARTIFACT = Path(__file__).resolve().parents[1] / "artifacts" / "arcface.onnx"


@dataclass
class FaceMatchResult:
    cosine: float
    passed: bool
    threshold: float
    backend: str  # "arcface" or "fallback"


def _decode_image(data_url_or_b64: str) -> bytes | None:
    if not data_url_or_b64:
        return None
    if data_url_or_b64.startswith("data:"):
        try:
            _, b64 = data_url_or_b64.split(",", 1)
        except ValueError:
            return None
    else:
        b64 = data_url_or_b64
    try:
        return base64.b64decode(b64)
    except Exception:
        return None


# ----------------------------------------------------------------------
# Real ArcFace (loaded only if ONNX present)
# ----------------------------------------------------------------------
_arcface_session = None


def _try_load_arcface():
    global _arcface_session
    if _arcface_session is not None or not ARTIFACT.exists():
        return _arcface_session
    try:
        import onnxruntime as ort

        _arcface_session = ort.InferenceSession(
            str(ARTIFACT), providers=["CPUExecutionProvider"]
        )
        log.info("arcface.loaded path=%s", ARTIFACT)
    except Exception as e:  # pragma: no cover
        log.warning("arcface.load_failed err=%s", e)
        _arcface_session = None
    return _arcface_session


def _embed(image_bytes: bytes):
    """Return a 512-d face embedding (numpy array). Requires arcface.onnx."""
    import cv2
    import numpy as np

    sess = _try_load_arcface()
    if sess is None:
        return None
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        img = cv2.resize(img, (112, 112))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32)
        img = (img - 127.5) / 127.5
        img = img.transpose(2, 0, 1)[None, :]
        out = sess.run(None, {sess.get_inputs()[0].name: img})[0]
        emb = out.flatten()
        norm = float((emb * emb).sum() ** 0.5)
        return emb / max(norm, 1e-6)
    except Exception as e:  # pragma: no cover
        log.warning("arcface.embed_failed err=%s", e)
        return None


def _cosine(a, b) -> float:
    import numpy as np

    return float(np.dot(a, b))


# ----------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------
def match(
    pan_photo: str | None,
    live_photo: str | None,
    pan_number: str | None = None,
    threshold: float = 0.4,
) -> FaceMatchResult:
    """
    Compare a PAN photo to a live face frame.

    Strategy:
        1. If both images decode and ArcFace is available  -> real cosine.
        2. Otherwise fall back to deterministic score:
              PAN starting with 'FRAUD' -> cosine 0.28 (fail)
              else                       -> cosine 0.82 (pass)
    """
    pan_bytes = _decode_image(pan_photo or "")
    live_bytes = _decode_image(live_photo or "")

    # ----- Real ArcFace path -----
    if pan_bytes and live_bytes and _try_load_arcface() is not None:
        a = _embed(pan_bytes)
        b = _embed(live_bytes)
        if a is not None and b is not None:
            sim = _cosine(a, b)
            return FaceMatchResult(
                cosine=round(sim, 3),
                passed=sim >= threshold,
                threshold=threshold,
                backend="arcface",
            )

    # ----- Fallback (scripted) -----
    pan = (pan_number or "").upper()
    if pan.startswith("FRAUD"):
        cosine = 0.28
    elif pan.startswith(("PRIYA", "AAAAA", "RAMES")):
        cosine = 0.82
    else:
        # Deterministic 0.65..0.90 from PAN hash
        h = int(hashlib.sha256(pan.encode()).hexdigest()[:6], 16) if pan else 0
        cosine = round(0.65 + (h % 25) / 100, 3)
    return FaceMatchResult(
        cosine=cosine,
        passed=cosine >= threshold,
        threshold=threshold,
        backend="fallback",
    )
