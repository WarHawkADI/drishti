"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from "@livekit/components-react";
import CallRoom from "@/components/call/CallRoom";

type TokenResponse = {
  token: string;
  url: string;
  sessionId: string;
};

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const sessionId = params.id;
  const name = search.get("name") || "Customer";

  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchToken() {
      try {
        const res = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, name }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
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
  }, [sessionId, name]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink p-8">
        <div className="max-w-md rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-white">
            Connection failed
          </h1>
          <p className="text-sm text-rose-200">{error}</p>
          <p className="mt-4 text-xs text-indigo-300">
            Verify <code>LIVEKIT_API_KEY</code>, <code>LIVEKIT_API_SECRET</code>{" "}
            and <code>NEXT_PUBLIC_LIVEKIT_URL</code> are set in{" "}
            <code>apps/web/.env.local</code>, then refresh.
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
    >
      <CallRoom sessionId={sessionId} customerName={name} />
      <RoomAudioRenderer />
      <StartAudio label="Click to enable audio" />
    </LiveKitRoom>
  );
}
