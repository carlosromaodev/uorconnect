-- Challenge lifecycle, review notes and answer versioning.
ALTER TABLE "PassportChallenge"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "PassportChallenge"
SET "status" = CASE
  WHEN "active" = true THEN 'APPROVED'
  WHEN "approvedAt" IS NOT NULL THEN 'PAUSED'
  ELSE 'PENDING_APPROVAL'
END;

ALTER TABLE "PassportChallengeAnswer"
  ADD COLUMN "challengeVersion" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "PassportChallengeAnswer_challengeId_studentNumber_attemptNumber_key";
CREATE UNIQUE INDEX "PassportChallengeAnswer_challengeId_studentNumber_challengeVersion_attemptNumber_key"
  ON "PassportChallengeAnswer"("challengeId", "studentNumber", "challengeVersion", "attemptNumber");

CREATE INDEX "PassportChallenge_status_updatedAt_idx" ON "PassportChallenge"("status", "updatedAt");
