-- AlterTable
ALTER TABLE "LiveChatMessage" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "LiveChatMessage" ADD COLUMN "attachmentMime" TEXT;
ALTER TABLE "LiveChatMessage" ADD COLUMN "replyToMessageId" INTEGER;
ALTER TABLE "LiveChatMessage" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveChatMessage" ADD COLUMN "isHighlighted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveChatMessage" ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LiveChatMessage" ADD COLUMN "hiddenAt" DATETIME;

-- CreateTable
CREATE TABLE "LiveChatReaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "LiveChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveChatReaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LiveChatMessage_isPinned_createdAt_idx" ON "LiveChatMessage"("isPinned", "createdAt");
CREATE INDEX "LiveChatMessage_hiddenAt_createdAt_idx" ON "LiveChatMessage"("hiddenAt", "createdAt");
CREATE UNIQUE INDEX "LiveChatReaction_messageId_studentId_type_key" ON "LiveChatReaction"("messageId", "studentId", "type");
CREATE INDEX "LiveChatReaction_messageId_type_idx" ON "LiveChatReaction"("messageId", "type");
CREATE INDEX "LiveChatReaction_studentId_createdAt_idx" ON "LiveChatReaction"("studentId", "createdAt");
