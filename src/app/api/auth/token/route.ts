import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

/**
 * Returns the WorkOS access token + a widget token for the current session.
 * The widget token is required by @workos-inc/widgets (UserProfile, etc.)
 * and is generated via the WorkOS Widgets API.
 */
export async function GET() {
  try {
    const session = await withAuth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ accessToken: null, user: null });
    }

    // Generate a widget token for the WorkOS widgets
    let widgetToken: string | null = null;
    if (session.user?.id && process.env.WORKOS_API_KEY) {
      try {
        const res = await fetch(
          "https://api.workos.com/user_management/widgets/token",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.WORKOS_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId: session.user.id }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          widgetToken = data.token ?? null;
        }
      } catch {
        // Widget token generation failed; widgets will be unavailable
      }
    }

    return NextResponse.json({
      accessToken: session.accessToken,
      widgetToken,
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
  } catch {
    return NextResponse.json({ accessToken: null, user: null });
  }
}
