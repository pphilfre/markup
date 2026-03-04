import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export async function GET() {
  const url = await getSignInUrl();
  return NextResponse.redirect(url);
}
