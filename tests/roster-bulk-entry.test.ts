import test from "node:test";
import assert from "node:assert/strict";
import { Gender, MemberRole } from "@prisma/client";

import {
  deriveAgeAtStart,
  dropDuplicateMembers,
  normalizeHeader,
  normalizeRosterRows,
  parseStrictUtcDate,
  rosterMemberDedupKey,
  type NormalizedRosterMember,
} from "../lib/roster-intake";

const startsOn = new Date("2026-01-01T00:00:00.000Z");

test("normalizeHeader maps aliases and strips BOM, returns null for unknown", () => {
  assert.equal(normalizeHeader("firstName"), "firstName");
  assert.equal(normalizeHeader("First Name"), "firstName");
  assert.equal(normalizeHeader("DOB"), "dateOfBirth");
  assert.equal(normalizeHeader("Date of Birth"), "dateOfBirth");
  assert.equal(normalizeHeader("﻿firstName"), "firstName"); // leading UTF-8 BOM
  assert.equal(normalizeHeader("Role"), "memberRole");
  assert.equal(normalizeHeader("nonsense column"), null);
});

test("parseStrictUtcDate accepts real dates and rejects impossible/malformed ones", () => {
  assert.equal(
    parseStrictUtcDate("2012-05-14")?.toISOString(),
    "2012-05-14T00:00:00.000Z",
  );
  assert.equal(parseStrictUtcDate("2012-02-31"), null); // would roll over to March
  assert.equal(parseStrictUtcDate("2013-02-29"), null); // non-leap year
  assert.equal(parseStrictUtcDate("2012-13-01"), null); // bad month
  assert.equal(parseStrictUtcDate("not-a-date"), null);
  assert.equal(parseStrictUtcDate("2012-5-14"), null); // not zero-padded
});

test("deriveAgeAtStart counts whole years reached on the year's start date", () => {
  // Birthday already passed before Jan 1, 2026.
  assert.equal(deriveAgeAtStart(new Date("2012-06-15T00:00:00.000Z"), startsOn), 13);
  // Born exactly on the start date → age 0.
  assert.equal(deriveAgeAtStart(new Date("2026-01-01T00:00:00.000Z"), startsOn), 0);
  // Birthday falls after the start date → not yet counted.
  assert.equal(deriveAgeAtStart(new Date("2010-12-31T00:00:00.000Z"), startsOn), 15);
});

test("normalizeRosterRows validates required fields and reports per-row errors", () => {
  const result = normalizeRosterRows(
    [
      { firstName: "Jane", lastName: "Doe", memberRole: "PATHFINDER", dateOfBirth: "2012-05-14" },
      { firstName: "", lastName: "NoFirst", memberRole: "PATHFINDER", dateOfBirth: "2012-05-14" },
      { firstName: "Bad", lastName: "Role", memberRole: "WIZARD", dateOfBirth: "2012-05-14" },
      { firstName: "Bad", lastName: "Date", memberRole: "PATHFINDER", dateOfBirth: "not-a-date" },
      // Syntactically valid but impossible — must NOT silently roll over to March.
      { firstName: "Imp", lastName: "Ossible", memberRole: "PATHFINDER", dateOfBirth: "2012-02-31" },
    ],
    { startsOn, rowOffset: 1 },
  );

  assert.equal(result.members.length, 1);
  assert.equal(result.skipped, 4);
  assert.equal(result.errors.length, 4);
  assert.match(result.errors[0], /Row 2: missing required field\(s\): firstName/);
  assert.match(result.errors[1], /Row 3: invalid memberRole "WIZARD"/);
  assert.match(result.errors[2], /Row 4: invalid dateOfBirth "not-a-date"/);
  assert.match(result.errors[3], /Row 5: invalid dateOfBirth "2012-02-31"/);
});

test("normalizeRosterRows derives age when blank and normalizes enum casing", () => {
  const result = normalizeRosterRows(
    [
      // lowercase role + spaced gender + blank age → derived
      { firstName: "Sam", lastName: "Lower", memberRole: "pathfinder", dateOfBirth: "2014-03-02", gender: "non binary" },
      // explicit age wins over derivation
      { firstName: "Pat", lastName: "Aged", memberRole: "TLT", dateOfBirth: "2009-08-08", ageAtStart: "99" },
    ],
    { startsOn, rowOffset: 1 },
  );

  assert.equal(result.members.length, 2);

  const [sam, pat] = result.members;
  assert.equal(sam.memberRole, MemberRole.PATHFINDER);
  assert.equal(sam.gender, Gender.NON_BINARY);
  assert.equal(sam.ageAtStart, deriveAgeAtStart(new Date("2014-03-02T00:00:00.000Z"), startsOn));
  assert.equal(pat.ageAtStart, 99);
});

test("rosterMemberDedupKey is case-insensitive and date-scoped", () => {
  const dob = new Date("2012-05-14T00:00:00.000Z");
  assert.equal(
    rosterMemberDedupKey("Jane", "Doe", dob),
    rosterMemberDedupKey("  jane ", "DOE", dob),
  );
  assert.notEqual(
    rosterMemberDedupKey("Jane", "Doe", dob),
    rosterMemberDedupKey("Jane", "Doe", new Date("2013-05-14T00:00:00.000Z")),
  );
});

test("dropDuplicateMembers skips collisions with existing roster and within the batch", () => {
  const make = (firstName: string, lastName: string, dob: string): NormalizedRosterMember => ({
    firstName,
    lastName,
    memberRole: MemberRole.PATHFINDER,
    dateOfBirth: new Date(`${dob}T00:00:00.000Z`),
    gender: null,
    ageAtStart: 12,
    emergencyContactName: null,
    emergencyContactPhone: null,
    medicalFlags: null,
    dietaryRestrictions: null,
    isFirstTime: false,
    isMedicalPersonnel: false,
    masterGuide: false,
  });

  const existing = [rosterMemberDedupKey("Existing", "Member", new Date("2012-01-01T00:00:00.000Z"))];

  const { unique, skippedDuplicates } = dropDuplicateMembers(
    [
      make("Existing", "Member", "2012-01-01"), // collides with existing roster
      make("Fresh", "One", "2013-02-02"),
      make("Fresh", "One", "2013-02-02"), // duplicate within the batch
      make("Fresh", "Two", "2014-03-03"),
    ],
    existing,
  );

  assert.equal(unique.length, 2);
  assert.equal(skippedDuplicates, 2);
  assert.deepEqual(
    unique.map((m) => m.lastName),
    ["One", "Two"],
  );
});
