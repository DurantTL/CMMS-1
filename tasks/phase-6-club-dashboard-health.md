# Phase 6: Club Dashboard Health

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the director-facing dashboard so club leaders can quickly assess roster health, compliance health, event readiness, reporting health, and activity health when available.

## Relevant Existing Models/Actions

- `app/director/dashboard/page.tsx`
- `app/actions/club-report-actions.ts`
- `app/actions/compliance-actions.ts`
- `app/actions/event-registration-actions.ts`
- `app/actions/roster-actions.ts`
- `lib/system-health.ts`
- `lib/data/student-portal.ts`
- `prisma/schema.prisma`

Pay special attention to:

- `ClubRosterYear`
- `RosterMember`
- `MonthlyReport`
- `YearEndReport`
- `EventRegistration`
- `ComplianceSyncRun`

This phase must extend existing dashboard and reporting infrastructure rather than create duplicate health workflows or new source-of-truth tables.

## Required Backend Work

- Create a director-facing readiness dashboard built from existing CMMS data
- Include roster health, compliance health, event readiness, and reporting health
- Include activity health if Phase 1 exists, but do not require rebuilding that phase if absent
- Keep the dashboard readable for non-technical users
- Prefer derived indicators over new persisted health data

## Required UI Work

- Update the director dashboard with clear readiness and health views
- Reuse existing director dashboard patterns and components where possible
- Present health indicators in a way that helps directors act on current data

## Tests Required

- Add tests for derived health scoring or readiness calculations
- Add tests for conditional activity-health behavior if Phase 1 data exists
- Add regression coverage showing existing director dashboard behavior still works
- Extend existing test patterns rather than introducing a separate dashboard framework

## Constraints

- Do not create duplicate source-of-truth tables for health metrics
- Prefer derived status from existing data instead of background duplication
- Keep director scope aligned through `getManagedClubContext()`
- Every new server action must call `auth()` and validate `session.user.role`
- Use `revalidatePath()` after mutations
- Run `npm run verify` before considering the phase complete

## Deliverables

- Director dashboard updates or supporting dashboard components
- Any supporting selectors/actions for health aggregation
- Tests for readiness/health derivation
- Documentation updates if the dashboard changes planner expectations

## Acceptance Criteria

- Directors can see meaningful health/readiness information built from existing CMMS data
- The dashboard does not introduce duplicate workflows or duplicate persisted metrics unless clearly justified
- Existing roster, compliance, event, and reporting systems remain the source of truth
- Tests are added for new behavior
- `npm run verify` passes
