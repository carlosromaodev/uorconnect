CREATE TABLE "CredentialPrintBatch" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'MIXED',
  "status" TEXT NOT NULL DEFAULT 'READY',
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "createdByStudentNumber" TEXT,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CredentialPrintBatchItem" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "batchId" INTEGER NOT NULL,
  "credentialId" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "label" TEXT,
  "itemType" TEXT NOT NULL DEFAULT 'NOMINAL',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CredentialPrintBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CredentialPrintBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CredentialPrintBatchItem_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "EventTeamCredential" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CredentialPrintBatch_code_key" ON "CredentialPrintBatch"("code");
CREATE INDEX "CredentialPrintBatch_mode_createdAt_idx" ON "CredentialPrintBatch"("mode", "createdAt");
CREATE INDEX "CredentialPrintBatch_status_createdAt_idx" ON "CredentialPrintBatch"("status", "createdAt");

CREATE UNIQUE INDEX "CredentialPrintBatchItem_batchId_credentialId_key" ON "CredentialPrintBatchItem"("batchId", "credentialId");
CREATE UNIQUE INDEX "CredentialPrintBatchItem_batchId_position_key" ON "CredentialPrintBatchItem"("batchId", "position");
CREATE INDEX "CredentialPrintBatchItem_credentialId_idx" ON "CredentialPrintBatchItem"("credentialId");
