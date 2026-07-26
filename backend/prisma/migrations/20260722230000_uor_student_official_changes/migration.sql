CREATE TABLE "UorStudentOfficialChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "event" TEXT,
  "previousVersion" INTEGER NOT NULL,
  "currentVersion" INTEGER NOT NULL,
  "beforeJson" TEXT NOT NULL,
  "afterJson" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'secretaria_uor',
  "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UorStudentOfficialChange_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UorStudentOfficialChange_studentId_domain_currentVersion_key" ON "UorStudentOfficialChange"("studentId", "domain", "currentVersion");
CREATE INDEX "UorStudentOfficialChange_studentId_detectedAt_idx" ON "UorStudentOfficialChange"("studentId", "detectedAt");
CREATE INDEX "UorStudentOfficialChange_institutionCode_domain_detectedAt_idx" ON "UorStudentOfficialChange"("institutionCode", "domain", "detectedAt");
