import test from "node:test";
import assert from "node:assert/strict";
import { FormFieldScope, FormFieldType, MemberRole, RegistrationStatus, UserRole } from "@prisma/client";

import { persistRegistrationForClub } from "../app/actions/event-registration-actions";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("registration persistence enforces submit requirements and locks submitted registrations", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const club = await prisma.club.create({
    data: {
      name: "Central Club",
      code: "CENT",
      type: "PATHFINDER",
    },
  });

  await prisma.user.create({
    data: {
      email: "director@example.org",
      name: "Director",
      role: UserRole.CLUB_DIRECTOR,
    },
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
      firstName: "Alice",
      lastName: "Adventurer",
      memberRole: MemberRole.PATHFINDER,
      photoReleaseConsent: true,
      medicalTreatmentConsent: true,
      membershipAgreementConsent: true,
    },
  });

  const event = await prisma.event.create({
    data: {
      name: "Spring Camporee",
      slug: "spring-camporee",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
      dynamicFields: {
        create: [
          {
            key: "needs_power",
            label: "Needs power?",
            type: FormFieldType.SINGLE_SELECT,
            fieldScope: FormFieldScope.GLOBAL,
            isRequired: true,
            options: ["Yes", "No"],
            sortOrder: 0,
          },
          {
            key: "power_notes",
            label: "Power notes",
            type: FormFieldType.LONG_TEXT,
            fieldScope: FormFieldScope.GLOBAL,
            isRequired: true,
            options: {
              conditional: {
                fieldKey: "needs_power",
                operator: "equals",
                value: "Yes",
              },
            },
            sortOrder: 1,
          },
        ],
      },
    },
    include: {
      dynamicFields: true,
    },
  });

  await assert.rejects(() =>
    persistRegistrationForClub({
      eventId: event.id,
      clubId: club.id,
      clubName: club.name,
      directorEmail: "director@example.org",
      payload: {
        attendeeIds: [member.id],
        responses: [],
      },
      nextStatus: RegistrationStatus.SUBMITTED,
      now: new Date("2026-03-10T12:00:00.000Z"),
      sendConfirmationEmail: async () => undefined,
    }),
  );

  await persistRegistrationForClub({
    eventId: event.id,
    clubId: club.id,
    clubName: club.name,
    directorEmail: "director@example.org",
    payload: {
      attendeeIds: [member.id],
        responses: [
          {
            fieldId: event.dynamicFields[0]!.id,
            attendeeId: null,
            value: "No",
          },
        ],
      },
    nextStatus: RegistrationStatus.SUBMITTED,
    now: new Date("2026-03-10T12:00:00.000Z"),
    sendConfirmationEmail: async () => undefined,
  });

  const saved = await prisma.eventRegistration.findUniqueOrThrow({
    where: {
      eventId_clubId: {
        eventId: event.id,
        clubId: club.id,
      },
    },
  });

  assert.equal(saved.status, RegistrationStatus.SUBMITTED);

  await assert.rejects(() =>
    persistRegistrationForClub({
      eventId: event.id,
      clubId: club.id,
      clubName: club.name,
      directorEmail: "director@example.org",
      payload: {
        attendeeIds: [member.id],
        responses: [
          {
            fieldId: event.dynamicFields[0]!.id,
            attendeeId: null,
            value: "Yes",
          },
        ],
      },
      nextStatus: RegistrationStatus.DRAFT,
      now: new Date("2026-03-10T12:30:00.000Z"),
      sendConfirmationEmail: async () => undefined,
    }),
  );
});

test("conditional camporee questions are only required and persisted when their module is active", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const club = await prisma.club.create({
    data: {
      name: "North Club",
      code: "NORTH",
      type: "PATHFINDER",
    },
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
      firstName: "Casey",
      lastName: "Camper",
      memberRole: MemberRole.PATHFINDER,
      photoReleaseConsent: true,
      medicalTreatmentConsent: true,
      membershipAgreementConsent: true,
    },
  });

  const event = await prisma.event.create({
    data: {
      name: "Camporee Modules",
      slug: "camporee-modules",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
      dynamicFields: {
        create: [
          {
            key: "needs_power",
            label: "Needs power?",
            type: FormFieldType.SINGLE_SELECT,
            fieldScope: FormFieldScope.GLOBAL,
            isRequired: true,
            options: ["Yes", "No"],
            sortOrder: 0,
          },
          {
            key: "power_notes",
            label: "Power notes",
            type: FormFieldType.LONG_TEXT,
            fieldScope: FormFieldScope.GLOBAL,
            isRequired: true,
            options: {
              conditional: {
                fieldKey: "needs_power",
                operator: "equals",
                value: "Yes",
              },
            },
            sortOrder: 1,
          },
        ],
      },
    },
    include: {
      dynamicFields: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });

  await persistRegistrationForClub({
    eventId: event.id,
    clubId: club.id,
    clubName: club.name,
    directorEmail: null,
    payload: {
      attendeeIds: [member.id],
      responses: [
        {
          fieldId: event.dynamicFields[0]!.id,
          attendeeId: null,
          value: "No",
        },
        {
          fieldId: event.dynamicFields[1]!.id,
          attendeeId: null,
          value: "This should be discarded while hidden",
        },
      ],
    },
    nextStatus: RegistrationStatus.SUBMITTED,
    now: new Date("2026-03-10T12:00:00.000Z"),
    sendConfirmationEmail: async () => undefined,
  });

  const savedResponses = await prisma.eventFormResponse.findMany({
    where: {
      registration: {
        eventId: event.id,
        clubId: club.id,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  assert.equal(savedResponses.length, 1);
  assert.equal(savedResponses[0]?.eventFormFieldId, event.dynamicFields[0]?.id);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
