# CMMS AI Development Prompts

These prompts are designed for use with Codex, Claude, or any coding AI. Each prompt includes codebase context, anti-pattern constraints, and acceptance criteria to prevent the AI from building features that already exist.

**Before using any prompt:** Share `docs/system-specification.md` with the AI as context.

---

## Universal Preamble (Include with Every Prompt)

```
You are working inside the GitHub repository imsda/CMMS.

CRITICAL CONTEXT — READ BEFORE DOING ANYTHING:

This is an EXISTING, PRODUCTION-READY codebase. Do NOT treat it as greenfield.

Existing infrastructure you must NOT rebuild:
- 20+ Prisma models in prisma/schema.prisma
- 19 server action files in app/actions/
- 16 test files in tests/
- 4-role auth: SUPER_ADMIN, CLUB_DIRECTOR, STAFF_TEACHER, STUDENT_PARENT
- Dynamic form system: 10 field types, GLOBAL/ATTENDEE scopes
- Class enrollment with capacity, prerequisites, and serializable transactions
- Registration lifecycle: DRAFT → SUBMITTED → APPROVED
- Medical data encryption, compliance sync, TLT workflow, nominations
- PDF export, email via Resend, i18n via next-intl

MANDATORY RULES:
1. Every server action must call auth() and check session.user.role
2. Use getManagedClubContext() from lib/club-management.ts for director-scoped actions
3. Use revalidatePath() after mutations, never router.refresh()
4. Link year-scoped data to ClubRosterYear, not directly to Club
5. Use serializable transactions for capacity-sensitive operations
6. Every new feature must include tests (unit + integration) in tests/
7. Follow the test pattern: Node.js built-in test module with assert/strict
8. Run npm run verify (typecheck + lint + test + build) before considering work complete

DO NOT:
- Create new models for functionality that existing models already cover
- Rename existing models or their relations
- Modify existing test files unless fixing a bug you introduced
- Skip Prisma migrations for schema changes
- Add dependencies without justification
```

---

## Phase 1: Club Activity Logging + Report Auto-Fill

```
CONTEXT:
You are extending the CMMS with club activity logging.

The MonthlyReport model already exists (prisma/schema.prisma lines 551-570):
- Fields: meetingCount, averagePathfinderAttendance, averageStaffAttendance, uniformCompliance, pointsCalculated
- Points formula in app/actions/club-report-actions.ts (lines 15-18):
  POINTS_PER_MEETING = 25, POINTS_PER_PATHFINDER_ATTENDEE = 2, POINTS_PER_STAFF_ATTENDEE = 1, MAX_UNIFORM_POINTS = 100

The existing createMonthlyReport() function in app/actions/club-report-actions.ts handles manual entry.
Directors currently enter these values by hand with no underlying data to validate them.

EXISTING PATTERNS TO FOLLOW:
- RosterMember is scoped to ClubRosterYear (not Club) — see prisma/schema.prisma line 210
- Server actions call auth() then check role — see app/actions/club-report-actions.ts line 46
- Director actions use getManagedClubContext() from lib/club-management.ts

TASK:
1. Create a Prisma migration adding:
   - ClubActivity model (clubRosterYearId, activityType enum, date, title, notes)
   - ActivityAttendance model (clubActivityId, rosterMemberId, present, uniformWorn)
   - ClubActivityType enum: CLUB_MEETING, STAFF_MEETING, OUTREACH, COMMUNITY_SERVICE, HONOR_ACTIVITY, FIELD_TRIP, OTHER
   - Add attendanceRecords relation to RosterMember

2. Create server actions in app/actions/activity-actions.ts:
   - saveClubActivity(formData) — create/update activity with attendance
   - deleteClubActivity(activityId) — soft or hard delete
   - getClubActivities(clubRosterYearId, filters?) — list with pagination
   - autoFillMonthlyReport(clubId, reportMonth) — calculate from activity data:
     * meetingCount = count of CLUB_MEETING activities in the month
     * averagePathfinderAttendance = avg present count where member.memberRole in [PATHFINDER, ADVENTURER, TLT]
     * averageStaffAttendance = avg present count where member.memberRole in [STAFF, DIRECTOR, COUNSELOR]
     * uniformCompliance = avg (uniformWorn / present) * 100

3. Create director UI pages:
   - /director/activities — activity log list with "Log Activity" button
   - /director/activities/new — activity form with attendance checklist
   - Enhance /director/reports to show "Auto-fill from Activities" button

4. Create tests in tests/:
   - activity-logging.test.ts — unit tests for auto-fill calculation
   - activity-logging.integration.test.ts — CRUD + auto-fill flow

ACCEPTANCE CRITERIA:
- npm run verify passes
- Directors can log meetings with attendance
- Auto-fill correctly calculates MonthlyReport fields
- Directors can review/edit auto-filled values before submission
- Existing manual report entry still works unchanged
```

