import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // These packages use native Node.js modules and must not be bundled by Turbopack.
  // They are only imported from API routes (server-side), never from client components.
  serverExternalPackages: [
    "@bitgo/sdk-api",
    "@bitgo/sdk-coin-eth",
  ],
};

export default nextConfig;
