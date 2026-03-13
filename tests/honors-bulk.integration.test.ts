import test from "node:test";
import assert from "node:assert/strict";
import { ClassType, MemberRole } from "@prisma/client";

import { bulkEnrollAttendeesInClass } from "../app/actions/enrollment-actions";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("bulk enrollment respects one-class-per-event and capacity rules", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const club = await prisma.club.create({
    data: {
      name: "Central Club",
      code: "CENT",
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

  const [alice, brian, cara] = await Promise.all([
    prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Alice",
        lastName: "Able",
        memberRole: MemberRole.PATHFINDER,
        photoReleaseConsent: true,
        medicalTreatmentConsent: true,
        membershipAgreementConsent: true,
      },
    }),
    prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Brian",
        lastName: "Baker",
        memberRole: MemberRole.PATHFINDER,
        photoReleaseConsent: true,
        medicalTreatmentConsent: true,
        membershipAgreementConsent: true,
      },
    }),
    prisma.rosterMember.create({
      data: {
        clubRosterYearId: rosterYear.id,
        firstName: "Cara",
        lastName: "Cole",
        memberRole: MemberRole.PATHFINDER,
        photoReleaseConsent: true,
        medicalTreatmentConsent: true,
        membershipAgreementConsent: true,
      },
    }),
  ]);

  const event = await prisma.event.create({
    data: {
      name: "Spring Camporee",
      slug: "spring-camporee-honors",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    },
  });

  await prisma.eventRegistration.create({
    data: {
      eventId: event.id,
      clubId: club.id,
      registrationCode: "REG-HONORS",
      status: "SUBMITTED",
      totalDue: 75,
      paymentStatus: "PENDING",
      attendees: {
        create: [
          { rosterMemberId: alice.id },
          { rosterMemberId: brian.id },
          { rosterMemberId: cara.id },
        ],
      },
    },
  });

  const [catalogA, catalogB] = await Promise.all([
    prisma.classCatalog.create({
      data: {
        title: "First Aid",
        code: "HON-AID",
        classType: ClassType.HONOR,
      },
    }),
    prisma.classCatalog.create({
      data: {
        title: "Camping Skills",
        code: "HON-CAMP",
        classType: ClassType.HONOR,
      },
    }),
  ]);

  const [offeringA, offeringB] = await Promise.all([
    prisma.eventClassOffering.create({
      data: {
        eventId: event.id,
        classCatalogId: catalogA.id,
        capacity: 2,
      },
    }),
    prisma.eventClassOffering.create({
      data: {
        eventId: event.id,
        classCatalogId: catalogB.id,
        capacity: 5,
      },
    }),
  ]);

  await prisma.classEnrollment.create({
    data: {
      eventClassOfferingId: offeringB.id,
      rosterMemberId: brian.id,
    },
  });

  await assert.rejects(
    () =>
      bulkEnrollAttendeesInClass({
        eventId: event.id,
        eventClassOfferingId: offeringA.id,
        rosterMemberIds: [alice.id, brian.id],
        clubId: club.id,
      }),
    /Bulk enrollment blocked/,
  );

  await bulkEnrollAttendeesInClass({
    eventId: event.id,
    eventClassOfferingId: offeringA.id,
    rosterMemberIds: [alice.id, cara.id],
    clubId: club.id,
  });

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      eventClassOfferingId: offeringA.id,
    },
    orderBy: {
      rosterMemberId: "asc",
    },
  });

  assert.equal(enrollments.length, 2);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
