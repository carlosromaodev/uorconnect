CREATE TABLE "AttendanceCredential" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "token" TEXT NOT NULL,
  "studentId" INTEGER NOT NULL,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "studentCourse" TEXT,
  "label" TEXT NOT NULL DEFAULT 'Credencial UOR Connect',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AttendanceCredential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AttendanceCheckIn" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "credentialId" INTEGER NOT NULL,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "studentCourse" TEXT,
  "eventKey" TEXT NOT NULL DEFAULT 'main-event',
  "eventLabel" TEXT NOT NULL DEFAULT 'Evento principal UOR Connect',
  "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedInByStudentNumber" TEXT NOT NULL,
  "notes" TEXT,
  CONSTRAINT "AttendanceCheckIn_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AttendanceCredential" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceCheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Certificate" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "code" TEXT NOT NULL,
  "validationToken" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientNumber" TEXT,
  "recipientCourse" TEXT,
  "studentId" INTEGER,
  "sourceType" TEXT,
  "sourceId" INTEGER,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedByStudentNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "revokedAt" DATETIME,
  "metadataJson" TEXT,
  CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AdminAuditLog" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "actorStudentNumber" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL DEFAULT 'admin',
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "summary" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AttendanceCredential_token_key" ON "AttendanceCredential"("token");
CREATE UNIQUE INDEX "AttendanceCredential_studentId_key" ON "AttendanceCredential"("studentId");
CREATE INDEX "AttendanceCredential_studentNumber_idx" ON "AttendanceCredential"("studentNumber");
CREATE INDEX "AttendanceCredential_createdAt_idx" ON "AttendanceCredential"("createdAt");

CREATE UNIQUE INDEX "AttendanceCheckIn_credentialId_eventKey_key" ON "AttendanceCheckIn"("credentialId", "eventKey");
CREATE INDEX "AttendanceCheckIn_studentId_checkedInAt_idx" ON "AttendanceCheckIn"("studentId", "checkedInAt");
CREATE INDEX "AttendanceCheckIn_studentNumber_checkedInAt_idx" ON "AttendanceCheckIn"("studentNumber", "checkedInAt");
CREATE INDEX "AttendanceCheckIn_checkedInAt_idx" ON "AttendanceCheckIn"("checkedInAt");

CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");
CREATE UNIQUE INDEX "Certificate_validationToken_key" ON "Certificate"("validationToken");
CREATE INDEX "Certificate_studentId_issuedAt_idx" ON "Certificate"("studentId", "issuedAt");
CREATE INDEX "Certificate_recipientNumber_idx" ON "Certificate"("recipientNumber");
CREATE INDEX "Certificate_type_issuedAt_idx" ON "Certificate"("type", "issuedAt");
CREATE INDEX "Certificate_status_issuedAt_idx" ON "Certificate"("status", "issuedAt");

CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
CREATE INDEX "AdminAuditLog_actorStudentNumber_createdAt_idx" ON "AdminAuditLog"("actorStudentNumber", "createdAt");
CREATE INDEX "AdminAuditLog_entityType_createdAt_idx" ON "AdminAuditLog"("entityType", "createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
