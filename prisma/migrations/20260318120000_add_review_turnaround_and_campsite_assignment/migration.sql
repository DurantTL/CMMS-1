-- AlterTable
ALTER TABLE "Event" ADD COLUMN "reviewTurnaroundDays" INTEGER;

-- NOTE: "EventRegistration"."campsiteAssignment" is already created by the
-- earlier migration 20260318100000_add_campsite_assignment. Re-adding it here
-- breaks `prisma migrate deploy` on a fresh database ("column already exists"),
-- so the duplicate ADD COLUMN has been removed.
