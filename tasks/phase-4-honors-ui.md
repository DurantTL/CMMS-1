# Phase 4: Honors UI

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the existing honors and class experience with better director and teacher UI while reusing the current class catalog, offerings, requirements, and enrollment system.

## Relevant Existing Models/Actions

- `prisma/schema.prisma`
- `app/actions/enrollment-actions.ts`
- `app/actions/admin-actions.ts`
- `app/actions/teacher-actions.ts`
- `lib/class-model.ts`
- `lib/class-prerequisite-utils.ts`
- `app/director/events/[eventId]/classes/page.tsx`
- `app/director/events/[eventId]/classes/_components/class-assignment-board.tsx`
- `app/teacher/class/[offeringId]/page.tsx`
- `lib/pdf/event-registration-pdf.tsx`

Pay special attention to:

- `ClassCatalog`
- `ClassRequirement`
- `EventClassOffering`
- `ClassEnrollment`
- `MemberRequirement`

This phase must extend the existing honors, requirements, offering, and enrollment infrastructure rather than recreate honors as a separate subsystem.

## Required Backend Work

- Improve honors/class assignment UX by extending current CMMS screens
- Support better grouping, filtering, and bulk actions where appropriate
- Reuse existing prerequisite and capacity logic
- Avoid duplicate honor data structures
- Keep enrollment and prerequisite checks inside current transactional patterns

## Required UI Work

- Improve director honors assignment screens
- Improve teacher-facing honors/class workflow where it helps completion tracking
- Add grouping, filtering, and bulk operations on top of existing screens

## Tests Required

- Add tests for grouping and filtering behavior where logic is introduced
- Add tests for bulk assignment or bulk update flows
- Add regression coverage for capacity and prerequisite enforcement
- Extend existing test patterns rather than creating a new honors test harness

## Constraints

- Do not create new honor models that duplicate `ClassCatalog` or `ClassEnrollment`
- Do not bypass capacity and conflict checks
- Capacity-sensitive changes must use serializable transactions
- Every new server action must call `auth()` and validate `session.user.role`
- Use `revalidatePath()` after mutations
- Run `npm run verify` before considering the phase complete

## Deliverables

- UI improvements for director and/or teacher honors workflows
- Any minimal schema extension needed for grouping or presentation
- Updated or new actions for bulk operations if needed
- Tests for grouping, bulk assignment, and validation paths
- Documentation updates if the workflow changes

## Acceptance Criteria

- Existing honors infrastructure remains the source of truth
- Directors can manage honors more efficiently without replacing current enrollment flows
- Capacity and prerequisite rules still hold
- Existing class catalog, offerings, and enrollment workflows are extended rather than rebuilt
- Tests are added for new behavior
- `npm run verify` passes
