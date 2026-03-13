#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: bash scripts/ai/run-phase.sh tasks/phase-1-club-activity.md"
  exit 1
fi

task_file=$1

if [ ! -f "$task_file" ]; then
  echo "Task file not found: $task_file"
  exit 1
fi

task_name=$(basename "$task_file" .md)
branch_name="codex/${task_name}"

echo "Read these docs first:"
echo "  1. docs/system-specification.md"
echo "  2. docs/revised-build-plan.md"
echo "  3. docs/ai-development-prompts.md"
echo "  4. $task_file"
echo
echo "Suggested branch name:"
echo "  $branch_name"
echo
echo "Workflow reminder:"
echo "  Extend existing CMMS."
echo "  Do not rebuild systems that already exist."
echo "  Inspect current models/actions/pages/tests before editing."
echo "  Keep changes scoped to the selected phase."
echo "  Add tests."
echo "  Run bash scripts/ai/verify-phase.sh before opening a PR."
