import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { getAdminReportsData } from "../../actions/club-report-actions";
import { AdminPageHeader } from "../_components/admin-page-header";

type ReportsPageProps = {
  searchParams?: Promise<{
    sort?: string;
    direction?: string;
  }>;
};

function formatMonth(reportMonth: Date, locale: string) {
  return reportMonth.toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
  });
}

function parseSort(value: string | undefined) {
  return value === "club" ? "club" : "month";
}

function parseDirection(value: string | undefined) {
  return value === "asc" ? "asc" : "desc";
}

function getDirectionToggle(currentDirection: "asc" | "desc") {
  return currentDirection === "asc" ? "desc" : "asc";
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const resolvedSearchParams = await searchParams;
  const sortBy = parseSort(resolvedSearchParams?.sort);
  const direction = parseDirection(resolvedSearchParams?.direction);
  const nextDirection = getDirectionToggle(direction);

  const reportData = await getAdminReportsData(sortBy, direction);

  return (
    <section className="space-y-8">
      <AdminPageHeader
        eyebrow={t("pages.reports.eyebrow")}
        breadcrumbs={[{ label: t("breadcrumbs.admin"), href: "/admin/dashboard" }, { label: t("breadcrumbs.reports") }]}
        title={t("pages.reports.title")}
        description={t("pages.reports.description")}
        secondaryActions={
          <>
            <Link
              href={`/admin/reports?sort=club&direction=${sortBy === "club" ? nextDirection : "asc"}`}
              className="btn-secondary"
            >
              {t("actions.sortByClub")}
            </Link>
            <Link
              href={`/admin/reports?sort=month&direction=${sortBy === "month" ? nextDirection : "desc"}`}
              className="btn-secondary"
            >
              {t("actions.sortByMonth")}
            </Link>
          </>
        }
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("pages.reports.monthlyTitle")}</h2>
        {reportData.monthlyReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{t("pages.reports.monthlyEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("pages.reports.columns.club")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.code")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.reportMonth")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.meetings")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.uniform")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.points")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.submitted")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.monthlyReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{report.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{report.club.code}</td>
                    <td className="px-4 py-3 text-slate-700">{formatMonth(report.reportMonth, locale)}</td>
                    <td className="px-4 py-3 text-slate-700">{report.meetingCount}</td>
                    <td className="px-4 py-3 text-slate-700">{report.uniformCompliance}%</td>
                    <td className="px-4 py-3 text-slate-700">{report.pointsCalculated}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {report.submittedAt ? report.submittedAt.toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("pages.reports.yearEndTitle")}</h2>
        {reportData.yearEndReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{t("pages.reports.yearEndEmpty")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("pages.reports.columns.club")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.year")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.friend")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.companion")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.explorer")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.ranger")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.voyager")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.guide")}</th>
                  <th className="px-4 py-3">{t("pages.reports.columns.submitted")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.yearEndReports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{report.club.name}</td>
                    <td className="px-4 py-3 text-slate-700">{report.reportYear}</td>
                    <td className="px-4 py-3 text-slate-700">{report.friendCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.companionCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.explorerCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.rangerCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.voyagerCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">{report.guideCompletions}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {report.submittedAt ? report.submittedAt.toLocaleDateString() : "-"}
                    </td>
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
