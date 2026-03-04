import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

/**
 * Returns the WorkOS access token for the current session.
 * Called by the Convex auth provider on the client side.
 */
export async function GET() {
  try {
    const session = await withAuth();

    if (!session || !session.accessToken) {
      return NextResponse.json({ accessToken: null, user: null });
    }

    return NextResponse.json({
      accessToken: session.accessToken,
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
