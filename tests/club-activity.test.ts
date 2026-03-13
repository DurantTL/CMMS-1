import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClubActivityAutoFill,
  buildMonthlyReportFormValues,
  formatMonthInputValue,
  getMonthWindow,
  parseMonthInput,
} from "../lib/club-activity";

test("club activity auto-fill converts logged activities into monthly report values", () => {
  const autoFill = buildClubActivityAutoFill([
    {
      pathfinderAttendance: 18,
      staffAttendance: 5,
      uniformCompliance: 92,
    },
    {
      pathfinderAttendance: 22,
      staffAttendance: 4,
      uniformCompliance: 88,
    },
    {
      pathfinderAttendance: 20,
      staffAttendance: 6,
      uniformCompliance: 90,
    },
  ]);

  assert.deepEqual(autoFill, {
    activityCount: 3,
    meetingCount: 3,
    averagePathfinderAttendance: 20,
    averageStaffAttendance: 5,
    uniformCompliance: 90,
  });
});

test("existing monthly report values override auto-fill defaults when editing a saved report", () => {
  const autoFill = buildClubActivityAutoFill([
    {
      pathfinderAttendance: 18,
      staffAttendance: 5,
      uniformCompliance: 92,
    },
  ]);

  const formValues = buildMonthlyReportFormValues(
    {
      meetingCount: 4,
      averagePathfinderAttendance: 25,
      averageStaffAttendance: 7,
      uniformCompliance: 96,
    },
    autoFill,
  );

  assert.deepEqual(formValues, {
    meetingCount: 4,
    averagePathfinderAttendance: 25,
    averageStaffAttendance: 7,
    uniformCompliance: 96,
  });
});

test("month helpers normalize month selection into a stable UTC reporting window", () => {
  const monthStart = parseMonthInput("2026-04");
  const { monthEndExclusive } = getMonthWindow(monthStart);

  assert.equal(formatMonthInputValue(monthStart), "2026-04");
  assert.equal(monthStart.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(monthEndExclusive.toISOString(), "2026-05-01T00:00:00.000Z");
});
