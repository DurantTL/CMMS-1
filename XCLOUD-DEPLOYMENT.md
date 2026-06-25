# xCloud / VPS Deployment Guide (Docker + PostgreSQL)

This guide shows how to deploy the CMMS Next.js platform to xCloud (or any VPS) using Docker and Docker Compose.

## 1) Prerequisites

Make sure your server has:

- Docker Engine installed
- Docker Compose plugin installed (`docker compose` command)
- Git installed
- A domain/subdomain ready (optional but recommended)

## 2) Clone the project

```bash
git clone <YOUR_REPO_URL>
cd CMMS
```

## 3) Review container configuration files

This repository includes:

- `Dockerfile` for building the Next.js + Prisma container
- `docker-compose.yml` for orchestrating `web` + `postgres`

The image build process runs:

```bash
npm install && npx prisma generate && npm run build
```

The app container start command runs:

```bash
npx prisma migrate deploy && npm start
```

## 4) Configure environment variables in xCloud panel

Secrets can be supplied **either way** — set them in the xCloud service env
settings (recommended; nothing committed to the repo), **or** drop a `.env`
file next to `docker-compose.yml` on the host. The compose `web` service forwards
each value via `${VAR:-}` pass-through and also reads an optional, non-required
`.env`, so both deployment styles work and a missing `.env` never blocks startup.

In your xCloud app/service environment settings, set the following variables for the Node.js app:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `INTERNAL_APP_URL` (optional)
- `MEDICAL_ENCRYPTION_KEY`

### Recommended values

- `DATABASE_URL`
  - If using the provided Compose service naming:
  - `postgresql://postgres:postgres@postgres:5432/cmms?schema=public`
- `NEXTAUTH_SECRET`
  - Generate a strong secret locally:
    ```bash
    openssl rand -base64 32
    ```
- `NEXTAUTH_URL`
  - Your public app URL, for example:
  - `https://cmms.yourdomain.com`
- `NEXT_PUBLIC_APP_URL`
  - The **public** origin users and Square reach (usually the same value as
    `NEXTAUTH_URL`). It signs Square webhooks and builds director email links, so
    it must be the externally reachable host, e.g. `https://cmms.imsda.org`.
- `INTERNAL_APP_URL` (optional)
  - A separate internal/server-to-server origin (e.g. a private host like
    `https://cmms.internal.imsda.org`). Kept distinct from `NEXT_PUBLIC_APP_URL`
    so internal traffic never rewrites external-facing links. Leave unset unless
    you need it.
- `MEDICAL_ENCRYPTION_KEY`
  - Must be a 64-character hex string or a base64 string that decodes to 32 bytes

> Keep `NEXTAUTH_SECRET` private and never commit it to Git.

## 5) Deploy with Docker Compose

From the repository root:

```bash
docker compose up -d --build
```

This will:

1. Build the `web` image from `Dockerfile`
2. Start a PostgreSQL 15 container
3. Start the Next.js app on port `3000`

## 6) Verify deployment

Check service status:

```bash
docker compose ps
```

Check logs:

```bash
docker compose logs -f web
docker compose logs -f postgres
```

If everything is healthy, visit:

- `http://<SERVER_IP>:3000`
- or your configured domain

Before opening access broadly, run:

```bash
docker compose exec web npm run check:startup
```

If you are deploying against an existing database, also run:

```bash
docker compose exec web npm run backfill:medical-encryption
docker compose exec web npm run check:startup
```

## 7) Ongoing operations

### Update to latest code

```bash
git pull
docker compose up -d --build
```

### One-click update button (optional)

The admin UI has an **Admin → System Update** page (`/admin/system`, SUPER_ADMIN
only) with an "Update CMMS now" button that runs the same `git pull` + rebuild as
above — no SSH required.

**How it works (and why it needs host-side setup):** the running app is an
immutable Docker image — it has no `.git`, no source tree, and no build
toolchain, so it *cannot* update itself. Instead the button only writes a small
request file into a shared volume (`./deploy-control`). A privileged **host-side
agent** (`scripts/host-updater.sh`, run by a systemd timer) sees the request and
runs `git pull && docker compose up -d --build` on the host. Git and Docker
never enter the container; the agent runs fixed commands and never executes the
contents of request files.

> ⚠️ **The button does nothing until the host agent is installed.** Without it,
> clicks are recorded (and audited) but no update happens, and the page shows
> "No deployment status is available yet."

The rebuild **restarts the app**, briefly disconnecting signed-in users. The
page reports "update started" — it cannot report completion live, because it
restarts. Reload after ~1 minute to confirm the running commit changed.

**Install the host agent (one time):**

```bash
# From the repo root on the host:
chmod +x scripts/host-updater.sh

# Copy and edit the unit files (set User=, WorkingDirectory=, REPO_DIR= to match
# your host — the defaults assume /opt/cmms and a `deploy` user):
sudo cp deploy/cmms-updater.service /etc/systemd/system/
sudo cp deploy/cmms-updater.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cmms-updater.timer

# Verify it ticks and writes deploy-control/status.json:
systemctl list-timers cmms-updater.timer
cat deploy-control/status.json
```

The agent user must be able to `git pull` non-interactively (configure an SSH
deploy key or a cached credential helper for the remote) and run
`docker compose`. The `./deploy-control` volume mount is already wired in
`docker-compose.yml`.

You can dry-run the agent without pulling or rebuilding:

```bash
DRY_RUN=1 scripts/host-updater.sh once   # echoes the git/compose commands
```

### Run one-off Prisma migration command manually (if needed)

```bash
docker compose exec web npx prisma migrate deploy
```

### Run startup self-checks manually

```bash
docker compose exec web npm run check:startup
```

### Stop services

```bash
docker compose down
```

### Stop services and remove database volume (destructive)

```bash
docker compose down -v
```

## 8) Optional production hardening

- Put Nginx/Caddy/Traefik in front of port `3000` for TLS termination
- Restrict direct public access to PostgreSQL port `5432`
- Use strong custom DB credentials (not defaults)
- Back up `postgres_data` volume regularly
- Set Docker restart policies (already set to `unless-stopped`)
- Schedule `npm run schedule:auth-rate-limit-cleanup` every 15 minutes
