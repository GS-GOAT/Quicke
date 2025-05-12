/** @type {import('next').NextConfig} */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      // Source directory for the generated Prisma client and engines for THIS APP (apps/web)
      const generatedClientDir = path.join(__dirname, 'prisma/generated-client');
      const engineFile = 'libquery_engine-rhel-openssl-3.0.x.so.node';
      const engineSourcePath = path.join(generatedClientDir, engineFile);
      const schemaSourcePath = path.join(__dirname, 'prisma/schema.prisma');

      // Output directory for these files within the Lambda package
      const outputDirInLambda = 'prisma-runtime'; // Changed name for clarity
      const destinationDir = path.join(__dirname, '.next/server/', outputDirInLambda);

      console.log(`[Next.config.js] Webpack: Engine source: ${engineSourcePath}`);
      console.log(`[Next.config.js] Webpack: Schema source: ${schemaSourcePath}`);
      console.log(`[Next.config.js] Webpack: Copy destination dir: ${destinationDir}`);

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: engineSourcePath,
              to: destinationDir, // e.g., .next/server/prisma-runtime/libquery_engine...
              noErrorOnMissing: false,
            },
            {
              from: schemaSourcePath,
              to: path.join(destinationDir, 'schema.prisma'), // e.g., .next/server/prisma-runtime/schema.prisma
              noErrorOnMissing: false,
            },
          ],
        }),
        new webpack.DefinePlugin({
          // This tells Prisma Client where to look for the files AT RUNTIME inside the Lambda
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