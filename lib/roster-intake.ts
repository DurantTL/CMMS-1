import { Gender, MemberRole } from "@prisma/client";

// ---------------------------------------------------------------------------
// Pure roster-intake helpers shared by the bulk-entry grid and the CSV import.
// No Prisma / no "use server" here so this stays unit-testable without a DB.
// ---------------------------------------------------------------------------

/** Canonical field keys a single intake row may carry. */
export type RosterIntakeRow = {
  firstName?: string;
  lastName?: string;
  memberRole?: string;
  dateOfBirth?: string;
  gender?: string;
  ageAtStart?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalFlags?: string;
  dietaryRestrictions?: string;
  isFirstTime?: string;
  isMedicalPersonnel?: string;
  masterGuide?: string;
};

/** A validated, ready-to-persist member (plain fields; medical encryption happens at write time). */
export type NormalizedRosterMember = {
  firstName: string;
  lastName: string;
  memberRole: MemberRole;
  dateOfBirth: Date;
  gender: Gender | null;
  ageAtStart: number | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  medicalFlags: string | null;
  dietaryRestrictions: string | null;
  isFirstTime: boolean;
  isMedicalPersonnel: boolean;
  masterGuide: boolean;
};

export type NormalizeResult = {
  members: NormalizedRosterMember[];
  errors: string[];
  skipped: number;
};

// Header aliases so real club spreadsheets / Sterling exports map without hand-editing.
// Keys are normalized (lowercased, non-alphanumeric stripped); values are canonical field names.
const HEADER_ALIASES: Record<string, keyof RosterIntakeRow> = {
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  memberrole: "memberRole",
  role: "memberRole",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  birthdate: "dateOfBirth",
  birthday: "dateOfBirth",
  gender: "gender",
  sex: "gender",
  ageatstart: "ageAtStart",
  age: "ageAtStart",
  emergencycontactname: "emergencyContactName",
  emergencycontact: "emergencyContactName",
  emergencycontactphone: "emergencyContactPhone",
  emergencyphone: "emergencyContactPhone",
  phone: "emergencyContactPhone",
  medicalflags: "medicalFlags",
  medical: "medicalFlags",
  allergies: "medicalFlags",
  dietaryrestrictions: "dietaryRestrictions",
  dietary: "dietaryRestrictions",
  diet: "dietaryRestrictions",
  isfirsttime: "isFirstTime",
  firsttime: "isFirstTime",
  firstyear: "isFirstTime",
  ismedicalpersonnel: "isMedicalPersonnel",
  medicalpersonnel: "isMedicalPersonnel",
  masterguide: "masterGuide",
};

/** Normalize a raw header cell to its canonical field key (or null if unrecognized). */
export function normalizeHeader(raw: string): keyof RosterIntakeRow | null {
  const cleaned = raw
    .replace(/^﻿/, "") // strip UTF-8 BOM
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[cleaned] ?? null;
}

function coerceBoolean(value: string | undefined): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const v = value.trim().toLowerCase();
  return v === "true" || v === "yes" || v === "y" || v === "1" || v === "x";
}

