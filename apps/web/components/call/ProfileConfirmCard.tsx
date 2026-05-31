"use client";

import { CheckCircle2, IndianRupee } from "lucide-react";
import type { ConfirmedProfile } from "@/lib/events";
import { formatINR } from "@/lib/utils";

type Props = {
  profile: ConfirmedProfile;
  onConfirm: () => void;
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  salaried: "Salaried",
  salaried_pvt: "Private salaried",
  salaried_govt: "Government salaried",
  self_employed: "Self-employed",
  other: "Other",
};

export default function ProfileConfirmCard({ profile, onConfirm }: Props) {
  const rows = [
    ["Age", `${profile.age} years`],
    ["Monthly income", `Rs ${formatINR(profile.monthly_income)}`],
    ["Employment", EMPLOYMENT_LABELS[profile.employment_type] ?? profile.employment_type],
    ["Purpose", profile.loan_purpose.replaceAll("_", " ")],
    ["Requested amount", `Rs ${formatINR(profile.requested_amount)}`],
    ["City", profile.declared_city],
  ];

  return (
    <div className="mt-6 w-full max-w-2xl rounded-xl border border-gold/50 bg-gold/10 p-5 backdrop-blur caption-enter">
      <div className="mb-4 flex items-center gap-2">
        <IndianRupee className="h-5 w-5 text-gold" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-gold">
          Confirm Application Details
        </h3>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
          >
            <dt className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              {label}
            </dt>
            <dd className="mt-1 font-semibold capitalize text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onConfirm}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-ink transition hover:bg-yellow-300"
      >
        <CheckCircle2 className="h-4 w-4" />
        Confirm details
      </button>
    </div>
  );
}
