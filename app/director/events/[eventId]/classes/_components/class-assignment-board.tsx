"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type MemberRole } from "@prisma/client";

import {
  bulkEnrollAttendeesInClass,
  bulkRemoveAttendeesFromClass,
  enrollAttendeeInClass,
  removeAttendeeFromClass,
} from "../../../../../actions/enrollment-actions";
import {
  CLASS_ASSIGNMENT_POLICY,
  getSeatsLeft,
  isOfferingFull,
} from "../../../../../../lib/class-model";
import {
  evaluateClassRequirements,
  requirementToBadgeLabel,
  type RequirementInput,
} from "../../../../../../lib/class-prerequisite-utils";
import {
  filterClassAssignmentAttendees,
  filterOfferings,
  getAssignableSelectedAttendeeIds,
  getRemovableSelectedAttendeeIds,
} from "../../../../../../lib/honors-ui";

type Attendee = {
  id: string;
  firstName: string;
  lastName: string;
  ageAtStart: number | null;
  memberRole: MemberRole;
  masterGuide: boolean;
  completedHonorCodes: string[];
  enrolledOfferingIds: string[];
};

type Offering = {
  id: string;
  title: string;
  code: string;
  location: string | null;
  capacity: number | null;
  enrolledCount: number;
  requirements: RequirementInput[];
};

type OptimisticState = {
  enrolledCountsByOfferingId: Record<string, number>;
  attendeeEnrollmentsById: Record<string, string[]>;
};

type OptimisticAction =
  | {
      kind: "enroll";
      attendeeId: string;
      offeringId: string;
    }
  | {
      kind: "remove";
      attendeeId: string;
      offeringId: string;
    };

type ClassAssignmentBoardProps = {
  eventId: string;
  managedClubId: string | null;
  attendees: Attendee[];
  offerings: Offering[];
};

function fullName(attendee: Attendee) {
  return `${attendee.firstName} ${attendee.lastName}`;
}

function formatAssignmentCount(count: number) {
  if (count === 0) {
    return "No class assigned";
  }

  return "1 class assigned";
}

