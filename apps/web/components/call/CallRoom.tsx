"use client";

import { useEffect, useState } from "react";
import {
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

import VoiceOrb from "@/components/orb/VoiceOrb";
import LiveCaptions from "./LiveCaptions";
import SignalsPanel from "./SignalsPanel";
import OfferCard from "./OfferCard";
import PanCapture from "./PanCapture";
import EndScreen from "./EndScreen";
import ConsentDialog from "./ConsentDialog";
import ProgressSteps from "./ProgressSteps";
import CallStatusBar from "./CallStatusBar";
import SelfVideoTile from "./SelfVideoTile";
import FraudBanner from "./FraudBanner";
import Confetti from "./Confetti";
import FraudSignalBoard from "./FraudSignalBoard";
import RiskGauge from "./RiskGauge";
import TechStackBar from "./TechStackBar";

import {
  decodeEvent,
  encodeEvent,
  type AgentEvent,
  type UiEvent,
} from "@/lib/events";
import { useCallStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const AGENT_EVENT_TYPES = new Set([
  "step.change",
  "consent.request",
  "pan.request",
  "signals.update",
  "caption",
  "offer.show",
  "fraud.flag",
  "session.ended",
]);

export default function CallRoom({
  sessionId,
  customerName,
}: {
  sessionId: string;
  customerName: string;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const apply = useCallStore((s) => s.apply);
  const reset = useCallStore((s) => s.reset);
  const selectTier = useCallStore((s) => s.selectTier);
  const step = useCallStore((s) => s.step);
  const ended = useCallStore((s) => s.ended);
  const offer = useCallStore((s) => s.offer);
  const selectedTier = useCallStore((s) => s.selectedTier);
  const captions = useCallStore((s) => s.captions);
  const signals = useCallStore((s) => s.signals);
  const panRequested = useCallStore((s) => s.panRequested);
  const consentRequested = useCallStore((s) => s.consentRequested);

  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  /* ---------- mobile detection ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  /* ---------- reset store on mount ---------- */
  useEffect(() => {
    reset();
  }, [reset]);

  /* ---------- inbound data-channel events ---------- */
  useDataChannel((msg) => {
    let evt: ReturnType<typeof decodeEvent>;
    try {
      evt = decodeEvent(msg.payload);
    } catch {
      // malformed payload — ignore silently in prod, log in dev
      if (process.env.NODE_ENV === "development") {
        console.warn("[CallRoom] invalid data-channel payload");
      }
      return;
    }
    if (!evt || !("type" in evt) || typeof evt.type !== "string") return;
    if (AGENT_EVENT_TYPES.has(evt.type)) {
      try {
        apply(evt as AgentEvent);
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.error("[CallRoom] apply() threw on event", evt, e);
        }
      }
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[CallRoom] unknown event type:", evt.type);
    }
  });

  /* ---------- agent speaking detection ---------- */
  useEffect(() => {
    if (!room) return;
    const handler = (
      speakers: { isSpeaking: boolean; identity: string }[],
    ) => {
      const agentSpk = speakers.find(
        (s) =>
          s.identity.startsWith("agent-") || s.identity.includes("drishti"),
      );
      setAgentSpeaking(!!agentSpk?.isSpeaking);
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handler);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handler);
    };
  }, [room]);

  /* ---------- "thinking" state: caption is from drishti but agent stopped speaking
                without a new caption (i.e., between turns / tool calls) ---------- */
  useEffect(() => {
    if (agentSpeaking) {
      setThinking(false);
      return;
    }
    const last = captions[captions.length - 1];
    if (last?.speaker === "customer") {
      // user just finished speaking → agent is reasoning
      setThinking(true);
      const t = setTimeout(() => setThinking(false), 6000);
      return () => clearTimeout(t);
    }
    setThinking(false);
  }, [agentSpeaking, captions]);

  /* ---------- send geo report on mount ---------- */
  useEffect(() => {
    if (!navigator.geolocation || !localParticipant) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const evt: UiEvent = {
          type: "geo.report",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        localParticipant
          .publishData(encodeEvent(evt), { reliable: true })
          .catch(() => {});
      },
      () => {},
      { timeout: 5000 },
    );
  }, [localParticipant]);

  function publishUi(evt: UiEvent) {
    if (!localParticipant) return;
    localParticipant
      .publishData(encodeEvent(evt), { reliable: true })
      .catch(() => {});
  }

  function toggleMic() {
    if (!localParticipant) return;
    const next = !micEnabled;
    localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }

  function toggleVideo() {
    if (!localParticipant) return;
    const next = !videoEnabled;
    localParticipant.setCameraEnabled(next);
    setVideoEnabled(next);
  }

  function leave() {
    room?.disconnect();
    window.location.href = "/";
  }

  /* ---------- end screen ---------- */
  if (ended) {
    return (
      <>
        {ended.outcome === "approved" && <Confetti />}
        <EndScreen
          ended={ended}
          offer={offer}
          selectedTier={selectedTier}
          onLeave={leave}
        />
      </>
    );
  }

  // Hide the orb when an interactive overlay is active, so the user focuses on the form.
  const overlayActive =
    (panRequested && step === "pan") ||
    (!!consentRequested && step === "consent");

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Top status bar */}
      <CallStatusBar sessionId={sessionId} customerName={customerName} />

      {/* Fraud banner (only when high-severity flag fires) */}
      <FraudBanner />

      {/* Progress rail */}
      <div className="border-b border-white/10 px-4 py-3 sm:px-6">
        <ProgressSteps step={step} />
      </div>

      {/* Main grid */}
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[260px_1fr_340px]">
        {/* Left - signals (mobile: collapsible top) */}
        <aside className="order-2 lg:order-none">
          <SignalsPanel />
        </aside>

        {/* Center - orb + captions + interactive surfaces */}
        <main className="relative order-1 flex min-h-[320px] flex-col items-center justify-between rounded-2xl glass-strong p-4 sm:min-h-[420px] sm:p-6 lg:order-none lg:p-8">
          {/* Self-video PiP */}
          <SelfVideoTile />

          {/* Voice orb — collapses to a small thumbnail when overlay is active */}
          <div
            className={`flex items-center justify-center transition-all duration-500 ${
              overlayActive ? "h-20 pt-2" : "flex-1 pt-4"
            }`}
          >
            <VoiceOrb
              active={agentSpeaking}
              thinking={thinking}
              size={
                overlayActive
                  ? 80
                  : isMobile
                    ? 180
                    : 240
              }
            />
          </div>

          {/* Captions */}
          <LiveCaptions />

          {/* Overlays */}
          {panRequested && step === "pan" && (
            <PanCapture
              onUpload={(payload) => {
                publishUi({
                  type: "pan.uploaded",
                  pan_number: payload.panNumber,
                  name: payload.name,
                  dob: payload.dob,
                  photo_data_url: payload.photoDataUrl,
                });
              }}
            />
          )}

          {/* Consent dialog auto-hides once the agent moves past the consent
              step — verbal "I agree" through STT advances the flow without
              requiring a click on the visual confirm button. */}
          {consentRequested && step === "consent" && (
            <ConsentDialog
              key={consentRequested.consent_type}
              prompt={consentRequested.prompt}
              consentType={consentRequested.consent_type}
              onAccept={(spoken) => {
                publishUi({
                  type: "consent.given",
                  consent_type: consentRequested.consent_type,
                  spoken_text: spoken,
                });
              }}
            />
          )}
        </main>

        {/* Right column — context-aware:
              · before evaluation: fraud-signal board + risk gauge + tech stack
              · on offer:          offer card
              · on decline / human review: respective card
        */}
        <aside className="order-3 space-y-3 lg:order-none">
          {offer.decision === "offer" && offer.offers.length > 0 && (
            <OfferCard
              offer={offer}
              onSelect={(tier) => {
                selectTier(tier);
                publishUi({ type: "offer.selected", tier });
              }}
            />
          )}
          {offer.decision === "soft_decline" && (
            <DeclineCard
              reason={offer.reason}
              nba={offer.nextBestAction}
            />
          )}
          {offer.decision === "human_review" && (
            <HumanReviewCard reason={offer.reason} />
          )}

          {/* Pre-decision: data-viz panels (always-visible during the journey) */}
          {!offer.decision && (
            <>
              <RiskGauge value={signals.risk as string | undefined} />
              <FraudSignalBoard />
              <TechStackBar />
            </>
          )}
        </aside>
      </div>

      {/* Bottom controls */}
      <footer
        className="sticky bottom-0 z-10 flex items-center justify-center gap-3 border-t border-white/10 bg-ink/80 px-4 py-4 backdrop-blur sm:relative sm:bg-transparent sm:px-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <ControlBtn
          onClick={toggleMic}
          active={micEnabled}
          label={micEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {micEnabled ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </ControlBtn>
        <ControlBtn
          onClick={toggleVideo}
          active={videoEnabled}
          label={videoEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {videoEnabled ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </ControlBtn>
        <button
          type="button"
          onClick={leave}
          className="flex h-12 items-center gap-2 rounded-full bg-rose-500/90 px-5 font-bold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-500"
        >
          <PhoneOff className="h-5 w-5" /> End call
        </button>
      </footer>
    </div>
  );
}

function ControlBtn({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition",
        active
          ? "bg-white/10 text-white hover:bg-white/20"
          : "bg-rose-500/30 text-rose-200 hover:bg-rose-500/40",
      )}
    >
      {children}
    </button>
  );
}

function DeclineCard({ reason, nba }: { reason?: string; nba?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 caption-enter">
      <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
        Decline · Next-Best-Action
      </p>
      <h3 className="mt-2 text-lg font-bold text-white">{reason}</h3>
      {nba && <p className="mt-3 text-sm text-amber-100">{nba}</p>}
    </div>
  );
}

function HumanReviewCard({ reason }: { reason?: string }) {
  return (
    <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-5 caption-enter">
      <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
        Routed for human review
      </p>
      <h3 className="mt-2 text-base font-bold text-white">
        Our team will reach out shortly.
      </h3>
      {reason && (
        <p className="mt-3 text-xs italic text-violet-200/80">Why: {reason}</p>
      )}
    </div>
  );
}
