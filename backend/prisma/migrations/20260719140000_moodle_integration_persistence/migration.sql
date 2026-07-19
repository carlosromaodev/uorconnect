-- Moodle integration persistence. This migration is intentionally SQLite SQL,
-- matching prisma/schema.prisma, the repository's migration source. Production
-- PostgreSQL is materialised from schema.deploy.prisma by the existing deploy
-- preparation command.

CREATE TABLE "MoodleConnection" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "moodleUserId" TEXT,
  "profilePublicId" TEXT NOT NULL,
  "moodleStudentNumber" TEXT,
  "displayName" TEXT,
  "email" TEXT,
  "timezone" TEXT,
  "profileSyncedAt" DATETIME,
  "credentialsEnvelope" TEXT,
  "sessionEnvelope" TEXT,
  "connectionGeneration" INTEGER NOT NULL DEFAULT 0,
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "activeSnapshotVersion" INTEGER,
  "activeSyncRunId" TEXT,
  "connectionAttemptId" TEXT,
  "connectionAttemptLeaseUntil" DATETIME,
  "sessionExpiresAt" DATETIME,
  "reauthLeaseOwner" TEXT,
  "reauthLeaseUntil" DATETIME,
  "failedReauthCount" INTEGER NOT NULL DEFAULT 0,
  "nextReauthAt" DATETIME,
  "lastAuthenticatedAt" DATETIME,
  "lastSuccessfulSyncAt" DATETIME,
  "lastUsedAt" DATETIME,
  "lastErrorCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MoodleConnection_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MoodleEntityRef" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "moodleExternalKey" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MoodleEntityRef_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MoodleCourseSnapshot" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "entityRefId" INTEGER NOT NULL,
  "moodleExternalKey" TEXT NOT NULL,
  "snapshotVersion" INTEGER NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "category" TEXT,
  "descriptionText" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "hiddenByStudent" BOOLEAN NOT NULL DEFAULT false,
  "favourite" BOOLEAN NOT NULL DEFAULT false,
  "startAt" DATETIME,
  "endAt" DATETIME,
  "progressAvailable" BOOLEAN NOT NULL DEFAULT false,
  "progressPercent" REAL,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "sourceSyncedAt" DATETIME,
  "syncedAt" DATETIME NOT NULL,
  "normalizedHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoodleCourseSnapshot_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MoodleCourseSnapshot_entityRefId_fkey"
    FOREIGN KEY ("entityRefId") REFERENCES "MoodleEntityRef" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MoodleSectionSnapshot" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "entityRefId" INTEGER NOT NULL,
  "courseEntityRefId" INTEGER NOT NULL,
  "moodleExternalKey" TEXT NOT NULL,
  "snapshotVersion" INTEGER NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "summaryText" TEXT,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "sourceSyncedAt" DATETIME,
  "syncedAt" DATETIME NOT NULL,
  "normalizedHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoodleSectionSnapshot_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MoodleSectionSnapshot_entityRefId_fkey"
    FOREIGN KEY ("entityRefId") REFERENCES "MoodleEntityRef" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MoodleSectionSnapshot_courseEntityRefId_fkey"
    FOREIGN KEY ("courseEntityRefId") REFERENCES "MoodleEntityRef" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MoodleMaterialSnapshot" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "entityRefId" INTEGER NOT NULL,
  "courseEntityRefId" INTEGER NOT NULL,
  "sectionEntityRefId" INTEGER,
  "moodleExternalKey" TEXT NOT NULL,
  "snapshotVersion" INTEGER NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "descriptionText" TEXT,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "openAvailable" BOOLEAN NOT NULL DEFAULT false,
  "downloadAvailable" BOOLEAN NOT NULL DEFAULT false,
  "fileName" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "sourceUpdatedAt" DATETIME,
  "metadataJson" TEXT,
  "locatorEnvelope" TEXT,
  "stale" BOOLEAN NOT NULL DEFAULT false,
  "sourceSyncedAt" DATETIME,
  "syncedAt" DATETIME NOT NULL,
  "normalizedHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoodleMaterialSnapshot_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MoodleMaterialSnapshot_entityRefId_fkey"
    FOREIGN KEY ("entityRefId") REFERENCES "MoodleEntityRef" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MoodleMaterialSnapshot_courseEntityRefId_fkey"
    FOREIGN KEY ("courseEntityRefId") REFERENCES "MoodleEntityRef" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MoodleMaterialSnapshot_sectionEntityRefId_fkey"
    FOREIGN KEY ("sectionEntityRefId") REFERENCES "MoodleEntityRef" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MoodleSyncRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "reason" TEXT,
  "connectionGeneration" INTEGER NOT NULL,
  "snapshotVersion" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseUntil" DATETIME,
  "heartbeatAt" DATETIME,
  "startedAt" DATETIME,
  "finishedAt" DATETIME,
  "discoveredCourses" INTEGER NOT NULL DEFAULT 0,
  "processedCourses" INTEGER NOT NULL DEFAULT 0,
  "failedCourses" INTEGER NOT NULL DEFAULT 0,
  "totalMaterials" INTEGER NOT NULL DEFAULT 0,
  "checkpointJson" TEXT,
  "lastErrorCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MoodleSyncRun_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MoodleConnection_studentId_key" ON "MoodleConnection"("studentId");
