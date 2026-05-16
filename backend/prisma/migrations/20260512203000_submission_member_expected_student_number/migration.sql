ALTER TABLE "SubmissionMember" ADD COLUMN IF NOT EXISTS "expectedStudentNumber" TEXT;

CREATE INDEX IF NOT EXISTS "SubmissionMember_submissionId_expectedStudentNumber_idx"
  ON "SubmissionMember"("submissionId", "expectedStudentNumber");
