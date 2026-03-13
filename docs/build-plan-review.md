# CMMS Build Plan Review

## Overview

This document reviews the proposed 12-phase CMMS build plan against the actual codebase. The review was conducted by auditing all 20+ Prisma models, 19 server action files, 24 lib modules, 16 test files, and the complete UI route structure.

**Key finding:** ~40-50% of the proposed plan describes rebuilding features that already exist and are tested.

---

## 1. Strengths of the Plan

- **Phased structure** — breaking work into deployable increments is the right approach
- **Activity logging (Phase 3)** — this is genuinely the biggest gap in the current system; `MonthlyReport` requires manual entry with no underlying meeting/attendance data to feed it
- **Auto-fill reports (Phase 4)** — high-value feature; the points formula already exists in `app/actions/club-report-actions.ts` and just needs real data
- **Event templates (Phase 5)** — the current event creation flow is manual; templates would reduce repetitive admin work for recurring events
- **Golden rules for AI** — establishing guardrails is pragmatic for AI-assisted development
- **Migration safety (Phase 11)** — the system has 9 migrations and a startup health check (`lib/system-health.ts`) that hard-fails on pending migrations
- **Review process (PLAN → BUILD → TEST → REVIEW → DEPLOY)** — this loop is solid discipline

---

## 2. Critical Issues

### 2.1 ~40-50% of the plan proposes rebuilding existing features

| Plan Proposes | Already Exists | Location |
|---|---|---|
| Club/Member/Event core entities | `Club`, `RosterMember` (70+ fields), `Event` models | `prisma/schema.prisma` |
| Class/Honor catalog | `ClassCatalog` + `ClassRequirement` (5 requirement types) | `prisma/schema.prisma` lines 417-440 |
| Class enrollment with capacity | `ClassEnrollment` + `EventClassOffering` with serializable transactions | `app/actions/enrollment-actions.ts` |
| Prerequisite checking | `evaluateClassRequirements()` (age, role, honor, master guide) | `lib/class-prerequisite-utils.ts` |
| Monthly/year-end reports | `MonthlyReport` + `YearEndReport` with points calculation | `app/actions/club-report-actions.ts` |
| Compliance sync system | `ComplianceSyncRun` with Sterling CSV preview/apply workflow | `lib/compliance-sync.ts`, `app/actions/compliance-actions.ts` |
| Registration lifecycle | State machine (NOT_OPEN/OPEN/CLOSED + DRAFT/SUBMITTED/APPROVED) | `lib/registration-lifecycle.ts` |
| Testing framework | 16 test files with unit + integration patterns | `tests/` directory |
| Dynamic form fields | 10 field types, GLOBAL/ATTENDEE scopes, FIELD_GROUP hierarchy | `EventFormField` model + `lib/event-form-*.ts` |

### 2.2 Phase 1 would destroy the existing architecture

The plan proposes redesigning around "Club, Member, Event, Activity" as core entities. Three of these are already load-bearing models:

- **`Club`** has relations to 8 other models (memberships, roster years, registrations, reports, nominations, TLT, compliance)
- **`RosterMember`** has 70+ fields and relations to 7 other models
- **`Event`** has dynamic form fields, registrations, and class offerings with a full lifecycle

This is not a greenfield project — it's an extension project. The plan must be reframed accordingly.

### 2.3 Phase 6 (Honors Weekend) duplicates existing class infrastructure

The system already has everything needed for Honors Weekend:
- `ClassCatalog` with `classType = HONOR`
- `EventClassOffering` with capacity and teacher assignment
- `ClassEnrollment` with one-class-per-attendee conflict detection (`lib/class-model.ts`)
- Prerequisite evaluation (`lib/class-prerequisite-utils.ts`)
- Director class assignment board (`app/director/events/[eventId]/classes/`)
- Teacher class roster manager (`app/teacher/class/[offeringId]/`)

An "Honors Weekend" is simply an Event with honor-type class offerings. What's actually needed is UI enhancements (honor selection wizard, bulk enrollment, completion certificates), not a new system.

