-- Add isPublished to Event model (safe default: false keeps all existing events unpublished)
ALTER TABLE "Event" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- Add EventBroadcast model for tracking message broadcasts to registered directors
CREATE TABLE "EventBroadcast" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,

    CONSTRAINT "EventBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventBroadcast_eventId_sentAt_idx" ON "EventBroadcast"("eventId", "sentAt");

ALTER TABLE "EventBroadcast" ADD CONSTRAINT "EventBroadcast_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
