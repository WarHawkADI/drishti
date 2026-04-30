# Drishti — The Agentic AI Loan Officer

> **Sees. Understands. Decides. In 5 minutes.**
>
> Built for Poonawalla Fincorp's Loan Wizard vision — TenzorX 2026, Problem Statement #3.
> Team **IIITDards** · Aditya Rai + Alabhya Jha · IIIT Delhi.

Drishti is a video-native, agentic AI loan officer that runs an end-to-end digital
loan origination in the browser. A customer clicks a link, has a 5-minute
conversation with Drishti (voice + video), uploads their PAN, answers a few
questions, and receives a personalized loan offer — all signed and audited
end-to-end with a tamper-evident SHA-256 hash chain.

---

## What's in this repo

```
drishti/
├── apps/
│   ├── web/              # Next.js 14 frontend (Vercel)
│   └── agent/            # Python LiveKit Agent (Claude orchestrator)
├── services/
│   └── api/              # FastAPI: policy / risk / fraud / bureau / audit
├── docs/                 # architecture, tools, compliance, etc.
├── demo/                 # scenario scripts and recordings
├── .env.example          # all env vars in one place
└── README.md             # you are here
```

Three runtime processes:

| # | Process | What | Where |
|---|---|---|---|
| 1 | **API** | FastAPI on `:8421` — policy engine, risk model, fraud signals, mock CIBIL, audit chain | `services/api` |
| 2 | **Agent** | Python LiveKit Agent with Claude Sonnet 4.6 + Sarvam-replaceable Deepgram/Cartesia | `apps/agent` |
| 3 | **Web** | Next.js 14 on `:3421` — landing + call UI + token mint | `apps/web` |

---

## Prerequisites

- **Node.js** 20+
- **Python** 3.11+
- **API keys** (all have free tiers — see `.env.example`):
  - Anthropic (Claude)
  - LiveKit Cloud
  - Deepgram (free $200 credit)
  - Cartesia (free tier)

Total cost for prototype dev + demo recording: **~₹850-1,650** (mostly Anthropic).

---

## One-time setup

### 1. Clone and prepare env files

```bash
git clone <your repo url>
cd drishti
cp .env.example .env
# edit .env and fill in: ANTHROPIC_API_KEY, LIVEKIT_*, DEEPGRAM_API_KEY,
#                       CARTESIA_API_KEY, NEXT_PUBLIC_LIVEKIT_URL
```

Each app reads from `../../.env` (root) — but you can also drop a copy in each app dir
if you prefer.

### 2. Install web

```bash
cd apps/web
npm install
cd ../..
```

### 3. Install API service + train the risk model (one-time)

```bash
cd services/api
python -m venv .venv
# Windows Git Bash:
source .venv/Scripts/activate
# Linux/Mac:
# source .venv/bin/activate

pip install -r requirements.txt
python -m train.train_risk     # produces api/artifacts/risk_model.onnx
deactivate
cd ../..
```

### 4. Install agent

```bash
cd apps/agent
python -m venv .venv
source .venv/Scripts/activate    # or .venv/bin/activate
pip install -r requirements.txt
deactivate
cd ../..
```

---

## Running locally — three terminals

### Terminal A — API

```bash
cd services/api
source .venv/Scripts/activate
uvicorn api.main:app --reload --port 8421
```

Verify: open <http://localhost:8421/healthz> → `{"status":"ok"}`.

### Terminal B — Agent

```bash
cd apps/agent
source .venv/Scripts/activate
python -m drishti_agent.main dev
```

The agent connects to LiveKit Cloud and waits for rooms.

### Terminal C — Web

```bash
cd apps/web
npm run dev
```

Open <http://localhost:3421>, enter a name, click **Start Loan Call**.
You'll be routed to `/session/<id>` where Drishti joins the call.

---

## Demo scenarios

| Scenario | PAN prefix | Outcome |
|---|---|---|
| **A — Happy Path** | `PRIYAxxxxx` (e.g. `PRIYA1234A`) | CIBIL 782, salaried, 3-tier offer presented |
| **B — Fraud Catch** | `FRAUDxxxxxx` (e.g. `FRAUD1234A`) | Face-match fails (cosine 0.28) → block + human review |
| **C — Soft Decline** | `RAMESxxxxxx` (e.g. `RAMES1234A`) | CIBIL 638 → soft decline + next-best-action |

Any other PAN gets a deterministic synthetic CIBIL band derived from the PAN's
first letter. See `services/api/api/core/bureau_db.py` for the buckets.

---

## Transparency table — what's production-ready vs mocked

