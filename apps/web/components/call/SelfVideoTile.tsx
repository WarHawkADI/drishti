"use client";

import { useTracks, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Video } from "lucide-react";

/**
 * Picture-in-picture self-view of the customer's camera.
 * Anchored bottom-right of the call screen as a trust signal.
 */
export default function SelfVideoTile() {
  const trackRefs = useTracks([Track.Source.Camera]);
  const localTrack = trackRefs.find((t) => t.participant.isLocal);

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-4 z-10 flex h-28 w-44 select-none items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-black/60 shadow-2xl backdrop-blur sm:h-32 sm:w-52"
      aria-label="Your camera preview"
    >
      {localTrack && localTrack.publication?.track ? (
        <VideoTrack
          trackRef={localTrack}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-1 text-indigo-300/60">
          <Video className="h-5 w-5" />
          <span className="text-[10px] uppercase tracking-widest">
            Camera off
          </span>
        </div>
      )}

      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/90">
        You
      </span>
    </div>
  );
}
