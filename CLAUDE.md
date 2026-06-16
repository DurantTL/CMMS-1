# CLAUDE.md

Guidance for working in this repository. Read it before making changes.

This is a **Next.js 15 (App Router) / React 18 / Prisma 5 / PostgreSQL** club
management system (CMMS) for Adventurer/Pathfinder clubs. Auth is NextAuth v5
(JWT) with four roles. Server Actions under `app/actions/*` do the writes; Prisma
is the single source of truth for the data model.

---

## a. DATA MODEL

Pulled verbatim from `prisma/schema.prisma`. Fields and enum values are exact —
do not paraphrase them in code; import the Prisma enums.

### Enums (every value)

```
UserRole              SUPER_ADMIN | CLUB_DIRECTOR | STAFF_TEACHER | STUDENT_PARENT
ClubType              PATHFINDER | ADVENTURER | EAGER_BEAVER
MemberRole            PATHFINDER | ADVENTURER | TLT | STAFF | CHILD | DIRECTOR | COUNSELOR
Gender                MALE | FEMALE | NON_BINARY | PREFER_NOT_TO_SAY
MemberStatus          ACTIVE | INACTIVE | WALK_IN
RolloverStatus        CONTINUING | ARCHIVED | GRADUATED | NEW
RegistrationStatus    DRAFT | SUBMITTED | REVIEWED | NEEDS_CHANGES | APPROVED | REJECTED
PaymentStatus         PENDING | PARTIAL | PAID
EventMode             BASIC_FORM | CLUB_REGISTRATION | CLASS_ASSIGNMENT
EventWorkflowType     STANDARD | CAMPOREE
EventTemplateCategory BASIC_EVENTS | CLUB_REGISTRATION | CLASS_ASSIGNMENT | MONTHLY_REPORTS
EventTemplateSource   SYSTEM | USER
FormFieldType         SHORT_TEXT | LONG_TEXT | NUMBER | BOOLEAN | DATE | SINGLE_SELECT |
                      MULTI_SELECT | ROSTER_SELECT | ROSTER_MULTI_SELECT | FIELD_GROUP
FormFieldScope        GLOBAL | ATTENDEE
ClassType             HONOR | SPECIALTY | WORKSHOP | REQUIRED
RequirementType       MIN_AGE | MAX_AGE | MEMBER_ROLE | COMPLETED_HONOR | MASTER_GUIDE
ReportStatus          DRAFT | SUBMITTED
MonthlyReportStatus   DRAFT | SUBMITTED | UNDER_REVIEW | APPROVED | REVISION_REQUESTED
NominationStatus      SUBMITTED | REVIEWED | WINNER
TltApplicationStatus  PENDING | APPROVED | REJECTED
TltRecommendationStatus              PENDING | COMPLETED
TltRecommendationInviteEmailStatus   PENDING | SENT | FAILED
ComplianceSyncRunStatus              PREVIEW | APPLIED
ComplianceSyncScope                  ROSTER_YEAR | SYSTEM_WIDE
AuthRateLimitScope                   EMAIL_IP | IP
```

### Roster foundation models

These three are the foundation (see CONSTRAINTS).

**Club**
```
id        String   @id @default(cuid())
name      String
code      String   @unique
type      ClubType
city      String?
state     String?
district  String?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
// relations: memberships ClubMembership[], rosterYears ClubRosterYear[],
//   registrations EventRegistration[], monthlyReports MonthlyReport[],
//   yearEndReports YearEndReport[], nominations Nomination[],
//   tltApplications TltApplication[], complianceSyncRuns ComplianceSyncRun[],
//   auditLogs AuditLog[]
```

**ClubRosterYear** — one per club per year; `isActive` marks the live year;
`copiedFromYearId` is the self-relation that records rollover lineage.
```
id               String   @id @default(cuid())
clubId           String
yearLabel        String
startsOn         DateTime
endsOn           DateTime
isActive         Boolean  @default(true)
copiedFromYearId String?
createdAt        DateTime @default(now())
// club Club (onDelete: Cascade)
// copiedFromYear ClubRosterYear?  @relation("RosterYearRollover")
// rolledIntoYears ClubRosterYear[] @relation("RosterYearRollover")
// members RosterMember[], clubActivities ClubActivity[], monthlyReports,
//   complianceSyncRuns, auditLogs
@@unique([clubId, yearLabel])
@@index([clubId, isActive])
```

