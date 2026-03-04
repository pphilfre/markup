import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    "didactic-space-engine-g475rrjqrv7rhw97-3000.app.github.dev",
    "freddiephilpot.dev",
    "localhost",
  ],
};

export default nextConfig;
