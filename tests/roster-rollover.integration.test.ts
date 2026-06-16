import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, MemberStatus, RolloverStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

// These tests exercise the roster foundation (Club / ClubRosterYear / RosterMember)
// and the data contract of the yearly rollover. The rollover logic itself lives in
// `executeYearlyRollover` (app/actions/roster-actions.ts), which is a "use server"
// action that resolves auth via getManagedClubContext and ends in redirect(), so it
// can't be invoked directly from a plain test. The helper below mirrors that action's
// transaction so we can assert the invariants the rest of the app relies on:
//   - copied year records its lineage via copiedFromYearId
//   - only active, non-WALK_IN members roll forward (as CONTINUING)
//   - the prior year and its members are preserved untouched (history)
async function rolloverActiveMembers(previousYearId: string, newYearLabel: string) {
  return prisma.$transaction(async (tx) => {
    const previousYear = await tx.clubRosterYear.findUniqueOrThrow({
      where: { id: previousYearId },
      select: { id: true, clubId: true },
    });

    await tx.clubRosterYear.updateMany({
      where: { clubId: previousYear.clubId, isActive: true },
      data: { isActive: false },
    });

    const newYear = await tx.clubRosterYear.create({
      data: {
        clubId: previousYear.clubId,
        yearLabel: newYearLabel,
        startsOn: new Date(`${newYearLabel}-01-01T00:00:00.000Z`),
        endsOn: new Date(`${newYearLabel}-12-31T23:59:59.000Z`),
        copiedFromYearId: previousYear.id,
        isActive: true,
      },
    });

    const activeMembers = await tx.rosterMember.findMany({
      where: {
        clubRosterYearId: previousYear.id,
        isActive: true,
        memberStatus: { not: MemberStatus.WALK_IN },
      },
    });

    if (activeMembers.length > 0) {
      await tx.rosterMember.createMany({
        data: activeMembers.map((member) => ({
          clubRosterYearId: newYear.id,
          firstName: member.firstName,
          lastName: member.lastName,
          dateOfBirth: member.dateOfBirth,
          ageAtStart: member.ageAtStart,
          gender: member.gender,
          memberRole: member.memberRole,
          isActive: true,
          rolloverStatus: RolloverStatus.CONTINUING,
        })),
      });
    }

    return newYear;
  });
}

test(
  "a roster member belongs to the correct club and roster year",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    const club = await prisma.club.create({
      data: { name: "Lighthouse Club", code: "LIGHT", type: "PATHFINDER" },
    });

    const rosterYear = await prisma.clubRosterYear.create({
      data: {
        clubId: club.id,
        yearLabel: "2026",
        startsOn: new Date("2026-01-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-31T23:59:59.000Z"),
        isActive: true,
      },
    });

    const member = await prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Riley",
        lastName: "Ranger",
        memberRole: MemberRole.PATHFINDER,
      },
    });

    // Members are scoped to a roster year, not directly to a club:
    // reach the club through member -> clubRosterYear -> club.
    const loaded = await prisma.rosterMember.findUniqueOrThrow({
      where: { id: member.id },
      include: { clubRosterYear: { include: { club: true } } },
    });

    assert.equal(loaded.clubRosterYearId, rosterYear.id);
    assert.equal(loaded.clubRosterYear.id, rosterYear.id);
    assert.equal(loaded.clubRosterYear.clubId, club.id);
    assert.equal(loaded.clubRosterYear.club.id, club.id);
  },
);

test(
  "rollover copies active members into the new year and preserves the prior year as history",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    const club = await prisma.club.create({
      data: { name: "Summit Club", code: "SUMMIT", type: "PATHFINDER" },
    });

    const previousYear = await prisma.clubRosterYear.create({
      data: {
        clubId: club.id,
        yearLabel: "2025",
        startsOn: new Date("2025-01-01T00:00:00.000Z"),
        endsOn: new Date("2025-12-31T23:59:59.000Z"),
        isActive: true,
      },
    });

    const active = await prisma.rosterMember.create({
      data: {
        clubRosterYearId: previousYear.id,
        firstName: "Avery",
        lastName: "Active",
        memberRole: MemberRole.PATHFINDER,
        isActive: true,
        memberStatus: MemberStatus.ACTIVE,
      },
    });

    const newYear = await rolloverActiveMembers(previousYear.id, "2026");

    // Lineage is recorded and the active year moves forward.
    assert.equal(newYear.copiedFromYearId, previousYear.id);
    assert.equal(newYear.isActive, true);

    const refreshedPrevious = await prisma.clubRosterYear.findUniqueOrThrow({
      where: { id: previousYear.id },
    });
    assert.equal(refreshedPrevious.isActive, false);

    // History: the prior year still holds its original member, untouched.
    const previousMembers = await prisma.rosterMember.findMany({
      where: { clubRosterYearId: previousYear.id },
    });
    assert.equal(previousMembers.length, 1);
    assert.equal(previousMembers[0]?.id, active.id);

    // The active member was copied forward as CONTINUING (a distinct row).
    const newMembers = await prisma.rosterMember.findMany({
      where: { clubRosterYearId: newYear.id },
    });
    assert.equal(newMembers.length, 1);
    assert.notEqual(newMembers[0]?.id, active.id);
    assert.equal(newMembers[0]?.firstName, "Avery");
    assert.equal(newMembers[0]?.lastName, "Active");
    assert.equal(newMembers[0]?.rolloverStatus, RolloverStatus.CONTINUING);
    assert.equal(newMembers[0]?.isActive, true);
  },
);

test(
  "rollover skips inactive and walk-in members",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    const club = await prisma.club.create({
      data: { name: "Harbor Club", code: "HARBOR", type: "PATHFINDER" },
    });

    const previousYear = await prisma.clubRosterYear.create({
      data: {
        clubId: club.id,
        yearLabel: "2025",
        startsOn: new Date("2025-01-01T00:00:00.000Z"),
        endsOn: new Date("2025-12-31T23:59:59.000Z"),
        isActive: true,
      },
    });

    await prisma.rosterMember.create({
      data: {
        clubRosterYearId: previousYear.id,
        firstName: "Cam",
        lastName: "Continuing",
        memberRole: MemberRole.PATHFINDER,
        isActive: true,
        memberStatus: MemberStatus.ACTIVE,
      },
    });

    await prisma.rosterMember.create({
      data: {
        clubRosterYearId: previousYear.id,
        firstName: "Ira",
        lastName: "Inactive",
        memberRole: MemberRole.PATHFINDER,
        isActive: false,
        memberStatus: MemberStatus.INACTIVE,
      },
    });

    await prisma.rosterMember.create({
      data: {
        clubRosterYearId: previousYear.id,
        firstName: "Wes",
        lastName: "Walkin",
        memberRole: MemberRole.PATHFINDER,
        isActive: true,
        memberStatus: MemberStatus.WALK_IN,
      },
    });

    const newYear = await rolloverActiveMembers(previousYear.id, "2026");

    const newMembers = await prisma.rosterMember.findMany({
      where: { clubRosterYearId: newYear.id },
    });

    assert.equal(newMembers.length, 1);
    assert.equal(newMembers[0]?.lastName, "Continuing");
  },
);

test.after(async () => {
  await disconnectIntegrationPrisma();
});
