import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

// Force Node runtime (required by livekit-server-sdk)
export const runtime = "nodejs";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

/**
 * POST /api/token
 * Body: { sessionId: string, name: string }
 * Returns: { token: string, url: string }
 *
 * Mints a short-lived LiveKit access token for the given session.
 * The agent worker auto-joins rooms it sees, so the customer just
 * needs to publish into a room named `sessionId`.
 */
export async function POST(req: NextRequest) {
  if (!API_KEY || !API_SECRET) {
    return NextResponse.json(
      { error: "LIVEKIT_API_KEY / LIVEKIT_API_SECRET not configured" },
      { status: 500 }
    );
  }

  let body: { sessionId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, name } = body;
  if (!sessionId || !name) {
    return NextResponse.json(
      { error: "sessionId and name are required" },
      { status: 400 }
    );
  }

  const at = new AccessToken(API_KEY, API_SECRET, {
    identity: `customer-${sessionId}`,
    name,
    ttl: 60 * 30, // 30 minutes (room for demo overruns)
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

  return NextResponse.json({ token, url, sessionId });
}
