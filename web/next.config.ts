import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @coral-xyz/anchor ships CJS that Next prefers to externalize on the server.
  serverExternalPackages: ["@coral-xyz/anchor"],
  // Empty turbopack config silences the "webpack config without turbopack config" warning
  // and signals we're aware Next 16 defaults to Turbopack.
  turbopack: {},
};

export default nextConfig;
