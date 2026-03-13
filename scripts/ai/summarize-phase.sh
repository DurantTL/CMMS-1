#!/usr/bin/env bash

set -euo pipefail

echo "==> Git status"
git status --short

echo
echo "==> Diff stat"

base_ref=""

if git show-ref --verify --quiet refs/remotes/origin/main; then
  base_ref="origin/main"
elif git show-ref --verify --quiet refs/heads/main; then
  base_ref="main"
elif git show-ref --verify --quiet refs/remotes/origin/master; then
  base_ref="origin/master"
elif git show-ref --verify --quiet refs/heads/master; then
  base_ref="master"
fi

if [ -n "$base_ref" ]; then
  merge_base=$(git merge-base HEAD "$base_ref")
  git diff --stat "$merge_base"...HEAD
  echo
  echo "Compared against base: $base_ref"
else
  git diff --stat
  echo
  echo "No main/master base found; showing working tree diff stat."
fi

echo
echo "==> Review checklist"
echo "- Read docs/system-specification.md and the task file again."
echo "- Confirm this extends existing CMMS instead of rebuilding it."
echo "- Confirm tests were added or updated."
echo "- Confirm migrations are safe and backwards compatible."
echo "- Confirm required human-review areas were called out when applicable."
echo "- Confirm bash scripts/ai/verify-phase.sh passed."
echo "- Confirm manual smoke testing was done where applicable."
