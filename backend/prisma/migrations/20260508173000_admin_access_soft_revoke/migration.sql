ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "revokedAt" DATETIME;
ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "revokedByStudentNumber" TEXT;
ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "revocationReason" TEXT;

CREATE INDEX "AdminAuthorizedStudent_isActive_studentNumber_idx"
  ON "AdminAuthorizedStudent"("isActive", "studentNumber");
