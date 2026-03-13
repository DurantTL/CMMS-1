import {
  createMonthlyReport,
  deleteClubActivity,
  getDirectorReportsDashboardData,
  saveClubActivity,
} from "../../actions/club-report-actions";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateInputValue } from "../../../lib/club-activity";
import { getManagedClubContext } from "../../../lib/club-management";

function formatMonthLabel(reportMonth: Date, locale: string) {
  return reportMonth.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

function formatActivityDateLabel(activityDate: Date, locale: string) {
  return activityDate.toLocaleDateString(locale, {
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
  const t = await getTranslations("Director");
  const locale = await getLocale();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);
  const dashboardData = await getDirectorReportsDashboardData(managedClub.clubId, resolvedSearchParams?.month ?? null);

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">{t("reports.eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {t("reports.title", { clubName: dashboardData.clubName })}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("reports.description")}
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("reports.autoFillTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("reports.autoFillDescription")}
            </p>
          </div>

          <form className="flex flex-wrap items-end gap-3">
            {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>{t("reports.month")}</span>
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
              {t("reports.loadMonth")}
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("reports.activitiesLogged")}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{dashboardData.selectedMonthAutoFill.activityCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("reports.avgPathfinderAttendance")}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {dashboardData.selectedMonthAutoFill.averagePathfinderAttendance}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("reports.avgStaffAttendance")}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {dashboardData.selectedMonthAutoFill.averageStaffAttendance}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("reports.avgUniformCompliance")}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {dashboardData.selectedMonthAutoFill.uniformCompliance}%
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          {dashboardData.selectedRosterYear ? (
            <>
              {t("reports.usingRosterYear", {
                yearLabel: dashboardData.selectedRosterYear.yearLabel,
                month: formatMonthLabel(dashboardData.selectedMonth, locale),
              })}
            </>
          ) : (
            <>{t("reports.noRosterYearForMonth")}</>
          )}
          {dashboardData.selectedMonthExistingReport ? (
            <span className="ml-1">
              {t("reports.existingReport")}
            </span>
          ) : null}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("reports.monthlyReportTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("reports.monthlyReportDescription", {
            meetings: dashboardData.rubric.pointsPerMeeting,
            pathfinder: dashboardData.rubric.pointsPerPathfinderAttendance,
            staff: dashboardData.rubric.pointsPerStaffAttendance,
            uniformMax: dashboardData.rubric.maxUniformPoints,
          })}
        </p>

        <form action={createMonthlyReport} className="mt-6 grid gap-4 md:grid-cols-2">
          {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.reportMonth")}</span>
            <input
              type="month"
              name="reportMonth"
              required
              defaultValue={dashboardData.selectedMonthInput}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.meetingCount")}</span>
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
            <span>{t("reports.averagePathfinderAttendance")}</span>
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
            <span>{t("reports.averageStaffAttendance")}</span>
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
            <span>{t("reports.uniformCompliance")}</span>
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
              {t("reports.submitMonthlyReport")}
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("reports.activityTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("reports.activityDescription", { month: formatMonthLabel(dashboardData.selectedMonth, locale) })}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {t("common.activitiesInMonth", { count: dashboardData.selectedMonthActivities.length })}
          </p>
        </div>

        <form action={saveClubActivity} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
          {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.activityDate")}</span>
            <input
              type="date"
              name="activityDate"
              required
              defaultValue={`${dashboardData.selectedMonthInput}-01`}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.activityTitleLabel")}</span>
            <input
              type="text"
              name="title"
              required
              placeholder={t("reports.activityTitlePlaceholder")}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.pathfinderAttendance")}</span>
            <input
              type="number"
              name="pathfinderAttendance"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.staffAttendance")}</span>
            <input
              type="number"
              name="staffAttendance"
              min={0}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>{t("reports.uniformCompliance")}</span>
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
            <span>{t("reports.notes")}</span>
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
              {t("reports.saveActivity")}
            </button>
          </div>
        </form>

        {dashboardData.selectedMonthActivities.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">
            {t("reports.noActivities")}
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {dashboardData.selectedMonthActivities.map((activity) => (
              <div key={activity.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                    <p className="text-xs text-slate-500">{formatActivityDateLabel(activity.activityDate, locale)}</p>
                  </div>
                  <form action={deleteClubActivity}>
                    {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
                    <input type="hidden" name="activityId" value={activity.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                    >
                      {t("reports.delete")}
                    </button>
                  </form>
                </div>

                <form action={saveClubActivity} className="grid gap-4 md:grid-cols-2">
                  {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
                  <input type="hidden" name="activityId" value={activity.id} />
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>{t("reports.activityDate")}</span>
                    <input
                      type="date"
                      name="activityDate"
                      required
                      defaultValue={formatDateInputValue(activity.activityDate)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>{t("reports.activityTitleLabel")}</span>
                    <input
                      type="text"
                      name="title"
                      required
                      defaultValue={activity.title}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>{t("reports.pathfinderAttendance")}</span>
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
                    <span>{t("reports.staffAttendance")}</span>
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
                    <span>{t("reports.uniformCompliance")}</span>
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
                    <span>{t("reports.notes")}</span>
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
                      {t("reports.saveChanges")}
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("reports.recentSubmissions")}</h2>
        {dashboardData.recentReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{t("reports.noRecentReports")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("reports.table.month")}</th>
                  <th className="px-4 py-3">{t("reports.table.meetings")}</th>
                  <th className="px-4 py-3">{t("reports.table.uniform")}</th>
                  <th className="px-4 py-3">{t("reports.table.points")}</th>
                  <th className="px-4 py-3">{t("reports.table.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dashboardData.recentReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMonthLabel(report.reportMonth, locale)}</td>
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
