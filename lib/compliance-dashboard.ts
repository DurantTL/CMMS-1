import { ComplianceSyncRunStatus, type ComplianceSyncScope, type MemberRole } from "@prisma/client";

const ADULT_ROLE_SET = new Set<MemberRole>(["STAFF", "DIRECTOR", "COUNSELOR"]);

export type ComplianceDashboardMember = {
  memberRole: MemberRole;
  backgroundCheckCleared: boolean;
};

export type ComplianceDashboardRun = {
  status: ComplianceSyncRunStatus;
  scope: ComplianceSyncScope;
  updateCount: number;
  ambiguousCount: number;
  skippedCount: number;
  passedRows: number;
  processedRows: number;
  createdAt: Date;
  appliedAt: Date | null;
};

export type ComplianceRosterStatus = {
  adultCount: number;
  clearedAdultCount: number;
  unclearedAdultCount: number;
  clearanceRate: number;
  status: "ready" | "attention" | "empty";
  latestRunStatus: ComplianceSyncRunStatus | "NONE";
  latestRunAt: Date | null;
  latestAppliedAt: Date | null;
  latestRunAmbiguousCount: number;
  latestRunUpdateCount: number;
};

export type ComplianceRunSummary = {
  totalRuns: number;
  previewRuns: number;
  appliedRuns: number;
  systemWideRuns: number;
  rosterYearRuns: number;
  pendingAmbiguousRows: number;
  safeUpdatesIdentified: number;
};

export function buildComplianceRosterStatus(input: {
  members: ComplianceDashboardMember[];
  latestRun?: ComplianceDashboardRun | null;
}): ComplianceRosterStatus {
  const adultMembers = input.members.filter((member) => ADULT_ROLE_SET.has(member.memberRole));
  const clearedAdultCount = adultMembers.filter((member) => member.backgroundCheckCleared).length;
  const adultCount = adultMembers.length;
  const unclearedAdultCount = Math.max(adultCount - clearedAdultCount, 0);
  const clearanceRate = adultCount === 0 ? 100 : Math.round((clearedAdultCount / adultCount) * 100);
  const latestRun = input.latestRun ?? null;

  return {
    adultCount,
    clearedAdultCount,
    unclearedAdultCount,
    clearanceRate,
    status: adultCount === 0 ? "empty" : unclearedAdultCount === 0 ? "ready" : "attention",
    latestRunStatus: latestRun?.status ?? "NONE",
    latestRunAt: latestRun?.createdAt ?? null,
    latestAppliedAt: latestRun?.appliedAt ?? null,
    latestRunAmbiguousCount: latestRun?.ambiguousCount ?? 0,
    latestRunUpdateCount: latestRun?.updateCount ?? 0,
  };
}

export function buildComplianceRunSummary(runs: ComplianceDashboardRun[]): ComplianceRunSummary {
  return {
    totalRuns: runs.length,
    previewRuns: runs.filter((run) => run.status === ComplianceSyncRunStatus.PREVIEW).length,
    appliedRuns: runs.filter((run) => run.status === ComplianceSyncRunStatus.APPLIED).length,
    systemWideRuns: runs.filter((run) => run.scope === "SYSTEM_WIDE").length,
    rosterYearRuns: runs.filter((run) => run.scope === "ROSTER_YEAR").length,
    pendingAmbiguousRows: runs
      .filter((run) => run.status === ComplianceSyncRunStatus.PREVIEW)
      .reduce((total, run) => total + run.ambiguousCount, 0),
    safeUpdatesIdentified: runs.reduce((total, run) => total + run.updateCount, 0),
  };
}
