#!/usr/bin/env bash
#
# CMMS host-side updater agent.
#
# Runs ON THE HOST (NOT inside Docker), driven by a systemd timer (see
# deploy/cmms-updater.timer). It is the privileged half of the in-app
# "Update CMMS" button: the web container only ever drops a request file into
# the shared deploy-control volume; this script performs the real
# `git pull && docker compose up -d --build`, which rebuilds and restarts the app.
#
# Security: this script runs FIXED commands. It never evaluates or interpolates
# the contents of request files into the shell. Request files are treated as
# presence signals only; the requester email (if any) is extracted with a strict
# email regex purely for the audit/status display.
#
# Usage:   scripts/host-updater.sh once
#
# Env knobs:
#   REPO_DIR            Git working tree / compose project dir   (default: script's repo root)
#   DEPLOY_CONTROL_DIR  Shared control dir                       (default: $REPO_DIR/deploy-control)
#   COMPOSE_CMD         Compose command                          (default: "docker compose")
#   GIT_BRANCH          Branch to track                          (default: current branch)
#   DRY_RUN             If "1", echo git/compose commands instead of running them
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
DEPLOY_CONTROL_DIR="${DEPLOY_CONTROL_DIR:-${REPO_DIR}/deploy-control}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
DRY_RUN="${DRY_RUN:-0}"

REQUESTS_DIR="${DEPLOY_CONTROL_DIR}/requests"
LOGS_DIR="${DEPLOY_CONTROL_DIR}/logs"
STATUS_FILE="${DEPLOY_CONTROL_DIR}/status.json"
LOCK_FILE="${DEPLOY_CONTROL_DIR}/updater.lock"

mkdir -p "${REQUESTS_DIR}" "${LOGS_DIR}"

now_iso() { date -u +"%Y-%m-%dT%H:%M:%S.000Z"; }

# Run a command, or just echo it in dry-run mode.
run() {
  if [ "${DRY_RUN}" = "1" ]; then
    echo "DRY_RUN: $*"
    return 0
  fi
  "$@"
}

git_in_repo() { git -C "${REPO_DIR}" "$@"; }

current_commit() {
  if [ "${DRY_RUN}" = "1" ]; then
    echo "dryrun0000000000000000000000000000000000"
    return 0
  fi
  git_in_repo rev-parse HEAD 2>/dev/null || echo ""
}

remote_commit() {
  local branch="$1"
  if [ "${DRY_RUN}" = "1" ]; then
    echo "dryrun1111111111111111111111111111111111"
    return 0
  fi
  git_in_repo rev-parse "origin/${branch}" 2>/dev/null || echo ""
}

resolve_branch() {
  if [ -n "${GIT_BRANCH:-}" ]; then
    echo "${GIT_BRANCH}"
    return 0
  fi
  if [ "${DRY_RUN}" = "1" ]; then
    echo "main"
    return 0
  fi
  git_in_repo rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"
}

# Atomically writes status.json. All values passed in are already safe:
# commit SHAs are hex, timestamps are ISO, booleans are literal, email is
# pre-validated by extract_requester_email().
write_status() {
  local current="$1" remote="$2" update_available="$3" in_progress="$4"
  local last_update_json="$5"
  local tmp
  tmp="$(mktemp "${DEPLOY_CONTROL_DIR}/.status.XXXXXX.json")"
  cat >"${tmp}" <<EOF
{
  "currentCommit": $( [ -n "${current}" ] && printf '"%s"' "${current}" || echo null ),
  "remoteCommit": $( [ -n "${remote}" ] && printf '"%s"' "${remote}" || echo null ),
  "updateAvailable": ${update_available},
  "lastCheckedAt": "$(now_iso)",
  "inProgress": ${in_progress},
  "lastUpdate": ${last_update_json}
}
EOF
  mv "${tmp}" "${STATUS_FILE}"
}

