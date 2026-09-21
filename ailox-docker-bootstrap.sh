#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json || ! -f next.config.ts ]]; then
  echo "请在 AIlox-blog 仓库根目录执行此脚本。" >&2
  exit 1
fi

cat > 'Dockerfile' <<'__AILOX_DOCKERFILE__'
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
    UPLOADTHING_TOKEN="docker-build-placeholder" \
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
__AILOX_DOCKERFILE__

cat > 'compose.yaml' <<'__AILOX_COMPOSE_YAML__'
name: ailox-blog

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:?POSTGRES_DB is required}
      POSTGRES_USER: ${POSTGRES_USER:?POSTGRES_USER is required}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 10s
    networks:
      - ailox

  # This service is not started by ordinary `docker compose up`.
  # Run it manually before the first app start and after schema changes:
  # docker compose --profile tools run --rm db-init
  db-init:
    profiles:
      - tools
    image: ailox-blog-tools:local
    build:
      context: .
      target: tools
    env_file:
      - .env
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
    depends_on:
      db:
        condition: service_healthy
    restart: "no"
    networks:
      - ailox

  app:
    image: ailox-blog-app:local
    build:
      context: .
      target: runner
      args:
        SITE_URL: ${SITE_URL:?SITE_URL is required}
    restart: unless-stopped
    init: true
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: "3000"
      HOSTNAME: 0.0.0.0
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "${APP_BIND:-127.0.0.1}:${APP_PORT:-3000}:3000"
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - >-
          fetch('http://127.0.0.1:3000/')
          .then(r => process.exit(r.status < 500 ? 0 : 1))
          .catch(() => process.exit(1))
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s
    networks:
      - ailox

volumes:
  postgres_data:

networks:
  ailox:
    driver: bridge
__AILOX_COMPOSE_YAML__

cat > '.dockerignore' <<'__AILOX__DOCKERIGNORE__'
.git
.github
.next
node_modules
.pnpm-store
coverage
*.log

.env
.env.*
!.env.example
!.env.docker.example

Dockerfile
compose.yaml
__AILOX__DOCKERIGNORE__

cat > '.env.docker.example' <<'__AILOX__ENV_DOCKER_EXAMPLE__'
# Final browser-visible origin. Do not add a trailing slash.
# Examples:
# SITE_URL=https://blog.example.com
# SITE_URL=http://192.168.1.100:3000
SITE_URL=https://blog.example.com

# 127.0.0.1 is appropriate when Nginx/Caddy/Cloudflare Tunnel runs on this host.
# Use 0.0.0.0 only when you deliberately want direct LAN/WAN access to port 3000.
APP_BIND=127.0.0.1
APP_PORT=3000

# Use a URL-safe password because Compose injects it into DATABASE_URL.
POSTGRES_DB=ailox_blog
POSTGRES_USER=ailox
POSTGRES_PASSWORD=REPLACE_WITH_URL_SAFE_RANDOM_PASSWORD

# At least 32 characters.
BETTER_AUTH_SECRET=REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARS

# Must match the email returned by GitHub/Google login.
# Multiple addresses may be comma-separated.
ADMIN_EMAILS=you@example.com

# Optional SIWE administrator wallet. Leave empty when unused.
ADMIN_WALLET_ADDRESS=

# Required by the current repository's environment validator.
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Required by the current repository's environment validator.
UPLOADTHING_TOKEN=

# SMTP is optional, but it must be either completely configured or completely blank.
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
MAIL_TO=
__AILOX__ENV_DOCKER_EXAMPLE__

cat > 'prepare-docker.sh' <<'__AILOX_PREPARE_DOCKER_SH__'
#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f next.config.ts || ! -f package.json ]]; then
  echo "Run this script from the AIlox-blog repository root." >&2
  exit 1
fi

