import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  reactCompiler: true,
  compiler: {
    emotion: true,
  },

  ...(process.env.CI ? { allowedDevOrigins: ['127.0.0.1'] } : {}),
};

export default nextConfig;
