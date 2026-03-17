import test from "node:test";
import assert from "node:assert/strict";
import { MemberRole, RegistrationStatus, UserRole } from "@prisma/client";

import { persistRegistrationForClub } from "../app/actions/event-registration-actions";
import { buildRegistrationConfirmationHtml } from "../lib/email/registration-confirmation";
import { prisma } from "../lib/prisma";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test(
  "registration confirmation email is sent to director after submission with full event and attendee data",
  { skip: !hasIntegrationDatabase },
  async () => {
    await resetIntegrationDatabase();

    const club = await prisma.club.create({
      data: {
        name: "Cedar Club",
        code: "CEDAR",
        type: "PATHFINDER",
      },
    });

    const director = await prisma.user.create({
      data: {
        email: "director@cedars.org",
        name: "Cedar Director",
        role: UserRole.CLUB_DIRECTOR,
      },
    });

    await prisma.clubMembership.create({
      data: {
        clubId: club.id,
        userId: director.id,
        isPrimary: true,
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
        firstName: "Cedar",
        lastName: "Pathfinder",
        memberRole: MemberRole.PATHFINDER,
        photoReleaseConsent: true,
        medicalTreatmentConsent: true,
        membershipAgreementConsent: true,
      },
    });

    const event = await prisma.event.create({
      data: {
        name: "Fall Camporee",
        slug: "fall-camporee",
        startsAt: new Date("2026-10-01T12:00:00.000Z"),
        endsAt: new Date("2026-10-03T18:00:00.000Z"),
        locationName: "Meadow Park",
        locationAddress: "456 Park Lane, Riverside, CA 92501",
        registrationOpensAt: new Date("2026-09-01T00:00:00.000Z"),
        registrationClosesAt: new Date("2026-09-25T23:59:59.000Z"),
        basePrice: 30,
        lateFeePrice: 35,
        lateFeeStartsAt: new Date("2026-09-20T00:00:00.000Z"),
      },
    });

    const capturedCalls: Array<{
      to: string;
      eventName: string;
      eventStartsAt: Date;
      eventEndsAt: Date;
      locationName: string | null;
      locationAddress: string | null;
      attendees: Array<{ name: string; role: string }>;
      totalDue: number;
      paymentStatus: string;
      eventId: string;
    }> = [];

    await persistRegistrationForClub({
      eventId: event.id,
      clubId: club.id,
      clubName: club.name,
      directorEmail: null,
      payload: {
        attendeeIds: [member.id],
        responses: [],
      },
      nextStatus: RegistrationStatus.SUBMITTED,
      now: new Date("2026-09-10T12:00:00.000Z"),
      sendConfirmationEmail: async (input) => {
        capturedCalls.push(input);
      },
    });

    assert.equal(capturedCalls.length, 1, "should send exactly one confirmation email");

    const call = capturedCalls[0]!;
    assert.equal(call.to, "director@cedars.org", "should email the club director");
    assert.equal(call.eventName, "Fall Camporee");
    assert.equal(call.locationName, "Meadow Park");
    assert.equal(call.locationAddress, "456 Park Lane, Riverside, CA 92501");
    assert.equal(call.totalDue, 30);
    assert.equal(call.paymentStatus, "PENDING");
    assert.equal(call.eventId, event.id);
    assert.equal(call.attendees.length, 1);
    assert.equal(call.attendees[0]?.name, "Cedar Pathfinder");
    assert.equal(call.attendees[0]?.role, MemberRole.PATHFINDER);
  },
);

test(
  "registration confirmation email HTML renders with correct event and attendee content",
  { skip: !hasIntegrationDatabase },
  async () => {
    const html = buildRegistrationConfirmationHtml({
      eventName: "Fall Camporee",
      eventStartsAt: new Date("2026-10-01T12:00:00.000Z"),
      eventEndsAt: new Date("2026-10-03T18:00:00.000Z"),
      locationName: "Meadow Park",
      locationAddress: "456 Park Lane, Riverside, CA 92501",
      attendees: [
        { name: "Cedar Pathfinder", role: "PATHFINDER" },
        { name: "Dana Director", role: "DIRECTOR" },
      ],
      totalDue: 60,
      paymentStatus: "PENDING",
      eventId: "event-xyz-456",
      appUrl: "https://cmms.example.org",
      contactEmail: "conf@example.org",
    });

    assert.ok(html.includes("Fall Camporee"), "renders event name");
    assert.ok(html.includes("Meadow Park"), "renders location name");
    assert.ok(html.includes("456 Park Lane"), "renders location address");
    assert.ok(html.includes("Cedar Pathfinder"), "renders attendee name");
    assert.ok(html.includes("Dana Director"), "renders attendee name");
    assert.ok(html.includes("$60.00"), "renders formatted total");
    assert.ok(html.includes("Pending"), "renders payment status");
    assert.ok(html.includes("/director/events/event-xyz-456"), "renders registration URL");
    assert.ok(html.includes("conf@example.org"), "renders contact email");
    assert.ok(html.includes("October"), "renders month in date");
  },
);

test.after(async () => {
  await disconnectIntegrationPrisma();
});
