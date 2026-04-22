CREATE TABLE "SmsCampaign" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "message" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "audienceFiltersJson" TEXT,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduleAt" DATETIME,
  "createdByStudentNumber" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" DATETIME
);

CREATE TABLE "SmsCampaignRecipient" (
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
  CONSTRAINT "SmsCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SmsCampaignRecipient_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SmsCampaignRecipient_campaignId_phone_key" ON "SmsCampaignRecipient"("campaignId", "phone");
CREATE INDEX "SmsCampaign_createdAt_idx" ON "SmsCampaign"("createdAt");
CREATE INDEX "SmsCampaign_status_createdAt_idx" ON "SmsCampaign"("status", "createdAt");
CREATE INDEX "SmsCampaignRecipient_campaignId_idx" ON "SmsCampaignRecipient"("campaignId");
CREATE INDEX "SmsCampaignRecipient_studentId_idx" ON "SmsCampaignRecipient"("studentId");
CREATE INDEX "SmsCampaignRecipient_status_createdAt_idx" ON "SmsCampaignRecipient"("status", "createdAt");
