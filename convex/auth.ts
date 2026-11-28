import type { Auth } from "convex/server";

/** Require an authenticated identity and, when supplied, its matching owner ID. */
export async function requireUser(ctx: { auth: Auth }, ownerId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || (ownerId !== undefined && identity.subject !== ownerId)) {
    throw new Error("Unauthorized");
  }
  return identity;
}
