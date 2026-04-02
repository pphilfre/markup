import type { NextConfig } from "next";

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;
const isProd = process.env.NODE_ENV === "production";

const codespacesPortForwardHost =
  process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : undefined;

const allowedDevOrigins = [codespacesPortForwardHost, "freddiephilpot.dev", "localhost", "127.0.0.1"].filter(
  (origin): origin is string => Boolean(origin)
);

const siteOrigin = (() => {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL || "https://markup.freddiephilpot.dev";

  try {
    return new URL(candidate).origin;
  } catch {
    return "https://markup.freddiephilpot.dev";
  }
})();

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProd ? "" : "'unsafe-eval'"} https://va.vercel-scripts.com`.trim(),
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  isProd ? "frame-ancestors 'none'" : "frame-ancestors 'self' https://github.dev https://*.app.github.dev",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
]
  .filter(Boolean)
  .join("; ");

const baseSecurityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ...(isProd ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
      ]
    : []),
];

const sensitiveNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // For Tauri static export builds we temporarily strip server-only routes,
    // which can cause Next's generated type validators to reference modules
    // that no longer exist. Skipping type checking in that mode keeps the
    // desktop build stable while preserving full type safety for normal builds.
    ignoreBuildErrors: isTauriBuild,
  },
  // Static export for Tauri production builds (no Node.js server needed)
  ...(isTauriBuild ? { output: "export" } : {}),
  allowedDevOrigins,
  async rewrites() {
    // Rewrites are not supported with static export, skip them for Tauri
    if (isTauriBuild) return [];
    return [
      {
        source: "/_widgets/:path*",
        destination: "https://api.workos.com/_widgets/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      {
        source: "/_next/static/media/:path*",
        headers: [
          ...(isProd
            ? [
                {
                  key: "Access-Control-Allow-Origin",
                  value: siteOrigin,
                },
                {
                  key: "Vary",
                  value: "Origin",
                },
              ]
            : []),
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        source: "/api/auth/:path*",
        headers: sensitiveNoStoreHeaders,
      },
      {
        source: "/callback",
        headers: sensitiveNoStoreHeaders,
      },
      {
        source: "/",
        headers: sensitiveNoStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
