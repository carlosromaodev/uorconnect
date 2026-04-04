ALTER TABLE "Submission" ADD COLUMN "studentId" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "studentNumberSnapshot" TEXT;

CREATE INDEX IF NOT EXISTS "Submission_studentId_createdAt_idx"
ON "Submission"("studentId", "createdAt");
