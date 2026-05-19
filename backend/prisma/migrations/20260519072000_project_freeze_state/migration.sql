ALTER TABLE "Submission" ADD COLUMN "projectFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Submission" ADD COLUMN "projectFrozenAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN "projectFrozenByStudentNumber" TEXT;
ALTER TABLE "Submission" ADD COLUMN "projectFreezeReason" TEXT;

CREATE INDEX "Submission_projectFrozen_status_createdAt_idx" ON "Submission"("projectFrozen", "status", "createdAt");
