/** @type {import('next').NextConfig} */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack'); // Import webpack

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      const outputDirInLambda = 'prisma-runtime-files';
      const engineSourceDir = path.join(__dirname, 'node_modules/.prisma/client');
      const engineFile = 'libquery_engine-rhel-openssl-3.0.x.so.node';
      const engineSourcePath = path.join(engineSourceDir, engineFile);
      const schemaSourcePath = path.join(__dirname, 'prisma/schema.prisma');
      const destinationDir = path.join(__dirname, '.next/server/', outputDirInLambda);

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            { from: engineSourcePath, to: destinationDir, noErrorOnMissing: false },
            { from: schemaSourcePath, to: path.join(destinationDir, 'schema.prisma'), noErrorOnMissing: false },
          ],
        }),
        // Define these environment variables for the serverless function's runtime
        new webpack.DefinePlugin({
          'process.env.PRISMA_QUERY_ENGINE_LIBRARY': JSON.stringify(`./${outputDirInLambda}/libquery_engine-rhel-openssl-3.0.x.so.node`),
          'process.env.PRISMA_SCHEMA_PATH': JSON.stringify(`./${outputDirInLambda}/schema.prisma`),
        })
      );

      if (!config.externals) { config.externals = []; }
      config.externals.push('pg-native');
    }
    return config;
  },
};

module.exports = nextConfig;