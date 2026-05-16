CREATE TABLE IF NOT EXISTS "PdfDocumentJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "businessKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "fileName" TEXT NOT NULL,
  "filePath" TEXT,
  "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
  "sizeBytes" INTEGER,
  "error" TEXT,
  "inputHash" TEXT,
  "snapshotJson" TEXT,
  "createdByStudentNumber" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" DATETIME,
  "lockOwner" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PdfDocumentJob_businessKey_key"
  ON "PdfDocumentJob"("businessKey");

CREATE INDEX IF NOT EXISTS "PdfDocumentJob_kind_status_idx"
  ON "PdfDocumentJob"("kind", "status");

CREATE INDEX IF NOT EXISTS "PdfDocumentJob_expiresAt_idx"
  ON "PdfDocumentJob"("expiresAt");

CREATE INDEX IF NOT EXISTS "PdfDocumentJob_createdAt_idx"
  ON "PdfDocumentJob"("createdAt");