---

## Phase 2: Event Templates

```
CONTEXT:
You are extending the CMMS with an event template system.

Event creation currently happens in app/actions/event-admin-actions.ts:
- createEventWithDynamicFields() creates an Event + EventFormField rows
- The dynamic field system supports 10 types: SHORT_TEXT, LONG_TEXT, NUMBER, BOOLEAN, DATE, SINGLE_SELECT, MULTI_SELECT, ROSTER_SELECT, ROSTER_MULTI_SELECT, FIELD_GROUP
- Fields have scopes: GLOBAL (per-registration) or ATTENDEE (per-attendee)
- Field hierarchy: FIELD_GROUP can contain child fields

The existing Event model is at prisma/schema.prisma lines 332-353.
The existing EventFormField model is at prisma/schema.prisma lines 355-376.
The admin event creation page is at app/admin/events/new/page.tsx.

TASK:
1. Create a Prisma migration adding:
   - EventTemplate model: name, slug (unique), description, version (Int, default 1), config (Json), isActive (Boolean, default true)
   - Optionally add templateId (String?) to Event model for lineage tracking

2. Template config JSON structure:
   {
     "defaultFields": [{ "key": "...", "label": "...", "type": "SHORT_TEXT", "scope": "GLOBAL", "isRequired": true, "options": null, "children": [] }],
     "defaultClassOfferings": [{ "classCatalogCode": "...", "capacity": null }],
     "defaultPricing": { "basePrice": 0, "lateFeePrice": 0 },
     "modules": ["camping_logistics", "duty_scheduler"]
   }

3. Create server actions in app/actions/template-actions.ts:
   - createEventTemplate(formData) — SUPER_ADMIN only
   - updateEventTemplate(formData) — increment version
   - getEventTemplates() — list active templates
   - createEventFromTemplate(templateId, eventData) — populate Event + fields from template

4. Enhance existing createEventWithDynamicFields() to accept optional templateId

5. Create admin UI:
   - /admin/templates — template list
   - /admin/templates/[templateId] — template editor with field builder
   - Enhance /admin/events/new with "Create from Template" dropdown

6. Create tests:
   - event-template.test.ts — config validation, field generation
   - event-template.integration.test.ts — create from template flow

ACCEPTANCE CRITERIA:
- npm run verify passes
- Admin can create and edit templates
- Creating an event from a template pre-populates form fields
- Template changes do not retroactively affect existing events
- Templates can be deactivated without deleting
```

---

## Phase 3: Camporee System

