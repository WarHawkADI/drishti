# Compliance & Audit

Drishti is engineered RBI-native. This document maps every Reserve Bank of India
**Digital Lending Guidelines (DLG) 2022** requirement to its implementation,
covers DPDP Act 2023 controls, and explains the tamper-evident hash chain.

---

## RBI DLG 2022 — requirement-by-requirement mapping

| #  | RBI Requirement | Drishti Implementation                                                                 |
|----|-----------------|----------------------------------------------------------------------------------------|
| 1  | Transparency in loan terms | Offer card surfaces amount, rate, tenure, processing fee, total cost of credit. Both narrated by Drishti and persisted in the audit bundle PDF. |
| 2  | Cooling-off / look-up period | Built into the post-decision flow; customer can withdraw within the regulatory window (configurable in `policy_engine`). |
| 3  | No unsolicited credit-limit increase | Offers are bounded by the YAML `grid.yaml` cells. The LLM cannot propose anything outside the grid. |
| 4  | Verifiable consent | Six verbal-consent checkpoints (data-processing, credit-pull, video-recording, offer-acceptance, e-sign, audit-share). Each stored as `(spoken_text, language, ts, prev_hash, this_hash)` in the SHA-256 chain. |
| 5  | Data storage in India | All media + PII written to AWS `ap-south-1` (Mumbai). LiveKit Cloud project pinned to India region. Audit SQLite stays on the API container's persistent volume in Mumbai. |
| 6  | Grievance redressal | Audit-bundle PDF includes a grievance officer contact and the session ID for one-click lookup. |
| 7  | Fair-practices code | Soft-decline narratives are empathetic and always paired with a next-best-action. No dark patterns; live captions are always on. |
| 8  | Audit trail | Append-only SHA-256 hash chain in SQLite. Every event (consent, capture, tool call, decision) is a row. Verifiable at `/audit/{session_id}/verify`. Recordings retained 7 years per RBI norms. |
| 9  | Explainability of decisions | Every score returns a SHAP top-3 driver list. The LLM narrates the decision in plain language, citing those drivers. |

---

## DPDP Act 2023 — key controls

| Control | Implementation |
|---------|----------------|
| Purpose specification | At every consent checkpoint, the consent_type is captured (e.g., `data_processing` for the credit decision only). |
| Data minimisation | Only fields the policy engine and risk model need are captured. No marketing data, no biometrics retained beyond the audit window. |
| Right to erasure | Documented deletion flow + cryptographic shredding (key rotation invalidates old audit hashes). |
| Data Principal rights | A self-serve dashboard (post-MVP) lets the customer download or delete their session data. The API exposes `GET /audit/{session_id}` for download today. |

---

## The hash chain in detail

Each `audit` row carries:

```
{
  id              integer     primary key
  session_id      text        the room/session identifier
  seq             integer     1, 2, 3, ... within a session
  ts              text        ISO-8601 timestamp UTC
  event           text        e.g., "consent.captured", "bureau.pulled"
  data_json       text        the event payload (JSON)
  prev_hash       text        sha256 of the previous row, or NULL for seq 1
  this_hash       text        sha256(json({session_id, seq, ts, event, data, prev}))
}
```

### Verification algorithm (Python pseudocode)

```python
expected_prev = None
for row in rows_in_seq_order:
    if row.prev_hash != expected_prev:
        return BROKEN
    payload = json.dumps({
        "session_id": session_id,
        "seq":  row.seq,
        "ts":   row.ts,
        "event": row.event,
        "data": row.data,
        "prev": row.prev_hash,
    }, sort_keys=True)
    if sha256(payload) != row.this_hash:
        return BROKEN
    expected_prev = row.this_hash
return OK, expected_prev   # final root hash
```

Tampering with **any** row breaks the chain from that row forward. Detectable
in O(n).

### Final root hash

The final row's `this_hash` is the **session root hash**. We:

- Print it on the offer/decline PDF.
- Send it back to the customer over the data channel as `session.ended.audit_hash`.
- Persist it in PostgreSQL (production) for cross-reference.
- Optionally anchor it in a public blockchain (post-MVP) for ultimate non-repudiation.

---

## What's in the audit bundle (per session)

| Artifact | Format | Where |
|----------|--------|-------|
| Session video (compressed) | H.265 480p | S3 ap-south-1 |
| Diarized transcript | JSONL with `t_start`, `t_end`, `speaker`, `text`, `confidence` | S3 + the chain row |
| Decision tree | JSON: which rules fired, which scores, which SHAP drivers | The chain row |
| Consent ledger | The 6 chain entries with `consent_type` + `spoken_text` + hashes | The chain itself |
| Fraud report | All flags + evidence frames + severity | The chain row |
| Final hash + retention metadata | Just bytes | The chain |

---

## Sample chain entry (real output)

```json
{
  "session_id": "drs_abc123",
  "seq": 3,
  "ts": "2026-04-30T14:22:01.347Z",
  "event": "bureau.pulled",
  "data": {
    "pan_masked": "ABCD****F",
    "cibil": 742,
    "existing_loans": 1,
    "dpd_30plus_last_12m": 0,
    "segment": "near_prime"
  },
  "prev_hash": "9f2a3b1c...c14e",
  "this_hash": "ab12cd34...e5f6"
}
```

---

## Honest limitations (what we don't ship in v1)

- **Aadhaar OCR via UIDAI** — we use Verhoeff checksum + format validation; UIDAI integration is a 2-week production task.
- **Cross-border data transfer audit** — we *prevent* it (no S3 buckets outside ap-south-1) but the audit doesn't yet emit a "no transfer occurred" attestation.
- **Hindi/Marathi audit-trail** — chain entries are English-only in v1; localized audit copies for grievance redressal are post-MVP.
- **Notarization** — root hashes are not anchored to a public chain in v1. Easy to add (Polygon/Avalanche, ~₹0.001/anchor).

---

> **Compliance is not a slide. It's a hash chain.**
