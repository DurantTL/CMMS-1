import { prisma } from "./prisma";
import { safeWriteAuditLog } from "./audit-log";
import {
  ADULT_ROLES,
  getCompliancePreviewRowsEligibleForApply,
  serializeComplianceRowResults,
  type ComplianceRowChangeAudit,
  type ComplianceSyncRowPreview,
} from "./compliance-sync";

function isPreviewRow(value: unknown): value is ComplianceSyncRowPreview {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.rowNumber === "number" &&
    typeof row.firstName === "string" &&
    typeof row.lastName === "string" &&
    typeof row.status === "string" &&
    (row.dateOfBirth === null || typeof row.dateOfBirth === "string") &&
    (row.action === "UPDATE" || row.action === "SKIP" || row.action === "AMBIGUOUS") &&
    typeof row.reason === "string" &&
    (row.matchedRosterMemberId === null || typeof row.matchedRosterMemberId === "string") &&
    (row.matchedDisplayName === null || typeof row.matchedDisplayName === "string")
  );
}

function toIsoDateString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function applyComplianceSyncRunMutation(runId: string, appliedByUserId: string) {
  const run = await prisma.complianceSyncRun.findUnique({
    where: {
      id: runId,
    },
    select: {
      id: true,
      status: true,
      fileName: true,
      processedRows: true,
      passedRows: true,
      updateCount: true,
      skippedCount: true,
      ambiguousCount: true,
      rowResults: true,
      scope: true,
      club: {
        select: {
          id: true,
          name: true,
        },
      },
      clubRosterYear: {
        select: {
          id: true,
          yearLabel: true,
        },
      },
    },
  });

  if (!run) {
    throw new Error("Preview run was not found.");
  }

  const rows = Array.isArray(run.rowResults) ? run.rowResults.filter(isPreviewRow) : [];

  if (run.status === "APPLIED") {
    await safeWriteAuditLog({
      actorUserId: appliedByUserId,
      action: "compliance.apply_run",
      targetType: "ComplianceSyncRun",
      targetId: run.id,
      clubId: run.club?.id ?? null,
      clubRosterYearId: run.clubRosterYear?.id ?? null,
      summary: `Compliance sync run ${run.id} was reviewed again after already being applied.`,
      metadata: {
        status: run.status,
        ambiguousCount: run.ambiguousCount,
        updateCount: run.updateCount,
      },
    });

    return {
      run,
      rows,
      updatedCount: rows.filter((row) => row.appliedChange?.result === "UPDATED").length,
      alreadyApplied: true,
    };
  }

  const updateRows = getCompliancePreviewRowsEligibleForApply(rows);
  const appliedAt = new Date();

  const { updatedCount, auditedRows } = await prisma.$transaction(async (tx) => {
    let count = 0;
    const auditByRowNumber = new Map<number, ComplianceRowChangeAudit>();

    for (const row of updateRows) {
      const rosterMember = await tx.rosterMember.findFirst({
        where: {
          id: row.matchedRosterMemberId ?? undefined,
          memberRole: {
            in: ADULT_ROLES,
          },
        },
        select: {
          id: true,
          backgroundCheckCleared: true,
          backgroundCheckDate: true,
        },
      });

      if (!rosterMember) {
        auditByRowNumber.set(row.rowNumber, {
          applied: false,
          appliedAt: appliedAt.toISOString(),
          changedByUserId: appliedByUserId,
          previousBackgroundCheckCleared: null,
          previousBackgroundCheckDate: null,
          nextBackgroundCheckCleared: null,
          nextBackgroundCheckDate: null,
          result: "SKIPPED",
          resultReason: "Roster member no longer matched the scoped apply criteria.",
        });
        continue;
      }

      const nextBackgroundCheckCleared = true;
      const nextBackgroundCheckDate = rosterMember.backgroundCheckDate ?? appliedAt;
      const alreadyCleared = rosterMember.backgroundCheckCleared && rosterMember.backgroundCheckDate !== null;

      if (!alreadyCleared) {
        await tx.rosterMember.update({
          where: {
            id: rosterMember.id,
          },
          data: {
            backgroundCheckCleared: nextBackgroundCheckCleared,
            backgroundCheckDate: nextBackgroundCheckDate,
          },
        });

        count += 1;
      }

      auditByRowNumber.set(row.rowNumber, {
        applied: !alreadyCleared,
        appliedAt: appliedAt.toISOString(),
        changedByUserId: appliedByUserId,
        previousBackgroundCheckCleared: rosterMember.backgroundCheckCleared,
        previousBackgroundCheckDate: toIsoDateString(rosterMember.backgroundCheckDate),
        nextBackgroundCheckCleared,
        nextBackgroundCheckDate: toIsoDateString(nextBackgroundCheckDate),
        result: alreadyCleared ? "UNCHANGED" : "UPDATED",
        resultReason: alreadyCleared
          ? "Roster member was already marked cleared before apply."
          : "Background check status was updated from the approved preview row.",
      });
    }

    const nextRows = rows.map((row) => ({
      ...row,
      appliedChange: auditByRowNumber.get(row.rowNumber) ?? row.appliedChange ?? null,
    }));

    await tx.complianceSyncRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "APPLIED",
        appliedAt,
        appliedByUserId,
        rowResults: serializeComplianceRowResults(nextRows),
      },
    });

    return {
      updatedCount: count,
      auditedRows: nextRows,
    };
  });

  await safeWriteAuditLog({
    actorUserId: appliedByUserId,
    action: "compliance.apply_run",
    targetType: "ComplianceSyncRun",
    targetId: run.id,
    clubId: run.club?.id ?? null,
    clubRosterYearId: run.clubRosterYear?.id ?? null,
    summary: `Applied compliance sync run ${run.id}.`,
    metadata: {
      updatedCount,
      ambiguousCount: run.ambiguousCount,
      updateCount: run.updateCount,
    },
  });

  return {
    run,
    rows: auditedRows,
    updatedCount,
    alreadyApplied: false,
  };
}
