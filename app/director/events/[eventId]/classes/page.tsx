import { type MemberRole, type Prisma, type RequirementType } from "@prisma/client";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getManagedClubContext } from "../../../../../lib/club-management";
import { CLASS_ASSIGNMENT_POLICY } from "../../../../../lib/class-model";
import { prisma } from "../../../../../lib/prisma";
import { type RequirementInput } from "../../../../../lib/class-prerequisite-utils";
import { ClassAssignmentBoard } from "./_components/class-assignment-board";

type RequirementConfig = {
  minAge?: number;
  maxAge?: number;
  requiredMemberRole?: MemberRole;
  requiredHonorCode?: string;
  requiredMasterGuide?: boolean;
};

function parseRequirementConfig(config: Prisma.JsonValue): RequirementConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const raw = config as Record<string, unknown>;

  return {
    minAge: typeof raw.minAge === "number" ? raw.minAge : undefined,
    maxAge: typeof raw.maxAge === "number" ? raw.maxAge : undefined,
    requiredMemberRole: typeof raw.requiredMemberRole === "string" ? (raw.requiredMemberRole as MemberRole) : undefined,
    requiredHonorCode: typeof raw.requiredHonorCode === "string" ? raw.requiredHonorCode : undefined,
    requiredMasterGuide: typeof raw.requiredMasterGuide === "boolean" ? raw.requiredMasterGuide : undefined,
  };
}

function mapRequirementsToEvaluatorInput(
  requirements: Array<{ requirementType: RequirementType; config: Prisma.JsonValue }>,
): RequirementInput[] {
  return requirements.map((requirement) => {
    const config = parseRequirementConfig(requirement.config);

    return {
      requirementType: requirement.requirementType,
      minAge: config.minAge ?? null,
      maxAge: config.maxAge ?? null,
      requiredMemberRole: config.requiredMemberRole ?? null,
      requiredHonorCode: config.requiredHonorCode ?? null,
      requiredMasterGuide: config.requiredMasterGuide ?? null,
    };
  });
}

function readHonorCodeFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).honorCode;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

export default async function DirectorClassSelectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const t = await getTranslations("Director");
  const { eventId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);

  if (!managedClub.clubId) {
    return (
      <section className="glass-panel">
        <h1 className="text-xl font-semibold">{t("common.clubNotFound")}</h1>
        <p className="mt-2 text-sm">{t("classes.clubNotFoundDescription")}</p>
      </section>
    );
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      eventId,
      clubId: managedClub.clubId,
    },
    select: {
      event: {
        select: {
          id: true,
          eventMode: true,
          name: true,
          startsAt: true,
          endsAt: true,
          locationName: true,
        },
      },
      attendees: {
        select: {
          rosterMember: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ageAtStart: true,
              memberRole: true,
              masterGuide: true,
              completedRequirements: {
                where: {
                  requirementType: "COMPLETED_HONOR",
                },
                select: {
                  metadata: true,
                },
              },
              classEnrollments: {
                where: {
                  offering: {
                    eventId,
                  },
                },
                select: {
                  eventClassOfferingId: true,
                },
              },
            },
          },
        },
        orderBy: {
          rosterMember: {
            lastName: "asc",
          },
        },
      },
    },
  });

  if (!registration) {
    notFound();
  }

  const offerings = await prisma.eventClassOffering.findMany({
    where: {
      eventId,
    },
    select: {
      id: true,
      capacity: true,
      classCatalog: {
        select: {
          title: true,
          code: true,
          requirements: {
            select: {
              requirementType: true,
              config: true,
            },
          },
        },
      },
      event: {
        select: {
          startsAt: true,
          endsAt: true,
          locationName: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: [{ classCatalog: { title: "asc" } }],
  });

  return (
    <section className="space-y-6">
      {registration.event.eventMode !== "CLASS_ASSIGNMENT" ? (
        <section className="glass-panel">
          <h1 className="text-xl font-semibold text-slate-900">{t("classes.eyebrow")}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("classes.notEnabled")}
          </p>
        </section>
      ) : null}
      {registration.event.eventMode === "CLASS_ASSIGNMENT" ? (
      <header className="glass-panel">
        <p className="hero-kicker">{t("classes.eyebrow")}</p>
        <h1 className="hero-title mt-3">{registration.event.name}</h1>
        <p className="hero-copy">{t("classes.description")}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{CLASS_ASSIGNMENT_POLICY}</p>
      </header>
      ) : null}

      {registration.event.eventMode === "CLASS_ASSIGNMENT" ? (
      <ClassAssignmentBoard
        eventId={registration.event.id}
        managedClubId={managedClub.isSuperAdmin ? managedClub.clubId : null}
        attendees={registration.attendees.map((attendee) => ({
          id: attendee.rosterMember.id,
          firstName: attendee.rosterMember.firstName,
          lastName: attendee.rosterMember.lastName,
          ageAtStart: attendee.rosterMember.ageAtStart,
          memberRole: attendee.rosterMember.memberRole,
          masterGuide: attendee.rosterMember.masterGuide,
          completedHonorCodes: attendee.rosterMember.completedRequirements
            .map((item) => readHonorCodeFromMetadata(item.metadata))
            .filter((item): item is string => Boolean(item)),
          enrolledOfferingIds: attendee.rosterMember.classEnrollments.map((enrollment) => enrollment.eventClassOfferingId),
        }))}
        offerings={offerings.map((offering) => ({
          id: offering.id,
          title: offering.classCatalog.title,
          code: offering.classCatalog.code,
          location: offering.event.locationName,
          capacity: offering.capacity,
          enrolledCount: offering._count.enrollments,
          requirements: mapRequirementsToEvaluatorInput(offering.classCatalog.requirements),
        }))}
      />
      ) : null}
    </section>
  );
}
