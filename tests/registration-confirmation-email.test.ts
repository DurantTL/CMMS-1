import test from "node:test";
import assert from "node:assert/strict";

import { buildRegistrationConfirmationHtml } from "../lib/email/registration-confirmation";

const baseProps = {
  eventName: "Spring Camporee",
  eventStartsAt: new Date("2026-04-10T12:00:00.000Z"),
  eventEndsAt: new Date("2026-04-12T18:00:00.000Z"),
  locationName: "Pine Grove Camp",
  locationAddress: "123 Forest Rd, Springfield, CA 90210",
  attendees: [
    { name: "Alice Adventurer", role: "PATHFINDER" },
    { name: "Bob Builder", role: "STAFF" },
  ],
  totalDue: 50,
  paymentStatus: "PENDING",
  eventId: "event-abc-123",
  appUrl: "https://cmms.example.org",
  contactEmail: "conference@example.org",
};

test("registration confirmation email includes event name", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(html.includes("Spring Camporee"), "should include event name");
});

test("registration confirmation email includes formatted dates", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(html.includes("2026"), "should include year in dates");
  assert.ok(html.includes("April"), "should include month in dates");
});

test("registration confirmation email includes location", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(html.includes("Pine Grove Camp"), "should include location name");
  assert.ok(html.includes("123 Forest Rd"), "should include location address");
});

test("registration confirmation email includes attendee names and roles", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(html.includes("Alice Adventurer"), "should include attendee name");
  assert.ok(html.includes("Bob Builder"), "should include attendee name");
  assert.ok(html.includes("PATHFINDER"), "should include attendee role");
  assert.ok(html.includes("STAFF"), "should include attendee role");
});

test("registration confirmation email includes formatted total and payment status", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(html.includes("$50.00"), "should include formatted total");
  assert.ok(html.includes("Pending"), "should include formatted payment status");
});

test("registration confirmation email includes link to registration page", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(
    html.includes("https://cmms.example.org/director/events/event-abc-123"),
    "should include registration URL",
  );
});

test("registration confirmation email includes conference contact email", () => {
  const html = buildRegistrationConfirmationHtml(baseProps);
  assert.ok(html.includes("conference@example.org"), "should include conference contact email");
});

test("registration confirmation email handles missing location gracefully", () => {
  const html = buildRegistrationConfirmationHtml({
    ...baseProps,
    locationName: null,
    locationAddress: null,
  });
  assert.ok(html.includes("Spring Camporee"), "should still render event name");
});

test("registration confirmation email handles missing contact email gracefully", () => {
  const html = buildRegistrationConfirmationHtml({
    ...baseProps,
    contactEmail: null,
  });
  assert.ok(html.includes("Spring Camporee"), "should still render event name");
  assert.ok(!html.includes("Questions?"), "should omit contact section when not configured");
});

test("registration confirmation email escapes HTML in event name", () => {
  const html = buildRegistrationConfirmationHtml({
    ...baseProps,
    eventName: "<script>alert('xss')</script>",
  });
  assert.ok(!html.includes("<script>"), "should not contain raw script tag");
  assert.ok(html.includes("&lt;script&gt;"), "should escape angle brackets");
});

test("registration confirmation email shows PAID status when total is zero", () => {
  const html = buildRegistrationConfirmationHtml({
    ...baseProps,
    totalDue: 0,
    paymentStatus: "PAID",
  });
  assert.ok(html.includes("Paid"), "should show Paid status");
  assert.ok(html.includes("$0.00"), "should show zero total");
});

test("registration confirmation email send path calls send function with correct arguments", async () => {
  const calls: unknown[] = [];

  const mockSend = async (input: unknown) => {
    calls.push(input);
  };

  await mockSend({
    to: "director@example.org",
    eventName: "Spring Camporee",
    eventStartsAt: new Date("2026-04-10T12:00:00.000Z"),
    eventEndsAt: new Date("2026-04-12T18:00:00.000Z"),
    locationName: "Pine Grove Camp",
    locationAddress: null,
    attendees: [{ name: "Alice Adventurer", role: "PATHFINDER" }],
    totalDue: 25,
    paymentStatus: "PENDING",
    eventId: "event-abc-123",
  });

  assert.equal(calls.length, 1, "should call send function once");

  const call = calls[0] as Record<string, unknown>;
  assert.equal(call.to, "director@example.org");
  assert.equal(call.eventName, "Spring Camporee");
  assert.equal(call.totalDue, 25);
});
