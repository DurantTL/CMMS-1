# CMMS Revised Build Plan

## Guiding Principle

This plan **extends** the existing CMMS — it does not rebuild it. Every phase assumes the existing 20+ models, 19 server action files, 16 test files, and 4-role auth system remain unchanged unless explicitly modified.

Before starting any phase, read `docs/system-specification.md` to understand what already exists.

---

## Review Process (Every Phase)

```
DESIGN → Review design → IMPLEMENT → Tests pass → Review code → DEPLOY
```

Every phase must:
1. Be deployable independently
2. Not break existing features (`npm run verify` must pass)
3. Include unit + integration tests
4. Include migration plan if schema changes
5. Include UI for both admin and director roles (where applicable)

---

## Phase 1: Club Activity Logging + Report Auto-Fill

**Goal:** Replace manual monthly report entry with real activity data.

**Why this is first:** The `MonthlyReport` model exists but requires directors to manually enter `meetingCount`, `averagePathfinderAttendance`, `averageStaffAttendance`, and `uniformCompliance`. There is no underlying data to validate these numbers. Activity logging fills this gap and makes reports auto-calculable.

### New Models

```prisma
model ClubActivity {
  id               String          @id @default(cuid())
  clubRosterYearId String
  activityType     ClubActivityType
  date             DateTime
  title            String?
  notes            String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  clubRosterYear   ClubRosterYear  @relation(fields: [clubRosterYearId], references: [id], onDelete: Cascade)
  attendanceRecords ActivityAttendance[]

  @@index([clubRosterYearId, activityType])
  @@index([clubRosterYearId, date])
}

enum ClubActivityType {
  CLUB_MEETING
  STAFF_MEETING
  OUTREACH
  COMMUNITY_SERVICE
  HONOR_ACTIVITY
  FIELD_TRIP
  OTHER
}

model ActivityAttendance {
  id              String       @id @default(cuid())
  clubActivityId  String
  rosterMemberId  String
  present         Boolean      @default(true)
  uniformWorn     Boolean      @default(false)
  createdAt       DateTime     @default(now())

  clubActivity    ClubActivity @relation(fields: [clubActivityId], references: [id], onDelete: Cascade)
  rosterMember    RosterMember @relation(fields: [rosterMemberId], references: [id], onDelete: Cascade)

  @@unique([clubActivityId, rosterMemberId])
  @@index([rosterMemberId])
}
```

**Key design decision:** Link to `ClubRosterYear`, not `Club`, following the existing year-scoped data pattern.

### Backend Changes
- New server actions: `saveClubActivity()`, `deleteClubActivity()`, `getClubActivities()`
- New server action: `autoFillMonthlyReport(clubId, reportMonth)` — queries `ClubActivity` + `ActivityAttendance` for the month, calculates meeting count, average attendances, and uniform compliance percentage
- Enhance existing `createMonthlyReport()` in `app/actions/club-report-actions.ts` to accept auto-filled values with a "director confirmed" flag

### UI Changes
- Director: `/director/activities` — activity log with create/edit forms
- Director: `/director/activities/[activityId]` — attendance marking
- Director: enhance `/director/reports` with "Auto-fill from activities" button
- Admin: read-only activity view per club

### Migration
- Add `ClubActivity` and `ActivityAttendance` tables
- Add `attendanceRecords` relation to existing `RosterMember`
- No changes to existing `MonthlyReport` schema (auto-fill populates existing fields)

### Tests
- Unit: activity creation validation, auto-fill calculation logic
- Integration: activity CRUD, attendance tracking, auto-fill → MonthlyReport flow

### Acceptance Criteria
- `npm run verify` passes
- Directors can log meetings and mark attendance
- Auto-fill correctly calculates monthly report fields from activity data
- Directors can review and edit auto-filled values before submission
- Existing manual report entry still works

---

## Phase 2: Event Templates

**Goal:** Reduce repetitive event setup for recurring event types (Camporee, Honors Weekend, retreats).

### New Models

