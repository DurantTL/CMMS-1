# CMMS AI Development Prompts

Use these prompts when handing a single scoped phase to Codex. They are designed to keep future work anchored to the existing CMMS instead of drifting into greenfield behavior.

Before using any phase prompt, share:

- `docs/system-specification.md`
- `docs/revised-build-plan.md`
- `docs/AI-WORKFLOW.md`
- the relevant file from `tasks/`

## Universal Preamble

```text
You are working inside the existing GitHub repository imsda/CMMS.

CRITICAL CONTEXT:

This is an EXISTING, PRODUCTION-READY codebase. Do NOT treat it as greenfield.

You must EXTEND the current CMMS safely. Do NOT rebuild systems that already exist.

Existing infrastructure already present includes:
- Next.js App Router + TypeScript + Prisma + PostgreSQL
- 20+ Prisma models
- 19 server action files
- 16 test files
- 4-role auth system:
  - SUPER_ADMIN
  - CLUB_DIRECTOR
  - STAFF_TEACHER
  - STUDENT_PARENT
- Dynamic event form system
- Event registration lifecycle
- Class/honor catalog, offerings, enrollment, capacity, prerequisites
- MonthlyReport and YearEndReport models
- Compliance sync
- PDF generation
- Email infrastructure
- File storage
- System health checks

MANDATORY RULES:
1. Every server action must call auth() and check session.user.role
2. Use getManagedClubContext() for director-scoped features
3. Use revalidatePath() after mutations
4. Link year-scoped data to ClubRosterYear, not directly to Club
5. Use serializable transactions for capacity-sensitive operations
6. Every new feature must include tests
7. Never invent duplicate models for functionality that already exists
8. Keep migrations safe and backwards compatible
9. Do not break existing tests or current workflows
10. Run npm run verify before considering work complete

START BY:
1. Reading docs/system-specification.md
2. Inspecting the relevant existing models, actions, pages, and tests before editing
3. Explaining how you will extend existing CMMS behavior rather than replace it

DO NOT:
- rebuild existing event, roster, reporting, compliance, class, storage, email, or check-in systems
- create duplicate models when existing models already fit
- make unrelated code changes
- skip tests or verification
```

## Planner Prompt Template

```text
Use the Universal Preamble above.

Then add:

Task file: tasks/phase-X-name.md

Please:
1. Read docs/system-specification.md first.
2. Inspect the files named in the task file before editing.
3. Extend existing CMMS behavior only within the scope of that task.
4. Add or update tests.
5. Run npm run verify.
6. Summarize:
   - files changed
   - migrations, if any
   - tests added
   - risks or follow-up items
```

## Phase-Specific Add-Ons

These short add-ons help steer Codex toward the right existing subsystem.

### Phase 1 Add-On

```text
This phase extends the existing MonthlyReport workflow. Do not replace current reporting.
Inspect app/actions/club-report-actions.ts, app/actions/teacher-actions.ts, app/actions/roster-actions.ts, app/director/reports/page.tsx, and prisma/schema.prisma first.
Any new year-scoped activity data must link to ClubRosterYear.
```

### Phase 2 Add-On

```text
This phase extends existing event creation and the dynamic event field system.
Inspect app/actions/event-admin-actions.ts, app/admin/events/new/page.tsx, app/admin/events/new/_components/dynamic-form-builder.tsx, and prisma/schema.prisma first.
Reuse Event, EventFormField, EventRegistration, EventFormResponse, and EventClassOffering where possible.
```

### Phase 3 Add-On

```text
This phase adds Camporee-specific behavior on top of the existing event platform.
Inspect app/actions/event-registration-actions.ts, app/actions/checkin-actions.ts, app/admin/events/[eventId]/page.tsx, app/director/events/[eventId]/page.tsx, and prisma/schema.prisma first.
Do not rebuild registrations, attendee handling, or dynamic fields.
```

### Phase 4 Add-On

```text
This phase extends the existing honors/class system.
Inspect app/actions/enrollment-actions.ts, app/actions/admin-actions.ts, lib/class-model.ts, lib/class-prerequisite-utils.ts, and the director/teacher class pages first.
Do not create duplicate honor models. Reuse ClassCatalog, ClassRequirement, EventClassOffering, ClassEnrollment, and MemberRequirement.
```

### Phase 5 Add-On

```text
This phase extends the existing compliance sync system.
Inspect app/actions/compliance-actions.ts, app/admin/compliance/page.tsx, app/admin/compliance/_components/compliance-sync-dashboard.tsx, lib/compliance-sync.ts, and prisma/schema.prisma first.
Preserve existing preview/apply behavior and role boundaries.
```

### Phase 6 Add-On

```text
This phase extends the director dashboard with readiness/health views built from existing data.
Inspect app/director/dashboard/page.tsx, app/actions/club-report-actions.ts, app/actions/compliance-actions.ts, app/actions/event-registration-actions.ts, lib/system-health.ts, and prisma/schema.prisma first.
Prefer derived health indicators over new source-of-truth tables.
```

### Phase 7 Add-On

```text
This phase adds audit logging around sensitive existing workflows.
Inspect app/actions/admin-management-actions.ts, app/actions/compliance-actions.ts, app/actions/roster-actions.ts, app/actions/enrollment-actions.ts, app/actions/storage-actions.ts, and prisma/schema.prisma first.
Do not log secrets, password hashes, raw medical data, or unnecessary personal details.
```

### Phase 8 Add-On

```text
This phase adds scheduled jobs by extending current scripts, APIs, email, and maintenance flows.
Inspect scripts/run-auth-rate-limit-cleanup.sh, scripts/run-startup-self-checks.ts, app/actions/storage-actions.ts, lib/email/resend.ts, lib/system-health.ts, prisma/cleanup-auth-rate-limits.ts, and relevant app/api routes first.
Prefer idempotent jobs and avoid heavy new infrastructure unless justified.
```

## Review Prompt

Use this when asking Codex for a pre-PR review of its own phase work:

```text
Review this change as an extension of the existing CMMS, not as a greenfield build.

Focus on:
- duplicate systems or models accidentally introduced
- missing auth()/role checks in new actions
- missing getManagedClubContext() in director-scoped changes
- missing revalidatePath() after mutations
- incorrect Club vs ClubRosterYear linkage
- missing serializable transactions for capacity-sensitive changes
- missing tests
- anything that would break npm run verify
```
