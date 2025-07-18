# Base image
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# Install dependencies
FROM base AS deps
WORKDIR /usr/src/app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api-worker/package.json ./apps/api-worker/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
COPY pnpm-lock.yaml ./
RUN pnpm install --recursive --frozen-lockfile --ignore-scripts

# Build and generate Prisma client
FROM base AS builder
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /usr/src/app/apps/api-worker/package.json ./apps/api-worker/
COPY --from=deps /usr/src/app/packages/db/package.json ./packages/db/
COPY --from=deps /usr/src/app/packages/utils/package.json ./packages/utils/
COPY patches ./patches 
RUN pnpm exec patch-package
COPY apps/api-worker ./apps/api-worker
COPY packages/db/prisma/schema.prisma ./packages/db/prisma/schema.prisma 
COPY packages/utils ./packages/utils
RUN mkdir -p ./apps/api-worker/prisma && cp ./packages/db/prisma/schema.prisma ./apps/api-worker/prisma/schema.prisma
RUN pnpm --filter "@quicke/api-worker" exec prisma generate

# Final image
FROM node:22-alpine AS final
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=8080
COPY pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/apps/api-worker/package.json ./apps/api-worker/package.json
COPY --from=builder /usr/src/app/packages/utils/package.json ./packages/utils/package.json
RUN echo '{ "name": "prod-dummy-root", "private": true }' > package.json
RUN corepack enable pnpm
RUN pnpm install --prod --ignore-scripts --recursive --filter "@quicke/api-worker" --filter "@quicke/utils"
COPY --from=builder /usr/src/app/apps/api-worker/src ./apps/api-worker/src
COPY --from=builder /usr/src/app/apps/api-worker/config ./apps/api-worker/config
COPY --from=builder /usr/src/app/packages/utils ./packages/utils/
COPY --from=builder /usr/src/app/apps/api-worker/node_modules/.prisma ./apps/api-worker/node_modules/.prisma
COPY --from=builder /usr/src/app/apps/api-worker/node_modules/@prisma/client ./apps/api-worker/node_modules/@prisma/client
WORKDIR /usr/src/app/apps/api-worker
EXPOSE 8080
CMD ["node", "src/server.js"]