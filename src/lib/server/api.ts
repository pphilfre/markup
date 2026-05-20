import type { NextRequest } from "next/server";

type JwtClaims = Record<string, unknown>;

export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string): ApiError {
  return new ApiError(400, message);
}

export function unauthorized(message = "Unauthorized"): ApiError {
  return new ApiError(401, message);
}

export function forbidden(message = "Forbidden"): ApiError {
  return new ApiError(403, message);
}

function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function userFromClaims(claims: JwtClaims, userId: string): AuthUser {
  return {
    id: userId,
    email: typeof claims.email === "string" ? claims.email : "",
    firstName: typeof claims.given_name === "string" ? claims.given_name : null,
    lastName: typeof claims.family_name === "string" ? claims.family_name : null,
    profilePictureUrl: typeof claims.picture === "string" ? claims.picture : null,
  };
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    const session = await withAuth();

    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        profilePictureUrl: session.user.profilePictureUrl,
      };
    }
  } catch {
    // Fallback to bearer token below.
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  if (!bearer) return null;

  const claims = decodeJwtPayload(bearer);
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) return null;

  try {
    const { getWorkOS } = await import("@workos-inc/authkit-nextjs");
    const workos = getWorkOS();
    const user = await workos.userManagement.getUser(userId);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
    };
  } catch {
    return userFromClaims(claims ?? {}, userId);
  }
}

export async function requireAuthUser(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) {
    throw unauthorized();
  }
  return user;
}

export function assertUserIdMatch(userId: string, user: AuthUser): void {
  if (userId !== user.id) {
    throw forbidden("User mismatch.");
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
