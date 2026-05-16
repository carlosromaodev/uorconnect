-- CreateTable
CREATE TABLE IF NOT EXISTS "PassportSurpriseQr" (
  "id" SERIAL NOT NULL,
  "qrActionId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "effectType" TEXT NOT NULL,
  "effectValue" INTEGER NOT NULL DEFAULT 0,
  "targetScope" TEXT NOT NULL DEFAULT 'SURPRISE_BONUS',
  "rarity" TEXT NOT NULL DEFAULT 'COMMON',
  "visibility" TEXT NOT NULL DEFAULT 'VISIBLE',
  "maxUsesTotal" INTEGER,
  "maxUsesPerStudent" INTEGER NOT NULL DEFAULT 1,
  "negativeCapPerStudent" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdByStudentNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PassportSurpriseQr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PassportSurpriseEffectLedger" (
  "id" SERIAL NOT NULL,
  "businessKey" TEXT NOT NULL,
  "surpriseQrId" INTEGER,
  "qrActionId" INTEGER,
  "qrActionScanId" INTEGER,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "studentCourse" TEXT,
  "effectType" TEXT NOT NULL,
  "effectValue" INTEGER NOT NULL,
  "targetScope" TEXT NOT NULL,
  "beforePoints" INTEGER NOT NULL,
  "afterPoints" INTEGER NOT NULL,
  "deltaPoints" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VALID',
  "message" TEXT,
  "metadataJson" TEXT,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PassportSurpriseEffectLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PassportSurpriseQr_qrActionId_key" ON "PassportSurpriseQr"("qrActionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseQr_effectType_active_idx" ON "PassportSurpriseQr"("effectType", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseQr_rarity_active_idx" ON "PassportSurpriseQr"("rarity", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseQr_startsAt_endsAt_idx" ON "PassportSurpriseQr"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseQr_createdAt_idx" ON "PassportSurpriseQr"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_businessKey_key" ON "PassportSurpriseEffectLedger"("businessKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_studentNumber_appliedAt_idx" ON "PassportSurpriseEffectLedger"("studentNumber", "appliedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_studentId_appliedAt_idx" ON "PassportSurpriseEffectLedger"("studentId", "appliedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_surpriseQrId_appliedAt_idx" ON "PassportSurpriseEffectLedger"("surpriseQrId", "appliedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_qrActionId_appliedAt_idx" ON "PassportSurpriseEffectLedger"("qrActionId", "appliedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_effectType_appliedAt_idx" ON "PassportSurpriseEffectLedger"("effectType", "appliedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportSurpriseEffectLedger_status_appliedAt_idx" ON "PassportSurpriseEffectLedger"("status", "appliedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportSurpriseQr"
    ADD CONSTRAINT "PassportSurpriseQr_qrActionId_fkey"
    FOREIGN KEY ("qrActionId") REFERENCES "QrAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportSurpriseEffectLedger"
    ADD CONSTRAINT "PassportSurpriseEffectLedger_surpriseQrId_fkey"
    FOREIGN KEY ("surpriseQrId") REFERENCES "PassportSurpriseQr"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportSurpriseEffectLedger"
    ADD CONSTRAINT "PassportSurpriseEffectLedger_qrActionId_fkey"
    FOREIGN KEY ("qrActionId") REFERENCES "QrAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportSurpriseEffectLedger"
    ADD CONSTRAINT "PassportSurpriseEffectLedger_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
