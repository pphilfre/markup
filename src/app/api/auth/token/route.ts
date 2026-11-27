import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/server/api";

/** Return credentials from the verified browser or desktop session. */
export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ accessToken: null, sessionId: null, user: null });
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
