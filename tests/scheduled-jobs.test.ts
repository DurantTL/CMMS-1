import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDirectorReminderItems,
  buildScheduledRunDate,
  isScheduledJobAuthorized,
  parseScheduledJobKeys,
  startOfUtcMonth,
} from "../lib/scheduled-jobs";

test("scheduled jobs normalize run dates to the UTC day and month", () => {
  const input = new Date("2026-03-12T18:45:30.000-05:00");

  assert.equal(buildScheduledRunDate(input).toISOString(), "2026-03-12T00:00:00.000Z");
  assert.equal(startOfUtcMonth(input).toISOString(), "2026-03-01T00:00:00.000Z");
});

test("scheduled job auth requires an exact bearer secret", () => {
  assert.equal(isScheduledJobAuthorized("Bearer secret-value", "secret-value"), true);
  assert.equal(isScheduledJobAuthorized("Bearer wrong-value", "secret-value"), false);
  assert.equal(isScheduledJobAuthorized("Bearer secret-value", null), false);
});

test("scheduled job key parsing supports all, csv input, and deduping", () => {
  assert.deepEqual(parseScheduledJobKeys(undefined), [
    "auth-rate-limit-cleanup",
    "inactive-insurance-card-cleanup",
    "director-readiness-reminders",
  ]);

  assert.deepEqual(parseScheduledJobKeys("auth-rate-limit-cleanup,director-readiness-reminders"), [
    "auth-rate-limit-cleanup",
    "director-readiness-reminders",
  ]);

  assert.deepEqual(parseScheduledJobKeys(["director-readiness-reminders", "director-readiness-reminders"]), [
    "director-readiness-reminders",
  ]);
});

test("scheduled job key parsing rejects unsupported jobs", () => {
  assert.throws(() => parseScheduledJobKeys("unknown-job"), /Unsupported scheduled job key/);
});

test("director reminders only include unresolved readiness gaps", () => {
  const items = buildDirectorReminderItems({
    clubName: "Northside",
    monthLabel: "March 2026",
    missingAdultClearanceCount: 2,
    draftRegistrationCount: 1,
    unstartedEventCount: 3,
    monthlyReportSubmitted: false,
  });

  assert.deepEqual(items, [
    "2 adult leader/staff record(s) are still missing Sterling clearance.",
    "1 event registration draft(s) still need submission.",
    "3 upcoming event(s) have not been started yet.",
    "The monthly report for March 2026 has not been submitted yet.",
  ]);
});
