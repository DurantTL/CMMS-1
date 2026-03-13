import Link from "next/link";
import { notFound } from "next/navigation";

import { getCamporeeDashboardData, saveCamporeeScore } from "../../../../actions/camporee-actions";
import { AdminPageHeader } from "../../../_components/admin-page-header";

type CamporeePageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function formatDateRange(startsAt: Date, endsAt: Date) {
  return `${startsAt.toLocaleDateString()} - ${endsAt.toLocaleDateString()}`;
}

export default async function CamporeePage({ params }: CamporeePageProps) {
  const { eventId } = await params;
  const dashboard = await getCamporeeDashboardData(eventId);

  if (!dashboard) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Camporee Scoring"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Events", href: "/admin/events" },
          { label: dashboard.event.name, href: `/admin/events/${dashboard.event.id}` },
          { label: "Camporee" },
        ]}
        title={dashboard.event.name}
        description={formatDateRange(dashboard.event.startsAt, dashboard.event.endsAt)}
        secondaryActions={
          <>
            <Link href={`/admin/events/${dashboard.event.id}`} className="btn-secondary">
              Event Overview
            </Link>
            <Link href={`/admin/events/${dashboard.event.id}/checkin`} className="btn-secondary">
              Open Check-in
            </Link>
          </>
        }
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Record Club Scores</h2>
        <p className="mt-1 text-sm text-slate-600">
          Score submitted or approved club registrations by category. This page is secondary to the module-based Camporee registration flow and only adds competition data onto existing registrations.
        </p>

        {dashboard.event.registrations.length === 0 ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No submitted or approved registrations are available for Camporee scoring yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {dashboard.event.registrations.map((registration) => (
              <div key={registration.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4">
                  <p className="text-base font-semibold text-slate-900">{registration.club.name}</p>
                  <p className="text-xs text-slate-500">
                    {registration.club.code} • {registration.registrationCode} • {registration.attendees.length} attendee
                    {registration.attendees.length === 1 ? "" : "s"} • {registration.status}
                  </p>
                </div>

                <form action={saveCamporeeScore} className="grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="eventId" value={dashboard.event.id} />
                  <input type="hidden" name="registrationId" value={registration.id} />
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Category</span>
                    <input
                      name="category"
                      type="text"
                      list="camporee-category-suggestions"
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Drill, Inspection, Pioneering..."
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span>Score</span>
                    <input
                      name="score"
                      type="number"
                      min="0"
                      step="0.1"
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="95"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
                    <span>Notes</span>
                    <input
                      name="notes"
                      type="text"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="Optional scoring note"
                    />
                  </label>
                  <div className="md:col-span-4">
                    <button
                      type="submit"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    >
                      Save Score
                    </button>
                  </div>
                </form>

                {registration.camporeeScores.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Score</th>
                          <th className="px-3 py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {registration.camporeeScores.map((score) => (
                          <tr key={`${registration.id}-${score.id}`}>
                            <td className="px-3 py-2 text-slate-900">{score.category}</td>
                            <td className="px-3 py-2 text-slate-700">{score.score}</td>
                            <td className="px-3 py-2 text-slate-600">{score.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <datalist id="camporee-category-suggestions">
          {dashboard.categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </article>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Overall Standings</h2>
          {dashboard.totalStandings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No Camporee scores have been recorded yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {dashboard.totalStandings.map((standing) => (
                <li key={standing.registrationId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        #{standing.rank} {standing.clubName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {standing.clubCode} • {standing.scoredCategories.join(", ") || "No categories"}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-indigo-700">{standing.totalScore}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Category Standings</h2>
          {dashboard.categoryStandings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No category scores have been recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {dashboard.categoryStandings.map((standing) => (
                <div key={standing.category} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">{standing.category}</h3>
                  <ol className="mt-3 space-y-2">
                    {standing.entries.map((entry) => (
                      <li key={`${standing.category}-${entry.registrationId}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700">
                          #{entry.rank} {entry.clubName} ({entry.clubCode})
                        </span>
                        <span className="font-semibold text-slate-900">{entry.score}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
