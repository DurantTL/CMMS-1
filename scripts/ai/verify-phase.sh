#!/usr/bin/env bash

set -euo pipefail

run_step() {
  label=$1
  shift

  echo
  echo "==> $label"

  if "$@"; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    exit 1
  fi
}

run_step "Prisma validate" npx prisma validate
run_step "Typecheck" npm run typecheck
run_step "Lint" npm run lint
run_step "Test" npm test
run_step "Verify" npm run verify

echo
echo "All verification steps passed."
