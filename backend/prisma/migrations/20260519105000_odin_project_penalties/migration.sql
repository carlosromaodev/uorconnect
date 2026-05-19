CREATE TABLE "OdinProjectPenalty" (
  "id" SERIAL PRIMARY KEY,
  "submissionId" INTEGER NOT NULL,
  "penaltyMode" TEXT NOT NULL,
  "requestedVoteCount" INTEGER,
  "removedVoteCount" INTEGER NOT NULL DEFAULT 0,
  "removedPointCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "affectedVoteIdsJson" TEXT,
  "affectedStudentIdsJson" TEXT,
  "affectedScoreEventIdsJson" TEXT,
  "notifiedProjectMembers" BOOLEAN NOT NULL DEFAULT true,
  "createdByStudentNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedByStudentNumber" TEXT,
  "revokeReason" TEXT,
  CONSTRAINT "OdinProjectPenalty_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OdinProjectPenalty_submissionId_createdAt_idx"
  ON "OdinProjectPenalty"("submissionId", "createdAt");
CREATE INDEX "OdinProjectPenalty_penaltyMode_createdAt_idx"
  ON "OdinProjectPenalty"("penaltyMode", "createdAt");
CREATE INDEX "OdinProjectPenalty_createdByStudentNumber_createdAt_idx"
  ON "OdinProjectPenalty"("createdByStudentNumber", "createdAt");