| Component | Status |
|---|---|
| Video call (LiveKit) | ✅ Production-grade |
| LLM Orchestrator (Claude Sonnet 4.6) | ✅ Production-grade |
| STT | ✅ Working (Deepgram). Sarvam Saaras is the production roadmap. |
| TTS | ✅ Working (Cartesia "Sonic"). Sarvam Bulbul "Meera" is the production roadmap. |
| Voice-orb UI + live captions | ✅ Production-grade |
| Policy engine + offer grid | ✅ 8 rules + 7-cell grid (`services/api/api/data/`) |
| Risk model | ✅ LightGBM trained on synthetic Indian-flavoured data; production needs PF's loan book |
| SHAP explainability | ✅ Top-3 drivers per prediction |
| Fraud signals | ⚠️ 3 of 8 implemented (face-match, age-mismatch, geo-mismatch). 5 designed and documented. |
| Liveness | 🔧 Browser MediaPipe planned; v1 ships server-side ArcFace cosine only |
| Face match | ✅ ArcFace cosine via fallback if `arcface.onnx` absent (deterministic by PAN prefix) |
| Bureau (CIBIL) | 🔧 Mocked with realistic synthetic data, deterministic by PAN prefix |
| Aadhaar / PAN OCR | 🔧 Manual upload + format validation (Verhoeff for Aadhaar is in roadmap) |
| Audit hash chain | ✅ Working SHA-256 chain in SQLite |
| RBI DLG bundle | 🔧 Sample audit JSON; full PDF bundle generator is post-MVP |
| Indian languages (Hindi/Marathi) | 🔧 English-only in v1; Sarvam Saaras+Bulbul roadmap |
| Observability | 🔧 Structured logs; Langfuse hookup is post-MVP |

---

## Repo overview by deploy unit

### `apps/web` — Next.js frontend

- `app/page.tsx` — landing
- `app/session/[id]/page.tsx` — call UI
- `app/api/token/route.ts` — LiveKit token mint
- `components/orb/VoiceOrb.tsx` — animated orb
- `components/call/*` — consent dialog, PAN capture, captions, signals, offer card, end screen
- `lib/store.ts` — Zustand store
- `lib/events.ts` — typed data-channel events (mirrored on the agent side)

### `services/api` — FastAPI backend

- `api/main.py` — app setup
- `api/routers/{policy,risk,fraud,bureau,audit}.py`
- `api/core/{policy_engine,risk_model,face_match,fraud_aggregator,bureau_db,audit_chain}.py`
- `api/data/{rules.yaml,grid.yaml}` — policy rules + offer grid
- `train/train_risk.py` — LightGBM training + ONNX export

### `apps/agent` — Python LiveKit Agent

- `drishti_agent/main.py` — entry
- `drishti_agent/orchestrator.py` — VoiceAssistant + 8 tools
- `drishti_agent/prompts.py` — system prompt
- `drishti_agent/state.py` — session state
- `drishti_agent/events.py` — data-channel events
- `drishti_agent/tools/*.py` — `consent`, `document`, `face`, `bureau`, `offer`, `fraud`, `session`
- `drishti_agent/audit_client.py` — async client over `/audit`

---

## API surface (FastAPI)

```
GET    /healthz
POST   /policy/evaluate           # profile + risk -> decision + offers
GET    /policy/rules              # rulebook for transparency
GET    /policy/grid               # offer grid
POST   /risk/score                # profile -> {risk, propensity, shap_top3}
POST   /fraud/face-match          # {pan_photo,live_photo,pan_number} -> cosine + pass
POST   /fraud/aggregate           # signals -> verdict
GET    /fraud/registry            # all 8 signal types
GET    /bureau/lookup/{pan}       # mock CIBIL
POST   /audit/append              # append to session chain
GET    /audit/{session_id}        # full session chain
GET    /audit/{session_id}/verify # re-hash and verify
```

---

## Troubleshooting

**Agent doesn't speak when the customer joins**
→ Check `Terminal B` for stack traces. Most common: missing
`ANTHROPIC_API_KEY` / `DEEPGRAM_API_KEY` / `CARTESIA_API_KEY`.

**`risk_model.using_fallback` warning**
→ You haven't run `python -m train.train_risk`. The system still works (uses a
deterministic scorecard), but for the demo, train the real model.

**`livekit-server-sdk` errors in the token route**
→ Ensure `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are set in `.env`. The Next.js
runtime for `app/api/token/route.ts` is `nodejs` (not edge) — already configured.

**No microphone access**
→ Browser must be served over HTTPS or `localhost`. Vercel preview URLs are HTTPS;
local `http://localhost:3421` is also allowed.

---

## License

MIT — see `LICENSE`.

---

## Team

**IIITDards · IIIT Delhi**

- Aditya Rai — agent orchestration, LLM integration, product (`aditya23047@iiitd.ac.in`)
- Alabhya Jha — frontend, infrastructure, observability

Built with **Claude Sonnet 4.6**, **Cartesia Sonic**, **Deepgram Nova-3**, **LiveKit Cloud**,
**LightGBM**, **FastAPI**, **Next.js 14**, **Tailwind**, **Framer Motion**, **Zustand**.

---

> *The LLM talks. The policy engine decides.*
