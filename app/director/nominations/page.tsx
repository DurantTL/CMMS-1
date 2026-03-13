import { getDirectorNominationPageData, submitNomination } from "../../actions/nomination-actions";
import { getTranslations } from "next-intl/server";
import { getManagedClubContext } from "../../../lib/club-management";

export default async function DirectorNominationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ clubId?: string }>;
}) {
  const t = await getTranslations("Director");
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const managedClub = await getManagedClubContext(resolvedSearchParams?.clubId ?? null);
  const nominationData = await getDirectorNominationPageData(managedClub.clubId);
  const currentYear = new Date().getFullYear();
  const awardTypes = [t("nominations.awardTypes.pathfinderOfTheYear")];

  return (
    <section className="space-y-8">
      <header>
        <p className="text-sm font-medium text-slate-500">{t("nominations.eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t("nominations.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {t("nominations.description", { clubName: nominationData.clubName })}
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{t("nominations.formTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("nominations.formDescription")}
        </p>

        {!nominationData.activeRosterYear || nominationData.activeRosterYear.members.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("nominations.empty")}
          </p>
        ) : (
          <form action={submitNomination} className="mt-6 grid gap-4 md:grid-cols-2">
            {managedClub.isSuperAdmin ? <input type="hidden" name="clubId" value={managedClub.clubId} /> : null}
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>{t("nominations.rosterMember")}</span>
              <select
                name="rosterMemberId"
                required
                defaultValue=""
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="" disabled>
                  {t("nominations.selectMember", { yearLabel: nominationData.activeRosterYear.yearLabel })}
                </option>
                {nominationData.activeRosterYear.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.lastName}, {member.firstName} ({member.memberRole})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>{t("nominations.awardType")}</span>
              <select
                name="awardType"
                required
                defaultValue={awardTypes[0]}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                {awardTypes.map((awardType) => (
                  <option key={awardType} value={awardType}>
                    {awardType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span>{t("nominations.nominationYear")}</span>
              <input
                type="number"
                name="year"
                min={2000}
                max={3000}
                required
                defaultValue={currentYear}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>{t("nominations.justification")}</span>
              <textarea
                name="justificationText"
                rows={5}
                required
                placeholder={t("nominations.justificationPlaceholder")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>{t("nominations.communityService")}</span>
              <textarea
                name="communityServiceDetails"
                rows={5}
                required
                placeholder={t("nominations.communityServicePlaceholder")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              <span>{t("nominations.leadership")}</span>
              <textarea
                name="leadershipDetails"
                rows={5}
                required
                placeholder={t("nominations.leadershipPlaceholder")}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                {t("nominations.submit")}
              </button>
            </div>
          </form>
        )}
      </article>
    </section>
  );
}
