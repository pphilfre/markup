import type { AuthConfig } from "convex/server";

const clientId = process.env.WORKOS_CLIENT_ID;
const jwks = `https://api.workos.com/sso/jwks/${clientId}`;

export default {
  providers: clientId ? [
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks,
    },
    {
      type: "customJwt",
      issuer: "https://api.workos.com/",
      applicationID: clientId,
      algorithm: "RS256",
      jwks,
    },
  ] : [],
} satisfies AuthConfig;
