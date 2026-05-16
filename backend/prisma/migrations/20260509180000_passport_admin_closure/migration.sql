-- AlterTable
ALTER TABLE "PassportScan"
  ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedByStudentNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportScan_reviewStatus_scannedAt_idx" ON "PassportScan"("reviewStatus", "scannedAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "PassportRankingFreeze" (
  "id" SERIAL NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "snapshotJson" TEXT NOT NULL,
  "frozenByStudentNumber" TEXT,
  "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PassportRankingFreeze_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportRankingFreeze_active_frozenAt_idx" ON "PassportRankingFreeze"("active", "frozenAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportRankingFreeze_frozenByStudentNumber_frozenAt_idx" ON "PassportRankingFreeze"("frozenByStudentNumber", "frozenAt");
