import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Returns the WorkOS access token for the current session.
 * Called by the Convex auth provider and WorkOS widgets on the client side.
 */
export async function GET(req: NextRequest) {
  try {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    const session = await withAuth();

    if (!session || !session.accessToken) {
      const authHeader = req.headers.get("authorization");
      const bearer = authHeader?.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : null;

      if (!bearer) {
        return NextResponse.json({ accessToken: null, sessionId: null, user: null });
      }

      // Best-effort desktop fallback: decode token claims and fetch profile.
      const claims = decodeJwtPayload(bearer);
      const userId = typeof claims?.sub === "string" ? claims.sub : null;
      const sessionId = typeof claims?.sid === "string" ? claims.sid : null;

      if (!userId) {
        return NextResponse.json({
          accessToken: bearer,
          sessionId,
          user: null,
        });
      }

      try {
        const { getWorkOS } = await import("@workos-inc/authkit-nextjs");
        const workos = getWorkOS();
        const user = await workos.userManagement.getUser(userId);
        return NextResponse.json({
          accessToken: bearer,
          sessionId,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
          },
        });
      } catch {
        return NextResponse.json({
          accessToken: bearer,
          sessionId,
          user: {
            id: userId,
            email: typeof claims?.email === "string" ? claims.email : "",
            firstName: null,
            lastName: null,
            profilePictureUrl: null,
          },
        });
      }
    }

    return NextResponse.json({
      accessToken: session.accessToken,
      sessionId: "sessionId" in session ? session.sessionId : null,
      user: session.user
        ? {
            id: session.user.id,
            email: session.user.email,
            firstName: session.user.firstName,
            lastName: session.user.lastName,
            profilePictureUrl: session.user.profilePictureUrl,
          }
        : null,
    });
  } catch (error) {
    console.error("[auth/token] Failed to resolve auth token", error);
    return NextResponse.json({ accessToken: null, sessionId: null, user: null });
  }
}
