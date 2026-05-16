CREATE TABLE "TeamMembership" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentNumber" TEXT,
  "fullName" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "category" TEXT NOT NULL DEFAULT 'NUCLEO',
  "team" TEXT NOT NULL DEFAULT 'Núcleo',
  "role" TEXT NOT NULL DEFAULT 'Membro',
  "accessLevel" TEXT NOT NULL DEFAULT 'Membro',
  "permissions" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "mandateLabel" TEXT,
  "startsAt" DATETIME,
  "endsAt" DATETIME,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "createdByStudentNumber" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMembership_studentNumber_fkey" FOREIGN KEY ("studentNumber") REFERENCES "Student" ("studentNumber") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TeamMembership_studentNumber_key" ON "TeamMembership"("studentNumber");
CREATE INDEX "TeamMembership_status_team_idx" ON "TeamMembership"("status", "team");
CREATE INDEX "TeamMembership_category_role_idx" ON "TeamMembership"("category", "role");
CREATE INDEX "TeamMembership_fullName_idx" ON "TeamMembership"("fullName");

CREATE TRIGGER IF NOT EXISTS team_membership_updated_at
AFTER UPDATE ON "TeamMembership"
FOR EACH ROW
BEGIN
  UPDATE "TeamMembership"
  SET "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."id";
END;
