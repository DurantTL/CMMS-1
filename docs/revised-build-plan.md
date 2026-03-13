# CMMS Revised Build Plan

This plan organizes future work so Codex can extend the existing CMMS phase-by-phase without rebuilding core systems that are already live.

Read `docs/system-specification.md` first for every phase.

## Non-Negotiable Rules

Every phase must:

1. extend existing CMMS behavior rather than replace it
2. stay independently deployable
3. preserve current auth, reporting, registration, compliance, and class workflows unless the phase explicitly changes them
4. include tests
5. keep migrations safe and backwards compatible
6. pass `npm run verify`

## Existing Systems to Reuse

Future work should be built on top of the current source of truth:

- Events: `Event`, `EventFormField`, `EventRegistration`, `RegistrationAttendee`, `EventFormResponse`
- Honors/classes: `ClassCatalog`, `ClassRequirement`, `EventClassOffering`, `ClassEnrollment`, `MemberRequirement`
- Reports: `MonthlyReport`, `YearEndReport`
- Compliance: `ComplianceSyncRun`
- Club lifecycle: `Club`, `ClubRosterYear`, `RosterMember`, rollover and roster management
- Operations: check-in, PDF generation, email, file storage, system health checks

If a proposed feature can be modeled by extending one of those systems, that path should be preferred over creating a new subsystem.

## Phase Sequence

### Phase 1: Club Activity Logging + Report Auto-Fill

Focus:

- add missing activity and attendance foundations
- extend the existing `MonthlyReport` workflow
- keep manual reporting intact as a fallback

Architecture direction:

- year-scoped data should connect to `ClubRosterYear`
- director workflows should build on `getManagedClubContext()`
- reporting calculations should feed the existing report model, not replace it

### Phase 2: Event Templates

Focus:

- reduce repeated event setup
- extend the existing event creation and dynamic field system

Architecture direction:

- reuse the current event, field, registration, and class-offering infrastructure
- keep templates additive so created events remain editable and independent

### Phase 3: Camporee

Focus:

- implement Camporee as a specialization of the existing event platform
- add only truly missing Camporee-specific pieces such as scoring or competition views if needed

Architecture direction:

- reuse registration, attendees, dynamic forms, exports, check-in, and reporting where possible
- avoid parallel event or attendee models

### Phase 4: Honors UI

Focus:

- improve honors/class assignment and completion experience
- reuse the current honors/class domain model

Architecture direction:

- `ClassCatalog`, `ClassRequirement`, `EventClassOffering`, and `ClassEnrollment` remain the source of truth
- do not create duplicate honor models

### Phase 5: Compliance Dashboard

Focus:

- improve visibility into compliance status
- extend the current compliance sync and reporting system

Architecture direction:

- build on `ComplianceSyncRun`, roster-year data, and existing compliance pages
- preserve preview/apply safeguards

### Phase 6: Club Dashboard Health

Focus:

- give directors one place to see roster, compliance, event, reporting, and activity health

Architecture direction:

- prefer derived readiness indicators from existing data
- avoid duplicate persisted health tables unless truly necessary

### Phase 7: Audit Logging

Focus:

- add production-safe auditing for sensitive actions

Architecture direction:

- wrap existing actions and mutations rather than rewriting them
- avoid logging secrets, medical details, or unnecessary personal data

### Phase 8: Scheduled Jobs

Focus:

- support reminders, cleanup, and routine maintenance

Architecture direction:

- reuse existing scripts, APIs, email, and health checks
- prefer idempotent jobs with clear reviewability

## Delivery Pattern for Every Phase

1. read `docs/system-specification.md`
2. read the relevant `tasks/phase-*.md` file
3. inspect the existing models, actions, pages, and tests named in the task file
4. implement only that scoped phase
5. add tests
6. run `bash scripts/ai/verify-phase.sh`
7. review the diff with `bash scripts/ai/summarize-phase.sh`
8. open a PR with the required checklist

## Planning Note

The task files in `tasks/` are the operational briefs for Codex work. This document is the sequencing guide. If the task file and an implementation idea conflict, favor the task file plus `docs/system-specification.md`, then update the plan only after human review.
