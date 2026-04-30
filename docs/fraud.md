# Fraud Detection

Drishti runs **8 real-time fraud signals** concurrently throughout every call.
Three are implemented in v1; five are designed and documented for v2.

## The 8 signals

| # | Signal | Method | Threshold | Sev | Action | v1? |
|---|---|---|---|---|---|---|
| 1 | `face_mismatch` | ArcFace cosine sim | < 0.4 | 4 | block | ✅ |
| 2 | `age_mismatch` | \|declared − CV age\| | > 7 yr | 2 | flag | ✅ |
| 3 | `liveness_failure` | Blink + head-turn challenge | failed | 5 | block | 🔧 |
| 4 | `geo_mismatch` | Haversine(declared, IP) | > 300 km | 2 | flag | ✅ |
| 5 | `document_tamper` | ELA + template match | score > 0.7 | 4 | block | 🔧 |
| 6 | `voice_age_mismatch` | Pyannote voice-age vs declared | \|Δ\| > 10 yr | 2 | flag | 🔧 |
| 7 | `answer_inconsistency` | LLM cross-check across session | any flag | 3 | probe | ✅ (LLM-driven) |
| 8 | `coaching_detection` | Pyannote diarization | > 1 voice | 3 | probe | 🔧 |

## Severity ladder

```
1  Log
2  Flag + review                 (orchestrator probes; routes to human after session)
3  Probe + review                (orchestrator probes immediately; routes to human before offer)
4  Pause + human review          (offer withheld; full evidence dispatched)
5  Hard block                    (24h device/IP ban)
```

## Aggregator

```python
sev_max = max(s.severity for s in signals)
if sev_max >= 5: decision = "block"
elif sev_max >= 4: decision = "human_review"
elif sev_max >= 3: decision = "human_review"
elif sev_max >= 2: decision = "probe"
else: decision = "pass"
```

The aggregator is intentionally simple and **deterministic** — every fraud
decision is replayable from the audit chain.

## Demo: Scenario B (impersonator)

PAN prefix `FRAUD` triggers:
- `face_mismatch` — cosine 0.28 (severity 4)
- `age_mismatch` — declared 25, CV estimates 42 (severity 2)
- `geo_mismatch` — declared Bangalore, IP Delhi 1900km (severity 2 if geo is reported)

Aggregate severity 4 → block + human review. Drishti politely ends the call;
the audit chain has every signal with evidence frames keyed by timestamp.

## Why multi-modal matters

A real customer rarely triggers more than one signal weakly.
A fraudster using a stolen PAN + deepfake face + VPN typically triggers ≥3.
Drishti's aggregator scores the **session**, not the individual signal.
