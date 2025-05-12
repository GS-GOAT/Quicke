/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      if (!config.externals) { config.externals = []; }
      config.externals.push('pg-native');
    }
    return config;
  },
};
module.exports = nextConfig;