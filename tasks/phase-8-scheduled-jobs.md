# Phase 8: Scheduled Jobs

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the CMMS with safe scheduled jobs for reminders, cleanup, and routine maintenance by building on existing APIs, scripts, email, and system health patterns.

## Relevant Existing Models/Actions

- `scripts/run-auth-rate-limit-cleanup.sh`
- `scripts/run-startup-self-checks.ts`
- `app/actions/storage-actions.ts`
- `lib/email/resend.ts`
- `lib/system-health.ts`
- `prisma/cleanup-auth-rate-limits.ts`
- `prisma/schema.prisma`
- any existing API routes under `app/api/`

Pay special attention to:

- existing cleanup tasks
- reminder-worthy workflows such as incomplete registrations, reports, or compliance follow-up

This phase must extend the current scripts, APIs, email, and operational helpers rather than introduce a separate heavy job platform without clear need.

## Required Backend Work

- Add scheduled task support in a way that fits current repo patterns
- Prefer idempotent jobs and safe retry behavior
- Support cron/API-based execution suitable for deployment environments
- Reuse current scripts, route handlers, and operational helpers where possible

## Required UI Work

- Add UI only if operators need status visibility or manual trigger access
- Reuse existing admin or health surfaces where practical
- Avoid building a separate scheduler UI unless the existing system genuinely needs one

## Tests Required

- Add tests for idempotency or repeated-run safety
- Add tests for core job behavior and authorization boundaries
- Add regression coverage for reminder or cleanup workflows touched by the phase
- Extend the existing test framework rather than introducing a new scheduler-specific one

## Constraints

- Do not introduce a heavy new infrastructure dependency unless clearly justified
- Do not send repeated emails or mutate data without idempotency protections
- High-impact jobs should be auditable and human-reviewable
- Every new server action or route handler must enforce appropriate auth/authorization
- Use `revalidatePath()` after mutations when scheduled work affects cached UI
- Run `npm run verify` before considering the phase complete

## Deliverables

- Job scripts, route handlers, or schedulable entry points as needed
- Documentation for deployment/runtime setup
- Tests for idempotency or core job behavior
- Any audit or status surfaces needed for safe operations

## Acceptance Criteria

- Scheduled jobs reuse existing CMMS capabilities where possible
- Jobs are safe to run repeatedly
- High-risk automations remain understandable and reviewable by humans
- Existing scripts, APIs, email, and health checks are extended rather than rebuilt
- Tests are added for new behavior
- `npm run verify` passes
