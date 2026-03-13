import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import {
  getOperationalAvCsv,
  getOperationalDutyCsv,
  getOperationalReports,
  getOperationalSpiritualCsv,
} from "../../../../../actions/report-actions";
import {
  AvReportTable,
  DutyReportTable,
  ExportCsvButton,
  SpiritualReportTable,
} from "./_components/report-tables";
import { AdminPageHeader } from "../../../../_components/admin-page-header";

function formatDateRange(startsAt: Date, endsAt: Date, locale: string) {
  return `${startsAt.toLocaleDateString(locale)} - ${endsAt.toLocaleDateString(locale)}`;
}

type OperationalReportsPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function OperationalReportsPage({ params }: OperationalReportsPageProps) {
  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const { eventId } = await params;

  const report = await getOperationalReports(eventId);

  if (!report) {
    notFound();
  }

  const [spiritualCsv, dutyCsv, avCsv] = await Promise.all([
    getOperationalSpiritualCsv(eventId),
    getOperationalDutyCsv(eventId),
    getOperationalAvCsv(eventId),
  ]);

  const spiritualCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(spiritualCsv.content)}`;
  const dutyCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(dutyCsv.content)}`;
  const avCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(avCsv.content)}`;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow={t("breadcrumbs.operationalReports")}
        breadcrumbs={[
          { label: t("breadcrumbs.admin"), href: "/admin/dashboard" },
          { label: t("breadcrumbs.events"), href: "/admin/events" },
          { label: report.event.name, href: `/admin/events/${eventId}` },
          { label: t("breadcrumbs.operationalReports") },
        ]}
        title={t("breadcrumbs.operationalReports")}
        description={t("pages.operationalReports.spiritualDescription")}
        secondaryActions={
          <Link href={`/admin/events/${eventId}`} className="btn-secondary">
            {t("actions.backToEvent")}
          </Link>
        }
        details={
          <>
            <div>
              <dt className="font-semibold text-slate-900">{t("pages.events.columns.event")}</dt>
              <dd>{report.event.name}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">{t("pages.events.columns.dates")}</dt>
              <dd>{formatDateRange(report.event.startsAt, report.event.endsAt, locale)}</dd>
            </div>
          </>
        }
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("pages.operationalReports.spiritualTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("pages.operationalReports.spiritualDescription")}
            </p>
          </div>
          <ExportCsvButton href={spiritualCsvHref} fileName={spiritualCsv.fileName} label={t("actions.exportCsv")} />
        </div>

        <SpiritualReportTable rows={report.spiritualRows} />
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("pages.operationalReports.dutyTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("pages.operationalReports.dutyDescription")}
            </p>
          </div>
          <ExportCsvButton href={dutyCsvHref} fileName={dutyCsv.fileName} label={t("actions.exportCsv")} />
        </div>

        <DutyReportTable rows={report.dutyRows} />
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{t("pages.operationalReports.avTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("pages.operationalReports.avDescription")}
            </p>
          </div>
          <ExportCsvButton href={avCsvHref} fileName={avCsv.fileName} label={t("actions.exportCsv")} />
        </div>

        <AvReportTable rows={report.avRows} />
      </article>
    </section>
  );
}
