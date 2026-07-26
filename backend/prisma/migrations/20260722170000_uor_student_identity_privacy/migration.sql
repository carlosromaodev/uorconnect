-- UOR Estudante product-owned identity, privacy and data-subject records.

ALTER TABLE "Student" ADD COLUMN "uorStudentPublicId" TEXT;
CREATE UNIQUE INDEX "Student_uorStudentPublicId_key" ON "Student"("uorStudentPublicId");

CREATE TABLE "UorStudentProfileField" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "valueJson" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'student',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentProfileField_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UorStudentProfileField_studentId_field_key" ON "UorStudentProfileField"("studentId", "field");
CREATE INDEX "UorStudentProfileField_institutionCode_field_idx" ON "UorStudentProfileField"("institutionCode", "field");

CREATE TABLE "UorStudentPrivacyPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "fieldsJson" TEXT NOT NULL,
  "expiresAt" DATETIME,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentPrivacyPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UorStudentPrivacyPreference_studentId_purpose_key" ON "UorStudentPrivacyPreference"("studentId", "purpose");
CREATE INDEX "UorStudentPrivacyPreference_institutionCode_purpose_enabled_idx" ON "UorStudentPrivacyPreference"("institutionCode", "purpose", "enabled");

CREATE TABLE "UorStudentDataRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scopeJson" TEXT NOT NULL,
  "retentionJson" TEXT NOT NULL,
  "resultJson" TEXT,
  "errorCode" TEXT,
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentDataRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentDataRequest_studentId_type_createdAt_idx" ON "UorStudentDataRequest"("studentId", "type", "createdAt");
CREATE INDEX "UorStudentDataRequest_status_createdAt_idx" ON "UorStudentDataRequest"("status", "createdAt");
CREATE INDEX "UorStudentDataRequest_institutionCode_status_idx" ON "UorStudentDataRequest"("institutionCode", "status");

CREATE TABLE "UorStudentAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "product" TEXT NOT NULL DEFAULT 'uor_student',
  "domain" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "purpose" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "traceId" TEXT,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UorStudentAuditEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentAuditEvent_studentId_createdAt_idx" ON "UorStudentAuditEvent"("studentId", "createdAt");
CREATE INDEX "UorStudentAuditEvent_institutionCode_domain_createdAt_idx" ON "UorStudentAuditEvent"("institutionCode", "domain", "createdAt");
CREATE INDEX "UorStudentAuditEvent_resourceType_resourceId_createdAt_idx" ON "UorStudentAuditEvent"("resourceType", "resourceId", "createdAt");
CREATE INDEX "UorStudentAuditEvent_traceId_idx" ON "UorStudentAuditEvent"("traceId");
