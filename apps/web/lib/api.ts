/**
 * Typed client for the Drishti FastAPI backend.
 * Uses NEXT_PUBLIC_API_BASE_URL or falls back to localhost.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8421";

export type AuditEntry = {
  seq: number;
  ts: string;
  event: string;
  data: Record<string, unknown>;
  prev_hash: string | null;
  this_hash: string;
};

export type AuditSession = {
  session_id: string;
  entries: AuditEntry[];
  head_hash: string | null;
};

export type VerifyResult = {
  ok: boolean;
  count: number;
  broken_at: number | null;
  reason?: string;
  head_hash?: string | null;
};

export type BureauRecord = {
  pan: string;
  cibil: number;
  existing_loans: number;
  dpd_30plus_last_12m: number;
  segment: string;
  pulled_at?: string;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function fetchAudit(sessionId: string): Promise<AuditSession> {
  return get<AuditSession>(`/audit/${encodeURIComponent(sessionId)}`);
}

export async function verifyAudit(sessionId: string): Promise<VerifyResult> {
  return get<VerifyResult>(
    `/audit/${encodeURIComponent(sessionId)}/verify`,
  );
}

export async function fetchBureau(pan: string): Promise<BureauRecord> {
  return get<BureauRecord>(`/bureau/lookup/${encodeURIComponent(pan)}`);
}

export async function fetchHealth(): Promise<{ status: string }> {
  return get("/healthz");
}

export type AuditSessionSummary = {
  session_id: string;
  count: number;
  first_ts: string | null;
  last_ts: string | null;
  decision: string | null;
  outcome: string | null;
  cibil: number | null;
  fraud_severity_max: number;
  latency_ms: number | null;
};

export type SessionsResponse = {
  count: number;
  sessions: AuditSessionSummary[];
};

export async function fetchSessions(limit = 50): Promise<SessionsResponse> {
  return get<SessionsResponse>(`/audit/sessions?limit=${limit}`);
}

export const API_BASE_URL = BASE;
