"use client";

import { useEffect, useState, useRef } from "react";
import { Upload, FileImage, AlertCircle } from "lucide-react";

type PanPayload = {
  panNumber: string;
  name: string;
  dob: string;
  photoDataUrl: string;
  livePhotoDataUrl: string;
};

type Props = {
  onUpload: (p: PanPayload) => void;
  demoScenario?: "happy" | "fraud" | "decline" | null;
};

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB hard cap on PAN photo
const MIN_DOB = "1925-01-01";
const MIN_AGE_YEARS = 18;
const MAX_AGE_YEARS = 80;
const DEMO_PAN_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

async function captureLiveFrame(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Camera capture failed.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

/**
 * PAN capture step.
 *
 * In v1 we accept a manual upload (image of PAN card) and ask the
 * customer to type the PAN number for verification. In v2 we'd run
 * Tesseract.js or call Google Vision for OCR.
 */
const DEMOS = {
  happy: {
    pan: "PRIYA1234A",
    label: "Happy",
    color: "text-emerald-300",
    name: "Priya Sharma",
    dob: "1996-03-15",
  },
  fraud: {
    pan: "FRAUD1234A",
    label: "Fraud",
    color: "text-rose-300",
    name: "Fraud Test",
    dob: "1990-01-01",
  },
  decline: {
    pan: "RAMES1234A",
    label: "Decline",
    color: "text-amber-300",
    name: "Ramesh Kumar",
    dob: "1979-08-20",
  },
} as const;

export default function PanCapture({ onUpload, demoScenario }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [panNumber, setPanNumber] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!demoScenario) return;
    const d = DEMOS[demoScenario];
    setPanNumber(d.pan);
    setName(d.name);
    setDob(d.dob);
    setPhotoDataUrl(DEMO_PAN_IMAGE);
  }, [demoScenario]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image (JPG / PNG).");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("Image is over 5 MB. Please use a smaller photo.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read that file. Try another.");
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setError("Unsupported file format.");
        return;
      }
      setPhotoDataUrl(result);
      setError(null);
    };
    reader.readAsDataURL(f);
  }

  async function submit() {
    setError(null);
    const pan = panNumber.toUpperCase().trim();
    if (!PAN_REGEX.test(pan)) {
      setError("PAN must match format AAAAA9999A.");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Name as on PAN is required.");
    if (trimmedName.length > 60) return setError("Name is too long.");
    if (!dob) return setError("Date of birth is required.");
    if (!photoDataUrl) return setError("PAN photo is required for face verification.");

    const age = ageFromDob(dob);
    if (age < 0) return setError("Date of birth is invalid.");
    if (age < MIN_AGE_YEARS) return setError("You must be at least 18 to apply.");
    if (age > MAX_AGE_YEARS) return setError("Date of birth looks incorrect.");

    try {
      const livePhotoDataUrl = await captureLiveFrame();
      onUpload({
        panNumber: pan,
        name: trimmedName,
        dob,
        photoDataUrl,
        livePhotoDataUrl,
      });
    } catch {
      setError("Camera capture failed. Please allow camera access and try again.");
    }
  }

  return (
    <div className="mt-6 w-full max-w-2xl rounded-xl border border-violet-400/40 bg-indigo-deep/80 p-5 backdrop-blur caption-enter">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-violet-300" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-violet-300">
            PAN Verification
          </h3>
        </div>
        <span className="hidden sm:inline-flex rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-200">
          Step 3 of 6
        </span>
      </div>
      <p className="mb-3 text-sm text-indigo-100">
        Upload a photo of your PAN card. We will capture a live camera frame
        on submit for face verification.
      </p>

      {/* Demo PAN quick-fills */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px]">
        <span className="font-bold uppercase tracking-widest text-indigo-300">
          Demo:
        </span>
        {Object.values(DEMOS).map((d) => (
          <button
            type="button"
            key={d.pan}
            onClick={() => {
              setPanNumber(d.pan);
              setName(d.name);
              setDob(d.dob);
              setPhotoDataUrl(DEMO_PAN_IMAGE);
              setError(null);
            }}
            className={`group min-h-[36px] rounded-md bg-white/5 px-2.5 py-1.5 font-mono transition hover:bg-white/10 ${d.color}`}
            title={`Auto-fill ${d.label} scenario`}
          >
            {d.pan}
            <span className="ml-1.5 text-[9px] opacity-70 group-hover:opacity-100">
              {d.label}
            </span>
          </button>
        ))}
      </div>

      {/* Upload area */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label="Upload PAN card photo"
        className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-violet-400/40 bg-violet-500/5 px-4 py-6 text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/10"
      >
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUrl}
            alt="PAN card preview"
            className="max-h-32 rounded shadow-lg"
          />
        ) : (
          <>
            <Upload className="h-6 w-6" />
            <span className="text-sm">Click to upload PAN card photo</span>
            <span className="text-[10px] text-violet-300/70">
              Optional for demo · used by ArcFace face-match in production
            </span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
        aria-label="PAN card image file"
      />

      {/* Form */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pan-num"
            className="block text-[10px] font-bold uppercase tracking-widest text-indigo-300"
          >
            PAN Number
          </label>
          <input
            id="pan-num"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            maxLength={10}
            aria-label="PAN number"
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white focus:border-violet-400 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="pan-dob"
            className="block text-[10px] font-bold uppercase tracking-widest text-indigo-300"
          >
            Date of Birth
          </label>
          <input
            id="pan-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            min={MIN_DOB}
            max={new Date().toISOString().split("T")[0]}
            aria-label="Date of birth"
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="pan-name"
            className="block text-[10px] font-bold uppercase tracking-widest text-indigo-300"
          >
            Full name as on PAN
          </label>
          <input
            id="pan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rahul Sharma"
            aria-label="Full name as on PAN"
            className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-center gap-2 text-xs text-red-300"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        className="mt-4 w-full rounded-lg bg-gold px-4 py-3 font-bold text-ink shadow-lg shadow-gold/20 transition hover:bg-yellow-400"
      >
        Submit for verification
      </button>
    </div>
  );
}
