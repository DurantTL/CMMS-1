import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, RequirementType } from "@prisma/client";

import {
  filterClassAssignmentAttendees,
  filterOfferings,
  getAssignableSelectedAttendeeIds,
  getRemovableSelectedAttendeeIds,
} from "../lib/honors-ui";

test("attendee filters support search and assignment status", () => {
  const attendees = [
    {
      id: "a1",
      firstName: "Alice",
      lastName: "Able",
      ageAtStart: 12,
      memberRole: MemberRole.PATHFINDER,
      masterGuide: false,
      completedHonorCodes: [],
      enrolledOfferingIds: [],
    },
    {
      id: "a2",
      firstName: "Brian",
      lastName: "Baker",
      ageAtStart: 15,
      memberRole: MemberRole.TLT,
      masterGuide: false,
      completedHonorCodes: [],
      enrolledOfferingIds: ["off-1"],
    },
  ];

  assert.equal(filterClassAssignmentAttendees(attendees, "alice", "all").length, 1);
  assert.equal(filterClassAssignmentAttendees(attendees, "", "unassigned").length, 1);
  assert.equal(filterClassAssignmentAttendees(attendees, "", "assigned").length, 1);
});

test("offering filters support search and availability state", () => {
  const offerings = [
    {
      id: "off-1",
      title: "Camping Skills",
      code: "HON-CAMP",
      location: null,
      capacity: 10,
      enrolledCount: 10,
      requirements: [],
    },
    {
      id: "off-2",
      title: "First Aid",
      code: "HON-AID",
      location: null,
      capacity: 10,
      enrolledCount: 4,
      requirements: [],
    },
  ];

  assert.equal(filterOfferings(offerings, "aid", "all").length, 1);
  assert.equal(filterOfferings(offerings, "", "full").length, 1);
  assert.equal(filterOfferings(offerings, "", "open").length, 1);
});

test("bulk selection helpers keep assignable and removable honors actions separate", () => {
  const attendees = [
    {
      id: "a1",
      firstName: "Alice",
      lastName: "Able",
      ageAtStart: 12,
      memberRole: MemberRole.PATHFINDER,
      masterGuide: false,
      completedHonorCodes: [],
      enrolledOfferingIds: [],
    },
    {
      id: "a2",
      firstName: "Brian",
      lastName: "Baker",
      ageAtStart: 15,
      memberRole: MemberRole.PATHFINDER,
      masterGuide: false,
      completedHonorCodes: [],
      enrolledOfferingIds: ["off-other"],
    },
    {
      id: "a3",
      firstName: "Cara",
      lastName: "Cole",
      ageAtStart: 14,
      memberRole: MemberRole.PATHFINDER,
      masterGuide: false,
      completedHonorCodes: [],
      enrolledOfferingIds: ["off-1"],
    },
  ];

  const offering = {
    id: "off-1",
    title: "First Aid",
    code: "HON-AID",
    location: null,
    capacity: 10,
    enrolledCount: 3,
    requirements: [
      {
        requirementType: RequirementType.MIN_AGE,
        minAge: 12,
        maxAge: null,
        requiredMemberRole: null,
        requiredHonorCode: null,
        requiredMasterGuide: null,
      },
    ],
  };

  assert.deepEqual(getAssignableSelectedAttendeeIds(attendees, ["a1", "a2", "a3"], offering), ["a1"]);
  assert.deepEqual(getRemovableSelectedAttendeeIds(attendees, ["a1", "a2", "a3"], "off-1"), ["a3"]);
});
