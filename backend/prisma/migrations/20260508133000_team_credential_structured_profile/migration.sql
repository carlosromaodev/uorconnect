ALTER TABLE "EventTeamCredential" ADD COLUMN "address" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "githubUrl" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "consentPhotoCredential" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventTeamCredential" ADD COLUMN "consentPublicProfile" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventTeamCredential" ADD COLUMN "consentSocialLinks" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventTeamCredential" ADD COLUMN "consentSms" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventTeamCredential" ADD COLUMN "consentWhatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventTeamCredential" ADD COLUMN "sourceSubmissionId" INTEGER;
ALTER TABLE "EventTeamCredential" ADD COLUMN "sourceSubmissionRef" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "sourceSubmissionName" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "sourceSubmissionType" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "sourceSubmissionArea" TEXT;

UPDATE "EventTeamCredential"
SET
  "address" = json_extract("notes", '$.address'),
  "instagramUrl" = json_extract("notes", '$.social.instagram'),
  "facebookUrl" = json_extract("notes", '$.social.facebook'),
  "linkedinUrl" = json_extract("notes", '$.social.linkedin'),
  "githubUrl" = json_extract("notes", '$.social.github'),
  "websiteUrl" = json_extract("notes", '$.social.website'),
  "consentPhotoCredential" = CASE WHEN json_extract("notes", '$.consent.photoCredential') = 1 THEN true ELSE false END,
  "consentPublicProfile" = CASE WHEN json_extract("notes", '$.consent.publicProfile') = 1 THEN true ELSE false END,
  "consentSocialLinks" = CASE WHEN json_extract("notes", '$.consent.socialLinks') = 1 THEN true ELSE false END,
  "consentSms" = CASE WHEN json_extract("notes", '$.consent.sms') = 1 THEN true ELSE false END,
  "consentWhatsapp" = CASE WHEN json_extract("notes", '$.consent.whatsapp') = 1 THEN true ELSE false END,
  "sourceSubmissionId" = json_extract("notes", '$.submissionId'),
  "sourceSubmissionRef" = json_extract("notes", '$.submissionRef'),
  "sourceSubmissionName" = json_extract("notes", '$.submissionName'),
  "sourceSubmissionType" = json_extract("notes", '$.submissionType'),
  "sourceSubmissionArea" = json_extract("notes", '$.submissionArea')
WHERE
  "notes" IS NOT NULL
  AND json_valid("notes")
  AND json_extract("notes", '$.profileExtras') = 1;

CREATE INDEX "EventTeamCredential_sourceSubmissionId_idx" ON "EventTeamCredential"("sourceSubmissionId");
