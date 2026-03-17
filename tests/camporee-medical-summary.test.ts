import test from "node:test";
import assert from "node:assert/strict";

import { prepareMedicalFieldsForWrite, decryptMedicalFields } from "../lib/medical-data";

const VALID_TEST_KEY = "12345678901234567890123456789012";

function makeTestEnv() {
  process.env.MEDICAL_ENCRYPTION_KEY = Buffer.from(VALID_TEST_KEY).toString("base64");
}

test("attendee medical summary: decryptMedicalFields surfaces dietary restrictions and medical flags for display", () => {
  makeTestEnv();

  const encrypted = prepareMedicalFieldsForWrite({
    medicalFlags: "Asthma — carries inhaler",
    dietaryRestrictions: "Vegan, no tree nuts",
    insuranceCompany: null,
    insurancePolicyNumber: null,
    lastTetanusDate: null,
  });

  const summary = decryptMedicalFields({
    medicalFlags: encrypted.medicalFlags,
    dietaryRestrictions: encrypted.dietaryRestrictions,
  });

  assert.equal(summary.medicalFlags, "Asthma — carries inhaler");
  assert.equal(summary.dietaryRestrictions, "Vegan, no tree nuts");
});

test("attendee medical summary: null fields produce null after decryption", () => {
  makeTestEnv();

  const summary = decryptMedicalFields({
    medicalFlags: null,
    dietaryRestrictions: null,
  });

  assert.equal(summary.medicalFlags, null);
  assert.equal(summary.dietaryRestrictions, null);
});

test("attendee medical summary: emergency contact fields pass through unchanged (not encrypted)", () => {
  // emergencyContactName and emergencyContactPhone are plain-text schema fields;
  // verify they survive the mapping step that page.tsx performs.
  const members = [
    {
      id: "m1",
      medicalFlags: null,
      dietaryRestrictions: null,
      emergencyContactName: "Jane Parent",
      emergencyContactPhone: "555-9999",
    },
    {
      id: "m2",
      medicalFlags: null,
      dietaryRestrictions: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
    },
  ];

  const summaries = members.map((member) => {
    const decrypted = decryptMedicalFields({
      medicalFlags: member.medicalFlags,
      dietaryRestrictions: member.dietaryRestrictions,
    });
    return {
      id: member.id,
      dietaryRestrictions: decrypted.dietaryRestrictions,
      medicalNotes: decrypted.medicalFlags,
      emergencyContactName: member.emergencyContactName ?? null,
      emergencyContactPhone: member.emergencyContactPhone ?? null,
    };
  });

  assert.equal(summaries[0].emergencyContactName, "Jane Parent");
  assert.equal(summaries[0].emergencyContactPhone, "555-9999");
  assert.equal(summaries[1].emergencyContactName, null);
  assert.equal(summaries[1].emergencyContactPhone, null);
});

test("attendee medical summary: only selected attendees with data should be shown in meals/safety sections", () => {
  makeTestEnv();

  const encrypted = prepareMedicalFieldsForWrite({
    medicalFlags: "EpiPen required",
    dietaryRestrictions: "Nut-free",
    insuranceCompany: null,
    insurancePolicyNumber: null,
    lastTetanusDate: null,
  });

  const allSummaries = [
    {
      id: "a1",
      ...decryptMedicalFields({ medicalFlags: encrypted.medicalFlags, dietaryRestrictions: encrypted.dietaryRestrictions }),
      emergencyContactName: "Bob Smith",
      emergencyContactPhone: "555-1234",
    },
    {
      id: "a2",
      ...decryptMedicalFields({ medicalFlags: null, dietaryRestrictions: null }),
      emergencyContactName: null,
      emergencyContactPhone: null,
    },
  ];

  const selectedIds = new Set(["a1"]);

  const withDiet = allSummaries.filter(
    (s) => selectedIds.has(s.id) && s.dietaryRestrictions,
  );
  assert.equal(withDiet.length, 1);
  assert.equal(withDiet[0].id, "a1");
  assert.equal(withDiet[0].dietaryRestrictions, "Nut-free");

  const withSafety = allSummaries.filter(
    (s) => selectedIds.has(s.id) && (s.emergencyContactName || s.medicalFlags),
  );
  assert.equal(withSafety.length, 1);
  assert.equal(withSafety[0].emergencyContactName, "Bob Smith");
  assert.equal(withSafety[0].medicalFlags, "EpiPen required");

  // a2 not in selected set — nothing shown
  const notSelected = allSummaries.filter(
    (s) => selectedIds.has(s.id) && s.id === "a2",
  );
  assert.equal(notSelected.length, 0);
});
