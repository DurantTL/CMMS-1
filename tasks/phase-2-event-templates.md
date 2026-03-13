# Phase 2: Event Templates

## Read First

Codex must read `docs/system-specification.md` before making any changes. Then read `docs/revised-build-plan.md`, `docs/ai-development-prompts.md`, `docs/AI-WORKFLOW.md`, and this task file.

## Goal

Extend the existing event creation workflow so admins can create reusable event templates on top of the current `Event` and dynamic form infrastructure.

## Relevant Existing Models/Actions

- `prisma/schema.prisma`
- `app/actions/event-admin-actions.ts`
- `app/admin/events/new/page.tsx`
- `app/admin/events/new/_components/dynamic-form-builder.tsx`
- `app/admin/events/[eventId]/edit/page.tsx`
- `app/admin/events/[eventId]/edit/_components/event-dynamic-fields-editor.tsx`
- `lib/event-form-scope.ts`
- `lib/event-form-completeness.ts`

Pay special attention to:

- `Event`
- `EventFormField`
- `EventClassOffering`
- `ClassCatalog`

This phase must extend the existing event creation, editing, and dynamic form infrastructure rather than create a parallel event setup system.

## Required Backend Work

- Add template support by extending the existing event creation flow
- Reuse the current dynamic field system instead of inventing a parallel one
- Preserve event-specific editing after a template is applied
- Support template activation/deactivation and future template evolution safely
- Reuse `createEventWithDynamicFields()` and related event admin infrastructure where practical

## Required UI Work

- Add admin UI for creating and managing event templates
- Add template selection to the current event creation flow
- Keep generated events editable through the existing event editing screens

## Tests Required

- Add tests for template creation and validation
- Add tests for generating an event from a template
- Add regression coverage showing existing event editing still works
- Extend the existing test framework instead of creating a new one

## Constraints

- Do not rebuild event creation from scratch
- Do not bypass `createEventWithDynamicFields()` unless there is a strong reason
- Do not create duplicate models for questions, registrations, or attendee data
- Keep migrations backwards compatible
- Every new server action must call `auth()` and validate `session.user.role`
- Use `revalidatePath()` after mutations
- Run `npm run verify` before considering the phase complete

## Deliverables

- Schema additions for template storage if needed
- Server actions for template management
- Admin UI for selecting and managing templates
- Tests covering template validation and template-to-event creation
- Updated workflow documentation if implementation details change

## Acceptance Criteria

- Admins can create and maintain event templates without disturbing existing events
- Creating an event from a template still uses the existing CMMS event infrastructure
- Template changes do not retroactively alter already-created events
- Existing event, registration, and dynamic field systems remain the source of truth
- Tests are added for the feature
- `npm run verify` passes
