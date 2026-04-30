"""
Mock CIBIL bureau.

Returns deterministic synthetic bureau records keyed off the PAN's first
character (so demos are reproducible). In production this would call a
real CIBIL/Equifax/Experian/CRIF API.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

# Stable buckets by PAN first letter
_BUCKETS = [
    # (cibil, existing_loans, dpd_30plus_last_12m, segment)
    (790, 1, 0, "prime"),         # A
    (760, 0, 0, "prime"),         # B
    (740, 1, 0, "near_prime"),    # C
    (720, 2, 0, "near_prime"),    # D
    (700, 1, 0, "near_prime"),    # E
    (685, 2, 0, "borderline"),    # F
    (670, 0, 0, "borderline"),    # G
    (660, 3, 1, "borderline"),    # H
    (640, 1, 1, "subprime"),      # I  <- triggers soft decline
    (620, 2, 2, "subprime"),      # J
    (740, 2, 0, "near_prime"),    # K
    (770, 0, 0, "prime"),         # L
    (730, 1, 0, "near_prime"),    # M
    (700, 1, 0, "near_prime"),    # N
    (680, 2, 0, "borderline"),    # O
    (650, 1, 1, "borderline"),    # P
    (725, 1, 0, "near_prime"),    # Q
    (735, 0, 0, "near_prime"),    # R  <- "Rahul" demo prefix
    (745, 1, 0, "near_prime"),    # S
    (715, 0, 0, "near_prime"),    # T
    (695, 2, 0, "borderline"),    # U
    (705, 1, 0, "near_prime"),    # V
    (720, 0, 0, "near_prime"),    # W
    (730, 1, 0, "near_prime"),    # X
    (745, 0, 0, "near_prime"),    # Y
    (760, 1, 0, "prime"),         # Z
]


@dataclass
class BureauRecord:
    pan: str
    cibil: int
    existing_loans: int
    dpd_30plus_last_12m: int
    segment: str
    pulled_at: str = ""

    def to_dict(self) -> dict:
        return self.__dict__


def lookup(pan: str) -> BureauRecord:
    pan = pan.upper().strip()
    if not pan:
        raise ValueError("PAN required")

    # ---- Scripted demo overrides (must come BEFORE the generic bucket map) ----
    if pan.startswith(("PRIYA", "AAAAA")):
        return BureauRecord(
            pan=pan, cibil=782, existing_loans=1,
            dpd_30plus_last_12m=0, segment="prime",
        )
    if pan.startswith("RAMES"):
        return BureauRecord(
            pan=pan, cibil=638, existing_loans=2,
            dpd_30plus_last_12m=1, segment="subprime",
        )
    if pan.startswith("FRAUD"):
        # Clean credit; fraud comes from the face/age/geo signals not bureau
        return BureauRecord(
            pan=pan, cibil=712, existing_loans=0,
            dpd_30plus_last_12m=0, segment="near_prime",
        )

    # ---- Deterministic bucket fallback (first letter -> band) ----
    first = pan[0] if pan[0].isalpha() else "R"
    idx = (ord(first) - ord("A")) % 26
    cibil, loans, dpd, segment = _BUCKETS[idx]

    # Add a small deterministic jitter from the rest of the PAN
    h = int(hashlib.sha256(pan.encode()).hexdigest()[:6], 16)
    cibil_jitter = (h % 21) - 10  # -10..+10
    cibil_final = max(450, min(900, cibil + cibil_jitter))

    return BureauRecord(
        pan=pan,
        cibil=cibil_final,
        existing_loans=loans,
        dpd_30plus_last_12m=dpd,
        segment=segment,
    )
