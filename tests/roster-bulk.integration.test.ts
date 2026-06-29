import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, Prisma, RolloverStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  decryptMedicalFields,
  isEncryptedMedicalValue,
  prepareMedicalFieldsForWrite,
} from "../lib/medical-data";
import {
  deriveAgeAtStart,
  dropDuplicateMembers,
  normalizeRosterRows,
  rosterMemberDedupKey,
  type NormalizedRosterMember,
} from "../lib/roster-intake";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

// `bulkCreateRosterMembers` (app/actions/roster-actions.ts) is a "use server" action
// that resolves auth via getManagedClubContext and calls revalidatePath, so it can't
// be invoked directly here. This mirrors the action's core pipeline — normalize →
// de-dup against existing active members → encrypt medical fields → createMany — so we
// assert the invariants the bulk-entry screen relies on:
//   - medical fields are stored encrypted and round-trip back to plaintext
//   - ageAtStart is derived from DOB + the roster year's startsOn when blank
//   - duplicates (same last/first/DOB as an existing active member) are skipped
//   - invalid rows are reported, not inserted
function buildCreateInput(
  member: NormalizedRosterMember,
  rosterYearId: string,
): Prisma.RosterMemberUncheckedCreateInput {
  const medical = prepareMedicalFieldsForWrite({
    medicalFlags: member.medicalFlags,
    dietaryRestrictions: member.dietaryRestrictions,
    insuranceCompany: null,
    insurancePolicyNumber: null,
    lastTetanusDate: null,
  });

  return {
    clubRosterYearId: rosterYearId,
    firstName: member.firstName,
    lastName: member.lastName,
    memberRole: member.memberRole,
    dateOfBirth: member.dateOfBirth,
    ageAtStart: member.ageAtStart,
    gender: member.gender,
    emergencyContactName: member.emergencyContactName,
    emergencyContactPhone: member.emergencyContactPhone,
    medicalFlags: medical.medicalFlags,
    dietaryRestrictions: medical.dietaryRestrictions,
    isFirstTime: member.isFirstTime,
    isMedicalPersonnel: member.isMedicalPersonnel,
    masterGuide: member.masterGuide,
    photoReleaseConsent: false,
    medicalTreatmentConsent: false,
    membershipAgreementConsent: false,
    backgroundCheckCleared: false,
    rolloverStatus: RolloverStatus.NEW,
    isActive: true,
  };
}

test(
  "bulk entry encrypts medical fields, derives age, and skips duplicate + invalid rows",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    const startsOn = new Date("2026-01-01T00:00:00.000Z");

    const club = await prisma.club.create({
      data: { name: "Beacon Club", code: "BEACON", type: "PATHFINDER" },
    });

    const rosterYear = await prisma.clubRosterYear.create({
      data: {
        clubId: club.id,
        yearLabel: "2026",
        startsOn,
        endsOn: new Date("2026-12-31T23:59:59.000Z"),
        isActive: true,
      },
    });

    // An existing active member the bulk batch will collide with.
    await prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Dana",
        lastName: "Existing",
        memberRole: MemberRole.PATHFINDER,
        dateOfBirth: new Date("2012-01-01T00:00:00.000Z"),
        isActive: true,
      },
    });

    const rawRows = [
      {
        firstName: "Riley",
        lastName: "Newcomer",
        memberRole: "pathfinder",
        dateOfBirth: "2013-09-10",
        medicalFlags: "Asthma — carries inhaler",
        dietaryRestrictions: "Gluten-free",
        emergencyContactName: "Pat Newcomer",
        emergencyContactPhone: "555-0100",
      },
      // duplicate of the existing active member
      { firstName: "Dana", lastName: "Existing", memberRole: "PATHFINDER", dateOfBirth: "2012-01-01" },
      // invalid role → reported, not inserted
      { firstName: "Bad", lastName: "Role", memberRole: "WIZARD", dateOfBirth: "2010-01-01" },
    ];

    const { members, errors, skipped } = normalizeRosterRows(rawRows, { startsOn, rowOffset: 1 });
    assert.equal(skipped, 1); // the invalid-role row
    assert.equal(errors.length, 1);
    assert.match(errors[0], /invalid memberRole "WIZARD"/);

    const existingActive = await prisma.rosterMember.findMany({
      where: { clubRosterYearId: rosterYear.id, isActive: true },
      select: { firstName: true, lastName: true, dateOfBirth: true },
    });
    const existingKeys = existingActive.map((m) =>
      rosterMemberDedupKey(m.firstName, m.lastName, m.dateOfBirth),
    );

    const { unique, skippedDuplicates } = dropDuplicateMembers(members, existingKeys);
    assert.equal(skippedDuplicates, 1); // the Dana Existing duplicate
    assert.equal(unique.length, 1); // only Riley Newcomer survives

    await prisma.rosterMember.createMany({
      data: unique.map((member) => buildCreateInput(member, rosterYear.id)),
    });

    // Read the raw row to confirm encryption-at-rest, then decrypt for the round-trip.
    const rawRiley = await prisma.rosterMember.findFirstOrThrow({
      where: { clubRosterYearId: rosterYear.id, lastName: "Newcomer" },
    });

    assert.ok(
      isEncryptedMedicalValue(rawRiley.medicalFlags),
      "medicalFlags should be stored encrypted, not plaintext",
    );
    assert.notEqual(rawRiley.medicalFlags, "Asthma — carries inhaler");

    const decrypted = decryptMedicalFields(rawRiley);
    assert.equal(decrypted.medicalFlags, "Asthma — carries inhaler");
    assert.equal(decrypted.dietaryRestrictions, "Gluten-free");

    // Age derived from DOB + the year's startsOn (none provided in the row).
    assert.equal(rawRiley.ageAtStart, deriveAgeAtStart(new Date("2013-09-10T00:00:00.000Z"), startsOn));

    // Intentional onboarding state: consents not yet captured, rollover status NEW.
    assert.equal(rawRiley.photoReleaseConsent, false);
    assert.equal(rawRiley.medicalTreatmentConsent, false);
    assert.equal(rawRiley.membershipAgreementConsent, false);
    assert.equal(rawRiley.rolloverStatus, RolloverStatus.NEW);

    // The duplicate did not create a second Dana Existing row.
    const danaCount = await prisma.rosterMember.count({
      where: { clubRosterYearId: rosterYear.id, lastName: "Existing" },
    });
    assert.equal(danaCount, 1);

    // Total members: the pre-existing Dana + the one new Riley.
    const total = await prisma.rosterMember.count({ where: { clubRosterYearId: rosterYear.id } });
    assert.equal(total, 2);
  },
);

test.after(async () => {
  await disconnectIntegrationPrisma();
});
