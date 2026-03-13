import assert from "node:assert/strict";
import test from "node:test";
import { AuthRateLimitScope } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { runAuthRateLimitCleanupJob } from "../lib/scheduled-jobs";
import {
  disconnectIntegrationPrisma,
  hasIntegrationDatabase,
  requireIntegrationDatabase,
  resetIntegrationDatabase,
} from "./integration-helpers";

test("auth rate-limit scheduled cleanup is idempotent per UTC day", { skip: !hasIntegrationDatabase }, async () => {
  const ready = await requireIntegrationDatabase();
  if (!ready) {
    return;
  }

  await resetIntegrationDatabase();

  await prisma.authRateLimitBucket.create({
    data: {
      keyHash: "bucket-1",
      scopeType: AuthRateLimitScope.IP,
      attemptCount: 4,
      windowStartedAt: new Date("2026-03-11T00:00:00.000Z"),
      blockedUntil: null,
    },
  });

  const runDate = new Date("2026-03-12T12:00:00.000Z");
  const firstRun = await runAuthRateLimitCleanupJob(runDate);
  const secondRun = await runAuthRateLimitCleanupJob(runDate);

  assert.equal(firstRun.status, "completed");
  assert.match(firstRun.summary, /Deleted 1 expired auth rate-limit bucket/);
  assert.equal(secondRun.status, "skipped");
  assert.match(secondRun.summary, /already ran for this UTC day/);

  const bucketCount = await prisma.authRateLimitBucket.count();
  const runCount = await prisma.scheduledJobRun.count({
    where: {
      jobKey: "auth-rate-limit-cleanup",
    },
  });

  assert.equal(bucketCount, 0);
  assert.equal(runCount, 1);
});

test.after(async () => {
  await disconnectIntegrationPrisma();
});
