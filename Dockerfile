# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.0-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm

FROM base AS dependencies
ENV CI=true

COPY package.json pnpm-lock.yaml ./

# The repository's prepare script installs Git hooks. It is unnecessary inside
# a production image, so remove only that script from this temporary layer.
RUN node -e "const fs=require('node:fs');const p=require('./package.json');if(p.scripts)delete p.scripts.prepare;fs.writeFileSync('package.json',JSON.stringify(p));"

RUN --mount=type=cache,id=ailox-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# Contains source code and development dependencies for one-off Drizzle commands.
FROM base AS tools
ENV NODE_ENV=development
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "exec", "drizzle-kit", "push", "--config=drizzle.config.ts"]

FROM base AS builder
ENV NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# SITE_URL is intentionally the only real build argument. It is used by
# next-sitemap/metadata and is not secret. The other values are build-only
# placeholders required by this repository's eager Zod environment validation.
ARG SITE_URL=http://localhost:3000

RUN SITE_URL="${SITE_URL}" \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    BETTER_AUTH_SECRET="docker-build-placeholder-secret-0000000000000000" \
    ADMIN_EMAILS="build@example.com" \
    GITHUB_CLIENT_ID="docker-build-placeholder" \
    GITHUB_CLIENT_SECRET="docker-build-placeholder" \
    GOOGLE_CLIENT_ID="docker-build-placeholder" \
    GOOGLE_CLIENT_SECRET="docker-build-placeholder" \
    S3_ENDPOINT="http://127.0.0.1:9000" \
    S3_ACCESS_KEY="docker-build-placeholder" \
    S3_SECRET_KEY="docker-build-placeholder" \
    S3_BUCKET="docker-build-placeholder" \
    S3_REGION="us-east-1" \
    pnpm build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p /app/.next && chown node:node /app/.next

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]
