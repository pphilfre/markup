import { NextRequest, NextResponse } from "next/server";
import { ApiError, getAuthSession } from "@/lib/server/api";

/** Return credentials from the verified browser or desktop session. */
export async function GET(req: NextRequest) {
  const session = await getAuthSession(req, true).catch((error: unknown) => {
    if (error instanceof ApiError) return error;
    throw error;
  });
  if (session instanceof ApiError) {
    return NextResponse.json({ error: session.message }, { status: session.status });
  }
  if (!session) {
    return NextResponse.json(
      { accessToken: null, sessionId: null, user: null },
      { status: req.headers.get("authorization") ? 401 : 200 },
    );
  }

  const { accessToken, sessionId, user } = session;
  return NextResponse.json({
    accessToken,
    sessionId,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
    },
  });
}
