CREATE TABLE "AdminTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "category" TEXT NOT NULL DEFAULT '',
  "assigneeMembershipId" INTEGER,
  "assigneeName" TEXT,
  "assigneePhone" TEXT,
  "dueDate" DATETIME,
  "createdByStudentNumber" TEXT,
  "createdByName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminTask_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "TeamMembership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AdminTaskAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dataUrl" TEXT NOT NULL,
  "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AdminTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AdminTask_status_priority_idx" ON "AdminTask"("status", "priority");
CREATE INDEX "AdminTask_assigneeMembershipId_idx" ON "AdminTask"("assigneeMembershipId");
CREATE INDEX "AdminTask_dueDate_idx" ON "AdminTask"("dueDate");
CREATE INDEX "AdminTask_createdAt_idx" ON "AdminTask"("createdAt");
CREATE INDEX "AdminTaskAttachment_taskId_idx" ON "AdminTaskAttachment"("taskId");

CREATE TRIGGER IF NOT EXISTS admin_task_updated_at
AFTER UPDATE ON "AdminTask"
FOR EACH ROW
BEGIN
  UPDATE "AdminTask"
  SET "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."id";
END;
