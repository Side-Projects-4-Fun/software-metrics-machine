import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  reactCompiler: true,
  compiler: {
    emotion: true,
  },
  // The Cypress harness proxies the app from 127.0.0.1 while the dev server is
  // initialized for localhost, so Next blocks its `/_next` dev requests as
  // cross-origin. Only the CI e2e job drives the app through that proxy — local
  // development keeps the default, stricter allowance.
  ...(process.env.CI ? { allowedDevOrigins: ['127.0.0.1'] } : {}),
};

export default nextConfig;
