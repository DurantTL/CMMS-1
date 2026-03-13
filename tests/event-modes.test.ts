import test from "node:test";
import assert from "node:assert/strict";
import { EventMode, FormFieldScope, FormFieldType } from "@prisma/client";

import { validateDynamicFieldsForEventMode } from "../lib/event-modes";
import { parseEventTemplateSnapshot } from "../lib/event-templates";

test("older template snapshots fall back to club registration mode", () => {
  const parsed = parseEventTemplateSnapshot({
    name: "Legacy Template",
    description: "",
    startsAt: "2026-04-10T12:00",
    endsAt: "2026-04-12T18:00",
    registrationOpensAt: "2026-03-01T00:00",
    registrationClosesAt: "2026-04-01T00:00",
    basePrice: 20,
    lateFeePrice: 30,
    lateFeeStartsAt: "2026-03-20T00:00",
    locationName: "Camp",
    locationAddress: "123 Road",
    dynamicFields: [],
  });

  assert.equal(parsed.eventMode, EventMode.CLUB_REGISTRATION);
});

test("basic form mode rejects attendee-scoped and roster-select fields", () => {
  assert.throws(() =>
    validateDynamicFieldsForEventMode(EventMode.BASIC_FORM, [
      {
        key: "camper_name",
        label: "Camper Name",
        type: FormFieldType.SHORT_TEXT,
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ]),
  );

  assert.throws(() =>
    validateDynamicFieldsForEventMode(EventMode.BASIC_FORM, [
      {
        key: "leader_pick",
        label: "Leader Pick",
        type: FormFieldType.ROSTER_SELECT,
        fieldScope: FormFieldScope.GLOBAL,
      },
    ]),
  );
});

test("club registration mode accepts attendee-scoped questions", () => {
  assert.doesNotThrow(() =>
    validateDynamicFieldsForEventMode(EventMode.CLUB_REGISTRATION, [
      {
        key: "shirt_size",
        label: "Shirt Size",
        type: FormFieldType.SHORT_TEXT,
        fieldScope: FormFieldScope.ATTENDEE,
      },
    ]),
  );
});
