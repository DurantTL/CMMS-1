-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJobRun_jobKey_scopeKey_runDate_key" ON "ScheduledJobRun"("jobKey", "scopeKey", "runDate");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_jobKey_runDate_idx" ON "ScheduledJobRun"("jobKey", "runDate");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_createdAt_idx" ON "ScheduledJobRun"("createdAt");