**RosterMember** — a person within ONE roster year (members are scoped to a
`ClubRosterYear`, not directly to a `Club`).
```
id                         String         @id @default(cuid())
clubRosterYearId           String
firstName                  String
lastName                   String
dateOfBirth                DateTime?
ageAtStart                 Int?
gender                     Gender?
memberRole                 MemberRole
medicalFlags               String?
dietaryRestrictions        String?
isFirstTime                Boolean        @default(false)
isMedicalPersonnel         Boolean        @default(false)
masterGuide                Boolean        @default(false)
swimTestCleared            Boolean        @default(false)
backgroundCheckDate        DateTime?
backgroundCheckCleared     Boolean        @default(false)
memberStatus               MemberStatus   @default(ACTIVE)
rolloverStatus             RolloverStatus @default(CONTINUING)
isActive                   Boolean        @default(true)
emergencyContactName       String?
emergencyContactPhone      String?
insuranceCompany           String?
insurancePolicyNumber      String?
insuranceCardFilename      String?
lastTetanusDate            DateTime?
lastTetanusDateEncrypted   String?
photoReleaseConsent          Boolean   @default(false)
medicalTreatmentConsent      Boolean   @default(false)
membershipAgreementConsent   Boolean   @default(false)
photoReleaseConsentAt        DateTime?
medicalTreatmentConsentAt    DateTime?
membershipAgreementConsentAt DateTime?
consentVersion               String?
createdAt                    DateTime  @default(now())
updatedAt                    DateTime  @updatedAt
// clubRosterYear ClubRosterYear (onDelete: Cascade)
// registrations RegistrationAttendee[], classEnrollments ClassEnrollment[],
//   completedRequirements MemberRequirement[], eventFormResponses EventFormResponse[],
//   nominations Nomination[], tltApplication TltApplication?,
//   portalUsers UserRosterMemberLink[]
@@index([clubRosterYearId, isActive])
@@index([lastName, firstName])
```

Notes on medical/PII fields: `medicalFlags`, `dietaryRestrictions`,
`insuranceCompany`, `insurancePolicyNumber`, and `lastTetanusDate` are written
through `lib/medical-data.ts` (`prepareMedicalFieldsForWrite` /
`decryptMedicalFields`), which manages `lastTetanusDateEncrypted`. Don't write
these columns raw.

### Event / Registration models

**Event**
```
id                   String            @id @default(cuid())
name                 String
slug                 String            @unique
eventMode            EventMode         @default(CLUB_REGISTRATION)
workflowType         EventWorkflowType @default(STANDARD)
description          String?
startsAt             DateTime
endsAt               DateTime
registrationOpensAt  DateTime
registrationClosesAt DateTime
basePrice            Float
lateFeePrice         Float
lateFeeStartsAt      DateTime
locationName         String?
locationAddress      String?
eventBringNote       String?
reviewTurnaroundDays Int?
minAttendeeAge       Int?
maxAttendeeAge       Int?
allowedClubTypes     String[]  @default([])
isPublished          Boolean   @default(false)
createdByUserId      String?
createdAt            DateTime  @default(now())
updatedAt            DateTime  @updatedAt
// relations: dynamicFields EventFormField[], registrations EventRegistration[],
//   classTimeslots, classOfferings, classPreferences, classWaitlistEntries,
//   camporeeScores, broadcasts EventBroadcast[]
```

**EventRegistration** — one per `(eventId, clubId)`.
```
id                      String             @id @default(cuid())
eventId                 String
clubId                  String
registrationCode        String             @unique
status                  RegistrationStatus @default(DRAFT)
submittedAt             DateTime?
approvedAt              DateTime?
reviewedAt              DateTime?
reviewedByUserId        String?
overrideLimitsAllowed   Boolean            @default(false)
notes                   String?
reviewerNotes           String?
revisionRequestedReason String?
totalDue                Float
amountPaid              Float              @default(0)
paymentStatus           PaymentStatus      @default(PENDING)
squarePaymentId         String?
squareCheckoutUrl       String?
squareOrderId           String?
campsiteAssignment      String?
createdAt               DateTime           @default(now())
updatedAt               DateTime           @updatedAt
// event Event, club Club, reviewedByUser User?,
//   attendees RegistrationAttendee[], formResponses EventFormResponse[],
//   camporeeScores CamporeeScore[], camporeeRegistration CamporeeRegistration?
@@unique([eventId, clubId])
@@index([clubId, status])
@@index([reviewedByUserId])
```

