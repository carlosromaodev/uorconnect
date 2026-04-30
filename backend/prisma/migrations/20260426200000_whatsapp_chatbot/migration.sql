-- CreateTable
CREATE TABLE "WhatsAppConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'MENU',
    "data" TEXT NOT NULL DEFAULT '{}',
    "studentId" INTEGER,
    "instanceName" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConversation_phone_key" ON "WhatsAppConversation"("phone");

-- CreateIndex
CREATE INDEX "WhatsAppConversation_updatedAt_idx" ON "WhatsAppConversation"("updatedAt");
