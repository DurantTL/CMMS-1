# AI Workflow for CMMS

This document explains how planners should use Codex inside the existing `imsda/CMMS` repository.

CMMS is not a greenfield system. Codex must extend the current Next.js, Prisma, PostgreSQL, registration, compliance, reporting, enrollment, PDF, email, and testing infrastructure already documented in `docs/system-specification.md`.

## Required Context Reading Order

Before any phase work starts, load context in this order:

1. `docs/system-specification.md`
2. `docs/revised-build-plan.md`
3. `docs/ai-development-prompts.md`
4. `tasks/<phase>.md`

If implementation ideas conflict with the existing architecture, treat `docs/system-specification.md` as the source of truth.

## Standard Workflow

1. Pick a task from `tasks/`.
2. Create a feature branch.
3. Give Codex the task and required repo context.
4. Run verification scripts.
5. Review the diff.
6. Open a pull request.
7. Merge after CI passes.

## How Planners Should Use Codex

### 1. Pick a task

Select one phase file from `tasks/` and keep the session scoped to that phase.

Examples:

- `tasks/phase-1-club-activity.md`
- `tasks/phase-4-honors-ui.md`
- `tasks/phase-8-scheduled-jobs.md`

Do not combine multiple phases in one implementation pass unless a human reviewer explicitly approves that scope.

### 2. Create a feature branch

Start with:

```bash
bash scripts/ai/run-phase.sh tasks/phase-1-club-activity.md
```

Then create the suggested branch, for example:

```bash
git checkout -b codex/phase-1-club-activity
```

### 3. Give Codex the task

Provide Codex with:

- `docs/system-specification.md`
- `docs/revised-build-plan.md`
- `docs/ai-development-prompts.md`
- the selected `tasks/<phase>.md`

Also remind Codex of these repo rules:

- extend existing CMMS infrastructure
- do not rebuild existing systems
- inspect current models, actions, pages, and tests before editing
- keep the work inside the selected phase

### 4. Run verification scripts

After implementation, run:

```bash
bash scripts/ai/verify-phase.sh
```

This runs:

- `npx prisma validate`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run verify`

### 5. Review the diff

Before opening a PR, run:

```bash
bash scripts/ai/summarize-phase.sh
```

Check that:

- the diff only covers the intended phase
- existing systems were extended rather than replaced
- tests were added or updated
- migrations are safe and backwards compatible

### 6. Open a pull request

Use `.github/pull_request_template.md` and complete every section, especially the sections that identify which existing CMMS systems were extended.

### 7. Merge after CI passes

Do not merge phase work until the PR workflow passes and required human review is complete.

## Required Human Review

These change types always require human review before merge:

- Prisma schema changes
- authentication changes
- encryption or medical data changes
- event registration logic
- enrollment capacity logic

## Planner Guardrails

When coordinating Codex work in this repo:

- always start from `docs/system-specification.md`
- assume the existing architecture docs are correct
- prefer extending current models, actions, and pages over introducing duplicates
- keep server actions aligned with current auth, role, and revalidation patterns
- keep year-scoped data attached to `ClubRosterYear`
- keep capacity-sensitive enrollment logic inside safe transaction boundaries

If a task starts to look like a redesign, stop and split the work into a smaller follow-up instead of letting Codex replace a working subsystem.
