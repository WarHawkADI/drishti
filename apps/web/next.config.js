/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Ensure node runtime for routes that need server SDKs
  env: {
    APP_VERSION: "0.1.0",
  },
};

module.exports = nextConfig;
