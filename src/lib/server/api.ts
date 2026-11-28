import type { NextRequest } from "next/server";
import type { createRemoteJWKSet, JWTVerifyGetKey } from "jose";

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
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

let workosKeys: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function verifyWorkOSSessionToken(token: string, clientId: string, keys: JWTVerifyGetKey) {
  const { jwtVerify } = await import("jose");
  const legacyIssuer = "https://api.workos.com/";
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: [`https://api.workos.com/user_management/${clientId}`, legacyIssuer],
    requiredClaims: ["exp", "sub", "sid"],
  });
  if (!payload.sub || typeof payload.sid !== "string" || !payload.sid) return null;
  if (payload.iss === legacyIssuer && ![payload.aud].flat().includes(clientId)) return null;
  return { userId: payload.sub, sessionId: payload.sid };
}

export async function getAuthSession(req: NextRequest, reportUnavailable = false): Promise<{
  accessToken: string;
  sessionId: string;
  user: AuthUser;
} | null> {
  try {
    const { withAuth } = await import("@workos-inc/authkit-nextjs");
    const session = await withAuth();
    if (session.user) {
      return {
        accessToken: session.accessToken,
        sessionId: session.sessionId,
        user: session.user,
      };
    }
  } catch {
    // Desktop requests can authenticate with a WorkOS bearer token.
  }

  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!bearer || !clientId) return null;

  try {
    const { getWorkOS } = await import("@workos-inc/authkit-nextjs");
    const { createRemoteJWKSet } = await import("jose");
    const workos = getWorkOS();
    workosKeys ??= createRemoteJWKSet(new URL(workos.userManagement.getJwksUrl(clientId)));
    const identity = await verifyWorkOSSessionToken(bearer, clientId, workosKeys);
    if (!identity) return null;

    const user = await workos.userManagement.getUser(identity.userId);
    return { accessToken: bearer, sessionId: identity.sessionId, user };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    const rejected = code === "ERR_JWT_EXPIRED" || code === "ERR_JWT_INVALID" ||
      code === "ERR_JWT_CLAIM_VALIDATION_FAILED" || code === "ERR_JWS_INVALID" ||
      code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || code === "ERR_JOSE_ALG_NOT_ALLOWED" ||
      code === "ERR_JWKS_NO_MATCHING_KEY" ||
      (error && typeof error === "object" && "status" in error && error.status === 404);
    if (reportUnavailable && !rejected) {
      throw new ApiError(503, "Session verification is temporarily unavailable.");
    }
    return null;
  }
}

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  return (await getAuthSession(req))?.user ?? null;
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
