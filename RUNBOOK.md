# RUNBOOK — Drishti

Quick reference for running, debugging, and demoing.

## TL;DR

```bash
# one-time
cp .env.example .env  &&  edit .env

# install (each in its own folder)
( cd apps/web        && npm install )
( cd services/api    && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements.txt && python -m train.train_risk && deactivate )
( cd apps/agent      && python -m venv .venv && source .venv/Scripts/activate && pip install -r requirements.txt && deactivate )

# run (3 terminals)
# Terminal A:
cd services/api && source .venv/Scripts/activate && uvicorn api.main:app --reload --port 8421

# Terminal B:
cd apps/agent && source .venv/Scripts/activate && python -m drishti_agent.main dev

# Terminal C:
cd apps/web && npm run dev
```

Open <http://localhost:3421>.

---

## Health checks

| Service | URL | Expect |
|---|---|---|
| API | http://localhost:8421/healthz | `{"status":"ok"}` |
| API root | http://localhost:8421/ | service info JSON |
| Web | http://localhost:3421 | landing page |
| Token | `curl -X POST http://localhost:3421/api/token -H 'content-type: application/json' -d '{"sessionId":"test","name":"X"}'` | `{token, url, sessionId}` |
| Bureau | http://localhost:8421/bureau/lookup/PRIYA1234A | CIBIL 782 record |

---

## Common errors

### "ECONNREFUSED localhost:8421"

The web app or agent is trying to reach the API. **Start API first** (Terminal A).

### "LIVEKIT_API_KEY not configured"

Token route can't read env. Ensure `apps/web/.env.local` has the LiveKit keys
(or `.env` at repo root if you're using a monorepo loader).

### "model not found: claude-sonnet-4-6"

Anthropic plugin version mismatch. Update:

```bash
pip install --upgrade livekit-plugins-anthropic anthropic
```

If still failing, swap to `claude-sonnet-4-5-20250929` in `orchestrator.py`.

### Agent connects but doesn't say anything

Check Cartesia voice ID. The default in `.env.example` may not exist on your
account. Pick a voice from <https://play.cartesia.ai/voices> and set `CARTESIA_VOICE_ID`.

### "risk_model.using_fallback"

You haven't trained yet. Run:
```bash
cd services/api && source .venv/Scripts/activate && python -m train.train_risk
```

---

## Env vars cheat-sheet

| Var | Where used | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | agent | YES |
| `LIVEKIT_URL` | agent | YES |
| `LIVEKIT_API_KEY` | agent + web | YES |
| `LIVEKIT_API_SECRET` | agent + web | YES |
| `NEXT_PUBLIC_LIVEKIT_URL` | web (browser) | YES |
| `DEEPGRAM_API_KEY` | agent | YES |
| `CARTESIA_API_KEY` | agent | YES |
| `CARTESIA_VOICE_ID` | agent | optional (has default) |
| `API_BASE_URL` | agent | optional (default `http://localhost:8421`) |
| `NEXT_PUBLIC_API_BASE_URL` | web | optional |
| `AUDIT_DB_PATH` | api | optional (default `./audit.db`) |
| `LOG_LEVEL` | agent | optional (default `INFO`) |

---

## Demo flow (the 5-minute path)

1. Open http://localhost:3421
2. Type a name (e.g., "Priya")
3. Click **Start Loan Call**
4. Grant camera + microphone permission
5. Drishti greets you over voice
6. When prompted, **upload PAN**:
   - Use any image (Drishti just needs a photo, ArcFace fallback is deterministic)
   - Type PAN as `PRIYA1234A` for the happy path
   - Type PAN as `FRAUD1234A` for the fraud-catch path
   - Type PAN as `RAMES1234A` for the soft-decline path
7. Answer Drishti's questions about employment, income, purpose
8. Three-tier offer appears on the right; click one
9. Confirmation screen with audit-hash root

Total runtime: 4-6 minutes per demo.

---

## Recording the demo video

1. Use OBS (or QuickTime on Mac).
2. Resolution 1920x1080, 30fps.
3. Mic on, system audio captured.
4. Three takes per scenario, pick best.
5. Edit in DaVinci Resolve / CapCut to ~3 minutes total.
6. Upload as **unlisted** YouTube → embed link in `demo/recordings/README.md`.

---

## Verifying audit chain integrity

After a session ends, you can re-hash the chain:

```bash
curl http://localhost:8421/audit/<session_id>/verify
```

Expected:
```json
{"ok": true, "count": 12, "broken_at": null, "head_hash": "sha256..."}
```

If `ok=false`, the chain has been tampered with — the row index of the break
is in `broken_at`.
