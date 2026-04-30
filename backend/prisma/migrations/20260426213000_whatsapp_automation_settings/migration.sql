CREATE TABLE IF NOT EXISTS "WhatsAppAutomationSetting" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "eventKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "customTitle" TEXT,
  "customMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppAutomationSetting_eventKey_key" ON "WhatsAppAutomationSetting"("eventKey");
CREATE INDEX IF NOT EXISTS "WhatsAppAutomationSetting_enabled_updatedAt_idx" ON "WhatsAppAutomationSetting"("enabled", "updatedAt");
