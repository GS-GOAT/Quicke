#-----------------------------------------------------------------------------
# STAGE 1: Base - Just Node and pnpm
#-----------------------------------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

#-----------------------------------------------------------------------------
# STAGE 2: Deps - Install ALL dependencies for the entire workspace, but ignore scripts initially
#-----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /usr/src/app
COPY pnpm-workspace.yaml ./
COPY package.json ./ 
# Root package.json
COPY apps/api-worker/package.json ./apps/api-worker/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
COPY pnpm-lock.yaml ./

# Install ALL dependencies, but IGNORE SCRIPTS to prevent apps/web's postinstall from running here
RUN pnpm install --recursive --frozen-lockfile --ignore-scripts

#-----------------------------------------------------------------------------
# STAGE 3: Builder - Apply patches, copy source, generate Prisma Client for api-worker
#-----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /usr/src/app

# Copy pre-installed node_modules and manifests from 'deps' stage
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
# Copy only the package.json files needed for pnpm exec context
COPY --from=deps /usr/src/app/apps/api-worker/package.json ./apps/api-worker/
COPY --from=deps /usr/src/app/packages/db/package.json ./packages/db/ 
# For schema path
COPY --from=deps /usr/src/app/packages/utils/package.json ./packages/utils/


# Now, explicitly run the root postinstall (for patch-package)
# patch-package needs its files to be present.
COPY patches ./patches 
# Assuming your patches directory is at the root
RUN pnpm exec patch-package

# Copy all source code necessary for the api-worker and its prisma generate
COPY apps/api-worker ./apps/api-worker
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma 
# Source for api-worker's schema copy
COPY packages/utils ./packages/utils

# Sync the schema for api-worker (if you have this script in root)
# Or just ensure apps/api-worker/prisma/schema.prisma is created/copied before generate
RUN mkdir -p ./apps/api-worker/prisma && cp ./packages/db/prisma/schema.prisma ./apps/api-worker/prisma/schema.prisma

# Generate Prisma Client specifically for the api-worker, using its local schema copy.
RUN pnpm --filter "@quicke/api-worker" exec prisma generate

#-----------------------------------------------------------------------------
# STAGE 4: Production Image - Final image
#-----------------------------------------------------------------------------
FROM node:22-alpine AS final
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8080

# Copy only the necessary package.json files for the production install.
COPY pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/apps/api-worker/package.json ./apps/api-worker/package.json
COPY --from=builder /usr/src/app/packages/utils/package.json ./packages/utils/package.json
RUN echo '{ "name": "prod-dummy-root", "private": true }' > package.json

RUN corepack enable pnpm
# Install prod dependencies. --ignore-scripts should prevent any residual postinstall.
RUN pnpm install --prod --ignore-scripts --recursive --filter "@quicke/api-worker" --filter "@quicke/utils"

# Copy application code for api-worker
COPY --from=builder /usr/src/app/apps/api-worker/src ./apps/api-worker/src

# Copy shared utils code
COPY --from=builder /usr/src/app/packages/utils ./packages/utils/

# Copy the generated Prisma Client & its runtime for api-worker
COPY --from=builder /usr/src/app/apps/api-worker/node_modules/.prisma ./apps/api-worker/node_modules/.prisma
COPY --from=builder /usr/src/app/apps/api-worker/node_modules/@prisma/client ./apps/api-worker/node_modules/@prisma/client

WORKDIR /usr/src/app/apps/api-worker

EXPOSE 8080
CMD ["node", "src/server.js"]