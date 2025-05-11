#-----------------------------------------------------------------------------
# STAGE 1: Base - Just Node and pnpm
#-----------------------------------------------------------------------------
    FROM node:22-alpine AS base
    ENV PNPM_HOME="/pnpm"
    ENV PATH="$PNPM_HOME:$PATH"
    RUN corepack enable pnpm
    
    #-----------------------------------------------------------------------------
    # STAGE 2: Deps - Install ALL dependencies for the entire workspace
    #-----------------------------------------------------------------------------
    FROM base AS deps
    WORKDIR /usr/src/app
    COPY pnpm-workspace.yaml ./
    COPY package.json ./ 
    # Root package.json (has postinstall for patch-package)
    COPY apps/api-worker/package.json ./apps/api-worker/
    COPY apps/web/package.json ./apps/web/
    COPY packages/db/package.json ./packages/db/
    COPY packages/utils/package.json ./packages/utils/
    COPY pnpm-lock.yaml ./
    # FULL install here, patch-package WILL run due to root package.json's postinstall
    RUN pnpm install --recursive --frozen-lockfile
    
    #-----------------------------------------------------------------------------
    # STAGE 3: Builder - Generate Prisma Client
    #-----------------------------------------------------------------------------
    FROM base AS builder
    WORKDIR /usr/src/app
    
    # Copy everything from deps stage (includes patched node_modules)
    COPY --from=deps /usr/src/app/node_modules ./node_modules
    COPY --from=deps /usr/src/app/package.json ./package.json
    COPY --from=deps /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
    COPY --from=deps /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
    COPY apps ./apps
    COPY packages ./packages
    
    RUN pnpm --filter "@quicke/api-worker" exec prisma generate
    
    #-----------------------------------------------------------------------------
    # STAGE 4: Production Image - Final image
    #-----------------------------------------------------------------------------
    FROM node:22-alpine AS final
    WORKDIR /usr/src/app
    
    ENV NODE_ENV=production
    ENV PORT=8080
    
    # Copy only the necessary package.json files for the production install.
    # DO NOT copy the root package.json that has the postinstall script.
    COPY pnpm-workspace.yaml ./
    COPY --from=builder /usr/src/app/apps/api-worker/package.json ./apps/api-worker/package.json
    COPY --from=builder /usr/src/app/packages/utils/package.json ./packages/utils/package.json
    # Create a dummy root package.json for this stage if pnpm requires it,
    # one WITHOUT the postinstall script.
    RUN echo '{ "name": "prod-dummy-root", "private": true }' > package.json
    
    RUN corepack enable pnpm
    # Install prod dependencies. --ignore-scripts should prevent any residual postinstall.
    RUN pnpm install --prod --ignore-scripts --recursive --filter "@quicke/api-worker" --filter "@quicke/utils"
    
    # Copy application code for api-worker
    COPY --from=builder /usr/src/app/apps/api-worker/src ./apps/api-worker/src
    
    # Copy shared utils code
    COPY --from=builder /usr/src/app/packages/utils ./packages/utils/
    # COPY --from=builder /usr/src/app/packages/utils/index.js ./packages/utils/index.js
    # COPY --from=builder /usr/src/app/packages/utils/errorService.js ./packages/utils/errorService.js # etc.
    
    # Copy the generated Prisma Client & its runtime for api-worker
    COPY --from=builder /usr/src/app/apps/api-worker/node_modules/.prisma ./apps/api-worker/node_modules/.prisma
    COPY --from=builder /usr/src/app/apps/api-worker/node_modules/@prisma/client ./apps/api-worker/node_modules/@prisma/client
    
    WORKDIR /usr/src/app/apps/api-worker
    
    EXPOSE 8080
    CMD ["node", "src/server.js"]