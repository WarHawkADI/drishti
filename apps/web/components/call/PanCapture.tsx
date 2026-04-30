"use client";

import { useState, useRef } from "react";
import { Upload, FileImage, AlertCircle } from "lucide-react";

type PanPayload = {
  panNumber: string;
  name: string;
  dob: string;
  photoDataUrl: string;
};

type Props = {
  onUpload: (p: PanPayload) => void;
};

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * PAN capture step.
 *
 * In v1 we accept a manual upload (image of PAN card) and ask the
 * customer to type the PAN number for verification. In v2 we'd run
 * Tesseract.js or call Google Vision for OCR.
 */
export default function PanCapture({ onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [panNumber, setPanNumber] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please upload an image file (jpg/png).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  function submit() {
    setError(null);
    const pan = panNumber.toUpperCase().trim();
    if (!PAN_REGEX.test(pan)) {
      setError("PAN must match format AAAAA9999A.");
      return;
    }
    if (!name.trim()) return setError("Name as on PAN is required.");
    if (!dob) return setError("Date of birth is required.");
    // Photo is optional in v1: face match falls back to deterministic by-PAN scoring.
    // A real PAN image would be required in production.
    onUpload({
      panNumber: pan,
      name: name.trim(),
      dob,
      photoDataUrl: photoDataUrl || "",
    });
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
        Upload a photo of your PAN card. Our computer-vision will match it to
        your face on camera.
      </p>

      {/* Demo PAN quick-fills */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px]">
        <span className="font-bold uppercase tracking-widest text-indigo-300">
          Demo:
        </span>
        {[
          {
            pan: "PRIYA1234A",
            label: "Happy",
            color: "text-emerald-300",
            name: "Priya Sharma",
            dob: "1996-03-15",
          },
          {
            pan: "FRAUD1234A",
            label: "Fraud",
            color: "text-rose-300",
            name: "Fraud Test",
            dob: "1990-01-01",
          },
          {
            pan: "RAMES1234A",
            label: "Decline",
            color: "text-amber-300",
            name: "Ramesh Kumar",
            dob: "1979-08-20",
          },
        ].map((d) => (
          <button
            type="button"
            key={d.pan}
            onClick={() => {
              setPanNumber(d.pan);
              setName(d.name);
              setDob(d.dob);
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