export function ClassAssignmentBoard({ eventId, managedClubId, attendees, offerings }: ClassAssignmentBoardProps) {
  const router = useRouter();
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string>(attendees[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(attendees[0] ? [attendees[0].id] : []);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendeeStatus, setAttendeeStatus] = useState<"all" | "assigned" | "unassigned">("all");
  const [offeringSearch, setOfferingSearch] = useState("");
  const [offeringAvailability, setOfferingAvailability] = useState<"all" | "open" | "full">("all");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const baseOptimisticState = useMemo<OptimisticState>(
    () => ({
      enrolledCountsByOfferingId: Object.fromEntries(
        offerings.map((offering) => [offering.id, offering.enrolledCount]),
      ),
      attendeeEnrollmentsById: Object.fromEntries(attendees.map((attendee) => [attendee.id, attendee.enrolledOfferingIds])),
    }),
    [attendees, offerings],
  );

  const [optimisticState, addOptimisticEnrollment] = useOptimistic(
    baseOptimisticState,
    (currentState, optimisticAction: OptimisticAction) => {
      const attendeeEnrollmentSet = new Set(
        currentState.attendeeEnrollmentsById[optimisticAction.attendeeId] ?? [],
      );

      if (optimisticAction.kind === "enroll") {
        if (attendeeEnrollmentSet.has(optimisticAction.offeringId)) {
          return currentState;
        }

        attendeeEnrollmentSet.add(optimisticAction.offeringId);

        return {
          enrolledCountsByOfferingId: {
            ...currentState.enrolledCountsByOfferingId,
            [optimisticAction.offeringId]:
              (currentState.enrolledCountsByOfferingId[optimisticAction.offeringId] ?? 0) + 1,
          },
          attendeeEnrollmentsById: {
            ...currentState.attendeeEnrollmentsById,
            [optimisticAction.attendeeId]: Array.from(attendeeEnrollmentSet),
          },
        };
      }

      if (!attendeeEnrollmentSet.has(optimisticAction.offeringId)) {
        return currentState;
      }

      attendeeEnrollmentSet.delete(optimisticAction.offeringId);

      return {
        enrolledCountsByOfferingId: {
          ...currentState.enrolledCountsByOfferingId,
          [optimisticAction.offeringId]: Math.max(
            (currentState.enrolledCountsByOfferingId[optimisticAction.offeringId] ?? 1) - 1,
            0,
          ),
        },
        attendeeEnrollmentsById: {
          ...currentState.attendeeEnrollmentsById,
          [optimisticAction.attendeeId]: Array.from(attendeeEnrollmentSet),
        },
      };
    },
  );

  const selectedAttendee = useMemo(
    () => attendees.find((attendee) => attendee.id === selectedAttendeeId) ?? null,
    [attendees, selectedAttendeeId],
  );

  const visibleAttendees = useMemo(
    () => filterClassAssignmentAttendees(attendees, attendeeSearch, attendeeStatus),
    [attendees, attendeeSearch, attendeeStatus],
  );

  const visibleOfferings = useMemo(
    () => filterOfferings(offerings, offeringSearch, offeringAvailability),
    [offerings, offeringSearch, offeringAvailability],
  );

  const visibleSelectedIds = selectedIds.filter((id) => visibleAttendees.some((attendee) => attendee.id === id));

  function toggleSelected(rosterMemberId: string) {
    setSelectedIds((current) =>
      current.includes(rosterMemberId)
        ? current.filter((id) => id !== rosterMemberId)
        : [...current, rosterMemberId],
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="glass-sidebar space-y-3">
        <h2 className="section-title">Registered Attendees</h2>
        <p className="text-xs text-slate-600">Choose an attendee for detail actions, or select multiple attendees for bulk assignment.</p>

        <div className="space-y-2">
          <input
            type="search"
            value={attendeeSearch}
            onChange={(event) => setAttendeeSearch(event.currentTarget.value)}
            placeholder="Search attendees"
            className="w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800"
          />
          <select
            value={attendeeStatus}
            onChange={(event) => setAttendeeStatus(event.currentTarget.value as "all" | "assigned" | "unassigned")}
            className="w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">All attendees</option>
            <option value="unassigned">Unassigned only</option>
            <option value="assigned">Assigned only</option>
          </select>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/50 bg-white/55 px-3 py-2">
          <p className="text-xs text-slate-600">{visibleSelectedIds.length} selected</p>
          <button
            type="button"
            onClick={() => {
              const allVisibleSelected = visibleAttendees.length > 0 && visibleAttendees.every((attendee) => selectedIds.includes(attendee.id));
              setSelectedIds((current) =>
                allVisibleSelected
                  ? current.filter((id) => !visibleAttendees.some((attendee) => attendee.id === id))
                  : Array.from(new Set([...current, ...visibleAttendees.map((attendee) => attendee.id)])),
              );
            }}
            className="text-xs font-semibold text-indigo-700"
          >
            Select visible
          </button>
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {visibleAttendees.map((attendee) => {
            const isSelected = attendee.id === selectedAttendeeId;
            const enrolledCount = optimisticState.attendeeEnrollmentsById[attendee.id]?.length ?? 0;

            return (
              <div
                key={attendee.id}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-indigo-300 bg-indigo-50/70 text-indigo-900"
                    : "border-white/50 bg-white/55 text-slate-700 hover:bg-white/75"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(attendee.id)}
                    onChange={() => toggleSelected(attendee.id)}
                    className="mt-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAttendeeId(attendee.id);
                      setSelectedIds((current) => (current.includes(attendee.id) ? current : [...current, attendee.id]));
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-semibold">{fullName(attendee)}</p>
                    <p className="text-xs text-slate-500">
                      {attendee.memberRole} • Age {attendee.ageAtStart ?? "N/A"} • {formatAssignmentCount(enrolledCount)}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="space-y-4">
        <header className="glass-panel">
          <h1 className="section-title">Class Enrollment & Live Capacity</h1>
          <p className="section-copy">
            {selectedAttendee
              ? `Assigning classes for ${fullName(selectedAttendee)}.`
              : "Select an attendee to start assigning classes."}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">{CLASS_ASSIGNMENT_POLICY}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="search"
              value={offeringSearch}
              onChange={(event) => setOfferingSearch(event.currentTarget.value)}
              placeholder="Search honors/classes"
              className="w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800"
            />
            <select
              value={offeringAvailability}
              onChange={(event) => setOfferingAvailability(event.currentTarget.value as "all" | "open" | "full")}
              className="w-full rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm text-slate-800"
            >
              <option value="all">All offerings</option>
              <option value="open">Open seats</option>
              <option value="full">Full offerings</option>
            </select>
          </div>
          {errorMessage ? (
            <p className="alert-danger mt-4">{errorMessage}</p>
          ) : null}
        </header>

        <article className="glass-panel">
          <div className="grid gap-3 xl:grid-cols-2">
            {visibleOfferings.map((offering) => {
              const enrolledCount =
                optimisticState.enrolledCountsByOfferingId[offering.id] ?? offering.enrolledCount;
              const seatsLeft = getSeatsLeft(offering.capacity, enrolledCount);
              const isFull = isOfferingFull(offering.capacity, enrolledCount);
              const alreadyEnrolled =
                selectedAttendee !== null &&
                (optimisticState.attendeeEnrollmentsById[selectedAttendee.id] ?? []).includes(offering.id);
              const hasOtherEnrollment =
                selectedAttendee !== null &&
                (optimisticState.attendeeEnrollmentsById[selectedAttendee.id] ?? []).some(
                  (enrolledOfferingId) => enrolledOfferingId !== offering.id,
                );
              const eligibility = selectedAttendee
                ? evaluateClassRequirements(
                    {
                      ageAtStart: selectedAttendee.ageAtStart,
                      memberRole: selectedAttendee.memberRole,
                      masterGuide: selectedAttendee.masterGuide,
                      completedHonorCodes: selectedAttendee.completedHonorCodes,
                    },
                    offering.requirements,
                  )
                : { eligible: false, blockers: ["Select an attendee"] };

              const blockedReason = !eligibility.eligible
                ? eligibility.blockers[0]
                : alreadyEnrolled
                  ? "Already enrolled"
                  : hasOtherEnrollment
                    ? "Already assigned to another event class"
                    : isFull
                      ? "Class full"
                      : null;

              return (
                <div key={offering.id} className="glass-card-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {offering.title} <span className="text-xs font-medium text-slate-500">({offering.code})</span>
                      </p>
                      <p className="text-xs text-slate-500">{offering.location ?? "Location TBD"}</p>
                    </div>
                    <span className="status-chip-neutral bg-slate-900/90 text-white">
                      {seatsLeft === null ? "Open capacity" : `${seatsLeft}/${offering.capacity} seats left`}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {offering.requirements.map((requirement, index) => (
                      <span
                        key={`${offering.id}-req-${index}`}
                        className="status-chip-warning"
                      >
                        {requirementToBadgeLabel(requirement)}
                      </span>
                    ))}
                    {blockedReason ? (
                      <span className="status-chip-danger">
                        {blockedReason}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    {(() => {
                      const assignableSelectedIds = getAssignableSelectedAttendeeIds(
                        attendees.map((attendee) => ({
                          ...attendee,
                          enrolledOfferingIds: optimisticState.attendeeEnrollmentsById[attendee.id] ?? attendee.enrolledOfferingIds,
                        })),
                        selectedIds,
                        {
                          ...offering,
                          enrolledCount,
                        },
                      );
                      const removableSelectedIds = getRemovableSelectedAttendeeIds(
                        attendees.map((attendee) => ({
                          ...attendee,
                          enrolledOfferingIds: optimisticState.attendeeEnrollmentsById[attendee.id] ?? attendee.enrolledOfferingIds,
                        })),
                        selectedIds,
                        offering.id,
                      );

                      return `${assignableSelectedIds.length} selected assignable • ${removableSelectedIds.length} selected removable`;
                    })()}
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={
                        isPending ||
                        !selectedAttendee ||
                        !eligibility.eligible ||
                        alreadyEnrolled ||
                        hasOtherEnrollment ||
                        isFull
                      }
                      onClick={() => {
                        if (!selectedAttendee) {
                          return;
                        }

                        setErrorMessage(null);
                        addOptimisticEnrollment({
                          kind: "enroll",
                          attendeeId: selectedAttendee.id,
                          offeringId: offering.id,
                        });

                        startTransition(async () => {
                          try {
                            await enrollAttendeeInClass({
                              eventId,
                              rosterMemberId: selectedAttendee.id,
                              eventClassOfferingId: offering.id,
                              clubId: managedClubId,
                            });
                            router.refresh();
                          } catch (error) {
                            const message =
                              error instanceof Error ? error.message : "Unable to enroll attendee.";
                            setErrorMessage(message);
                          }
                        });
                      }}
                      className="btn-primary px-3 py-2 disabled:bg-slate-300"
                    >
                      {alreadyEnrolled ? "Enrolled" : "Enroll"}
                    </button>

                    {alreadyEnrolled ? (
                      <button
                        type="button"
                        disabled={isPending || !selectedAttendee}
                        onClick={() => {
                          if (!selectedAttendee) {
                            return;
                          }

                          setErrorMessage(null);
                          addOptimisticEnrollment({
                            kind: "remove",
                            attendeeId: selectedAttendee.id,
                            offeringId: offering.id,
                          });

                          startTransition(async () => {
                            try {
                              await removeAttendeeFromClass({
                                eventId,
                                rosterMemberId: selectedAttendee.id,
                                eventClassOfferingId: offering.id,
                                clubId: managedClubId,
                              });
                              router.refresh();
                            } catch (error) {
                              const message =
                                error instanceof Error ? error.message : "Unable to remove enrollment.";
                              setErrorMessage(message);
                            }
                          });
                        }}
                        className="btn-secondary ml-2 px-3 py-2"
                      >
                        Remove
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={
                        isPending ||
                        getAssignableSelectedAttendeeIds(
                          attendees.map((attendee) => ({
                            ...attendee,
                            enrolledOfferingIds: optimisticState.attendeeEnrollmentsById[attendee.id] ?? attendee.enrolledOfferingIds,
                          })),
                          selectedIds,
                          {
                            ...offering,
                            enrolledCount,
                          },
                        ).length === 0
                      }
                      onClick={() => {
                        const assignableIds = getAssignableSelectedAttendeeIds(
                          attendees.map((attendee) => ({
                            ...attendee,
                            enrolledOfferingIds: optimisticState.attendeeEnrollmentsById[attendee.id] ?? attendee.enrolledOfferingIds,
                          })),
                          selectedIds,
                          {
                            ...offering,
                            enrolledCount,
                          },
                        );

                        if (assignableIds.length === 0) {
                          return;
                        }

                        setErrorMessage(null);
                        for (const attendeeId of assignableIds) {
                          addOptimisticEnrollment({
                            kind: "enroll",
                            attendeeId,
                            offeringId: offering.id,
                          });
                        }

                        startTransition(async () => {
                          try {
                            await bulkEnrollAttendeesInClass({
                              eventId,
                              rosterMemberIds: assignableIds,
                              eventClassOfferingId: offering.id,
                              clubId: managedClubId,
                            });
                            router.refresh();
                          } catch (error) {
                            setErrorMessage(error instanceof Error ? error.message : "Unable to bulk enroll attendees.");
                          }
                        });
                      }}
                      className="btn-secondary ml-2 px-3 py-2"
                    >
                      Bulk Enroll
                    </button>

                    <button
                      type="button"
                      disabled={
                        isPending ||
                        getRemovableSelectedAttendeeIds(
                          attendees.map((attendee) => ({
                            ...attendee,
                            enrolledOfferingIds: optimisticState.attendeeEnrollmentsById[attendee.id] ?? attendee.enrolledOfferingIds,
                          })),
                          selectedIds,
                          offering.id,
                        ).length === 0
                      }
                      onClick={() => {
                        const removableIds = getRemovableSelectedAttendeeIds(
                          attendees.map((attendee) => ({
                            ...attendee,
                            enrolledOfferingIds: optimisticState.attendeeEnrollmentsById[attendee.id] ?? attendee.enrolledOfferingIds,
                          })),
                          selectedIds,
                          offering.id,
                        );

                        if (removableIds.length === 0) {
                          return;
                        }

                        setErrorMessage(null);
                        for (const attendeeId of removableIds) {
                          addOptimisticEnrollment({
                            kind: "remove",
                            attendeeId,
                            offeringId: offering.id,
                          });
                        }

                        startTransition(async () => {
                          try {
                            await bulkRemoveAttendeesFromClass({
                              eventId,
                              rosterMemberIds: removableIds,
                              eventClassOfferingId: offering.id,
                              clubId: managedClubId,
                            });
                            router.refresh();
                          } catch (error) {
                            setErrorMessage(error instanceof Error ? error.message : "Unable to bulk remove attendees.");
                          }
                        });
                      }}
                      className="btn-secondary ml-2 px-3 py-2"
                    >
                      Bulk Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}
