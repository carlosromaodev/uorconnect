CREATE TABLE "StudentLoginAudit" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "studentNumber" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentLoginAudit_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StudentLoginAudit_loggedAt_idx" ON "StudentLoginAudit"("loggedAt");
CREATE INDEX "StudentLoginAudit_studentId_loggedAt_idx" ON "StudentLoginAudit"("studentId", "loggedAt");
CREATE INDEX "StudentLoginAudit_origin_loggedAt_idx" ON "StudentLoginAudit"("origin", "loggedAt");
