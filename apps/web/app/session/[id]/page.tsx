"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import CallRoom from "@/components/call/CallRoom";

type TokenResponse = {
  token: string;
  url: string;
  sessionId: string;
  expiresAt?: number;
};

type PermState = "unknown" | "granted" | "denied" | "no-device";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const sessionId = params.id;
  const name = search.get("name") || "Customer";

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permState, setPermState] = useState<PermState>("unknown");

  /* ---------- pre-flight permission probe ---------- */
  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        if (!cancelled) setPermState("no-device");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        // Immediately release tracks — LiveKit will re-acquire on connect.
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setPermState("granted");
      } catch (err) {
        if (cancelled) return;
        // Type-guard the error: blind `as DOMException` crashes on iOS Safari
        // when getUserMedia rejects with a plain Error or null.
        const name =
          err instanceof DOMException
            ? err.name
            : err instanceof Error
              ? err.name
              : "UnknownError";
        if (name === "NotFoundError" || name === "OverconstrainedError") {
          setPermState("no-device");
        } else {
          setPermState("denied");
        }
      }
    }
    probe();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- fetch token only after permission OK ---------- */
  useEffect(() => {
    if (permState !== "granted") return;
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, name }),
        });
        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data: TokenResponse = await res.json();
        if (!cancelled) {
          setToken(data.token);
          setServerUrl(data.url);
        }
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to fetch token");
      }
    }
    fetchToken();
    return () => {
      cancelled = true;
    };
  }, [sessionId, name, permState]);

  /* ---------- permission denied / no device ---------- */
  if (permState === "denied" || permState === "no-device") {
    const isDenied = permState === "denied";
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink p-6">
        <div className="max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-white">
            {isDenied ? "Camera & microphone needed" : "No camera or microphone found"}
          </h1>
          <p className="text-sm text-amber-200">
            {isDenied
              ? "Drishti is a video call — we need camera and microphone access to verify your identity and have a conversation."
              : "We couldn't detect a camera or microphone on this device. Try a phone or laptop with both."}
          </p>
          {isDenied && (
            <ul className="mt-4 space-y-1 text-left text-xs text-amber-100/80">
              <li>1. Click the camera icon in your browser&apos;s address bar.</li>
              <li>2. Allow access for this site.</li>
              <li>3. Refresh.</li>
            </ul>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink p-8">
        <div className="max-w-md rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-white">
            Connection failed
          </h1>
          <p className="text-sm text-rose-200">
            We couldn&apos;t reach the call service. Please refresh and try again.
          </p>
          <p className="mt-3 text-[11px] text-rose-300/70">
            Reference: <code className="font-mono">{error.slice(0, 80)}</code>
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (permState === "unknown") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <div className="text-center text-indigo-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="text-sm uppercase tracking-widest text-gold">
            Checking camera & mic
          </p>
          <p className="mt-2 text-xs text-indigo-300/70">
            Please allow access when prompted.
          </p>
        </div>
      </main>
    );
  }

  if (!token || !serverUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <div className="text-center text-indigo-200">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="text-sm uppercase tracking-widest text-gold">
            Connecting to Drishti
          </p>
          <p className="mt-2 text-lg">Establishing secure session…</p>
          <p className="mt-3 text-xs text-indigo-300/70">
            Session {sessionId.slice(-6)} · {name}
          </p>
        </div>
      </main>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video
      data-lk-theme="default"
      className="min-h-screen bg-ink"
      onError={(e) => {
        // LiveKit connection error — fall back to error screen.
        setError(e?.message || "LiveKit connection failed");
      }}
    >
      <CallRoom sessionId={sessionId} customerName={name} />
      <RoomAudioRenderer />
      <StartAudio label="Click to enable audio" />
    </LiveKitRoom>
  );
}