```
CONTEXT:
You are building Camporee functionality using the event template system from Phase 2.

A Camporee is an Event created from a "Camporee" template. Most Camporee features
are handled by existing infrastructure:
- Attendee registration: EventRegistration + RegistrationAttendee (already built)
- Dynamic form questions: EventFormField with GLOBAL/ATTENDEE scopes (already built)
- Class/honor offerings: EventClassOffering + ClassEnrollment (already built)

What does NOT exist: inter-club scoring and competition tracking.

EXISTING FILES TO REFERENCE:
- Event model: prisma/schema.prisma lines 332-353
- Registration: app/actions/event-registration-actions.ts
- Dynamic fields: lib/event-form-completeness.ts, lib/event-form-scope.ts
- Check-in: app/actions/checkin-actions.ts

TASK:
1. Create the Camporee event template (using Phase 2 infrastructure) with modules:
   - Club information (GLOBAL fields: club_contact, arrival_time)
   - Camping logistics (GLOBAL fields: tent_count, camping_type, special_needs)
   - Duty scheduling (ATTENDEE fields: duty_first, duty_second, special_activity)
   - Spiritual milestones (ATTENDEE fields: baptism_names, bible_names)
   - Meal sponsorship (GLOBAL field: meal_sponsorship_details)

2. Create Prisma migration for scoring (if not covered by dynamic fields):
   - CamporeeScore model: eventRegistrationId, category, score, maxScore, judgeName, notes

3. Create server actions in app/actions/camporee-actions.ts:
   - saveCamporeeScore(formData) — SUPER_ADMIN only
   - getCamporeeScoreboard(eventId) — aggregate scores by club
   - getCamporeeScoreboardCsv(eventId) — export

4. Create UI:
   - Admin: scoring input per club (accessible from event admin page)
   - Admin: scoreboard/leaderboard view
   - Director: read-only view of their club's scores

5. Create tests:
   - camporee-scoring.test.ts — score aggregation, ranking logic
   - camporee-scoring.integration.test.ts — score CRUD, leaderboard

ACCEPTANCE CRITERIA:
- npm run verify passes
- Camporee template can be created and used to create events
- Admins can enter scores per club per category
- Leaderboard shows correct rankings
- Existing event registration flow works unchanged for Camporee events
```

---

## Phase 4: Honors Weekend UI Enhancements

```
CONTEXT:
You are improving the Honors Weekend experience. This is NOT a new system.

EVERYTHING NEEDED FOR HONORS WEEKEND ALREADY EXISTS:
- ClassCatalog with classType = HONOR (prisma/schema.prisma lines 417-429)
- ClassRequirement with 5 requirement types: MIN_AGE, MAX_AGE, MEMBER_ROLE, COMPLETED_HONOR, MASTER_GUIDE (lines 431-440)
- EventClassOffering with capacity and teacher assignment (lines 442-457)
- ClassEnrollment with unique constraint per offering+member (lines 459-471)
- Prerequisite evaluation: lib/class-prerequisite-utils.ts
- Enrollment conflict detection ("one class per attendee"): lib/class-model.ts (isOfferingFull, findEventEnrollmentConflict)
- Director class assignment board: app/director/events/[eventId]/classes/
- Teacher class roster: app/teacher/class/[offeringId]/
- Enrollment actions: app/actions/enrollment-actions.ts (enrollAttendeeInClass, removeAttendeeFromClass)

DO NOT create HonorSlot, HonorClass, or HonorEnrollment models. These are redundant.

TASK:
1. Add optional sessionLabel (String?) to EventClassOffering for time slot grouping
   - Migration: ALTER TABLE add nullable column

2. Enhance the director class assignment UI:
   - Group offerings by sessionLabel (e.g., "Saturday AM", "Saturday PM", "Sunday AM")
   - Show eligibility badges per attendee (uses evaluateClassRequirements from lib/class-prerequisite-utils.ts)
   - Add bulk enrollment: select multiple attendees → assign to a class in one action

3. Add bulk enrollment server action in app/actions/enrollment-actions.ts:
   - bulkEnrollAttendees(eventClassOfferingId, rosterMemberIds[]) — validate all, enroll all in transaction

4. Add completion certificate PDF:
   - New template in lib/pdf/honor-certificate.tsx
   - New API route: /api/events/[eventId]/certificates/[rosterMemberId]

5. Create tests:
   - honor-weekend.test.ts — session grouping, bulk validation
   - honor-weekend.integration.test.ts — bulk enrollment, certificate generation

ACCEPTANCE CRITERIA:
- npm run verify passes
- Offerings can be grouped by session label
- Directors can bulk-enroll attendees
- Eligibility is checked for every attendee in bulk enrollment
- Certificate PDF generates correctly
- All existing enrollment functionality unchanged
```