**RegistrationAttendee** — joins a registration to a `RosterMember`; check-in
lives here (`checkedInAt`).
```
id                  String    @id @default(cuid())
eventRegistrationId String
rosterMemberId      String
checkedInAt         DateTime?
createdAt           DateTime  @default(now())
// eventRegistration EventRegistration, rosterMember RosterMember,
//   classPreferences EventClassPreference[], classWaitlistEntries EventClassWaitlist[]
@@unique([eventRegistrationId, rosterMemberId])
@@index([rosterMemberId])
```

**EventFormField** — dynamic form definition (supports nested `FIELD_GROUP` via
self-relation `parentFieldId`). `options` is JSON (select choices and/or
`{ conditional: { fieldKey, operator, value } }`).
```
id            String         @id @default(cuid())
eventId       String
parentFieldId String?
key           String
label         String
description   String?
type          FormFieldType
fieldScope    FormFieldScope @default(GLOBAL)
options       Json?
isRequired    Boolean        @default(false)
sortOrder     Int            @default(0)
// event Event, parentField/childFields EventFormField (hierarchy),
//   responses EventFormResponse[]
@@unique([eventId, key])
@@index([eventId, sortOrder])
@@index([eventId, parentFieldId])
```

**EventFormResponse** — one value per `(registration, field, attendee?)`.
`attendeeId` references a `RosterMember` (nullable for GLOBAL-scope answers).
```
id                  String   @id @default(cuid())
eventRegistrationId String
eventFormFieldId    String
attendeeId          String?
value               Json
createdAt           DateTime @default(now())
updatedAt           DateTime @updatedAt
@@unique([eventRegistrationId, eventFormFieldId, attendeeId])
@@index([eventRegistrationId]) @@index([eventFormFieldId]) @@index([attendeeId])
```

`CamporeeRegistration` (1:1 with EventRegistration, camporee workflow logistics)
and `CamporeeScore` (`@@unique([eventRegistrationId, category])`) extend the
camporee path. See schema for their full field lists.

### Class / Enrollment models

**ClassCatalog** — reusable class definition.
```
id String @id, title String, code String @unique, description String?,
classType ClassType, active Boolean @default(true), createdAt, updatedAt
// requirements ClassRequirement[], offerings EventClassOffering[]
```

**ClassRequirement** — eligibility rule; `requirementType RequirementType`,
`config Json` (config-driven, not flat columns).

**EventClassTimeslot** — `@@unique([eventId, label])`; a scheduling slot for an
event's classes.

**EventClassOffering** — a catalog class offered at an event/timeslot.
```
id, eventId, timeslotId String?, classCatalogId, teacherUserId String?,
capacity Int?, locationName String?, active Boolean @default(true), createdAt
// teacher relation = "OfferingTeacher" on User; teacher field is teacherUserId
@@unique([eventId, classCatalogId, timeslotId])
```

**ClassEnrollment** — an attendee assigned to an offering. Class attendance
(`attendedAt`) is SEPARATE from event arrival check-in (`RegistrationAttendee.checkedInAt`).
```
id, eventClassOfferingId, rosterMemberId, assignedAt DateTime @default(now()),
attendedAt DateTime?
@@unique([eventClassOfferingId, rosterMemberId])
@@index([rosterMemberId])
```

**EventClassPreference** — ranked class choices per attendee per timeslot
(`rank`); unique on `[timeslotId, registrationAttendeeId, rank]` and
`[timeslotId, registrationAttendeeId, eventClassOfferingId]`.

**EventClassWaitlist** — waitlist `position` per attendee per timeslot/offering.

**MemberRequirement** — completed requirements per user/roster member;
`requirementType` + `metadata Json?` + `completedAt`.

### Other models (for orientation)

`User`, `ClubMembership` (`@@unique([clubId, userId])`), `UserRosterMemberLink`
(student-portal link, `@@unique([userId, rosterMemberId])`), `ClubActivity`,
`TltApplication` / `TltRecommendation`, `Nomination`, `EventBroadcast`,
`EventTemplate`, `ComplianceSyncRun`, `AuditLog`, `ScheduledJobRun`,
`AuthRateLimitBucket`, `MonthlyReport` / `MonthlyReportScoreLineItem`,
`YearEndReport`. See `prisma/schema.prisma` for their exact fields.

---

## b. FILE MAP

### Roster logic
- `app/actions/roster-actions.ts` — **owns all roster writes**: `saveRosterMember`
  (create/update), `createRosterYear`, `executeYearlyRollover` (rollover),
  `importRosterMembers` (CSV import).
