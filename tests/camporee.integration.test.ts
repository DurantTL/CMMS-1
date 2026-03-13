import test from "node:test";
import assert from "node:assert/strict";
import { RegistrationStatus, UserRole } from "@prisma/client";

import { getCamporeeDashboardSnapshot } from "../lib/data/camporee";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("camporee dashboard aggregates score entries by registration without replacing event registrations", { skip: !hasIntegrationDatabase }, async () => {
  await resetIntegrationDatabase();

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.org",
      name: "Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const event = await prisma.event.create({
    data: {
      name: "Spring Camporee",
      slug: "spring-camporee-scores",
      startsAt: new Date("2026-04-10T12:00:00.000Z"),
      endsAt: new Date("2026-04-12T18:00:00.000Z"),
      registrationOpensAt: new Date("2026-03-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-04-01T23:59:59.000Z"),
      basePrice: 25,
      lateFeePrice: 30,
      lateFeeStartsAt: new Date("2026-03-20T00:00:00.000Z"),
    },
  });

  const clubs = await Promise.all([
    prisma.club.create({
      data: {
        name: "Central Club",
        code: "CENT",
        type: "PATHFINDER",
      },
    }),
    prisma.club.create({
      data: {
        name: "North Club",
        code: "NORTH",
        type: "PATHFINDER",
      },
    }),
  ]);

  const registrations = await Promise.all(
    clubs.map((club, index) =>
      prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          clubId: club.id,
          registrationCode: `REG-${index + 1}`,
          status: RegistrationStatus.SUBMITTED,
          totalDue: 50,
          paymentStatus: "PENDING",
        },
      }),
    ),
  );

  await prisma.camporeeScore.createMany({
    data: [
      {
        eventId: event.id,
        eventRegistrationId: registrations[0]!.id,
        category: "Drill",
        score: 91,
        createdByUserId: admin.id,
      },
      {
        eventId: event.id,
        eventRegistrationId: registrations[0]!.id,
        category: "Inspection",
        score: 88,
        createdByUserId: admin.id,
      },
      {
        eventId: event.id,
        eventRegistrationId: registrations[1]!.id,
        category: "Drill",
        score: 97,
        createdByUserId: admin.id,
      },
    ],
  });

  const dashboard = await getCamporeeDashboardSnapshot(event.id);

  assert.ok(dashboard);
  assert.equal(dashboard?.totalStandings[0]?.clubName, "Central Club");
  assert.equal(dashboard?.totalStandings[0]?.totalScore, 179);
  assert.equal(dashboard?.categoryStandings[0]?.entries[0]?.clubName, "North Club");
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
