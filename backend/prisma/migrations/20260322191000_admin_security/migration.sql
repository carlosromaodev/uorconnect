ALTER TABLE "Student" ADD COLUMN "lastLoginAt" DATETIME;

CREATE TABLE "AdminAuthorizedStudent" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentNumber" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AdminAuthorizedStudent_studentNumber_key" ON "AdminAuthorizedStudent"("studentNumber");

CREATE TRIGGER IF NOT EXISTS admin_authorized_student_updated_at
AFTER UPDATE ON "AdminAuthorizedStudent"
FOR EACH ROW
BEGIN
  UPDATE "AdminAuthorizedStudent"
  SET "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."id";
END;

INSERT OR IGNORE INTO "AdminAuthorizedStudent" ("studentNumber") VALUES ('20242099');
