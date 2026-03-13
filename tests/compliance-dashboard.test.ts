import test from "node:test";
import assert from "node:assert/strict";
import { ComplianceSyncRunStatus, MemberRole } from "@prisma/client";

import {
  buildComplianceRosterStatus,
  buildComplianceRunSummary,
} from "../lib/compliance-dashboard";

test("compliance roster status highlights missing adult clearances without inventing a new source of truth", () => {
  const status = buildComplianceRosterStatus({
    members: [
      {
        memberRole: MemberRole.DIRECTOR,
        backgroundCheckCleared: true,
      },
      {
        memberRole: MemberRole.STAFF,
        backgroundCheckCleared: false,
      },
      {
        memberRole: MemberRole.PATHFINDER,
        backgroundCheckCleared: false,
      },
    ],
    latestRun: {
      status: ComplianceSyncRunStatus.PREVIEW,
      scope: "ROSTER_YEAR",
      updateCount: 1,
      ambiguousCount: 2,
      skippedCount: 0,
      passedRows: 3,
      processedRows: 4,
      createdAt: new Date("2026-03-13T12:00:00.000Z"),
      appliedAt: null,
    },
  });

  assert.equal(status.adultCount, 2);
  assert.equal(status.clearedAdultCount, 1);
  assert.equal(status.unclearedAdultCount, 1);
  assert.equal(status.status, "attention");
  assert.equal(status.latestRunAmbiguousCount, 2);
  assert.equal(status.latestRunStatus, ComplianceSyncRunStatus.PREVIEW);
});

test("compliance run summary aggregates preview and applied history for admin dashboards", () => {
  const summary = buildComplianceRunSummary([
    {
      status: ComplianceSyncRunStatus.PREVIEW,
      scope: "ROSTER_YEAR",
      updateCount: 3,
      ambiguousCount: 2,
      skippedCount: 1,
      passedRows: 3,
      processedRows: 5,
      createdAt: new Date("2026-03-12T12:00:00.000Z"),
      appliedAt: null,
    },
    {
      status: ComplianceSyncRunStatus.APPLIED,
      scope: "SYSTEM_WIDE",
      updateCount: 4,
      ambiguousCount: 0,
      skippedCount: 2,
      passedRows: 4,
      processedRows: 6,
      createdAt: new Date("2026-03-11T12:00:00.000Z"),
      appliedAt: new Date("2026-03-11T12:15:00.000Z"),
    },
  ]);

  assert.equal(summary.totalRuns, 2);
  assert.equal(summary.previewRuns, 1);
  assert.equal(summary.appliedRuns, 1);
  assert.equal(summary.systemWideRuns, 1);
  assert.equal(summary.rosterYearRuns, 1);
  assert.equal(summary.pendingAmbiguousRows, 2);
  assert.equal(summary.safeUpdatesIdentified, 7);
});
