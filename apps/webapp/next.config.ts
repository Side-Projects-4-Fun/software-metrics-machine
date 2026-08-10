import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  reactCompiler: true,
  compiler: {
    emotion: true,
  },
};

export default nextConfig;
