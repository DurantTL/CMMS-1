import { type MemberRole } from "@prisma/client";

import { evaluateClassRequirements, type RequirementInput } from "./class-prerequisite-utils";

export type HonorsUiAttendee = {
  id: string;
  firstName: string;
  lastName: string;
  ageAtStart: number | null;
  memberRole: MemberRole;
  masterGuide: boolean;
  completedHonorCodes: string[];
  enrolledOfferingIds: string[];
};

export type HonorsUiOffering = {
  id: string;
  title: string;
  code: string;
  location: string | null;
  capacity: number | null;
  enrolledCount: number;
  requirements: RequirementInput[];
};

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function filterClassAssignmentAttendees(
  attendees: HonorsUiAttendee[],
  search: string,
  status: "all" | "assigned" | "unassigned",
) {
  const normalizedSearch = normalizeSearch(search);

  return attendees.filter((attendee) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      `${attendee.firstName} ${attendee.lastName}`.toLowerCase().includes(normalizedSearch) ||
      attendee.memberRole.toLowerCase().includes(normalizedSearch);

    const assigned = attendee.enrolledOfferingIds.length > 0;
    const matchesStatus =
      status === "all" ||
      (status === "assigned" && assigned) ||
      (status === "unassigned" && !assigned);

    return matchesSearch && matchesStatus;
  });
}

export function filterOfferings(
  offerings: HonorsUiOffering[],
  search: string,
  availability: "all" | "open" | "full",
) {
  const normalizedSearch = normalizeSearch(search);

  return offerings.filter((offering) => {
    const matchesSearch =
      normalizedSearch.length === 0 ||
      offering.title.toLowerCase().includes(normalizedSearch) ||
      offering.code.toLowerCase().includes(normalizedSearch);

    const seatsLeft = offering.capacity === null ? null : Math.max(offering.capacity - offering.enrolledCount, 0);
    const isFull = seatsLeft !== null && seatsLeft <= 0;
    const matchesAvailability =
      availability === "all" ||
      (availability === "open" && !isFull) ||
      (availability === "full" && isFull);

    return matchesSearch && matchesAvailability;
  });
}

export function getAssignableSelectedAttendeeIds(
  attendees: HonorsUiAttendee[],
  selectedIds: string[],
  offering: HonorsUiOffering,
) {
  const selectedSet = new Set(selectedIds);

  return attendees
    .filter((attendee) => selectedSet.has(attendee.id))
    .filter((attendee) => {
      const alreadyEnrolled = attendee.enrolledOfferingIds.includes(offering.id);
      const hasOtherEnrollment = attendee.enrolledOfferingIds.some((enrollmentId) => enrollmentId !== offering.id);
      const eligibility = evaluateClassRequirements(
        {
          ageAtStart: attendee.ageAtStart,
          memberRole: attendee.memberRole,
          masterGuide: attendee.masterGuide,
          completedHonorCodes: attendee.completedHonorCodes,
        },
        offering.requirements,
      );

      return eligibility.eligible && !alreadyEnrolled && !hasOtherEnrollment;
    })
    .map((attendee) => attendee.id);
}

export function getRemovableSelectedAttendeeIds(
  attendees: HonorsUiAttendee[],
  selectedIds: string[],
  offeringId: string,
) {
  const selectedSet = new Set(selectedIds);

  return attendees
    .filter((attendee) => selectedSet.has(attendee.id))
    .filter((attendee) => attendee.enrolledOfferingIds.includes(offeringId))
    .map((attendee) => attendee.id);
}
