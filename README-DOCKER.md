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
