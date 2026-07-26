-- Product-owned local workflows and contextual authorizations.

CREATE TABLE "UorStudentAggregate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerStudentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentAggregate_ownerStudentId_fkey" FOREIGN KEY ("ownerStudentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentAggregate_ownerStudentId_category_status_updatedAt_idx" ON "UorStudentAggregate"("ownerStudentId", "category", "status", "updatedAt");
CREATE INDEX "UorStudentAggregate_institutionCode_category_scopeKey_status_idx" ON "UorStudentAggregate"("institutionCode", "category", "scopeKey", "status");
CREATE INDEX "UorStudentAggregate_category_status_expiresAt_idx" ON "UorStudentAggregate"("category", "status", "expiresAt");

CREATE TABLE "UorStudentAggregateActor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "aggregateId" TEXT NOT NULL,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payloadJson" TEXT,
  "decidedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentAggregateActor_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "UorStudentAggregate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UorStudentAggregateActor_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UorStudentAggregateActor_aggregateId_studentId_role_key" ON "UorStudentAggregateActor"("aggregateId", "studentId", "role");
CREATE INDEX "UorStudentAggregateActor_studentId_role_status_updatedAt_idx" ON "UorStudentAggregateActor"("studentId", "role", "status", "updatedAt");
CREATE INDEX "UorStudentAggregateActor_institutionCode_role_status_idx" ON "UorStudentAggregateActor"("institutionCode", "role", "status");

CREATE TABLE "UorStudentAggregateEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "aggregateId" TEXT NOT NULL,
  "actorStudentId" INTEGER,
  "institutionCode" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "payloadJson" TEXT,
  "traceId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UorStudentAggregateEvent_aggregateId_fkey" FOREIGN KEY ("aggregateId") REFERENCES "UorStudentAggregate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UorStudentAggregateEvent_actorStudentId_fkey" FOREIGN KEY ("actorStudentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "UorStudentAggregateEvent_aggregateId_createdAt_idx" ON "UorStudentAggregateEvent"("aggregateId", "createdAt");
CREATE INDEX "UorStudentAggregateEvent_actorStudentId_createdAt_idx" ON "UorStudentAggregateEvent"("actorStudentId", "createdAt");
CREATE INDEX "UorStudentAggregateEvent_institutionCode_type_createdAt_idx" ON "UorStudentAggregateEvent"("institutionCode", "type", "createdAt");

CREATE TABLE "UorStudentAuthorization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerStudentId" INTEGER NOT NULL,
  "representativeStudentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "product" TEXT NOT NULL DEFAULT 'uor_student',
  "purpose" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "fieldsJson" TEXT NOT NULL,
  "contextHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "startsAt" DATETIME NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "decidedAt" DATETIME,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentAuthorization_ownerStudentId_fkey" FOREIGN KEY ("ownerStudentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UorStudentAuthorization_representativeStudentId_fkey" FOREIGN KEY ("representativeStudentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentAuthorization_ownerStudentId_status_expiresAt_idx" ON "UorStudentAuthorization"("ownerStudentId", "status", "expiresAt");
CREATE INDEX "UorStudentAuthorization_representativeStudentId_status_expiresAt_idx" ON "UorStudentAuthorization"("representativeStudentId", "status", "expiresAt");
CREATE INDEX "UorStudentAuthorization_institutionCode_purpose_status_idx" ON "UorStudentAuthorization"("institutionCode", "purpose", "status");

CREATE TABLE "UorStudentOtpChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "authorizationId" TEXT NOT NULL,
  "actorStudentId" INTEGER NOT NULL,
  "contextHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "maxResends" INTEGER NOT NULL DEFAULT 3,
  "expiresAt" DATETIME NOT NULL,
  "verifiedAt" DATETIME,
  "lockedAt" DATETIME,
  "lastSentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentOtpChallenge_authorizationId_fkey" FOREIGN KEY ("authorizationId") REFERENCES "UorStudentAuthorization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UorStudentOtpChallenge_actorStudentId_fkey" FOREIGN KEY ("actorStudentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentOtpChallenge_authorizationId_status_expiresAt_idx" ON "UorStudentOtpChallenge"("authorizationId", "status", "expiresAt");
CREATE INDEX "UorStudentOtpChallenge_actorStudentId_status_expiresAt_idx" ON "UorStudentOtpChallenge"("actorStudentId", "status", "expiresAt");
CREATE INDEX "UorStudentOtpChallenge_contextHash_status_idx" ON "UorStudentOtpChallenge"("contextHash", "status");

CREATE TABLE "UorStudentNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payloadJson" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNREAD',
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentNotification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UorStudentNotification_studentId_deduplicationKey_key" ON "UorStudentNotification"("studentId", "deduplicationKey");
CREATE INDEX "UorStudentNotification_studentId_status_createdAt_idx" ON "UorStudentNotification"("studentId", "status", "createdAt");
CREATE INDEX "UorStudentNotification_institutionCode_category_createdAt_idx" ON "UorStudentNotification"("institutionCode", "category", "createdAt");

CREATE TABLE "UorStudentRankingParticipation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "contextKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "policyVersion" TEXT NOT NULL,
  "consentedAt" DATETIME,
  "withdrawnAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentRankingParticipation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UorStudentRankingParticipation_studentId_contextKey_key" ON "UorStudentRankingParticipation"("studentId", "contextKey");
CREATE INDEX "UorStudentRankingParticipation_institutionCode_contextKey_enabled_idx" ON "UorStudentRankingParticipation"("institutionCode", "contextKey", "enabled");

CREATE TABLE "UorStudentProductConfiguration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "institutionCode" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "valueJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" DATETIME NOT NULL,
  "effectiveUntil" DATETIME,
  "createdByStudentId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentProductConfiguration_createdByStudentId_fkey" FOREIGN KEY ("createdByStudentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UorStudentProductConfiguration_institutionCode_key_version_key" ON "UorStudentProductConfiguration"("institutionCode", "key", "version");
CREATE INDEX "UorStudentProductConfiguration_institutionCode_key_status_effectiveFrom_idx" ON "UorStudentProductConfiguration"("institutionCode", "key", "status", "effectiveFrom");

CREATE TABLE "UorStudentStepUpChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" INTEGER NOT NULL,
  "institutionCode" TEXT NOT NULL,
  "contextHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "maxResends" INTEGER NOT NULL DEFAULT 3,
  "expiresAt" DATETIME NOT NULL,
  "verifiedAt" DATETIME,
  "lockedAt" DATETIME,
  "lastSentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UorStudentStepUpChallenge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UorStudentStepUpChallenge_studentId_contextHash_status_expiresAt_idx" ON "UorStudentStepUpChallenge"("studentId", "contextHash", "status", "expiresAt");
CREATE INDEX "UorStudentStepUpChallenge_status_expiresAt_idx" ON "UorStudentStepUpChallenge"("status", "expiresAt");
