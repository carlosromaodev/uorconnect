ALTER TABLE "Submission" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "Submission" ADD COLUMN "paymentSubmittedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "paymentReviewedAt" DATETIME;
ALTER TABLE "Submission" ADD COLUMN "paymentReviewedByStudentNumber" TEXT;
ALTER TABLE "Submission" ADD COLUMN "paymentReviewNote" TEXT;

UPDATE "Submission"
SET "paymentStatus" = CASE
  WHEN "paymentConfirmed" = 1 THEN 'PENDING_REVIEW'
  ELSE 'SUBMITTED_BY_USER'
END,
"paymentSubmittedAt" = COALESCE("updatedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Submission_paymentStatus_updatedAt_idx"
  ON "Submission"("paymentStatus", "updatedAt");

ALTER TABLE "CourseEnrollment" ADD COLUMN "paymentReviewedAt" DATETIME;
ALTER TABLE "CourseEnrollment" ADD COLUMN "paymentReviewedByStudentNumber" TEXT;
ALTER TABLE "CourseEnrollment" ADD COLUMN "paymentReviewNote" TEXT;

UPDATE "CourseEnrollment"
SET "paymentStatus" = CASE
  WHEN "paymentStatus" IN ('CONFIRMED', 'APPROVED') THEN 'CONFIRMED_BY_ADMIN'
  WHEN "paymentStatus" = 'PENDING' THEN 'PENDING_REVIEW'
  WHEN "paymentStatus" = 'REJECTED' THEN 'REJECTED'
  WHEN "paymentStatus" = 'CANCELED' THEN 'CANCELED'
  ELSE 'SUBMITTED_BY_USER'
END;
