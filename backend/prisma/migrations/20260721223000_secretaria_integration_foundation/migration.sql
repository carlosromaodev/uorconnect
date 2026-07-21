-- Secretaria integration persistence. SQLite is the repository migration
-- source; production PostgreSQL is materialised from schema.deploy.prisma.

CREATE TABLE "SecretariaConnection" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "upstreamStudentNumber" TEXT,
  "displayName" TEXT,
  "credentialsEnvelope" TEXT,
  "sessionEnvelope" TEXT,
  "connectionGeneration" INTEGER NOT NULL DEFAULT 0,
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "activeSnapshotVersion" INTEGER,
  "lastAuthenticatedAt" DATETIME,
  "lastSuccessfulSyncAt" DATETIME,
  "lastUsedAt" DATETIME,
  "lastErrorCode" TEXT,
  "failedReauthCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SecretariaConnection_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SecretariaSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "domain" TEXT NOT NULL,
  "snapshotVersion" INTEGER NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "coverage" TEXT NOT NULL DEFAULT 'live',
  "sourceHash" TEXT NOT NULL,
  "observedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecretariaSnapshot_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SecretariaSyncRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "snapshotVersion" INTEGER,
  "domainsJson" TEXT NOT NULL,
  "resultJson" TEXT,
  "errorCode" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SecretariaSyncRun_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SecretariaConnection_studentId_key" ON "SecretariaConnection"("studentId");
CREATE INDEX "SecretariaConnection_status_updatedAt_idx" ON "SecretariaConnection"("status", "updatedAt");
CREATE UNIQUE INDEX "SecretariaSnapshot_studentId_domain_snapshotVersion_key" ON "SecretariaSnapshot"("studentId", "domain", "snapshotVersion");
CREATE INDEX "SecretariaSnapshot_studentId_snapshotVersion_domain_idx" ON "SecretariaSnapshot"("studentId", "snapshotVersion", "domain");
CREATE INDEX "SecretariaSyncRun_studentId_createdAt_idx" ON "SecretariaSyncRun"("studentId", "createdAt");
CREATE INDEX "SecretariaSyncRun_status_updatedAt_idx" ON "SecretariaSyncRun"("status", "updatedAt");
