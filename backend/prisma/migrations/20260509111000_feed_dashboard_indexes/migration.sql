CREATE INDEX IF NOT EXISTS "Submission_status_createdAt_idx"
  ON "Submission"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Submission_type_status_createdAt_idx"
  ON "Submission"("type", "status", "createdAt");
