CREATE TABLE IF NOT EXISTS "TrainerRegistrationRequest" (
  "id" SERIAL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "specialty" TEXT NOT NULL,
  "bio" TEXT NOT NULL,
  "linkedinUrl" TEXT,
  "portfolioUrl" TEXT,
  "organization" TEXT,
  "selectedCourseId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "reviewedByStudentNumber" TEXT,
  "reviewNote" TEXT,
  "approvedMembershipId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainerRegistrationRequest_selectedCourseId_fkey"
    FOREIGN KEY ("selectedCourseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrainerRegistrationRequest_phone_status_idx"
  ON "TrainerRegistrationRequest"("phone", "status");

CREATE INDEX IF NOT EXISTS "TrainerRegistrationRequest_selectedCourseId_status_idx"
  ON "TrainerRegistrationRequest"("selectedCourseId", "status");

CREATE INDEX IF NOT EXISTS "TrainerRegistrationRequest_status_createdAt_idx"
  ON "TrainerRegistrationRequest"("status", "createdAt");
