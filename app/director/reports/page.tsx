import {
  createMonthlyReport,
  deleteClubActivity,
  getDirectorReportsDashboardData,
  saveClubActivity,
} from "../../actions/club-report-actions";
import { formatDateInputValue } from "../../../lib/club-activity";
import { getManagedClubContext } from "../../../lib/club-management";

function formatMonthLabel(reportMonth: Date) {
  return reportMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatActivityDateLabel(activityDate: Date) {
  return activityDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DirectorReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string; month?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);
  const dashboardData = await getDirectorReportsDashboardData(managedClub.clubId, resolvedSearchParams?.month ?? null);

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">Club Reporting</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {dashboardData.clubName} Reporting Engine
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Replace paper submissions by sending your monthly metrics directly to the Conference.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Monthly Activity Auto-Fill</h2>
            <p className="mt-1 text-sm text-slate-600">
              Load a month to review club activities, then submit the monthly report with editable auto-filled values.
            </p>
          </div>

          <form className="flex flex-wrap items-end gap-3">
            {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>Month</span>
              <input
                type="month"
                name="month"
                defaultValue={dashboardData.selectedMonthInput}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
            >
              Load month
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activities logged</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{dashboardData.selectedMonthAutoFill.activityCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Pathfinder attendance</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {dashboardData.selectedMonthAutoFill.averagePathfinderAttendance}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg staff attendance</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {dashboardData.selectedMonthAutoFill.averageStaffAttendance}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg uniform compliance</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {dashboardData.selectedMonthAutoFill.uniformCompliance}%
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          {dashboardData.selectedRosterYear ? (
            <>
              Using roster year <span className="font-semibold text-slate-900">{dashboardData.selectedRosterYear.yearLabel}</span>{" "}
              for {formatMonthLabel(dashboardData.selectedMonth)}. Monthly report values will auto-fill from the logged activities below, but you can still edit them before submit.
            </>
          ) : (
            <>No roster year covers this month yet. Add or activate the correct roster year before logging activity for this month.</>
          )}
          {dashboardData.selectedMonthExistingReport ? (
            <span className="ml-1">
              An existing report already exists for this month, so the form is preloaded with the saved report values.
            </span>
          ) : null}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Start Monthly Report</h2>
        <p className="mt-1 text-sm text-slate-600">
          Points are auto-calculated when you submit: {dashboardData.rubric.pointsPerMeeting} points per
          meeting, {dashboardData.rubric.pointsPerPathfinderAttendance} per Pathfinder average attendance,
          {dashboardData.rubric.pointsPerStaffAttendance} per staff average attendance, plus uniform
          compliance bonus up to {dashboardData.rubric.maxUniformPoints}.
        </p>

        <form action={createMonthlyReport} className="mt-6 grid gap-4 md:grid-cols-2">
          {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Report month</span>
            <input
              type="month"
              name="reportMonth"
              required
              defaultValue={dashboardData.selectedMonthInput}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Number of meetings</span>
            <input
              type="number"
              name="meetingCount"
              min={0}
              required
              defaultValue={dashboardData.selectedMonthFormValues.meetingCount}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Average Pathfinder attendance</span>
            <input
              type="number"
              name="averagePathfinderAttendance"
              min={0}
              required
              defaultValue={dashboardData.selectedMonthFormValues.averagePathfinderAttendance}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Average staff attendance</span>
            <input
              type="number"
              name="averageStaffAttendance"
              min={0}
              required
              defaultValue={dashboardData.selectedMonthFormValues.averageStaffAttendance}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
            <span>Uniform compliance (%)</span>
            <input
              type="number"
              name="uniformCompliance"
              min={0}
              max={100}
              required
              defaultValue={dashboardData.selectedMonthFormValues.uniformCompliance}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Submit Monthly Report
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Log Club Activities</h2>
            <p className="mt-1 text-sm text-slate-600">
              Log activities for {formatMonthLabel(dashboardData.selectedMonth)} so the monthly report can auto-fill from real attendance data.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {dashboardData.selectedMonthActivities.length} activit{dashboardData.selectedMonthActivities.length === 1 ? "y" : "ies"} in this month
          </p>
        </div>

        <form action={saveClubActivity} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Activity date</span>
            <input
              type="date"
              name="activityDate"
              required
              defaultValue={`${dashboardData.selectedMonthInput}-01`}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Activity title</span>
            <input
              type="text"
              name="title"
              required
              placeholder="Club meeting, drill practice, outreach night..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Pathfinder attendance</span>
            <input
              type="number"
              name="pathfinderAttendance"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Staff attendance</span>
            <input
              type="number"
              name="staffAttendance"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Uniform compliance (%)</span>
            <input
              type="number"
              name="uniformCompliance"
              min={0}
              max={100}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
            <span>Notes</span>
            <textarea
              name="notes"
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Save activity
            </button>
          </div>
        </form>

        {dashboardData.selectedMonthActivities.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">
            No club activities have been logged for this month yet.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {dashboardData.selectedMonthActivities.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                    <p className="text-xs text-slate-500">{formatActivityDateLabel(activity.activityDate)}</p>
                  </div>
                  <form action={deleteClubActivity}>
                    {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
                    <input type="hidden" name="activityId" value={activity.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </form>
                </div>

                <form action={saveClubActivity} className="grid gap-4 md:grid-cols-2">
                  {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
                  <input type="hidden" name="activityId" value={activity.id} />
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Activity date</span>
                    <input
                      type="date"
                      name="activityDate"
                      required
                      defaultValue={formatDateInputValue(activity.activityDate)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Activity title</span>
                    <input
                      type="text"
                      name="title"
                      required
                      defaultValue={activity.title}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Pathfinder attendance</span>
                    <input
                      type="number"
                      name="pathfinderAttendance"
                      min={0}
                      required
                      defaultValue={activity.pathfinderAttendance}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Staff attendance</span>
                    <input
                      type="number"
                      name="staffAttendance"
                      min={0}
                      required
                      defaultValue={activity.staffAttendance}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Uniform compliance (%)</span>
                    <input
                      type="number"
                      name="uniformCompliance"
                      min={0}
                      max={100}
                      required
                      defaultValue={activity.uniformCompliance}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
                    <span>Notes</span>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={activity.notes ?? ""}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
                    >
                      Save changes
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Recent Monthly Submissions</h2>
        {dashboardData.recentReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No monthly reports have been submitted yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Meetings</th>
                  <th className="px-4 py-3">Uniform %</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboardData.recentReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMonthLabel(report.reportMonth)}</td>
                    <td className="px-4 py-3 text-slate-700">{report.meetingCount}</td>
                    <td className="px-4 py-3 text-slate-700">{report.uniformCompliance}%</td>
                    <td className="px-4 py-3 text-slate-700">{report.pointsCalculated}</td>
                    <td className="px-4 py-3 text-slate-700">{report.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
