import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
  compiler: {
    emotion: true,
  },
};

export default nextConfig;
