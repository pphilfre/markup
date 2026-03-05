import { withAuth, getWorkOS } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

/**
 * Returns the authenticated user's full profile, sessions, and auth factors.
 */
export async function GET() {
  try {
    const session = await withAuth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const workos = getWorkOS();
    const userId = session.user.id;

    // Fetch user profile and auth factors in parallel
    const [user, factors] = await Promise.all([
      workos.userManagement.getUser(userId),
      workos.userManagement.listAuthFactors({ userId }).then((r) => r.data),
    ]);

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      authFactors: factors.map((f) => ({
        id: f.id,
        type: f.type,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }
}