- `app/director/roster/page.tsx` — director roster screen; renders the active
  roster year and the rollover / create-year buttons (inline server actions
  call into `roster-actions.ts`).
- `app/director/roster/_components/roster-table.tsx` — roster table + member
  add/edit form UI.
- `lib/club-management.ts` — `getManagedClubContext()` resolves which club the
  caller may manage (CLUB_DIRECTOR via membership, SUPER_ADMIN via `clubId`
  override). Every director write goes through this.
- `lib/director-path.ts` — `buildDirectorPath` / `readManagedClubId` for the
  super-admin `?clubId=` override.
- `lib/medical-data.ts` — encrypt/decrypt of roster medical/PII fields.
- `lib/data/student-portal.ts` + `app/actions/storage-actions.ts` — also read
  roster data.

### Event / registration logic
- `app/actions/event-registration-actions.ts` — director-side registration
  writes: `persistRegistrationForClub` (core, dependency-injected & unit/integration
  tested), `saveEventRegistrationDraft`, `submitEventRegistration`,
  `createWalkInAttendee`.
- `app/actions/event-admin-actions.ts` — admin event CRUD, dynamic-field
  updates, templates, broadcasts.
- `app/actions/checkin-actions.ts` — arrival check-in.
- `app/actions/camporee-registration-actions.ts` + `lib/camporee*.ts` — camporee
  workflow.
- `lib/registration-lifecycle.ts` — when a registration can be edited / locked /
  checked in (status + window rules).
- `lib/event-modes.ts` — `EventMode` capabilities + dynamic-field validation.
- `lib/event-form-fields.ts`, `lib/event-form-config.ts`,
  `lib/event-form-responses.ts`, `lib/event-form-completeness.ts`,
  `lib/event-form-scope.ts` — dynamic form field rules, parsing, response
  shaping, required-completeness checks, GLOBAL/ATTENDEE scoping.
- `lib/registration-code.ts` — registration code generation.
- `app/director/events/**`, `app/admin/events/**`, `app/(public)/events/**` —
  event/registration UI.

### Class / enrollment logic
- `app/actions/enrollment-actions.ts` — enroll/remove/bulk class assignment.
- `app/actions/teacher-actions.ts` — teacher class attendance.
- `lib/class-model.ts` — capacity, conflict detection, attendance update helpers
  (pure, unit tested).
- `lib/class-prerequisite-utils.ts` — requirement/prerequisite evaluation.
- `app/director/events/[eventId]/classes/**`, `app/teacher/**`,
  `app/admin/events/[eventId]/classes/**` — class UI.

### Dynamic form builder
- `app/admin/events/new/_components/dynamic-form-builder.tsx` — **the builder**
  (used when creating an event).
- `app/admin/events/new/_components/admin-create-event-client.tsx` — wraps it in
  the create-event flow.
- `app/admin/events/[eventId]/edit/_components/event-dynamic-fields-editor.tsx` —
  edit the dynamic fields of an existing event.
- Backed by `lib/event-form-*.ts` and persisted as `EventFormField` rows.

### Cross-cutting
- `auth.ts` (NextAuth v5), `middleware.ts`, `lib/prisma.ts` (client),
  `lib/audit-log.ts` (`safeWriteAuditLog`), `lib/action-utils.ts`
  (`isRedirectError`), `lib/payments/square.ts`, `lib/email/**`,
  `prisma/seed.ts`, `tests/**`.

---

## c. CONSTRAINTS

**The roster tables — `RosterMember`, `ClubRosterYear`, `Club` — are the
foundation that every other feature reads from.** Registrations, attendees,
class enrollments, compliance sync, monthly reports, TLT, nominations, and the
student portal all hang off these three.

- **Do not change their shape** (rename/remove/retype existing fields, change
  relations, or alter `@@unique` / `@@index` semantics) **without stopping and
  flagging it to Caleb first.**
- **New features build ON TOP of the existing roster model — never by reshaping
  it.** Add new models/columns/relations alongside; do not repurpose existing
  roster fields.
- Members are scoped to a `ClubRosterYear` (via `clubRosterYearId`), not directly
  to a `Club`. Reach the club through `member -> clubRosterYear -> club`.
- Rollover lineage is recorded by `ClubRosterYear.copiedFromYearId`; rollover
  copies forward only **active, non-`WALK_IN`** members and must **preserve the
  prior year and its members untouched** (history). See
  `executeYearlyRollover` in `app/actions/roster-actions.ts`.

