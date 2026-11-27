import type { Auth } from "convex/server";

export async function requireUser(ctx: { auth: Auth }, ownerId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || (ownerId !== undefined && identity.subject !== ownerId)) {
    throw new Error("Unauthorized");
  }
  return identity;
}
