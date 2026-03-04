"use server";

import { getSignInUrl, signOut } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export async function handleSignIn() {
  const url = await getSignInUrl();
  redirect(url);
}

export async function handleSignOut() {
  await signOut();
}
