import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@bitgo/sdk-api",
    "@bitgo/sdk-coin-eth",
  ],
  turbopack: {
    // The ethmumbai root has its own package.json which confuses Turbopack's
    // workspace root detection. Pin it to this project's directory so it
    // resolves node_modules (including tailwindcss) from here.
    root: __dirname,
  },
};

export default nextConfig;
