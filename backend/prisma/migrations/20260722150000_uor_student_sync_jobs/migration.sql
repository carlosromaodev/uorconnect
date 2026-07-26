-- Durable UOR Estudante orchestration. Provider snapshots remain owned by
-- Moodle/Secretaria; this table only coordinates automatic work.

CREATE TABLE "UorStudentSyncJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseUntil" DATETIME,
  "heartbeatAt" DATETIME,
  "providerRunId" TEXT,
  "lastErrorCode" TEXT,
  "startedAt" DATETIME,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentSyncJob_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UorStudentSyncJob_studentId_idempotencyKey_key"
  ON "UorStudentSyncJob"("studentId", "idempotencyKey");
CREATE INDEX "UorStudentSyncJob_status_nextAttemptAt_leaseUntil_createdAt_idx"
  ON "UorStudentSyncJob"("status", "nextAttemptAt", "leaseUntil", "createdAt");
CREATE INDEX "UorStudentSyncJob_studentId_provider_createdAt_idx"
  ON "UorStudentSyncJob"("studentId", "provider", "createdAt");
CREATE INDEX "UorStudentSyncJob_institutionCode_provider_status_idx"
  ON "UorStudentSyncJob"("institutionCode", "provider", "status");
