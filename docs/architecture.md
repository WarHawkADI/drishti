# Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  CUSTOMER DEVICE  (browser, no install)              │
│                                                                      │
│   Next.js 14 + LiveKit React + Voice Orb UI + MediaPipe (liveness)   │
└──────────────┬─────────────────────────────────────┬─────────────────┘
               │ WebRTC                              │ HTTPS
               ▼                                     ▼
   ┌────────────────────┐                ┌──────────────────────────┐
   │   LIVEKIT CLOUD    │                │  Next.js API routes      │
   │   SFU + TURN +     │                │  /api/token  (LiveKit)   │
   │   recording        │                └──────────────────────────┘
   └─────────┬──────────┘
             │ media + data channel
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  AGENT RUNTIME  (Python LiveKit Agent on Railway/Fly)                │
│                                                                      │
│  ┌────────────────────────────────┐                                  │
│  │  Perception (parallel)         │   ┌─────────────────────────┐    │
│  │   - Deepgram STT (streaming)   │   │  Session State          │    │
│  │   - Silero VAD                 │◄─►│  (CustomerProfile,      │    │
│  │   - Frame extraction (TODO)    │   │   bureau, fraud, risk)  │    │
│  └────────────────────────────────┘   └─────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Orchestrator: Claude Sonnet 4.6 + 8 tools                     │  │
│  │  capture_consent, request_pan_upload, verify_face,             │  │
│  │  check_bureau, evaluate_offer, wait_for_selection,             │  │
│  │  flag_fraud, end_session                                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────┐                                  │
│  │  Speech Out                    │                                  │
│  │   - Cartesia Sonic (Meera)     │                                  │
│  │   - Barge-in via VAD           │                                  │
│  └────────────────────────────────┘                                  │
└─────────────┬─────────────────────────────────────────────────────────┘
              │ HTTP (httpx)
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  DRISHTI API  (FastAPI on Railway)                                   │
│                                                                      │
│  /policy   - YAML rule engine + offer grid (deterministic)           │
│  /risk     - LightGBM ONNX + SHAP top-3                              │
│  /fraud    - face-match + age + geo + aggregator (8 signals)         │
│  /bureau   - mock CIBIL by PAN prefix                                │
│  /audit    - SHA-256 hash chain in SQLite                            │
└──────────────────────────────────────────────────────────────────────┘
```

## Five layers

1. **Customer Device** — privacy-first; MediaPipe liveness runs in-browser
2. **Edge / WebRTC** — LiveKit Cloud handles SFU + NAT traversal + recording
3. **Agent Runtime** — the only stateful component; Claude orchestrator + tools
4. **Intelligence Services** — deterministic policy + ML risk + fraud detectors
5. **Audit / Compliance / Integration** — append-only hash chain + LOS webhook (TODO)

## Why this shape

- **Stateless services** scale horizontally without coordination.
- **Single FastAPI app** consolidates 5 logical surfaces into one Railway deploy.
- **Agent worker** is the only long-running process; one instance per concurrent session.
- **The LLM never reaches the policy decision directly** — it must call
  `evaluate_offer()` which routes to `/policy/evaluate`. This is the deterministic
  guardrail.

## Latency budget (per turn)

| Stage | Target | Actual (typical) |
|---|---|---|
| Deepgram STT (streaming first token) | 300 ms | 250-400 ms |
| Claude tool call decision | 600 ms | 500-900 ms |
| API service round-trip | 50 ms | 20-80 ms |
| Cartesia TTS first audio | 250 ms | 200-300 ms |
| Network + WebRTC | 300 ms | 150-400 ms |
| **Total turn latency** | **<1.5 s** | **~1.2-2.0 s** |
