import assert from "node:assert/strict";

import { prisma } from "../lib/prisma";

export const hasIntegrationDatabase = Boolean(process.env.DATABASE_URL);

export async function requireIntegrationDatabase() {
  if (!hasIntegrationDatabase) {
    return false;
  }

  await prisma.$queryRaw`SELECT 1`;
  return true;
}

export async function resetIntegrationDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "EventFormResponse",
      "ClubActivity",
      "CamporeeScore",
      "EventTemplate",
      "ClassEnrollment",
      "RegistrationAttendee",
      "EventRegistration",
      "EventFormField",
      "EventClassOffering",
      "ClassRequirement",
      "ClassCatalog",
      "ComplianceSyncRun",
      "AuditLog",
      "ScheduledJobRun",
      "MemberRequirement",
      "UserRosterMemberLink",
      "TltRecommendation",
      "TltApplication",
      "Nomination",
      "MonthlyReport",
      "YearEndReport",
      "ClubMembership",
      "RosterMember",
      "ClubRosterYear",
      "Event",
      "Club",
      "AuthRateLimitBucket",
      "User"
    RESTART IDENTITY CASCADE
  `);
}

export async function disconnectIntegrationPrisma() {
  await prisma.$disconnect();
}

export function expectDate(value: Date | null | undefined, message: string) {
  assert.ok(value instanceof Date, message);
}