function coerceEnumToken(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function optionalString(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse a strict `YYYY-MM-DD` string as UTC midnight, rejecting impossible dates.
 * `new Date("2012-02-31...")` silently rolls over to March, so we round-trip the
 * components and return null if they don't match what was submitted.
 */
export function parseStrictUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Age (in whole years) a member has reached on the roster year's start date. */
export function deriveAgeAtStart(dateOfBirth: Date, startsOn: Date): number {
  let age = startsOn.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = startsOn.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && startsOn.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Stable key used to detect duplicate members within a roster year. */
export function rosterMemberDedupKey(firstName: string, lastName: string, dateOfBirth: Date | null): string {
  const dob = dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : "";
  return `${lastName.trim().toLowerCase()}|${firstName.trim().toLowerCase()}|${dob}`;
}

/**
 * Validate and normalize a batch of intake rows. Rows missing required fields or
 * carrying invalid enums/dates are skipped and reported; valid rows are returned
 * ready to persist (with ageAtStart derived from DOB when blank).
 */
export function normalizeRosterRows(
  rows: RosterIntakeRow[],
  options: { startsOn: Date; rowOffset?: number },
): NormalizeResult {
  const { startsOn } = options;
  const rowOffset = options.rowOffset ?? 1;
  const members: NormalizedRosterMember[] = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNum = index + rowOffset;

    const firstName = (row.firstName ?? "").trim();
    const lastName = (row.lastName ?? "").trim();
    const memberRoleRaw = (row.memberRole ?? "").trim();
    const dateOfBirthRaw = (row.dateOfBirth ?? "").trim();

    if (!firstName || !lastName || !memberRoleRaw || !dateOfBirthRaw) {
      const missing = [
        !firstName && "firstName",
        !lastName && "lastName",
        !memberRoleRaw && "memberRole",
        !dateOfBirthRaw && "dateOfBirth",
      ]
        .filter(Boolean)
        .join(", ");
      errors.push(`Row ${rowNum}: missing required field(s): ${missing}.`);
      skipped += 1;
      return;
    }

    const memberRoleToken = coerceEnumToken(memberRoleRaw);
    if (!(memberRoleToken in MemberRole)) {
      errors.push(
        `Row ${rowNum}: invalid memberRole "${memberRoleRaw}". Valid values: ${Object.values(MemberRole).join(", ")}.`,
      );
      skipped += 1;
      return;
    }

    const dateOfBirth = parseStrictUtcDate(dateOfBirthRaw);
    if (!dateOfBirth) {
      errors.push(`Row ${rowNum}: invalid dateOfBirth "${dateOfBirthRaw}". Use YYYY-MM-DD format.`);
      skipped += 1;
      return;
    }

    const genderRaw = (row.gender ?? "").trim();
    const genderToken = genderRaw.length > 0 ? coerceEnumToken(genderRaw) : "";
    const gender = genderToken.length > 0 && genderToken in Gender ? (genderToken as Gender) : null;

    const ageRaw = (row.ageAtStart ?? "").trim();
    let ageAtStart: number | null = null;
    if (ageRaw.length > 0) {
      const parsed = Number(ageRaw);
      ageAtStart = Number.isNaN(parsed) ? null : parsed;
    }
    if (ageAtStart === null) {
      ageAtStart = deriveAgeAtStart(dateOfBirth, startsOn);
    }

    members.push({
      firstName,
      lastName,
      memberRole: memberRoleToken as MemberRole,
      dateOfBirth,
      gender,
      ageAtStart,
      emergencyContactName: optionalString(row.emergencyContactName),
      emergencyContactPhone: optionalString(row.emergencyContactPhone),
      medicalFlags: optionalString(row.medicalFlags),
      dietaryRestrictions: optionalString(row.dietaryRestrictions),
      isFirstTime: coerceBoolean(row.isFirstTime),
      isMedicalPersonnel: coerceBoolean(row.isMedicalPersonnel),
      masterGuide: coerceBoolean(row.masterGuide),
    });
  });

  return { members, errors, skipped };
}

/**
 * Drop members that collide with an existing roster (or each other) on
 * (lastName, firstName, dateOfBirth). Returns the unique set plus a skip count.
 */
export function dropDuplicateMembers(
  members: NormalizedRosterMember[],
  existingKeys: Iterable<string>,
): { unique: NormalizedRosterMember[]; skippedDuplicates: number } {
  const seen = new Set<string>(existingKeys);
  const unique: NormalizedRosterMember[] = [];
  let skippedDuplicates = 0;

  for (const member of members) {
    const key = rosterMemberDedupKey(member.firstName, member.lastName, member.dateOfBirth);
    if (seen.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    seen.add(key);
    unique.push(member);
  }

  return { unique, skippedDuplicates };
}
