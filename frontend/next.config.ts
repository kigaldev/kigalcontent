import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  reactStrictMode: true,
  transpilePackages: ["@astryxdesign/core", "@astryxdesign/theme-neutral"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
