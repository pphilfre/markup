import { signOut } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await signOut();
  } catch {
    // signOut() may internally redirect/throw — catch and redirect manually
  }
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || "http://localhost:3000"));
}
