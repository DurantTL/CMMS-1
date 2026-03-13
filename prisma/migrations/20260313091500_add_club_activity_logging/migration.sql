-- CreateTable
CREATE TABLE "ClubActivity" (
    "id" TEXT NOT NULL,
    "clubRosterYearId" TEXT NOT NULL,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "pathfinderAttendance" INTEGER NOT NULL,
    "staffAttendance" INTEGER NOT NULL,
    "uniformCompliance" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubActivity_clubRosterYearId_activityDate_idx" ON "ClubActivity"("clubRosterYearId", "activityDate");

-- AddForeignKey
ALTER TABLE "ClubActivity" ADD CONSTRAINT "ClubActivity_clubRosterYearId_fkey" FOREIGN KEY ("clubRosterYearId") REFERENCES "ClubRosterYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
