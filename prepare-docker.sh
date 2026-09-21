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
