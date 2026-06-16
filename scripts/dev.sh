#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# scripts/dev.sh — bring the LOCAL dev/test loop fully current in one command.
#
# Idempotent and safe to re-run. It will:
#   1. git pull the current branch
#   2. bring up the disposable Postgres (docker-compose.local.yml) and wait
#      until it is healthy
#   3. install deps if package-lock.json changed
#   4. sync the schema to the disposable DB (prisma db push)
#   5. seed the realistic conference slice (prisma db seed)
#   6. run the test suite and report whether the roster tests passed / skipped
#   7. print the seeded admin + director logins and the local app URL
#   8. optionally start the dev server (pass --serve)
#
# SAFETY: this RESEEDS DESTRUCTIVELY. It refuses to run unless DATABASE_URL
# points at a LOCAL/disposable Postgres (localhost / 127.0.0.1 / ::1). It will
# never touch a remote or production database.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="docker-compose.local.yml"
SERVE=0
for arg in "$@"; do
  case "$arg" in
    --serve) SERVE=1 ;;
    *) echo "Unknown argument: $arg (supported: --serve)" >&2; exit 2 ;;
  esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1" >&2; exit 1; }

# --- Load .env so DATABASE_URL et al. are available -------------------------
step "Loading environment"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  info "Loaded .env"
else
  fail "No .env found. Copy it first:  cp .env.example .env"
fi

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set (check your .env)."

# --- SAFETY: refuse anything that isn't a local DB --------------------------
step "Verifying DATABASE_URL is a LOCAL, disposable database"
DB_HOST="$(node -e '
try {
  const u = new URL(process.env.DATABASE_URL);
  process.stdout.write(u.hostname || "");
} catch { process.exit(1); }
')" || fail "DATABASE_URL is not a valid PostgreSQL connection string."

case "$DB_HOST" in
  localhost|127.0.0.1|::1|0.0.0.0)
    info "DATABASE_URL host is '$DB_HOST' — OK (local)." ;;
  *)
    fail "DATABASE_URL host is '$DB_HOST'. This script reseeds DESTRUCTIVELY and only runs against a local/disposable DB (localhost). Refusing to continue."
    ;;
esac

[ -n "${MEDICAL_ENCRYPTION_KEY:-}" ] || fail "MEDICAL_ENCRYPTION_KEY is not set (roster medical writes + seed will throw)."

# --- 1. git pull current branch --------------------------------------------
step "Updating the current branch"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
info "Branch: $BRANCH"
if git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only origin "$BRANCH" || info "git pull skipped/failed (continuing with local checkout)."
else
  info "No 'origin' remote — skipping pull."
fi

# --- 2. disposable Postgres up + healthy ------------------------------------
step "Starting disposable Postgres ($COMPOSE_FILE)"
docker compose -f "$COMPOSE_FILE" up -d postgres
info "Waiting for Postgres to report healthy..."
for i in $(seq 1 30); do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' cmms-local-postgres 2>/dev/null || echo "starting")"
  if [ "$STATUS" = "healthy" ]; then
    info "Postgres is healthy."
    break
  fi
  if [ "$i" = "30" ]; then
    fail "Postgres did not become healthy in time. Check: docker compose -f $COMPOSE_FILE logs postgres"
  fi
  sleep 2
done

# --- 3. install deps if the lockfile changed --------------------------------
step "Installing dependencies (if needed)"
LOCK_HASH_FILE="node_modules/.dev-sh-lock-hash"
CURRENT_LOCK_HASH="$( (sha1sum package-lock.json 2>/dev/null || shasum package-lock.json) | awk '{print $1}')"
if [ ! -d node_modules ] || [ ! -f "$LOCK_HASH_FILE" ] || [ "$(cat "$LOCK_HASH_FILE" 2>/dev/null)" != "$CURRENT_LOCK_HASH" ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  mkdir -p node_modules
  printf '%s' "$CURRENT_LOCK_HASH" > "$LOCK_HASH_FILE"
else
  info "Dependencies up to date — skipping install."
fi

# --- 4. sync schema to the disposable DB ------------------------------------
# `prisma db push` is used (not `migrate deploy`) because it reliably brings a
# fresh scratch DB to the current schema in one step.
step "Syncing schema to the disposable DB (prisma db push)"
npx prisma db push

# --- 5. seed ----------------------------------------------------------------
step "Seeding the conference slice (prisma db seed)"
npx prisma db seed

# --- 6. tests ---------------------------------------------------------------
step "Running the roster tests"
ROSTER_OUT="$(node --import tsx --test --test-concurrency=1 tests/roster-rollover.integration.test.ts 2>&1 || true)"
echo "$ROSTER_OUT" | grep -E '^# (tests|pass|fail|skipped)' | sed 's/^/    /'
ROSTER_FAIL="$(echo "$ROSTER_OUT" | sed -n 's/^# fail \([0-9]*\)$/\1/p')"
ROSTER_SKIP="$(echo "$ROSTER_OUT" | sed -n 's/^# skipped \([0-9]*\)$/\1/p')"
if [ "${ROSTER_FAIL:-0}" != "0" ]; then
  info "Roster tests: FAILED (${ROSTER_FAIL} failing)."
elif [ "${ROSTER_SKIP:-0}" != "0" ]; then
  info "Roster tests: SKIPPED (no DATABASE_URL seen by the runner)."
else
  info "Roster tests: PASSED."
fi

step "Running the full test suite (serial)"
info "Note: a few registration/webhook integration tests fail outside the Next runtime (revalidatePath) — see CLAUDE.md."
node --import tsx --test --test-concurrency=1 tests/*.test.ts tests/*.integration.test.ts 2>&1 \
  | grep -E '^# (tests|pass|fail|skipped)' | sed 's/^/    /' || true

# --- 7. print logins + URL --------------------------------------------------
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
step "Local environment ready"
cat <<EOF
    App URL:       $APP_URL

    Super Admin:   ${SEED_SUPER_ADMIN_EMAIL:-superadmin@cmms.local} / ${SEED_SUPER_ADMIN_PASSWORD:-ChangeMeNow123!}
    Club Director: ${SEED_CLUB_DIRECTOR_EMAIL:-director@cmms.local} / ${SEED_CLUB_DIRECTOR_PASSWORD:-DirectorPass123!}
                   (director is linked to "Northgate Pathfinders")

    NOTE: the test run above TRUNCATES the DB. If you just ran tests and want to
    browse the seeded data, reseed first:  npx prisma db seed
EOF

# --- 8. optional dev server -------------------------------------------------
if [ "$SERVE" = "1" ]; then
  step "Starting the dev server (npm run dev)"
  npx prisma db seed   # refresh data the tests truncated
  exec npm run dev
fi
