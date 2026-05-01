import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

// Force Node runtime (required by livekit-server-sdk)
export const runtime = "nodejs";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

const SESSION_ID_RE = /^[a-z0-9_-]{6,64}$/i;
const NAME_RE = /^[\p{L}\p{N} .'-]{1,40}$/u;

// Tiny in-memory rate limiter — best effort only; production would use Redis.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const recent = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    recent.set(key, arr);
    return true;
  }
  arr.push(now);
  recent.set(key, arr);
  return false;
}

/**
 * POST /api/token
 * Body: { sessionId: string, name: string }
 * Returns: { token: string, url: string, sessionId: string, expiresAt: number }
 *
 * Mints a 60-min LiveKit access token. Validates sessionId format (URL-safe),
 * name length, and applies a soft rate limit per (IP, sessionId) tuple.
 */
export async function POST(req: NextRequest) {
  if (!API_KEY || !API_SECRET) {
    // Don't leak env var names to the public — return a generic error.
    return NextResponse.json(
      { error: "Service is not configured. Contact support." },
      { status: 500 }
    );
  }

  let body: { sessionId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = (body.sessionId ?? "").trim();
  const name = (body.name ?? "").trim();

  if (!SESSION_ID_RE.test(sessionId)) {
    return NextResponse.json(
      { error: "Invalid sessionId format" },
      { status: 400 }
    );
  }
  if (!NAME_RE.test(name)) {
    return NextResponse.json(
      { error: "Invalid name (1-40 chars, letters/digits/spaces only)" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon";
  if (rateLimited(`${ip}|${sessionId}`)) {
    return NextResponse.json(
      { error: "Too many token requests. Please wait a minute." },
      { status: 429 }
    );
  }

  // 60-minute TTL: long enough to cover slow demos and a brief reconnect, but
  // short enough that a leaked token is not a long-term credential.
  const ttlSeconds = 60 * 60;
  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: `customer-${sessionId}`,
    name,
    ttl: ttlSeconds,
  });

  at.addGrant({
    room: sessionId,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "";

  return NextResponse.json({
    token,
    url,
    sessionId,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
