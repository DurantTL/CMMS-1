-- CreateTable
CREATE TABLE "CamporeeScore" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventRegistrationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CamporeeScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CamporeeScore_eventRegistrationId_category_key" ON "CamporeeScore"("eventRegistrationId", "category");

-- CreateIndex
CREATE INDEX "CamporeeScore_eventId_category_score_idx" ON "CamporeeScore"("eventId", "category", "score");

-- CreateIndex
CREATE INDEX "CamporeeScore_createdByUserId_createdAt_idx" ON "CamporeeScore"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "CamporeeScore" ADD CONSTRAINT "CamporeeScore_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CamporeeScore" ADD CONSTRAINT "CamporeeScore_eventRegistrationId_fkey" FOREIGN KEY ("eventRegistrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CamporeeScore" ADD CONSTRAINT "CamporeeScore_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
