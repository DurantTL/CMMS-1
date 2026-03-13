"use server";

import { revalidatePath } from "next/cache";
import { ComplianceSyncScope } from "@prisma/client";

import { initialComplianceSyncState, type ComplianceSyncState } from "./compliance-state";
import { auth } from "../../auth";
import { applyComplianceSyncRunMutation } from "../../lib/compliance-apply";
import { safeWriteAuditLog } from "../../lib/audit-log";
import {
  ADULT_ROLES,
  buildCompliancePreview,
  parseSterlingCsv,
  serializeComplianceRowResults,
  type ComplianceSyncRowPreview,
} from "../../lib/compliance-sync";
import { prisma } from "../../lib/prisma";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Only Super Admins can run this sync.");
  }

  return session.user.id;
}

function buildScopeLabel(clubName: string, yearLabel: string) {
  return `${clubName} — ${yearLabel}`;
}

function buildSystemWideScopeLabel() {
  return "Entire system";
}

function buildRunScopeLabel(run: {
  scope: ComplianceSyncScope;
  club: { name: string } | null;
  clubRosterYear: { yearLabel: string } | null;
}) {
  if (run.scope === ComplianceSyncScope.SYSTEM_WIDE) {
    return buildSystemWideScopeLabel();
  }

  if (run.club && run.clubRosterYear) {
    return buildScopeLabel(run.club.name, run.clubRosterYear.yearLabel);
  }

  return "Selected roster year";
}

function toStateFromPreview(input: {
  message: string;
  status: "success" | "error";
  runId: string | null;
  fileName: string | null;
  scopeLabel: string | null;
  processedRows: number;
  passedRows: number;
  updateCount: number;
  skippedCount: number;
  ambiguousCount: number;
  appliedCount?: number;
  rows: ComplianceSyncRowPreview[];
  phase: "preview" | "applied";
}): ComplianceSyncState {
  return {
    status: input.status,
    phase: input.phase,
    message: input.message,
    runId: input.runId,
    fileName: input.fileName,
    scopeLabel: input.scopeLabel,
    processedRows: input.processedRows,
    passedRows: input.passedRows,
    updateCount: input.updateCount,
    skippedCount: input.skippedCount,
    ambiguousCount: input.ambiguousCount,
    appliedCount: input.appliedCount ?? 0,
    updates: input.rows.filter((row) => row.action === "UPDATE"),
    skipped: input.rows.filter((row) => row.action === "SKIP"),
    ambiguous: input.rows.filter((row) => row.action === "AMBIGUOUS"),
  };
}

