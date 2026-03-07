import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * Desktop OAuth entry point.
 *
 * The Tauri app opens the system browser to this route with ?port=XXXX.
 * We store the port in a cookie so the client-side page can redirect
 * back to the desktop app's localhost OAuth server after auth completes.
 */
export async function GET(req: NextRequest) {
  const port = req.nextUrl.searchParams.get("port");

  if (!port || !/^\d{4,5}$/.test(port)) {
    return NextResponse.json({ error: "Invalid port" }, { status: 400 });
  }

  // Store the desktop port so the landing page can redirect back
  const cookieStore = await cookies();
  cookieStore.set("desktop_port", port, {
    path: "/",
    maxAge: 300, // 5 minutes
    httpOnly: false, // needs to be readable by client JS
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const signInUrl = await getSignInUrl();
  return NextResponse.redirect(signInUrl);
}
