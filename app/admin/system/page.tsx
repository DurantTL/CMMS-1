import { redirect } from "next/navigation";

import { auth } from "../../../auth";
import { readDeployStatus } from "../../../lib/system-update";
import { AdminPageHeader } from "../_components/admin-page-header";
import { UpdateButton } from "./_components/update-button";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default async function AdminSystemUpdatePage() {
  const session = await auth();

  // The admin layout already gates this, but guard defensively for an
  // operation that can restart production.
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const status = await readDeployStatus();
  const updateAvailable = status?.updateAvailable ?? false;
  const inProgress = status?.inProgress ?? false;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform Controls"
        breadcrumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "System Update" },
        ]}
        title="System Update"
        description="Pull the latest CMMS code and rebuild without using SSH."
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Current deployment</h2>

        {status ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Running commit
              </dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">
                {status.currentCommitShort ?? "unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Latest available
              </dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">
                {status.remoteCommitShort ?? "unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd className="mt-1 text-sm">
                {inProgress ? (
                  <span className="font-medium text-amber-700">Update in progress…</span>
                ) : updateAvailable ? (
                  <span className="font-medium text-indigo-700">Update available</span>
                ) : (
                  <span className="font-medium text-emerald-700">Up to date</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Last checked
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {formatTimestamp(status.lastCheckedAt)}
              </dd>
            </div>
            {status.lastUpdate ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Last update
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  <span
                    className={
                      status.lastUpdate.status === "success"
                        ? "font-medium text-emerald-700"
                        : "font-medium text-rose-700"
                    }
                  >
                    {status.lastUpdate.status === "success" ? "Succeeded" : "Failed"}
                  </span>{" "}
                  at {formatTimestamp(status.lastUpdate.at)}
                  {status.lastUpdate.requestedByEmail
                    ? ` · requested by ${status.lastUpdate.requestedByEmail}`
                    : null}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No deployment status is available yet. This usually means the host-side updater agent
            has not been installed or has not run. The button below will still record an update
            request, but nothing will happen until the agent is running. See
            <span className="font-mono"> XCLOUD-DEPLOYMENT.md</span> for setup.
          </p>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Run update</h2>
        <p className="mt-1 text-sm text-slate-600">
          This signals the host to run <span className="font-mono">git pull</span> and rebuild the
          app. The page cannot report completion live because the app restarts — reload after a
          minute to confirm the running commit changed.
        </p>
        <UpdateButton inProgress={inProgress} />
      </article>
    </section>
  );
}
