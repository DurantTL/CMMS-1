import { RegistrationStatus } from "@prisma/client";

import { buildCamporeeCategoryStandings, buildCamporeeTotalStandings } from "../camporee";
import { prisma } from "../prisma";

export async function getCamporeeDashboardSnapshot(eventId: string) {
  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      registrations: {
        where: {
          status: {
            in: [RegistrationStatus.SUBMITTED, RegistrationStatus.APPROVED],
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          status: true,
          registrationCode: true,
          club: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          attendees: {
            select: {
              id: true,
            },
          },
          camporeeScores: {
            orderBy: [{ category: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              category: true,
              score: true,
              notes: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    return null;
  }

  const flattenedScores = event.registrations.flatMap((registration) =>
    registration.camporeeScores.map((score) => ({
      category: score.category,
      score: score.score,
      registrationId: registration.id,
      clubName: registration.club.name,
      clubCode: registration.club.code,
    })),
  );

  const categories = Array.from(new Set(flattenedScores.map((score) => score.category))).sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    event,
    categories,
    categoryStandings: buildCamporeeCategoryStandings(flattenedScores),
    totalStandings: buildCamporeeTotalStandings(flattenedScores),
  };
}
