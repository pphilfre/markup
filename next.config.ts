import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "didactic-space-engine-g475rrjqrv7rhw97-3000.app.github.dev",
    "freddiephilpot.dev",
    "localhost",
  ],
  async rewrites() {
    return [
      {
        source: "/_widgets/:path*",
        destination: "https://api.workos.com/_widgets/:path*",
      },
    ];
  },
};

export default nextConfig;
