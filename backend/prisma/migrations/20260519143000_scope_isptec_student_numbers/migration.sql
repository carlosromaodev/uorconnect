CREATE TEMP TABLE IF NOT EXISTS "__IsptecStudentNumberRemap" (
  "studentId" INTEGER PRIMARY KEY,
  "oldStudentNumber" TEXT NOT NULL,
  "nextStudentNumber" TEXT NOT NULL
);

DELETE FROM "__IsptecStudentNumberRemap";

INSERT INTO "__IsptecStudentNumberRemap" ("studentId", "oldStudentNumber", "nextStudentNumber")
SELECT
  "id",
  "studentNumber",
  'ISPTEC-' || REPLACE("studentNumber", 'ISPTEC-', '')
FROM "Student"
WHERE
  "studentNumber" NOT LIKE 'ISPTEC-%'
  AND (
    UPPER(COALESCE("registrationSource", '')) = 'ISPTEC_OFFICIAL'
    OR UPPER(COALESCE("university", '')) LIKE '%ISPTEC%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Student" AS "ExistingStudent"
    WHERE "ExistingStudent"."studentNumber" = 'ISPTEC-' || REPLACE("Student"."studentNumber", 'ISPTEC-', '')
  );

UPDATE "Student"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "Student"."id"
)
WHERE "id" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "TeamMembership"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."oldStudentNumber" = "TeamMembership"."studentNumber"
)
WHERE "studentNumber" IN (SELECT "oldStudentNumber" FROM "__IsptecStudentNumberRemap");

UPDATE "TeamMembershipClaim"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "TeamMembershipClaim"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "StudentLoginAudit"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "StudentLoginAudit"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "OdinEvent"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "OdinEvent"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "Submission"
SET "studentNumberSnapshot" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "Submission"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "SubmissionMember"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "SubmissionMember"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "CourseEnrollment"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "CourseEnrollment"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "SmsCampaignRecipient"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "SmsCampaignRecipient"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "WhatsAppCampaignRecipient"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "WhatsAppCampaignRecipient"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "AttendanceCredential"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "AttendanceCredential"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "AttendanceCheckIn"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "AttendanceCheckIn"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "Certificate"
SET "recipientNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "Certificate"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "QrActionScan"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "QrActionScan"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "PassportChallengeAnswer"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "PassportChallengeAnswer"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "PassportSurpriseEffectLedger"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "PassportSurpriseEffectLedger"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "PassportScan"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "PassportScan"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "PassportPointLedger"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "PassportPointLedger"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "PassportPointRecovery"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "PassportPointRecovery"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

UPDATE "PassportStudentBadge"
SET "studentNumber" = (
  SELECT "nextStudentNumber"
  FROM "__IsptecStudentNumberRemap"
  WHERE "__IsptecStudentNumberRemap"."studentId" = "PassportStudentBadge"."studentId"
)
WHERE "studentId" IN (SELECT "studentId" FROM "__IsptecStudentNumberRemap");

DROP TABLE "__IsptecStudentNumberRemap";
