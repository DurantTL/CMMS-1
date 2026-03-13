# Phase 5: Compliance Dashboard

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the existing compliance sync and reporting system with a clearer dashboard for directors and/or admins, using current compliance data rather than rebuilding compliance tracking.

## Relevant Existing Models/Actions

- `prisma/schema.prisma`
- `app/actions/compliance-actions.ts`
- `app/admin/compliance/page.tsx`
- `app/admin/compliance/_components/compliance-sync-dashboard.tsx`
- `app/admin/events/[eventId]/reports/compliance/page.tsx`
- `app/director/dashboard/page.tsx`
- `lib/compliance-sync.ts`
- `lib/system-health.ts`

Pay special attention to:

- `ComplianceSyncRun`
- `ClubRosterYear`
- `RosterMember`
- any compliance-related derived status currently shown in admin views

This phase must extend the current compliance sync, roster-year, and dashboard infrastructure rather than create a second compliance tracking system.

## Required Backend Work

- Extend current compliance data and sync results into a clearer dashboard
- Preserve the preview/apply flow already used by admins
- Surface actionable status for directors without exposing unsafe admin-only operations
- Reuse current compliance actions and selectors where possible

## Required UI Work

- Improve compliance visibility in existing admin pages and/or director views
- Present actionable readiness indicators without changing the core sync flow
- Keep preview and apply safeguards visible and understandable

## Tests Required

- Add tests for derived compliance status calculations
- Add tests for any new dashboard aggregation logic
- Add regression coverage for role and scope boundaries
- Extend the existing test framework rather than creating a compliance-only testing path

## Constraints

- Do not create a second compliance system
- Do not bypass existing preview/apply safeguards
- Keep scope and permissions aligned to current roles
- Every new server action must call `auth()` and validate `session.user.role`
- Director-scoped work must use `getManagedClubContext()`
- Use `revalidatePath()` after mutations
- Run `npm run verify` before considering the phase complete

## Deliverables

- Dashboard UI additions for compliance visibility
- Any supporting actions or selectors needed for dashboard data
- Tests for new derived status logic
- Documentation updates if planner/reviewer flow changes

## Acceptance Criteria

- Compliance status is easier to review without replacing existing sync workflows
- Role boundaries remain correct for admin and director views
- Existing compliance sync infrastructure remains the source of truth
- Tests are added for new behavior
- `npm run verify` passes