### 2.4 Phase 10 (Testing) is dangerously late

Placing testing at Phase 10 of 12 implies Phases 1-9 ship untested. The codebase already has test infrastructure with both unit and integration patterns. Every phase should include tests as a deliverable, not be deferred.

### 2.5 Phase 0 (Audit) runs after the plan was written

The audit prompt runs *after* the plan was designed. Since the plan was written without codebase knowledge, it proposes rebuilding existing features. The audit should have informed the plan. Result: the plan proposes models like `HonorSlot`, `HonorClass`, `HonorEnrollment` that are redundant with `EventClassOffering`, `ClassCatalog`, and `ClassEnrollment`.

### 2.6 The 4-role authorization model is never mentioned

The codebase has a well-defined role system (`SUPER_ADMIN`, `CLUB_DIRECTOR`, `STAFF_TEACHER`, `STUDENT_PARENT`) enforced in every server action via `auth()` + role checks. The plan's Phase 9 (Admin Control Center) does not mention this existing infrastructure. Any new feature must integrate with this pattern.

---

## 3. What's Missing from the Plan

1. **Audit logging model** — no `AuditLog` model exists despite encrypted medical data, financial tracking (`totalDue`/`amountPaid`), and compliance records
2. **Scheduled jobs / cron** — no job scheduler for report reminders, background check expiration alerts, or stale `AuthRateLimitBucket` cleanup
3. **Payment integration strategy** — `EventRegistration` tracks `totalDue`, `amountPaid`, and `PaymentStatus` but there's no payment processor integration
4. **File/document storage strategy** — insurance cards (`RosterMember.insuranceCardFilename`) and secure files exist but storage architecture (local vs S3) isn't addressed
5. **Error monitoring** — no Sentry, structured logging, or operational monitoring beyond the startup health check
6. **Background check expiration** — `backgroundCheckDate` exists but no `backgroundCheckExpiresAt` field for proactive alerting

---

## 4. Sequencing Issues

| Issue | Problem | Fix |
|---|---|---|
| Phase 0 after plan | Audit should inform the plan, not follow it | Run audit FIRST |
| Phases 3-4 split | Activity logging and report auto-fill are two halves of one feature | Combine into single phase |
| Phase 5 before 6-7 | Templates should exist before Camporee/Honors Weekend use them | Correct (keep this order) |
| Phase 8 at position 8 | Compliance dashboard is UI over existing data | Move earlier |
| Phase 10 standalone | Testing should be in every phase | Embed, don't defer |
| Phase 12 at end | Documentation should be continuous | Ongoing, finalized at end |

---

## 5. Prompt Engineering Issues

### Problem: No codebase context
Every prompt should start with a "Current State" block listing existing models, server actions, and test files. Without this, the AI proposes building things that already exist.

### Problem: Abstract golden rules
"AI must maintain code quality" is not actionable. Better: "Every server action must call `auth()` and check session role before proceeding."

### Problem: No acceptance criteria
Each phase prompt should end with: "Acceptance criteria: (1) `npm run verify` passes, (2) `npx prisma validate` succeeds, (3) all existing tests still pass, (4) new tests for [specific features] pass."

### Problem: No anti-pattern constraints
Add: "Do NOT create new models for functionality existing models already cover."

### Problem: No file references
Instead of "build a class enrollment system," say: "The class enrollment system exists at `app/actions/enrollment-actions.ts`. Extend it to support [specific new capability]."

---

## 6. Summary

The plan's instinct is right: phased, safe, testable development. But the execution is undermined by not knowing what already exists. **Reframe from "build a CMMS" to "extend the existing CMMS."** Run the audit first, cut the redundant phases, embed testing into every phase, and give every AI prompt explicit codebase context.

See `docs/revised-build-plan.md` for the corrected plan.
See `docs/system-specification.md` for the codebase reference document.
See `docs/ai-development-prompts.md` for improved AI prompts.
