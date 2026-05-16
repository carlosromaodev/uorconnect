CREATE TABLE IF NOT EXISTS "ExhibitorScoreConfig" (
  "id" SERIAL PRIMARY KEY,
  "version" INTEGER NOT NULL,
  "eventKey" TEXT NOT NULL DEFAULT 'main-event',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "weightsJson" TEXT NOT NULL DEFAULT '{}',
  "roundsJson" TEXT NOT NULL DEFAULT '[]',
  "streakBonusesJson" TEXT NOT NULL DEFAULT '[]',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "createdByStudentNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExhibitorScoreConfig_version_key"
  ON "ExhibitorScoreConfig"("version");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreConfig_eventKey_active_idx"
  ON "ExhibitorScoreConfig"("eventKey", "active");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreConfig_status_updatedAt_idx"
  ON "ExhibitorScoreConfig"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreConfig_lockedAt_idx"
  ON "ExhibitorScoreConfig"("lockedAt");

CREATE TABLE IF NOT EXISTS "ExhibitorScoreEvent" (
  "id" SERIAL PRIMARY KEY,
  "businessKey" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL DEFAULT 'main-event',
  "submissionId" INTEGER NOT NULL,
  "studentId" INTEGER,
  "actorStudentId" INTEGER,
  "submissionMemberId" INTEGER,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "action" TEXT NOT NULL,
  "role" TEXT,
  "roundKey" TEXT,
  "roundLabel" TEXT,
  "voterCourse" TEXT,
  "submissionCourse" TEXT,
  "basePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bonusPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'VALID',
  "reason" TEXT,
  "metadataJson" TEXT,
  "scoreConfigVersion" INTEGER NOT NULL DEFAULT 1,
  "lockedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByStudentNumber" TEXT,
  "revokeReason" TEXT,
  "createdByStudentNumber" TEXT,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExhibitorScoreEvent_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExhibitorScoreEvent_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExhibitorScoreEvent_actorStudentId_fkey"
    FOREIGN KEY ("actorStudentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExhibitorScoreEvent_submissionMemberId_fkey"
    FOREIGN KEY ("submissionMemberId") REFERENCES "SubmissionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExhibitorScoreEvent_businessKey_key"
  ON "ExhibitorScoreEvent"("businessKey");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_eventKey_action_idx"
  ON "ExhibitorScoreEvent"("eventKey", "action");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_submissionId_status_awardedAt_idx"
  ON "ExhibitorScoreEvent"("submissionId", "status", "awardedAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_studentId_awardedAt_idx"
  ON "ExhibitorScoreEvent"("studentId", "awardedAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_actorStudentId_awardedAt_idx"
  ON "ExhibitorScoreEvent"("actorStudentId", "awardedAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_submissionMemberId_awardedAt_idx"
  ON "ExhibitorScoreEvent"("submissionMemberId", "awardedAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_sourceType_sourceId_idx"
  ON "ExhibitorScoreEvent"("sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_scoreConfigVersion_idx"
  ON "ExhibitorScoreEvent"("scoreConfigVersion");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_lockedAt_idx"
  ON "ExhibitorScoreEvent"("lockedAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreEvent_status_awardedAt_idx"
  ON "ExhibitorScoreEvent"("status", "awardedAt");

CREATE TABLE IF NOT EXISTS "ExhibitorScoreRankingFreeze" (
  "id" SERIAL PRIMARY KEY,
  "eventKey" TEXT NOT NULL DEFAULT 'main-event',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "snapshotJson" TEXT NOT NULL,
  "frozenByStudentNumber" TEXT,
  "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ExhibitorScoreRankingFreeze_eventKey_active_frozenAt_idx"
  ON "ExhibitorScoreRankingFreeze"("eventKey", "active", "frozenAt");
CREATE INDEX IF NOT EXISTS "ExhibitorScoreRankingFreeze_frozenByStudentNumber_frozenAt_idx"
  ON "ExhibitorScoreRankingFreeze"("frozenByStudentNumber", "frozenAt");

ALTER TABLE "StudentComment"
  ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "StudentComment"
  ADD COLUMN IF NOT EXISTS "feedbackReviewedAt" TIMESTAMP(3);
ALTER TABLE "StudentComment"
  ADD COLUMN IF NOT EXISTS "feedbackReviewedByStudentNumber" TEXT;
ALTER TABLE "StudentComment"
  ADD COLUMN IF NOT EXISTS "feedbackReviewNote" TEXT;
ALTER TABLE "StudentComment"
  ADD COLUMN IF NOT EXISTS "feedbackScoredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "StudentComment_moderationStatus_createdAt_idx"
  ON "StudentComment"("moderationStatus", "createdAt");

ALTER TABLE "SubmissionMember"
  ADD COLUMN IF NOT EXISTS "isExternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SubmissionMember"
  ADD COLUMN IF NOT EXISTS "externalOrganization" TEXT;
ALTER TABLE "SubmissionMember"
  ADD COLUMN IF NOT EXISTS "externalReason" TEXT;
ALTER TABLE "SubmissionMember"
  ADD COLUMN IF NOT EXISTS "exceptionApprovedAt" TIMESTAMP(3);
ALTER TABLE "SubmissionMember"
  ADD COLUMN IF NOT EXISTS "exceptionApprovedByStudentNumber" TEXT;

CREATE INDEX IF NOT EXISTS "SubmissionMember_isExternal_exceptionApprovedAt_idx"
  ON "SubmissionMember"("isExternal", "exceptionApprovedAt");
