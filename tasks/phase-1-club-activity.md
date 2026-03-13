# Phase 1: Club Activity Logging + Report Auto-Fill

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the existing CMMS so club activity logging can support monthly reporting and auto-fill parts of the existing `MonthlyReport` workflow without replacing current report submission.

## Relevant Existing Models/Actions

- `prisma/schema.prisma`
- `app/actions/club-report-actions.ts`
- `app/actions/teacher-actions.ts`
- `app/actions/roster-actions.ts`
- `lib/club-management.ts`
- `app/director/reports/page.tsx`
- `app/director/dashboard/page.tsx`
- `app/director/roster/page.tsx`

Pay special attention to:

- `MonthlyReport`
- `ClubRosterYear`
- `RosterMember`
- any existing attendance-related fields or actions already used for class attendance

This phase must extend the existing monthly reporting and roster-year infrastructure rather than recreate it.

## Required Backend Work

- Add club activity logging foundations tied to `ClubRosterYear`
- Support attendance capture suitable for monthly report calculations
- Provide an auto-fill path for `MonthlyReport` values while still allowing director review/editing
- Keep director scoping aligned with `getManagedClubContext()`
- Use `revalidatePath()` after any mutation
- Reuse existing report and attendance infrastructure where possible

## Required UI Work

- Add director-facing UI for logging club activities
- Update the existing monthly reporting UX to surface auto-fill support without removing manual entry
- Preserve current admin and director report pages as the base workflow

## Tests Required

- Add tests for monthly report auto-fill calculations
- Add tests for the happy-path activity logging flow
- Add regression coverage showing manual report entry still works
- Extend existing test patterns rather than introducing a separate testing approach

## Constraints

- Do not create a replacement reporting subsystem
- Do not recreate monthly reporting, roster, or attendance systems from scratch
- Do not link year-scoped activity records directly to `Club`
- Do not break existing `MonthlyReport` admin/director views
- Do not duplicate teacher/class attendance features when shared logic can be reused
- Keep any migration backwards compatible and safe for production data
- Every new server action must call `auth()` and validate `session.user.role`
- Run `npm run verify` before considering the phase complete

## Deliverables

- Any needed schema additions and safe migration files
- Server actions for activity CRUD and monthly-report auto-fill support
- Director-facing UI updates for logging and reviewing activity data
- Tests covering calculations and the main user flow
- Documentation updates if the final implementation changes workflow assumptions

## Acceptance Criteria

- Directors can log club activities without disrupting existing reports
- Monthly report values can be auto-filled from activity data and still edited before submission
- New year-scoped data is attached to `ClubRosterYear`
- Existing monthly report submission still works for manual entry
- Existing CMMS reporting infrastructure remains the source of truth
- Tests are added for the new behavior
- `npm run verify` passes
