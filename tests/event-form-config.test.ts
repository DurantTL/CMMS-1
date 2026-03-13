import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStoredEventFieldOptions,
  isEventFieldVisible,
  readEventFieldConfig,
} from "../lib/event-form-config";

test("field config preserves select options and conditional logic in EventFormField options JSON", () => {
  const stored = buildStoredEventFieldOptions({
    optionValues: ["Yes", "No"],
    conditional: {
      fieldKey: "needs_power",
      operator: "equals",
      value: "Yes",
    },
  });

  assert.deepEqual(stored, {
    choices: ["Yes", "No"],
    conditional: {
      fieldKey: "needs_power",
      operator: "equals",
      value: "Yes",
    },
  });

  assert.deepEqual(readEventFieldConfig(stored), {
    optionValues: ["Yes", "No"],
    conditional: {
      fieldKey: "needs_power",
      operator: "equals",
      value: "Yes",
    },
  });
});

test("field visibility evaluates conditional rules against prior global answers", () => {
  const field = {
    options: {
      conditional: {
        fieldKey: "needs_power",
        operator: "includes",
        value: "Generator",
      },
    },
  };

  assert.equal(
    isEventFieldVisible(field, {
      needs_power: ["Generator", "Extension Cord"],
    }),
    true,
  );

  assert.equal(
    isEventFieldVisible(field, {
      needs_power: ["Lantern"],
    }),
    false,
  );
});
