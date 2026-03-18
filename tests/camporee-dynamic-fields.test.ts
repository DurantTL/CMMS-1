import test from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for dynamic field injection into the Camporee workflow.
 *
 * These tests cover:
 * - parseDynamicFieldResponses helper (parsing and validation)
 * - formatDynamicFieldValue display helper (via inline logic tests)
 * - sectionOrder computation (dynamic-fields section present/absent)
 */

// ----- parseDynamicFieldResponses logic (duplicated here for unit testing) -----

function parseDynamicFieldResponses(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ----- formatDynamicFieldValue logic (duplicated here for unit testing) -----

function formatDynamicFieldValue(value: unknown): string {
  if (value === null || typeof value === "undefined" || value === "") {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

// ----- sectionOrder computation logic (duplicated here for unit testing) -----

type SectionId =
  | "club-info"
  | "attendance"
  | "campsite"
  | "travel"
  | "meals"
  | "participation"
  | "dynamic-fields"
  | "safety"
  | "ministry"
  | "review";

const FULL_SECTION_ORDER: SectionId[] = [
  "club-info",
  "attendance",
  "campsite",
  "travel",
  "meals",
  "participation",
  "dynamic-fields",
  "safety",
  "ministry",
  "review",
];

function computeSectionOrder(hasDynamicFields: boolean): SectionId[] {
  if (!hasDynamicFields) {
    return FULL_SECTION_ORDER.filter((id) => id !== "dynamic-fields");
  }
  return FULL_SECTION_ORDER;
}

// ----- Tests -----

test("parseDynamicFieldResponses returns empty object for null input", () => {
  assert.deepEqual(parseDynamicFieldResponses(null), {});
});

test("parseDynamicFieldResponses returns empty object for empty string", () => {
  assert.deepEqual(parseDynamicFieldResponses(""), {});
});

test("parseDynamicFieldResponses returns empty object for invalid JSON", () => {
  assert.deepEqual(parseDynamicFieldResponses("{not valid json"), {});
});

test("parseDynamicFieldResponses returns empty object for JSON array", () => {
  assert.deepEqual(parseDynamicFieldResponses(JSON.stringify(["a", "b"])), {});
});

test("parseDynamicFieldResponses parses valid field response map", () => {
  const responses = {
    "field-id-1": "some text answer",
    "field-id-2": true,
    "field-id-3": 42,
    "field-id-4": ["option-a", "option-b"],
  };

  const result = parseDynamicFieldResponses(JSON.stringify(responses));
  assert.deepEqual(result, responses);
});

test("parseDynamicFieldResponses returns empty object for non-object JSON values", () => {
  assert.deepEqual(parseDynamicFieldResponses(JSON.stringify(42)), {});
  assert.deepEqual(parseDynamicFieldResponses(JSON.stringify("a string")), {});
  assert.deepEqual(parseDynamicFieldResponses(JSON.stringify(null)), {});
});

test("formatDynamicFieldValue returns dash for null/undefined/empty", () => {
  assert.equal(formatDynamicFieldValue(null), "—");
  assert.equal(formatDynamicFieldValue(undefined), "—");
  assert.equal(formatDynamicFieldValue(""), "—");
});

test("formatDynamicFieldValue returns dash for empty array", () => {
  assert.equal(formatDynamicFieldValue([]), "—");
});

test("formatDynamicFieldValue joins array values with comma", () => {
  assert.equal(formatDynamicFieldValue(["First Aid", "Drill"]), "First Aid, Drill");
});

test("formatDynamicFieldValue formats booleans as Yes/No", () => {
  assert.equal(formatDynamicFieldValue(true), "Yes");
  assert.equal(formatDynamicFieldValue(false), "No");
});

test("formatDynamicFieldValue converts other values to string", () => {
  assert.equal(formatDynamicFieldValue(42), "42");
  assert.equal(formatDynamicFieldValue("hello"), "hello");
});

test("section order includes dynamic-fields when fields are present", () => {
  const order = computeSectionOrder(true);
  assert.ok(order.includes("dynamic-fields"), "dynamic-fields section should be present");
});

test("section order excludes dynamic-fields when no fields are present", () => {
  const order = computeSectionOrder(false);
  assert.ok(!order.includes("dynamic-fields"), "dynamic-fields section should not be present");
});

test("dynamic-fields section is inserted between participation and safety", () => {
  const order = computeSectionOrder(true);
  const participationIndex = order.indexOf("participation");
  const dynamicIndex = order.indexOf("dynamic-fields");
  const safetyIndex = order.indexOf("safety");

  assert.ok(participationIndex < dynamicIndex, "participation must come before dynamic-fields");
  assert.ok(dynamicIndex < safetyIndex, "dynamic-fields must come before safety");
});

test("without dynamic-fields, participation is still followed by safety", () => {
  const order = computeSectionOrder(false);
  const participationIndex = order.indexOf("participation");
  const safetyIndex = order.indexOf("safety");

  assert.ok(participationIndex + 1 === safetyIndex, "participation must be immediately before safety when dynamic-fields is absent");
});

test("review is always the last section", () => {
  const withDynamic = computeSectionOrder(true);
  const withoutDynamic = computeSectionOrder(false);

  assert.equal(withDynamic[withDynamic.length - 1], "review");
  assert.equal(withoutDynamic[withoutDynamic.length - 1], "review");
});

test("section label numbering increments correctly with dynamic-fields", () => {
  const order = computeSectionOrder(true);
  const BASE_SECTION_NAMES: Record<SectionId, string> = {
    "club-info": "Club Information",
    attendance: "Attendance & Roster",
    campsite: "Campsite Needs",
    travel: "Travel & Arrival",
    meals: "Meals & Food Planning",
    participation: "Participation Planning",
    "dynamic-fields": "Event-Specific Questions",
    safety: "Safety / Emergency",
    ministry: "Spiritual / Ministry Items",
    review: "Final Review",
  };

  const labels: Record<string, string> = {};
  let i = 1;
  for (const id of order) {
    labels[id] = `${i}. ${BASE_SECTION_NAMES[id]}`;
    i++;
  }

  assert.equal(labels["participation"], "6. Participation Planning");
  assert.equal(labels["dynamic-fields"], "7. Event-Specific Questions");
  assert.equal(labels["safety"], "8. Safety / Emergency");
  assert.equal(labels["review"], "10. Final Review");
});
