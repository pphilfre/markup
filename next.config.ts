import type { NextConfig } from "next";

const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

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
  allowedDevOrigins: [
    "didactic-space-engine-g475rrjqrv7rhw97-3000.app.github.dev",
    "freddiephilpot.dev",
    "localhost",
  ],
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
};

export default nextConfig;
