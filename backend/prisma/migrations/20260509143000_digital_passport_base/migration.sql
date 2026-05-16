CREATE TABLE IF NOT EXISTS "PassportMission" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "points" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "maxPointsPerStudent" INTEGER,
  "targetType" TEXT,
  "targetId" INTEGER,
  "targetKey" TEXT,
  "badgeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PassportMission_key_key" ON "PassportMission"("key");
CREATE INDEX IF NOT EXISTS "PassportMission_type_active_idx" ON "PassportMission"("type", "active");
CREATE INDEX IF NOT EXISTS "PassportMission_targetType_targetId_idx" ON "PassportMission"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "PassportMission_startsAt_endsAt_idx" ON "PassportMission"("startsAt", "endsAt");

ALTER TABLE "QrAction" ADD COLUMN IF NOT EXISTS "passportMissionId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'QrAction_passportMissionId_fkey'
  ) THEN
    ALTER TABLE "QrAction"
      ADD CONSTRAINT "QrAction_passportMissionId_fkey"
      FOREIGN KEY ("passportMissionId") REFERENCES "PassportMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "QrAction_passportMissionId_idx" ON "QrAction"("passportMissionId");

CREATE TABLE IF NOT EXISTS "PassportScan" (
  "id" SERIAL PRIMARY KEY,
  "businessKey" TEXT NOT NULL,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "studentCourse" TEXT,
  "missionId" INTEGER,
  "qrActionId" INTEGER,
  "qrActionScanId" INTEGER,
  "result" TEXT NOT NULL,
  "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "metadataJson" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PassportScan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PassportScan_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "PassportMission"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PassportScan_qrActionId_fkey" FOREIGN KEY ("qrActionId") REFERENCES "QrAction"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PassportScan_qrActionScanId_fkey" FOREIGN KEY ("qrActionScanId") REFERENCES "QrActionScan"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PassportScan_businessKey_key" ON "PassportScan"("businessKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PassportScan_qrActionScanId_key" ON "PassportScan"("qrActionScanId");
CREATE INDEX IF NOT EXISTS "PassportScan_studentNumber_scannedAt_idx" ON "PassportScan"("studentNumber", "scannedAt");
CREATE INDEX IF NOT EXISTS "PassportScan_studentId_scannedAt_idx" ON "PassportScan"("studentId", "scannedAt");
CREATE INDEX IF NOT EXISTS "PassportScan_missionId_scannedAt_idx" ON "PassportScan"("missionId", "scannedAt");
CREATE INDEX IF NOT EXISTS "PassportScan_qrActionId_idx" ON "PassportScan"("qrActionId");
CREATE INDEX IF NOT EXISTS "PassportScan_result_scannedAt_idx" ON "PassportScan"("result", "scannedAt");

CREATE TABLE IF NOT EXISTS "PassportPointLedger" (
  "id" SERIAL PRIMARY KEY,
  "businessKey" TEXT NOT NULL,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "studentCourse" TEXT,
  "missionId" INTEGER,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VALID',
  "reason" TEXT,
  "metadataJson" TEXT,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedByStudentNumber" TEXT,
  "revokeReason" TEXT,
  CONSTRAINT "PassportPointLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PassportPointLedger_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "PassportMission"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PassportPointLedger_businessKey_key" ON "PassportPointLedger"("businessKey");
CREATE INDEX IF NOT EXISTS "PassportPointLedger_studentNumber_awardedAt_idx" ON "PassportPointLedger"("studentNumber", "awardedAt");
CREATE INDEX IF NOT EXISTS "PassportPointLedger_studentId_awardedAt_idx" ON "PassportPointLedger"("studentId", "awardedAt");
CREATE INDEX IF NOT EXISTS "PassportPointLedger_missionId_awardedAt_idx" ON "PassportPointLedger"("missionId", "awardedAt");
CREATE INDEX IF NOT EXISTS "PassportPointLedger_status_awardedAt_idx" ON "PassportPointLedger"("status", "awardedAt");
CREATE INDEX IF NOT EXISTS "PassportPointLedger_sourceType_sourceId_idx" ON "PassportPointLedger"("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS "PassportBadge" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "ruleType" TEXT NOT NULL,
  "ruleValue" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PassportBadge_key_key" ON "PassportBadge"("key");
CREATE INDEX IF NOT EXISTS "PassportBadge_active_idx" ON "PassportBadge"("active");
CREATE INDEX IF NOT EXISTS "PassportBadge_ruleType_idx" ON "PassportBadge"("ruleType");

CREATE TABLE IF NOT EXISTS "PassportStudentBadge" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "badgeId" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" TEXT,
  CONSTRAINT "PassportStudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PassportStudentBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "PassportBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PassportStudentBadge_studentNumber_badgeId_key" ON "PassportStudentBadge"("studentNumber", "badgeId");
CREATE INDEX IF NOT EXISTS "PassportStudentBadge_studentId_awardedAt_idx" ON "PassportStudentBadge"("studentId", "awardedAt");
CREATE INDEX IF NOT EXISTS "PassportStudentBadge_badgeId_awardedAt_idx" ON "PassportStudentBadge"("badgeId", "awardedAt");
