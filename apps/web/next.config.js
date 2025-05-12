/** @type {import('next').NextConfig} */
const path = require('path'); // Make sure path is imported

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Vercel specific output configuration (might not be strictly necessary if using Root Dir setting)
  // output: 'standalone', // This can sometimes help with dependency tracing for serverless

  webpack: (config, { isServer, webpack, buildId }) => {
    if (isServer) {
      // Ensure Prisma engine files are copied to the .next/server/ FOLDER
      // where the serverless functions will run.

      // This path needs to point to where the 'prisma generate' for 'apps/web'
      // actually outputs the RHEL engine file during the Vercel build.
      // If 'prisma generate' runs in 'apps/web', it outputs to 'apps/web/node_modules/.prisma/client/'
      const engineDir = path.join(__dirname, 'node_modules/.prisma/client');

      // The specific engine file name for RHEL OpenSSL 3.0.x
      const rhelEngineFile = 'libquery_engine-rhel-openssl-3.0.x.so.node';

      // Add a new rule to copy the engine file using file-loader or similar
      // This tells Webpack to treat the .node file as an asset and include it.
      config.module.rules.push({
        test: /\.node$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              // Output path relative to .next/server/
              // We want it next to the Prisma client runtime, or in a known location.
              // Prisma client by default looks for it in node_modules/.prisma/client/
              // or next to the schema file.
              // For serverless, it's best to have it in the .next/server/pages/api directory or .next/server/
              // Let's try putting it directly in the server output root for simplicity first.
              outputPath: '.', // This will put it in .next/server/
              // A more precise path would be 'static/chunks/pages/api/' or similar if needed.
            },
          },
        ],
      });

      // You might also need to ensure that the require path for the engine
      // within Prisma client can find it. Prisma client has internal logic for this.
      // Sometimes, you need to set PRISMA_QUERY_ENGINE_LIBRARY env var at runtime
      // if the engine is not in a default search path.

      // Alternative: Using Prisma's recommended way to output engines for serverless
      // This is often done by ensuring 'prisma generate' creates a 'runtime' folder.
      // The 'binaryTargets' in schema.prisma should handle engine availability.
      // The main issue is the bundler NOT including it.

      // Try to ensure the Prisma client folder is not tree-shaken too aggressively
      // by making sure the directory is resolvable.
      // This can be tricky. A common way is to use Next.js's unstable_includeFiles
      // or to ensure something in your API code directly requires a file from that dir.

      // For Prisma, often the easiest way is to ensure that prisma generate
      // runs in the correct context and then the bundler includes the output.
      // The `file-loader` approach for .node files is a common fix.

      // Add pg-native to externals if you use it and it causes issues
      config.externals = [...config.externals, 'pg-native'];
    }
    return config;
  },
};

module.exports = nextConfig;