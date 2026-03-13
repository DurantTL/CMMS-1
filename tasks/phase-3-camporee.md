# Phase 3: Camporee

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the current CMMS to support Camporee-specific workflows using existing event registration and dynamic form infrastructure, adding only the missing Camporee-specific pieces.

## Relevant Existing Models/Actions

- `prisma/schema.prisma`
- `app/actions/event-admin-actions.ts`
- `app/actions/event-registration-actions.ts`
- `app/actions/checkin-actions.ts`
- `app/actions/report-actions.ts`
- `app/admin/events/[eventId]/page.tsx`
- `app/admin/events/[eventId]/checkin/page.tsx`
- `app/director/events/[eventId]/page.tsx`
- `lib/event-form-responses.ts`
- `lib/data/event-registration-export.ts`

Pay special attention to:

- `Event`
- `EventFormField`
- `EventRegistration`
- `RegistrationAttendee`
- `EventFormResponse`

This phase must extend the existing event, registration, check-in, export, and reporting infrastructure rather than create a separate Camporee system.

## Required Backend Work

- Build Camporee on top of the existing event and registration lifecycle
- Reuse dynamic event forms for club-level and attendee-level questions
- Add only genuine Camporee-specific capabilities that the current system lacks
- Support admin and director views where appropriate
- Reuse existing attendee, export, and check-in data flows where possible

## Required UI Work

- Integrate Camporee-specific UI into existing admin and director event pages
- Reuse current registration and check-in surfaces wherever they already fit
- Add only the missing Camporee-specific views needed for scoring, competitions, or special review

## Tests Required

- Add tests for Camporee-specific backend behavior
- Add tests for any new scoring or competition rules
- Add regression coverage showing normal event flows still work
- Extend the existing test framework instead of creating a separate one

## Constraints

- Do not rebuild registration, attendee selection, check-in, or event forms
- Do not introduce duplicate event or attendee models
- Keep Camporee-specific logic clearly layered on top of current infrastructure
- Any scoring or competition features must be additive and production-safe
- Every new server action must call `auth()` and validate `session.user.role`
- Use `revalidatePath()` after mutations
- Run `npm run verify` before considering the phase complete

## Deliverables

- Any minimal schema additions needed for Camporee-only data
- Server actions for Camporee-specific operations
- Admin/director UI additions integrated into current event pages
- Tests covering new Camporee logic
- Documentation updates if the Camporee workflow changes planner expectations

## Acceptance Criteria

- Camporee works through the existing event creation and registration infrastructure
- Only missing Camporee-specific features are added
- Existing event workflows continue to work unchanged
- Existing event and attendee models remain the source of truth
- Tests are added for the new behavior
- `npm run verify` passes
