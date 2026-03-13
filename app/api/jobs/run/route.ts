import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  isScheduledJobAuthorized,
  parseScheduledJobKeys,
  runScheduledJobs,
} from "../../../../lib/scheduled-jobs";

export const runtime = "nodejs";

async function readRequestedJobs(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryJobs = searchParams.getAll("job");

  if (queryJobs.length > 0) {
    return parseScheduledJobKeys(queryJobs);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return parseScheduledJobKeys(undefined);
  }

  const body = await request.json().catch(() => ({})) as { jobs?: unknown; job?: unknown };
  return parseScheduledJobKeys(body.jobs ?? body.job);
}

function revalidateScheduledJobPaths(jobKeys: string[]) {
  revalidatePath("/admin/audit");

  if (jobKeys.includes("inactive-insurance-card-cleanup")) {
    revalidatePath("/admin/storage");
  }
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET ?? null;

  if (!isScheduledJobAuthorized(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const jobKeys = await readRequestedJobs(request);
    const results = await runScheduledJobs(jobKeys, new Date());

    revalidateScheduledJobPaths(jobKeys);

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled job execution failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