```prisma
model EventTemplate {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  version     Int      @default(1)
  config      Json     // Stores: default form fields, default class offerings, pricing defaults, module list
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Backend Changes
- New server actions: `createEventTemplate()`, `updateEventTemplate()`, `getEventTemplates()`
- Enhance `createEventWithDynamicFields()` in `app/actions/event-admin-actions.ts` to accept an optional `templateId` parameter
- Template `config` JSON structure:
  ```json
  {
    "defaultFields": [{ "key": "...", "label": "...", "type": "...", "scope": "...", "isRequired": true }],
    "defaultClassOfferings": [{ "classCatalogCode": "...", "capacity": null }],
    "defaultPricing": { "basePrice": 0, "lateFeePrice": 0 },
    "modules": ["camping_logistics", "duty_scheduler", "spiritual_milestones"]
  }
  ```

### UI Changes
- Admin: `/admin/templates` — template list + builder
- Admin: `/admin/templates/[templateId]` — template editor (field configuration, module ordering)
- Admin: enhance `/admin/events/new` with "Create from Template" dropdown

### Migration
- Add `EventTemplate` table
- Optionally add `templateId` to `Event` model for lineage tracking

### Tests
- Unit: template config validation, template-to-event field generation
- Integration: create event from template, verify fields match

### Acceptance Criteria
- Admin can create, edit, and deactivate templates
- Creating an event from a template pre-populates form fields and class offerings
- Template changes do not affect existing events
- `npm run verify` passes

---

## Phase 3: Camporee System

**Goal:** Build Camporee-specific functionality using the event template system from Phase 2.

### Approach
A Camporee is an Event created from a "Camporee" template. The template includes modules for:
- Club information (GLOBAL scope fields)
- Camping logistics (tent count, camping type — GLOBAL scope)
- Roster/attendee selection (existing functionality)
- Duty scheduling (ATTENDEE scope fields with duty slot options)
- Club activities/scoring (new)
- Meal sponsorship (GLOBAL scope)
- Spiritual milestones (ATTENDEE scope — baptism/Bible study names)

### New Models (if needed for scoring)

```prisma
model CamporeeScore {
  id                  String   @id @default(cuid())
  eventRegistrationId String
  category            String   // drill, inspection, activity name
  score               Float
  maxScore            Float
  judgeName            String?
  notes               String?
  createdAt           DateTime @default(now())

  eventRegistration   EventRegistration @relation(fields: [eventRegistrationId], references: [id], onDelete: Cascade)

  @@index([eventRegistrationId, category])
}
```

### Backend Changes
- Camporee template definition (uses Phase 2 infrastructure)
- New server actions for scoring: `saveCamporeeScore()`, `getCamporeeScoreboard(eventId)`
- Scoring summary/leaderboard calculation

### UI Changes
- Admin: scoring input UI per club registration
- Admin: scoreboard/leaderboard view
- Director: read-only score view for their club

### Tests
- Unit: score calculation, leaderboard ranking
- Integration: score CRUD, leaderboard aggregation

---

## Phase 4: Honors Weekend UI Enhancements

**Goal:** Improve the Honors Weekend experience using existing class infrastructure.

**Important:** This phase does NOT create new models. The existing `ClassCatalog` (with `classType = HONOR`), `EventClassOffering`, `ClassEnrollment`, and `ClassRequirement` models already provide all needed functionality.

### What Already Works
- Class catalog with `HONOR` type
- Per-event class offerings with capacity and teacher assignment
- Enrollment with one-class-per-attendee conflict detection (`lib/class-model.ts`)
- Prerequisite evaluation (age, role, honor completion, master guide — `lib/class-prerequisite-utils.ts`)
- Director class assignment board (`app/director/events/[eventId]/classes/`)
- Teacher class roster and attendance marking (`app/teacher/class/[offeringId]/`)

### What to Add
1. **Honor selection wizard** — Director UI that shows available honors filtered by time slot, age eligibility, and capacity, with drag-and-drop or checkbox-based assignment
2. **Bulk enrollment** — Select multiple attendees and assign them to an honor in one action
3. **Time slot grouping** — Add optional `timeSlot` or `sessionLabel` field to `EventClassOffering` so honors can be grouped by time slot in the UI
4. **Completion certificate PDF** — Extend existing PDF export at `lib/pdf/` to generate individual honor completion certificates

### Schema Change (minimal)
```prisma
// Add to EventClassOffering:
sessionLabel String?  // e.g., "Session A", "Saturday AM"
```

### Tests
- Unit: time slot grouping logic, bulk enrollment validation
- Integration: bulk enroll, certificate generation

---

## Phase 5: Compliance Dashboard

**Goal:** Visual compliance monitoring over existing data.

**Important:** The compliance data infrastructure already exists:
- `ComplianceSyncRun` model with preview/apply workflow
- `RosterMember.backgroundCheckDate` and `backgroundCheckCleared` fields
- `app/admin/compliance/page.tsx` (currently sync-only UI)
- `app/admin/events/[eventId]/reports/compliance/page.tsx` (event-scoped)

### What to Add
1. **Conference-wide dashboard** — per-club compliance coverage percentages (staff with cleared background checks vs total staff)
2. **Expiring checks alert** — add `backgroundCheckExpiresAt` field to `RosterMember`, show items expiring within 30/60/90 days
3. **Missing documents view** — identify members missing photoReleaseConsent, medicalTreatmentConsent, or membershipAgreementConsent
4. **Director compliance view** — directors see their own club's compliance status
5. **Export** — compliance status CSV

### Schema Change
```prisma
// Add to RosterMember:
backgroundCheckExpiresAt DateTime?
```

### UI Changes
- Enhance `/admin/compliance` with dashboard tabs: Overview | Sync | Expiring | Missing
- New: `/director/compliance` — club-scoped compliance view

### Tests
- Unit: compliance percentage calculation, expiration window detection
- Integration: dashboard data queries, CSV export

---

## Phase 6: Admin Analytics & Control Center

**Goal:** Enhance the admin dashboard with actionable analytics.

### What Already Exists
- `/admin/dashboard` with basic club/member/event stats and system health warnings
- Monthly report data in `MonthlyReport`
- Registration data in `EventRegistration`
- Compliance data in `ComplianceSyncRun` + `RosterMember`

### What to Add
1. **Registration alerts** — clubs with DRAFT registrations approaching deadline
2. **Missing report alerts** — clubs that haven't submitted monthly reports
3. **Compliance gaps** — clubs below compliance threshold
4. **Activity trends** — charts showing meeting frequency, attendance trends (uses Phase 1 data)
5. **Export center** — consolidated export page for all report types
6. **System operations** — rate limit bucket cleanup, orphaned file cleanup

### No Schema Changes — purely aggregation queries and UI.

### Tests
- Unit: alert threshold logic
- Integration: dashboard data aggregation queries

---

## Phase 7: Audit Logging

**Goal:** Track changes to sensitive data for accountability.

### New Model

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String   // CREATE, UPDATE, DELETE
  entityType String   // RosterMember, EventRegistration, ComplianceSyncRun, etc.
  entityId   String
  changes    Json?    // { field: { old: "...", new: "..." } }
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId, createdAt])
  @@index([createdAt])
}
```