---

## Phase 5: Compliance Dashboard

```
CONTEXT:
You are building a visual compliance dashboard over existing data.

EXISTING COMPLIANCE INFRASTRUCTURE:
- ComplianceSyncRun model: prisma/schema.prisma lines 489-517
- RosterMember fields: backgroundCheckDate, backgroundCheckCleared (lines 222-223)
- Consent fields: photoReleaseConsent, medicalTreatmentConsent, membershipAgreementConsent (lines 233-235)
- Compliance sync actions: app/actions/compliance-actions.ts
- Existing compliance page (sync only): app/admin/compliance/page.tsx
- Event-scoped compliance report: app/admin/events/[eventId]/reports/compliance/page.tsx

TASK:
1. Add backgroundCheckExpiresAt (DateTime?) to RosterMember — migration

2. Create server actions in app/actions/compliance-dashboard-actions.ts:
   - getConferenceComplianceOverview() — per-club coverage percentages
   - getExpiringBackgroundChecks(daysAhead) — checks expiring within N days
   - getMissingConsents(clubId?) — members missing photo/medical/membership consent
   - getClubComplianceDetail(clubId) — detailed view for one club
   - exportComplianceCsv(filters) — CSV export

3. Enhance admin compliance UI at /admin/compliance:
   - Add dashboard tabs: Overview | Sync | Expiring | Missing Consents
   - Overview: table with per-club compliance percentages
   - Expiring: list of checks expiring in 30/60/90 days
   - Missing: members missing consent documents

4. Create director compliance view:
   - /director/compliance — club-scoped version of the dashboard

5. Create tests:
   - compliance-dashboard.test.ts — percentage calculation, expiration window
   - compliance-dashboard.integration.test.ts — dashboard queries

ACCEPTANCE CRITERIA:
- npm run verify passes
- Admin sees conference-wide compliance percentages
- Expiring checks are highlighted with urgency levels
- Directors see their own club's compliance status
- CSV export works for all views
```

---

## Phase 6: Admin Analytics & Control Center

```
CONTEXT:
The admin dashboard exists at app/admin/dashboard/page.tsx with basic stats.
The getAdminDashboardOverview() function is in app/actions/admin-actions.ts (line 414).

TASK:
1. Enhance getAdminDashboardOverview() to include:
   - Registration alerts: clubs with DRAFT status approaching registrationClosesAt
   - Missing report alerts: clubs without submitted MonthlyReport for current month
   - Compliance gaps: clubs below 80% background check coverage
   - Activity trends (from Phase 1): meeting frequency by month

2. Create new actions:
   - getRegistrationAlerts(eventId?) — DRAFT registrations near deadline
   - getMissingReportAlerts(month?) — clubs without submitted reports
   - getComplianceGapAlerts() — clubs below threshold

3. Enhance /admin/dashboard UI:
   - Alert cards with counts and drill-down links
   - Activity trend charts (simple table or CSS-based)

4. Create admin export center:
   - /admin/exports — consolidated page linking to all report exports

5. Create tests:
   - admin-alerts.test.ts — threshold logic, date calculations
   - admin-alerts.integration.test.ts — alert queries with test data

NO NEW MODELS NEEDED — this is aggregation queries over existing data.

ACCEPTANCE CRITERIA:
- npm run verify passes
- Dashboard shows actionable alerts
- Alerts link to relevant detail pages
- Export center provides access to all report types
```

---

## Phase 7: Audit Logging

