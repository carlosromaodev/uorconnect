-- Durable, idempotent Secretaria command engine for individually approved writes.

CREATE TABLE "SecretariaCommand" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "risk" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "payloadEnvelope" TEXT NOT NULL,
  "connectionGeneration" INTEGER NOT NULL,
  "resultEnvelope" TEXT,
  "errorCode" TEXT,
  "confirmationExpiresAt" DATETIME,
  "submittedAt" DATETIME,
  "leaseUntil" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SecretariaCommand_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SecretariaCommandAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "commandId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseHash" TEXT,
  "errorCode" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  CONSTRAINT "SecretariaCommandAttempt_commandId_fkey"
    FOREIGN KEY ("commandId") REFERENCES "SecretariaCommand" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SecretariaCommand_studentId_type_idempotencyKey_key"
  ON "SecretariaCommand"("studentId", "type", "idempotencyKey");
CREATE INDEX "SecretariaCommand_studentId_createdAt_idx"
  ON "SecretariaCommand"("studentId", "createdAt");
CREATE INDEX "SecretariaCommand_status_updatedAt_idx"
  ON "SecretariaCommand"("status", "updatedAt");
CREATE UNIQUE INDEX "SecretariaCommandAttempt_commandId_attempt_key"
  ON "SecretariaCommandAttempt"("commandId", "attempt");
CREATE INDEX "SecretariaCommandAttempt_commandId_startedAt_idx"
  ON "SecretariaCommandAttempt"("commandId", "startedAt");