### Backend Changes
- Utility function `logAudit(userId, action, entityType, entityId, changes)` in `lib/audit.ts`
- Add audit calls to server actions that modify sensitive data:
  - `saveRosterMember()` — medical/compliance field changes
  - `applySterlingBackgroundChecksPreview()` — background check updates
  - `submitEventRegistration()` — registration submissions
  - `approveRegistrationForCheckIn()` — approvals
  - `createMonthlyReport()` — report submissions

### UI Changes
- Admin: `/admin/audit` — searchable audit log with filters (entity type, user, date range)

### Tests
- Unit: audit log creation, change diffing
- Integration: verify audit entries created on sensitive operations

---

## Phase 8: Scheduled Jobs

**Goal:** Automate recurring tasks.

### Infrastructure
Choose one approach based on deployment environment:
- **Option A:** Next.js API route + external cron (e.g., cron-job.org, GitHub Actions)
- **Option B:** Node.js worker process alongside Next.js

### Jobs to Implement
1. **Monthly report reminder** — email directors who haven't submitted by the 5th of the month
2. **Background check expiration alerts** — email admins about checks expiring within 30 days (requires Phase 5)
3. **Rate limit bucket cleanup** — purge `AuthRateLimitBucket` entries older than 24 hours
4. **Stale draft cleanup** — notify directors about DRAFT registrations older than 30 days

### Backend Changes
- New API route: `/api/cron/[jobName]` with shared secret authentication
- New lib module: `lib/scheduled-jobs.ts` with individual job functions
- Leverage existing email infrastructure in `lib/email/`

### Tests
- Unit: job logic (who to notify, what to clean up)
- Integration: job execution with test data

---

## Phase 9: Documentation & Finalization

**Goal:** Finalize all documentation.

### Deliverables
1. Update `docs/system-specification.md` with all new models and features from Phases 1-8
2. API reference for all server actions (auto-generated or manual)
3. Update `HOW-TO-Admin.md` with new admin features
4. Update `HOW-TO-ClubDirector.md` with activity logging and compliance
5. Update `XCLOUD-DEPLOYMENT.md` with scheduled job configuration
6. Architecture diagram (text-based or Mermaid)
7. Data model diagram showing all entity relationships

---

## Golden Rules for AI Development (Actionable Version)

### Rule 1: Know the codebase
Before writing any code, read `docs/system-specification.md`. Never propose models that already exist.

### Rule 2: Follow existing patterns
- Every server action must call `auth()` and check `session.user.role`
- Use `getManagedClubContext()` for director-scoped actions
- Use `revalidatePath()` after mutations
- Link year-scoped data to `ClubRosterYear`, not `Club`
- Use serializable transactions for capacity-sensitive operations

### Rule 3: Never break existing tests
Run `npm run verify` (typecheck + lint + test + build) before marking any phase complete.

### Rule 4: Write tests for every new feature
- Unit tests in `tests/[feature].test.ts`
- Integration tests in `tests/[feature].integration.test.ts`
- Follow patterns in existing test files using Node.js `test` module

### Rule 5: Migrations must be safe
- Never drop columns or tables without a data migration plan
- Add new columns as optional (nullable) first, backfill, then make required
- Test migrations against a copy of production data

### Rule 6: Document every new model
Update `docs/system-specification.md` with model purpose, key fields, and relations.

### Rule 7: One feature per PR
Each phase should be a single pull request with a clear description of what changed and why.