```
CONTEXT:
The CMMS handles sensitive data but has no audit trail:
- Medical data: encrypted fields in RosterMember (lib/medical-data.ts, lib/encryption.ts)
- Financial data: EventRegistration.totalDue, amountPaid, paymentStatus
- Compliance data: ComplianceSyncRun with background check updates
- The only audit trail is ComplianceSyncRun.rowResults for background check changes

TASK:
1. Create Prisma migration for AuditLog model:
   - id, userId (nullable for system actions), action (CREATE/UPDATE/DELETE),
     entityType, entityId, changes (Json — { field: { old, new } }), ipAddress, createdAt

2. Create lib/audit.ts:
   - logAudit(userId, action, entityType, entityId, changes?) — creates AuditLog entry
   - diffChanges(oldObj, newObj, fields[]) — computes change diff

3. Add audit calls to existing server actions (minimal, targeted):
   - saveRosterMember() in app/actions/roster-actions.ts — log medical/compliance changes
   - applySterlingBackgroundChecksPreview() — log background check updates
   - submitEventRegistration() — log submission
   - approveRegistrationForCheckIn() — log approval
   - createMonthlyReport() — log report submission

4. Create admin UI:
   - /admin/audit — searchable audit log with filters (entity type, user, date range)

5. Create tests:
   - audit-log.test.ts — change diff logic
   - audit-log.integration.test.ts — verify entries created on operations

ACCEPTANCE CRITERIA:
- npm run verify passes
- Sensitive operations create audit entries
- Admin can search and filter audit log
- Audit entries include old and new values for changed fields
- No performance degradation on normal operations
```

---

## Phase 8: Scheduled Jobs

```
CONTEXT:
The CMMS has no scheduled job infrastructure. Features that need scheduling:
- Monthly report reminders (uses existing MonthlyReport model)
- Background check expiration alerts (uses Phase 5 data)
- Rate limit bucket cleanup (AuthRateLimitBucket model)
- Stale draft cleanup notifications

Email infrastructure exists: lib/email/resend.ts with templates in lib/email/templates/
Deployment: Docker/xCloud (see XCLOUD-DEPLOYMENT.md)

TASK:
1. Create API route: /api/cron/[jobName]/route.ts
   - Authenticate with CRON_SECRET environment variable
   - Supported jobs: monthly-report-reminder, background-check-expiration, rate-limit-cleanup, stale-draft-notify

2. Create lib/scheduled-jobs.ts with individual job functions:
   - runMonthlyReportReminder() — find clubs without submitted report, send email to directors
   - runBackgroundCheckExpirationAlert() — find expiring checks, email admins
   - runRateLimitCleanup() — delete AuthRateLimitBucket entries older than 24 hours
   - runStaleDraftNotification() — find DRAFT registrations > 30 days old, email directors

3. Create email templates for each notification type

4. Document cron setup in XCLOUD-DEPLOYMENT.md:
   - External cron (cron-job.org or GitHub Actions) hitting /api/cron/[jobName]
   - Recommended schedule for each job

5. Create tests:
   - scheduled-jobs.test.ts — job logic (who to notify, what to clean)
   - scheduled-jobs.integration.test.ts — job execution with test data

ACCEPTANCE CRITERIA:
- npm run verify passes
- Each job can be triggered via authenticated API call
- Jobs produce correct results with test data
- Rate limit cleanup actually deletes old entries
- Deployment documentation updated
```

---

## General Prompt Tips

### When the AI proposes a new model, ask:
> "Does this functionality already exist in the CMMS? Check docs/system-specification.md before proposing new models."

### When reviewing AI output, verify:
1. Does `npm run verify` pass?
2. Are existing tests still passing?
3. Does the new code follow the server action pattern (auth → role check → query → revalidatePath)?
4. Are new tests included?
5. Is the Prisma migration safe (no data loss)?

### If the AI goes off track:
> "Stop. Read docs/system-specification.md section [X]. The feature you are building already exists as [model/function]. Extend it instead of rebuilding."