export async function previewSterlingBackgroundChecks(
  _previousState: ComplianceSyncState,
  formData: FormData,
): Promise<ComplianceSyncState> {
  try {
    const uploadedByUserId = await requireSuperAdmin();
    const clubRosterYearIdEntry = formData.get("clubRosterYearId");
    const file = formData.get("sterlingCsv");
    const scopeSelection =
      typeof clubRosterYearIdEntry === "string" ? clubRosterYearIdEntry.trim() : "";
    const isSystemWide = scopeSelection === "SYSTEM_WIDE";

    if (!isSystemWide && scopeSelection.length === 0) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Select a sync scope before previewing the CSV.",
      };
    }

    if (!(file instanceof File)) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Please choose a CSV file to upload.",
      };
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Only .csv files are supported.",
      };
    }

    const rosterYear = isSystemWide
      ? null
      : await prisma.clubRosterYear.findUnique({
          where: {
            id: scopeSelection,
          },
          select: {
            id: true,
            yearLabel: true,
            clubId: true,
            club: {
              select: {
                name: true,
              },
            },
          },
        });

    if (!isSystemWide && !rosterYear) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "Selected club roster year was not found.",
      };
    }

    const candidates = await prisma.rosterMember.findMany({
      where: {
        memberRole: {
          in: ADULT_ROLES,
        },
        ...(isSystemWide
          ? {}
          : {
              clubRosterYearId: rosterYear?.id,
            }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        memberRole: true,
        dateOfBirth: true,
        backgroundCheckCleared: true,
      },
    });

    const csvText = await file.text();
    const records = parseSterlingCsv(csvText);
    const preview = buildCompliancePreview(records, candidates);
    const rows = preview.rowResults.map((row) => {
      if (row.action !== "UPDATE") {
        return row;
      }

      const matchedMember = candidates.find((member) => member.id === row.matchedRosterMemberId);

      if (matchedMember?.backgroundCheckCleared) {
        return {
          ...row,
          action: "SKIP" as const,
          reason: "Background check is already marked cleared for this roster member.",
          matchedRosterMemberId: matchedMember.id,
          matchedDisplayName: `${matchedMember.firstName} ${matchedMember.lastName} (${matchedMember.memberRole})`,
        };
      }

      return row;
    });

    const updateCount = rows.filter((row) => row.action === "UPDATE").length;
    const skippedCount = rows.filter((row) => row.action === "SKIP").length;
    const ambiguousCount = rows.filter((row) => row.action === "AMBIGUOUS").length;

    const run = await prisma.complianceSyncRun.create({
      data: {
        uploadedByUserId,
        scope: isSystemWide ? ComplianceSyncScope.SYSTEM_WIDE : ComplianceSyncScope.ROSTER_YEAR,
        clubId: rosterYear?.clubId ?? null,
        clubRosterYearId: rosterYear?.id ?? null,
        fileName: file.name,
        processedRows: preview.processedRows,
        passedRows: preview.passedRows,
        updateCount,
        skippedCount,
        ambiguousCount,
        rowResults: serializeComplianceRowResults(rows),
      },
      select: {
        id: true,
      },
    });

    await safeWriteAuditLog({
      actorUserId: uploadedByUserId,
      action: "compliance.preview_run",
      targetType: "ComplianceSyncRun",
      targetId: run.id,
      clubId: rosterYear?.clubId ?? null,
      clubRosterYearId: rosterYear?.id ?? null,
      summary: `Generated compliance preview run ${run.id}.`,
      metadata: {
        scope: isSystemWide ? "SYSTEM_WIDE" : "ROSTER_YEAR",
        processedRows: preview.processedRows,
        updateCount,
        skippedCount,
        ambiguousCount,
      },
    });

    return toStateFromPreview({
      status: "success",
      phase: "preview",
      message: updateCount > 0
        ? "Preview generated. Review updates, skipped rows, and ambiguous rows before applying."
        : "Preview generated. No safe updates were found in this file.",
      runId: run.id,
      fileName: file.name,
      scopeLabel: isSystemWide
        ? buildSystemWideScopeLabel()
        : buildScopeLabel(rosterYear!.club.name, rosterYear!.yearLabel),
      processedRows: preview.processedRows,
      passedRows: preview.passedRows,
      updateCount,
      skippedCount,
      ambiguousCount,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background check preview failed.";

    return {
      ...initialComplianceSyncState,
      status: "error",
      message,
    };
  }
}

export async function applySterlingBackgroundChecksPreview(
  _previousState: ComplianceSyncState,
  formData: FormData,
): Promise<ComplianceSyncState> {
  try {
    const appliedByUserId = await requireSuperAdmin();

    const runIdEntry = formData.get("runId");
    if (typeof runIdEntry !== "string" || runIdEntry.trim().length === 0) {
      return {
        ...initialComplianceSyncState,
        status: "error",
        message: "A preview run is required before applying updates.",
      };
    }

    const result = await applyComplianceSyncRunMutation(runIdEntry.trim(), appliedByUserId);

    if (result.alreadyApplied) {
      return toStateFromPreview({
        status: "success",
        phase: "applied",
        message: "This preview run was already applied.",
        runId: result.run.id,
        fileName: result.run.fileName,
        scopeLabel: buildRunScopeLabel(result.run),
        processedRows: result.run.processedRows,
        passedRows: result.run.passedRows,
        updateCount: result.run.updateCount,
        skippedCount: result.run.skippedCount,
        ambiguousCount: result.run.ambiguousCount,
        appliedCount: result.updatedCount,
        rows: result.rows,
      });
    }

    revalidatePath("/admin/compliance");

    await safeWriteAuditLog({
      actorUserId: appliedByUserId,
      action: "compliance.apply_preview",
      targetType: "ComplianceSyncRun",
      targetId: result.run.id,
      clubId: result.run.club?.name ? undefined : null,
      clubRosterYearId: result.run.clubRosterYear?.id ?? null,
      summary: `Applied compliance preview ${result.run.id}.`,
      metadata: {
        updatedCount: result.updatedCount,
        ambiguousCount: result.run.ambiguousCount,
        scope: result.run.scope,
      },
    });

    return toStateFromPreview({
      status: "success",
      phase: "applied",
      message: `Applied ${result.updatedCount} background-check update(s). Ambiguous rows were left unchanged for manual review.`,
      runId: result.run.id,
      fileName: result.run.fileName,
      scopeLabel: buildRunScopeLabel(result.run),
      processedRows: result.run.processedRows,
      passedRows: result.run.passedRows,
      updateCount: result.run.updateCount,
      skippedCount: result.run.skippedCount,
      ambiguousCount: result.run.ambiguousCount,
      appliedCount: result.updatedCount,
      rows: result.rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Background check apply failed.";

    return {
      ...initialComplianceSyncState,
      status: "error",
      message,
    };
  }
}
