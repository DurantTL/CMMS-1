import { type Prisma, type UserRole } from "@prisma/client";

import { prisma } from "./prisma";

type AuditMetadata = Record<string, unknown>;

export type AuditLogInput = {
  actorUserId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  clubId?: string | null;
  clubRosterYearId?: string | null;
  summary: string;
  metadata?: AuditMetadata | null;
};

const FORBIDDEN_METADATA_KEYS = [
  "password",
  "passwordHash",
  "newPassword",
  "temporaryPassword",
  "medicalFlags",
  "dietaryRestrictions",
  "insuranceCompany",
  "insurancePolicyNumber",
  "lastTetanusDate",
  "lastTetanusDateEncrypted",
  "medical",
  "secret",
  "token",
];

function shouldStripKey(key: string) {
  const lowered = key.toLowerCase();
  return FORBIDDEN_METADATA_KEYS.some((item) => lowered.includes(item.toLowerCase()));
}

export function sanitizeAuditMetadata(value: unknown): Prisma.InputJsonValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !shouldStripKey(key))
    .map(([key, entry]) => {
      if (entry === null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
        return [key, entry];
      }

      if (Array.isArray(entry)) {
        return [
          key,
          entry
            .filter((item) => item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean")
            .slice(0, 25),
        ];
      }

      return [key, String(entry)];
    });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export async function safeWriteAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        clubId: input.clubId ?? null,
        clubRosterYearId: input.clubRosterYearId ?? null,
        summary: input.summary,
        metadata: sanitizeAuditMetadata(input.metadata),
      },
    });
  } catch (error) {
    console.error("Audit log write failed.", error);
  }
}
