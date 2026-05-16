ALTER TABLE "TeamMembership" ADD COLUMN "verifiedAt" DATETIME;
ALTER TABLE "TeamMembership" ADD COLUMN "verifiedByStudentNumber" TEXT;

CREATE INDEX "TeamMembership_verifiedAt_idx" ON "TeamMembership"("verifiedAt");
