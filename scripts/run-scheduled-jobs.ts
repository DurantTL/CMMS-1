import { parseScheduledJobKeys, runScheduledJobs } from "../lib/scheduled-jobs";

async function main() {
  const requestedJobs = parseScheduledJobKeys(process.argv.slice(2));
  const results = await runScheduledJobs(requestedJobs, new Date());

  for (const result of results) {
    console.log(`[${result.status}] ${result.jobKey}: ${result.summary}`);
  }

  if (results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Scheduled job execution failed.";
  console.error(message);
  process.exitCode = 1;
});
