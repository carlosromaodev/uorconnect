-- Versioned academic rules and student-owned simulation namespace.

CREATE TABLE "UorStudentAcademicRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionCode" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "formula" TEXT NOT NULL,
  "parametersJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" DATETIME,
  "effectiveUntil" DATETIME,
  "decisionSource" TEXT,
  "approvedBy" TEXT,
  "approvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "UorStudentAcademicRule_institutionCode_code_version_key" ON "UorStudentAcademicRule"("institutionCode", "code", "version");
CREATE INDEX "UorStudentAcademicRule_institutionCode_kind_status_effectiveFrom_idx" ON "UorStudentAcademicRule"("institutionCode", "kind", "status", "effectiveFrom");

CREATE TABLE "UorStudentAcademicSimulation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "period" TEXT,
  "ruleCode" TEXT NOT NULL,
  "ruleVersion" INTEGER NOT NULL,
  "ruleStatus" TEXT NOT NULL,
  "scenarioJson" TEXT NOT NULL,
  "resultJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentAcademicSimulation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentAcademicSimulation_studentId_status_updatedAt_idx" ON "UorStudentAcademicSimulation"("studentId", "status", "updatedAt");
CREATE INDEX "UorStudentAcademicSimulation_institutionCode_subjectKey_period_idx" ON "UorStudentAcademicSimulation"("institutionCode", "subjectKey", "period");
