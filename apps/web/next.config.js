/** @type {import('next').NextConfig} */
const path = require('path');
// const CopyPlugin = require('copy-webpack-plugin'); // REMOVE
// const webpack = require('webpack'); // REMOVE if only used for DefinePlugin

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // outputFileTracingIncludes: { ... } // REMOVE or comment out for this strategy
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      if (!config.externals) { config.externals = []; }
      config.externals.push('pg-native');
      // NO CopyPlugin or DefinePlugin for Prisma paths here
    }
    return config;
  },
};
module.exports = nextConfig;