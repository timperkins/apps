import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export into out/, served by Firebase Hosting (no server code).
  output: "export",
};

export default nextConfig;
