import { prisma } from "../prisma";
import {
  buildComplianceRosterStatus,
  buildComplianceRunSummary,
  type ComplianceDashboardRun,
} from "../compliance-dashboard";

function toRunSummary(run: {
  status: "PREVIEW" | "APPLIED";
  scope: "ROSTER_YEAR" | "SYSTEM_WIDE";
  updateCount: number;
  ambiguousCount: number;
  skippedCount: number;
  passedRows: number;
  processedRows: number;
  createdAt: Date;
  appliedAt: Date | null;
}) {
  return {
    status: run.status,
    scope: run.scope,
    updateCount: run.updateCount,
    ambiguousCount: run.ambiguousCount,
    skippedCount: run.skippedCount,
    passedRows: run.passedRows,
    processedRows: run.processedRows,
    createdAt: run.createdAt,
    appliedAt: run.appliedAt,
  } satisfies ComplianceDashboardRun;
}

export async function getAdminComplianceDashboardData() {
  const [rosterYears, recentRunsRaw] = await Promise.all([
    prisma.clubRosterYear.findMany({
      select: {
        id: true,
        yearLabel: true,
        isActive: true,
        club: {
          select: {
            name: true,
            code: true,
          },
        },
        members: {
          where: {
            isActive: true,
          },
          select: {
            memberRole: true,
            backgroundCheckCleared: true,
          },
        },
        complianceSyncRuns: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            status: true,
            scope: true,
            updateCount: true,
            ambiguousCount: true,
            skippedCount: true,
            passedRows: true,
            processedRows: true,
            createdAt: true,
            appliedAt: true,
          },
        },
      },
      orderBy: [
        {
          isActive: "desc",
        },
        {
          club: {
            name: "asc",
          },
        },
        {
          yearLabel: "desc",
        },
      ],
    }),
    prisma.complianceSyncRun.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        fileName: true,
        status: true,
        scope: true,
        updateCount: true,
        ambiguousCount: true,
        skippedCount: true,
        passedRows: true,
        processedRows: true,
        createdAt: true,
        appliedAt: true,
        club: {
          select: {
            name: true,
            code: true,
          },
        },
        clubRosterYear: {
          select: {
            yearLabel: true,
          },
        },
      },
    }),
  ]);

  const recentRuns = recentRunsRaw.map((run) => ({
    ...run,
    scopeLabel:
      run.scope === "SYSTEM_WIDE"
        ? "Entire system"
        : `${run.club?.name ?? "Unknown club"} (${run.club?.code ?? "—"}) — ${run.clubRosterYear?.yearLabel ?? "Unknown year"}`,
  }));

  return {
    overview: buildComplianceRunSummary(recentRunsRaw.map(toRunSummary)),
    rosterYearStatuses: rosterYears.map((rosterYear) => ({
      id: rosterYear.id,
      yearLabel: rosterYear.yearLabel,
      isActive: rosterYear.isActive,
      club: rosterYear.club,
      compliance: buildComplianceRosterStatus({
        members: rosterYear.members,
        latestRun: rosterYear.complianceSyncRuns[0] ? toRunSummary(rosterYear.complianceSyncRuns[0]) : null,
      }),
    })),
    recentRuns,
  };
}

export async function getDirectorComplianceDashboardData(clubId: string) {
  const rosterYear = await prisma.clubRosterYear.findFirst({
    where: {
      clubId,
      isActive: true,
    },
    select: {
      id: true,
      yearLabel: true,
      members: {
        where: {
          isActive: true,
        },
        select: {
          firstName: true,
          lastName: true,
          memberRole: true,
          backgroundCheckCleared: true,
        },
      },
      complianceSyncRuns: {
        orderBy: {
          createdAt: "desc",
        },
        take: 3,
        select: {
          id: true,
          fileName: true,
          status: true,
          scope: true,
          updateCount: true,
          ambiguousCount: true,
          skippedCount: true,
          passedRows: true,
          processedRows: true,
          createdAt: true,
          appliedAt: true,
        },
      },
    },
  });

  if (!rosterYear) {
    return null;
  }

  const adultMembersMissingClearance = rosterYear.members
    .filter((member) => ["STAFF", "DIRECTOR", "COUNSELOR"].includes(member.memberRole))
    .filter((member) => !member.backgroundCheckCleared)
    .map((member) => `${member.firstName} ${member.lastName}`);

  return {
    rosterYearId: rosterYear.id,
    yearLabel: rosterYear.yearLabel,
    compliance: buildComplianceRosterStatus({
      members: rosterYear.members,
      latestRun: rosterYear.complianceSyncRuns[0] ? toRunSummary(rosterYear.complianceSyncRuns[0]) : null,
    }),
    recentRuns: rosterYear.complianceSyncRuns,
    adultMembersMissingClearance,
  };
}
