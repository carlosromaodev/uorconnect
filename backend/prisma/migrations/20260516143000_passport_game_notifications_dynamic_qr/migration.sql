ALTER TABLE "PassportSurpriseQr" ADD COLUMN "displayCode" TEXT;
ALTER TABLE "PassportSurpriseQr" ADD COLUMN "batchCode" TEXT;
ALTER TABLE "PassportSurpriseQr" ADD COLUMN "dynamicRulesJson" TEXT;
ALTER TABLE "PassportSurpriseQr" ADD COLUMN "printedAt" DATETIME;

CREATE UNIQUE INDEX "PassportSurpriseQr_displayCode_key" ON "PassportSurpriseQr"("displayCode");
CREATE INDEX "PassportSurpriseQr_batchCode_createdAt_idx" ON "PassportSurpriseQr"("batchCode", "createdAt");

CREATE TABLE "PassportPointRecovery" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "businessKey" TEXT NOT NULL,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "phone" TEXT,
  "amountKz" INTEGER NOT NULL DEFAULT 300,
  "requestedPoints" INTEGER NOT NULL DEFAULT 60,
  "awardedPoints" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "paymentReference" TEXT,
  "paymentProofUrl" TEXT,
  "note" TEXT,
  "reviewedByStudentNumber" TEXT,
  "reviewedAt" DATETIME,
  "ledgerId" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PassportPointRecovery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PassportPointRecovery_businessKey_key" ON "PassportPointRecovery"("businessKey");
CREATE INDEX "PassportPointRecovery_studentNumber_createdAt_idx" ON "PassportPointRecovery"("studentNumber", "createdAt");
CREATE INDEX "PassportPointRecovery_status_createdAt_idx" ON "PassportPointRecovery"("status", "createdAt");
