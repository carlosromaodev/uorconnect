BEGIN;

ALTER TABLE "Student"
  ADD COLUMN IF NOT EXISTS "institutionCode" TEXT NOT NULL DEFAULT 'UOR';

UPDATE "Student"
SET "institutionCode" = 'ISPTEC'
WHERE
  lower(coalesce("email", '')) LIKE '%isptec%'
  OR lower(coalesce("university", '')) LIKE '%isptec%'
  OR "registrationSource" = 'ISPTEC_OFFICIAL';

UPDATE "Student"
SET "institutionCode" = 'UOR'
WHERE "institutionCode" IS NULL OR "institutionCode" = '';

ALTER TABLE "TeamMembership"
  ADD COLUMN IF NOT EXISTS "studentId" INTEGER;

UPDATE "TeamMembership" tm
SET "studentId" = s."id"
FROM "Student" s
WHERE
  tm."studentId" IS NULL
  AND tm."studentNumber" IS NOT NULL
  AND tm."studentNumber" = s."studentNumber";

ALTER TABLE "TeamMembership"
  DROP CONSTRAINT IF EXISTS "TeamMembership_studentNumber_fkey";

DROP INDEX IF EXISTS "Student_studentNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Student_institutionCode_studentNumber_key"
  ON "Student" ("institutionCode", "studentNumber");

CREATE INDEX IF NOT EXISTS "Student_studentNumber_idx"
  ON "Student" ("studentNumber");

CREATE INDEX IF NOT EXISTS "Student_institutionCode_idx"
  ON "Student" ("institutionCode");

CREATE INDEX IF NOT EXISTS "TeamMembership_studentId_idx"
  ON "TeamMembership" ("studentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TeamMembership_studentId_fkey'
  ) THEN
    ALTER TABLE "TeamMembership"
      ADD CONSTRAINT "TeamMembership_studentId_fkey"
      FOREIGN KEY ("studentId")
      REFERENCES "Student"("id")
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