if ! grep -q "output: ['\"]standalone['\"]" next.config.ts; then
  sed -i "/const nextConfig: NextConfig = {/a\\  output: 'standalone'," next.config.ts
  echo "Added output: 'standalone' to next.config.ts"
else
  echo "next.config.ts already enables standalone output"
fi

if [[ ! -f .env ]]; then
  cp .env.docker.example .env
  chmod 600 .env
  echo "Created .env from .env.docker.example"
  echo "Edit .env before building."
else
  chmod 600 .env
  echo ".env already exists; it was not overwritten."
fi
__AILOX_PREPARE_DOCKER_SH__

cat > 'README-DOCKER.md' <<'__AILOX_README_DOCKER_MD__'
# AIlox Blog — Docker deployment bundle

This bundle targets the `e-ALX-e/AIlox-blog` repository and requires only
Docker Engine plus Docker Compose on the Ubuntu host.

## 1. Copy the bundle into the repository root

The repository root must contain `package.json`, `pnpm-lock.yaml`,
`next.config.ts`, and the files from this bundle.

## 2. Prepare Next.js standalone output and the environment file

```bash
chmod +x prepare-docker.sh
./prepare-docker.sh
nano .env
```

Fill all required values in `.env`. Keep every SMTP field blank when SMTP is
not being used.

Generate URL-safe secrets without installing Node.js on the host:

```bash
docker run --rm node:24.13.0-slim \
  node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"

docker run --rm node:24.13.0-slim \
  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Use the first output for `POSTGRES_PASSWORD` and the second for
`BETTER_AUTH_SECRET`.

## 3. Validate configuration

```bash
docker compose config >/dev/null
```

## 4. Start PostgreSQL

```bash
docker compose up -d db
docker compose ps
```

## 5. Build the application and database tool image

```bash
docker compose --profile tools build --pull app db-init
```

## 6. Initialize/synchronize the empty PostgreSQL database

```bash
docker compose --profile tools run --rm db-init
```

For a dry-run before a later schema update:

```bash
docker compose --profile tools run --rm db-init \
  pnpm exec drizzle-kit push \
  --config=drizzle.config.ts \
  --explain --verbose
```

Do not add `--force` to routine production updates without reviewing the
planned SQL/data-loss warnings.

## 7. Start the application

```bash
docker compose up -d app
docker compose ps
docker compose logs --tail=100 app
```

Default host endpoint:

```text
http://127.0.0.1:3000
```

Change `APP_BIND=0.0.0.0` in `.env` only when direct network access is
intended. With a host-installed Cloudflare Tunnel, keep `127.0.0.1` and point
the tunnel origin to `http://localhost:3000`.

## OAuth callback addresses

With `SITE_URL=https://blog.example.com`:

```text
GitHub: https://blog.example.com/api/auth/callback/github
Google: https://blog.example.com/api/auth/callback/google
```

## Routine update

```bash
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "ailox-$(date +%F-%H%M%S).dump"

# Pull the new source revision here.

docker compose --profile tools build --pull app db-init

docker compose --profile tools run --rm db-init \
  pnpm exec drizzle-kit push \
  --config=drizzle.config.ts \
  --explain --verbose

docker compose --profile tools run --rm db-init
docker compose up -d app
docker image prune -f
```

## Backup

```bash
mkdir -p backups

docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/ailox-$(date +%F-%H%M%S).dump"
```

## Restore

Stop the application first, then restore the selected dump:

```bash
docker compose stop app

cat backups/SELECTED.dump | \
  docker compose exec -T db sh -c \
  'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

docker compose start app
```

## Remove containers without deleting PostgreSQL data

```bash
docker compose down
```

## Permanently delete containers and PostgreSQL data

```bash
docker compose down -v
```
__AILOX_README_DOCKER_MD__

chmod +x prepare-docker.sh
./prepare-docker.sh

echo "Docker 部署文件已写入当前目录。下一步编辑 .env，然后执行 README-DOCKER.md 中的命令。"