CREATE UNIQUE INDEX "MoodleConnection_studentId_profilePublicId_key" ON "MoodleConnection"("studentId", "profilePublicId");
CREATE INDEX "MoodleConnection_status_nextReauthAt_idx" ON "MoodleConnection"("status", "nextReauthAt");
CREATE INDEX "MoodleConnection_activeSyncRunId_idx" ON "MoodleConnection"("activeSyncRunId");
CREATE INDEX "MoodleConnection_connectionAttemptId_connectionAttemptLeaseUntil_idx" ON "MoodleConnection"("connectionAttemptId", "connectionAttemptLeaseUntil");
CREATE INDEX "MoodleConnection_reauthLeaseOwner_reauthLeaseUntil_idx" ON "MoodleConnection"("reauthLeaseOwner", "reauthLeaseUntil");

CREATE UNIQUE INDEX "MoodleEntityRef_studentId_kind_moodleExternalKey_key" ON "MoodleEntityRef"("studentId", "kind", "moodleExternalKey");
CREATE UNIQUE INDEX "MoodleEntityRef_studentId_publicId_key" ON "MoodleEntityRef"("studentId", "publicId");
CREATE INDEX "MoodleEntityRef_studentId_kind_idx" ON "MoodleEntityRef"("studentId", "kind");

CREATE UNIQUE INDEX "MoodleCourseSnapshot_studentId_moodleExternalKey_snapshotVersion_key" ON "MoodleCourseSnapshot"("studentId", "moodleExternalKey", "snapshotVersion");
CREATE UNIQUE INDEX "MoodleCourseSnapshot_studentId_entityRefId_snapshotVersion_key" ON "MoodleCourseSnapshot"("studentId", "entityRefId", "snapshotVersion");
CREATE INDEX "MoodleCourseSnapshot_studentId_snapshotVersion_normalizedName_idx" ON "MoodleCourseSnapshot"("studentId", "snapshotVersion", "normalizedName");
CREATE INDEX "MoodleCourseSnapshot_studentId_snapshotVersion_syncRunId_idx" ON "MoodleCourseSnapshot"("studentId", "snapshotVersion", "syncRunId");

CREATE UNIQUE INDEX "MoodleSectionSnapshot_studentId_moodleExternalKey_snapshotVersion_key" ON "MoodleSectionSnapshot"("studentId", "moodleExternalKey", "snapshotVersion");
CREATE UNIQUE INDEX "MoodleSectionSnapshot_studentId_entityRefId_snapshotVersion_key" ON "MoodleSectionSnapshot"("studentId", "entityRefId", "snapshotVersion");
CREATE INDEX "MoodleSectionSnapshot_studentId_snapshotVersion_courseEntityRefId_position_idx" ON "MoodleSectionSnapshot"("studentId", "snapshotVersion", "courseEntityRefId", "position");
CREATE INDEX "MoodleSectionSnapshot_studentId_snapshotVersion_syncRunId_idx" ON "MoodleSectionSnapshot"("studentId", "snapshotVersion", "syncRunId");

CREATE UNIQUE INDEX "MoodleMaterialSnapshot_studentId_moodleExternalKey_snapshotVersion_key" ON "MoodleMaterialSnapshot"("studentId", "moodleExternalKey", "snapshotVersion");
CREATE UNIQUE INDEX "MoodleMaterialSnapshot_studentId_entityRefId_snapshotVersion_key" ON "MoodleMaterialSnapshot"("studentId", "entityRefId", "snapshotVersion");
CREATE INDEX "MoodleMaterialSnapshot_studentId_snapshotVersion_normalizedTitle_idx" ON "MoodleMaterialSnapshot"("studentId", "snapshotVersion", "normalizedTitle");
CREATE INDEX "MoodleMaterialSnapshot_studentId_snapshotVersion_courseEntityRefId_normalizedTitle_idx" ON "MoodleMaterialSnapshot"("studentId", "snapshotVersion", "courseEntityRefId", "normalizedTitle");
CREATE INDEX "MoodleMaterialSnapshot_studentId_snapshotVersion_sectionEntityRefId_idx" ON "MoodleMaterialSnapshot"("studentId", "snapshotVersion", "sectionEntityRefId");
CREATE INDEX "MoodleMaterialSnapshot_studentId_snapshotVersion_syncRunId_idx" ON "MoodleMaterialSnapshot"("studentId", "snapshotVersion", "syncRunId");

CREATE INDEX "MoodleSyncRun_studentId_status_createdAt_idx" ON "MoodleSyncRun"("studentId", "status", "createdAt");
CREATE INDEX "MoodleSyncRun_status_leaseUntil_createdAt_idx" ON "MoodleSyncRun"("status", "leaseUntil", "createdAt");
CREATE INDEX "MoodleSyncRun_studentId_connectionGeneration_snapshotVersion_idx" ON "MoodleSyncRun"("studentId", "connectionGeneration", "snapshotVersion");
