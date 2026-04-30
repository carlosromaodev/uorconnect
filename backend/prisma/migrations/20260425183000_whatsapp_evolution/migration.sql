CREATE TABLE IF NOT EXISTS "WhatsAppInstance" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "label" TEXT,
  "phoneNumber" TEXT,
  "baseUrl" TEXT,
  "apiKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  "qrCode" TEXT,
  "pairingCode" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastConnectedAt" DATETIME,
  "lastCheckedAt" DATETIME,
  "createdByStudentNumber" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppInstance_name_key" ON "WhatsAppInstance"("name");
CREATE INDEX IF NOT EXISTS "WhatsAppInstance_isActive_isDefault_idx" ON "WhatsAppInstance"("isActive", "isDefault");
CREATE INDEX IF NOT EXISTS "WhatsAppInstance_status_updatedAt_idx" ON "WhatsAppInstance"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "WhatsAppCampaign" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "message" TEXT NOT NULL,
  "instanceId" INTEGER,
  "instanceName" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "audienceFiltersJson" TEXT,
  "mediaUrl" TEXT,
  "mediaType" TEXT,
  "mediaMimeType" TEXT,
  "mediaFileName" TEXT,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdByStudentNumber" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" DATETIME,
  CONSTRAINT "WhatsAppCampaign_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WhatsAppCampaign_instanceId_createdAt_idx" ON "WhatsAppCampaign"("instanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppCampaign_createdAt_idx" ON "WhatsAppCampaign"("createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppCampaign_status_createdAt_idx" ON "WhatsAppCampaign"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "WhatsAppCampaignRecipient" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "campaignId" INTEGER NOT NULL,
  "studentId" INTEGER,
  "studentNumber" TEXT,
  "recipientName" TEXT,
  "recipientCourse" TEXT,
  "phone" TEXT NOT NULL,
  "providerTo" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "providerMessageId" TEXT,
  "providerResponseJson" TEXT,
  "errorMessage" TEXT,
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppCampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "WhatsAppCampaign" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WhatsAppCampaignRecipient_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_campaignId_phone_key" ON "WhatsAppCampaignRecipient"("campaignId", "phone");
CREATE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_campaignId_idx" ON "WhatsAppCampaignRecipient"("campaignId");
CREATE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_studentId_idx" ON "WhatsAppCampaignRecipient"("studentId");
CREATE INDEX IF NOT EXISTS "WhatsAppCampaignRecipient_status_createdAt_idx" ON "WhatsAppCampaignRecipient"("status", "createdAt");