# Extract a requester email from a request file using a strict regex. Anything
# that does not match a normal email shape is dropped, so this can never inject
# into the JSON we emit.
extract_requester_email() {
  local file="$1"
  grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "${file}" 2>/dev/null | head -n1 || true
}

# Preserve the previous lastUpdate block when only refreshing status.
read_existing_last_update() {
  if [ -f "${STATUS_FILE}" ]; then
    # crude but safe: pull the lastUpdate object back out, default to null
    sed -n 's/.*"lastUpdate":[[:space:]]*\(.*\)/\1/p' "${STATUS_FILE}" 2>/dev/null | sed 's/[[:space:]]*$//' | head -n1 || echo "null"
  else
    echo "null"
  fi
}

main() {
  local mode="${1:-once}"
  if [ "${mode}" != "once" ]; then
    echo "Usage: $0 once" >&2
    exit 2
  fi

  local branch
  branch="$(resolve_branch)"

  # Refresh remote knowledge (best-effort; never fatal).
  run git -C "${REPO_DIR}" fetch --quiet origin "${branch}" || true

  local cur rem avail
  cur="$(current_commit)"
  rem="$(remote_commit "${branch}")"
  if [ -n "${cur}" ] && [ -n "${rem}" ] && [ "${cur}" != "${rem}" ]; then
    avail="true"
  else
    avail="false"
  fi

  # Collect any pending requests.
  local requests=()
  while IFS= read -r -d '' f; do
    requests+=("${f}")
  done < <(find "${REQUESTS_DIR}" -maxdepth 1 -name '*.json' ! -name '.*' -print0 2>/dev/null)

  if [ "${#requests[@]}" -eq 0 ]; then
    # No work: just refresh status, keep any prior lastUpdate.
    write_status "${cur}" "${rem}" "${avail}" "false" "$(read_existing_last_update)"
    exit 0
  fi

  # Determine requester email from the most recent request, for the audit/status.
  local requester_email=""
  requester_email="$(extract_requester_email "${requests[0]}")"
  local requester_json="null"
  [ -n "${requester_email}" ] && requester_json="\"${requester_email}\""

  # Mark in-progress so the UI (and concurrent ticks) back off.
  write_status "${cur}" "${rem}" "${avail}" "true" "$(read_existing_last_update)"

  # One rebuild drains all queued requests.
  local log_file="${LOGS_DIR}/$(now_iso | tr ':' '-').log"
  local result="success"

  {
    echo "==== CMMS update $(now_iso) (branch ${branch}) ===="
    if [ "${DRY_RUN}" = "1" ]; then
      echo "DRY_RUN: git -C ${REPO_DIR} pull --ff-only origin ${branch}"
      echo "DRY_RUN: ${COMPOSE_CMD} up -d --build"
    else
      ( cd "${REPO_DIR}" \
        && git pull --ff-only origin "${branch}" \
        && ${COMPOSE_CMD} up -d --build )
    fi
  } >"${log_file}" 2>&1 || result="error"

  # Recompute current commit after the pull.
  cur="$(current_commit)"
  if [ -n "${cur}" ] && [ -n "${rem}" ] && [ "${cur}" != "${rem}" ]; then
    avail="true"
  else
    avail="false"
  fi

  local last_update_json
  last_update_json="$(printf '{ "status": "%s", "at": "%s", "requestedByEmail": %s }' \
    "${result}" "$(now_iso)" "${requester_json}")"

  write_status "${cur}" "${rem}" "${avail}" "false" "${last_update_json}"

  # Drain processed requests regardless of outcome (avoid an infinite retry loop).
  local r
  for r in "${requests[@]}"; do
    rm -f "${r}"
  done

  echo "Update ${result}; log: ${log_file}"
  [ "${result}" = "success" ]
}

# Serialize runs so two ticks never rebuild at once.
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another updater run holds the lock; skipping." >&2
  exit 0
fi

main "$@"
