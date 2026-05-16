DROP INDEX IF EXISTS "TeamMembership_studentNumber_key";

CREATE INDEX IF NOT EXISTS "TeamMembership_studentNumber_idx"
  ON "TeamMembership"("studentNumber");
