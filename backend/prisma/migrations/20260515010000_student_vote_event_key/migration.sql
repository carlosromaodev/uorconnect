ALTER TABLE "StudentVote"
  ADD COLUMN IF NOT EXISTS "eventKey" TEXT NOT NULL DEFAULT 'main-event';

DROP INDEX IF EXISTS "StudentVote_studentId_submissionId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "StudentVote_studentId_submissionId_eventKey_key"
  ON "StudentVote"("studentId", "submissionId", "eventKey");

CREATE INDEX IF NOT EXISTS "StudentVote_submissionId_eventKey_createdAt_idx"
  ON "StudentVote"("submissionId", "eventKey", "createdAt");
