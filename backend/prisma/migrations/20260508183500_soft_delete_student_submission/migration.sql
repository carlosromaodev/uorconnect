ALTER TABLE "Student" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Student" ADD COLUMN "deletionReason" TEXT;

ALTER TABLE "Submission" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "deletedByStudentNumber" TEXT;
ALTER TABLE "Submission" ADD COLUMN "deletionReason" TEXT;

CREATE INDEX IF NOT EXISTS "Student_deletedAt_idx" ON "Student"("deletedAt");
CREATE INDEX IF NOT EXISTS "Submission_deletedAt_idx" ON "Submission"("deletedAt");
