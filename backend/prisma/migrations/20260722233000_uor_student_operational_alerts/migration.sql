CREATE TABLE "UorStudentOperationalAlert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionCode" TEXT NOT NULL,
  "product" TEXT NOT NULL DEFAULT 'uor_student',
  "provider" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'HIGH',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "deduplicationKey" TEXT NOT NULL,
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "firstDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" DATETIME,
  "resolvedByStudentId" INTEGER,
  "resolution" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "UorStudentOperationalAlert_deduplicationKey_key" ON "UorStudentOperationalAlert"("deduplicationKey");
CREATE INDEX "UorStudentOperationalAlert_institutionCode_status_lastDetectedAt_idx" ON "UorStudentOperationalAlert"("institutionCode", "status", "lastDetectedAt");
CREATE INDEX "UorStudentOperationalAlert_provider_code_status_idx" ON "UorStudentOperationalAlert"("provider", "code", "status");