---

## d. VERIFICATION PROTOCOL (run before handing ANY change back)

1. **Build & static checks.** Run all three and fix what fails — never return
   work with these failing:
   - `npm run build`
   - `npx tsc --noEmit`  (or `npm run typecheck`, which runs `next typegen && tsc --noEmit`)
   - `npm run lint`  (eslint, `--max-warnings=0`)
2. **Roster/rollover changes:** if the change touches the roster tables or
   rollover, run the roster tests (`npm test`). If no test covers what changed,
   write one. (Integration tests are gated on `DATABASE_URL`; see "Testing".)
3. **UI / flow changes:** start the dev server (`npm run dev`), walk the primary
   flow in a browser, and capture a screenshot.
4. **Hand back** with exactly these parts:
   - (a) what changed
   - (b) check results (build / tsc / lint / tests)
   - (c) screenshot, if UI
   - (d) a short list titled **"Needs Caleb's eyes:"** naming ONLY what you could
     not verify yourself (visual feel, wording, whether the flow matches intent).
     Keep it as short as is honestly true.

---

## Testing

A test runner is already configured — **no new setup is needed.**
- Runner: Node's built-in test runner via `node --import tsx --test`.
- Scripts: `npm test` (runs `tests/*.test.ts` + `tests/*.integration.test.ts`),
  and `npm run verify` (`typecheck && lint && test && build`).
- Pure tests use `node:test` + `node:assert/strict` against `lib/*` helpers
  (e.g. `tests/class-model.test.ts`, `tests/registration-lifecycle.test.ts`).
- Integration tests hit a real Postgres via `tests/integration-helpers.ts`
  (`hasIntegrationDatabase`, `resetIntegrationDatabase`, `disconnectIntegrationPrisma`)
  and are **skipped when `DATABASE_URL` is unset** (`{ skip: !hasIntegrationDatabase }`).

### Canonical local test sequence (the ONLY safe DB)

> ⚠️ The integration tests and the seed are **destructive** — they `TRUNCATE`
> and reseed. Run them **only** against a local, disposable Postgres. **Never**
> set `DATABASE_URL` to a staging/production database when running tests, the
> seed, `prisma migrate reset`, or `prisma db push`.

Standard flow from a clean checkout:

```bash
# 1. Bring up the disposable local Postgres (one command):
docker compose -f docker-compose.local.yml up -d   # postgres on localhost:5432

# 2. Point at it (matches DATABASE_URL in .env.example):
cp .env.example .env        # first time only

# 3. Apply the schema to the disposable DB:
npx prisma migrate deploy   # OR, for a fresh scratch DB: npx prisma db push

# 4. Seed the realistic conference slice (idempotent / re-runnable):
npx prisma db seed

# 5. Run the suite:
npm test
```

Or do all of it in one shot with the dev refresh script (see below):
`./scripts/dev.sh` — it refuses to run unless `DATABASE_URL` is local.

Notes:
- `MEDICAL_ENCRYPTION_KEY` must be set (it is in `.env.example`) or the seed and
  any roster medical write throws — fields are encrypted via `lib/medical-data.ts`.
- The integration tests each `resetIntegrationDatabase()` (full `TRUNCATE`), so a
  test run wipes the seed. Reseed (`npx prisma db seed`) before browsing the
  director UI.
- Run integration tests **serially** against a single DB
  (`node --import tsx --test --test-concurrency=1 …`); the default parallel runner
  races multiple files on the shared `TRUNCATE`.

### One-command local DB + refresh (Docker)

`docker-compose.local.yml` stands up a disposable Postgres only (named volume,
dev-only credentials, port 5432) wired to the `DATABASE_URL` in `.env.example`.
It does **not** touch the existing production/XCloud `Dockerfile` +
`docker-compose.yml`. `scripts/dev.sh` brings the whole local loop current
(pull → DB up → deps → schema → seed → test) and **hard-refuses** to run against
a non-local `DATABASE_URL`.

## Conventions
- Writes go through Server Actions in `app/actions/*` (`"use server"`); they
  resolve permissions via `lib/club-management.ts` and audit via
  `lib/audit-log.ts`.
- Always import Prisma enums from `@prisma/client`; never hardcode enum strings.
- React 18 + Next 15 App Router. Use `useFormState`/`useFormStatus` (not
  `useActionState`) — see `AGENTS.md`.
- Money is `Float`; dates are stored UTC (`new Date(\`${ymd}T00:00:00.000Z\`)`).

