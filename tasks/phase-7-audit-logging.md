# Phase 7: Audit Logging

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Add safe audit logging for sensitive CMMS operations so administrators can review important changes without disrupting existing business workflows.

## Relevant Existing Models/Actions

- `app/actions/admin-management-actions.ts`
- `app/actions/compliance-actions.ts`
- `app/actions/roster-actions.ts`
- `app/actions/enrollment-actions.ts`
- `app/actions/storage-actions.ts`
- `app/actions/club-report-actions.ts`
- `auth.ts`
- `prisma/schema.prisma`

Pay special attention to:

- operations that change permissions, membership, compliance status, roster state, report submission, or enrollment/capacity

This phase must wrap and extend existing sensitive workflows rather than replace those workflows with a new mutation path.

## Required Backend Work

- Introduce audit logging for clearly sensitive operations
- Capture actor, action, target, and timestamp in a reviewable way
- Keep audit records understandable to admins and safe for production use
- Integrate audit writes into existing actions without rebuilding those actions

## Required UI Work

- Add an admin review surface only if needed to inspect audit data
- Reuse existing admin patterns for review and filtering where possible
- Keep audit visibility separate from the main business workflows unless the current UI already supports it

## Tests Required

- Add tests for audit writes on key sensitive actions
- Add tests that confirm unsafe data is not logged
- Add regression coverage showing core mutations still work if audit logging is enabled
- Extend the existing test framework rather than introducing a separate logging harness

## Constraints

- Do not log secrets, password hashes, raw medical data, or unnecessary personal details
- Do not make existing mutations unreliable because of audit logging failures without an explicit product decision
- Keep migrations backwards compatible and production-safe
- Every new server action must call `auth()` and validate `session.user.role`
- Use `revalidatePath()` after mutations when UI changes depend on new audit entries
- Run `npm run verify` before considering the phase complete

## Deliverables

- Minimal schema and migration changes if audit persistence is added
- Shared audit utility/helpers if needed
- Integration into sensitive existing actions
- Admin review UI or query surface if applicable
- Tests for audit creation behavior

## Acceptance Criteria

- Sensitive operations can be audited without rebuilding the workflows themselves
- Audit logging avoids storing unsafe data
- Existing admin, roster, compliance, and enrollment workflows remain intact
- Tests are added for new behavior
- `npm run verify` passes
