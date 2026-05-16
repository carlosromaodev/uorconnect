UPDATE "EventTeamCredential"
SET
  "address" = COALESCE("address", json_extract("notes", '$.address')),
  "instagramUrl" = COALESCE("instagramUrl", json_extract("notes", '$.social.instagram')),
  "facebookUrl" = COALESCE("facebookUrl", json_extract("notes", '$.social.facebook')),
  "linkedinUrl" = COALESCE("linkedinUrl", json_extract("notes", '$.social.linkedin')),
  "githubUrl" = COALESCE("githubUrl", json_extract("notes", '$.social.github')),
  "websiteUrl" = COALESCE("websiteUrl", json_extract("notes", '$.social.website')),
  "consentPhotoCredential" = CASE
    WHEN "consentPhotoCredential" = true THEN true
    WHEN json_extract("notes", '$.consent.photoCredential') = 1 THEN true
    ELSE false
  END,
  "consentPublicProfile" = CASE
    WHEN "consentPublicProfile" = true THEN true
    WHEN json_extract("notes", '$.consent.publicProfile') = 1 THEN true
    ELSE false
  END,
  "consentSocialLinks" = CASE
    WHEN "consentSocialLinks" = true THEN true
    WHEN json_extract("notes", '$.consent.socialLinks') = 1 THEN true
    ELSE false
  END,
  "consentSms" = CASE
    WHEN "consentSms" = true THEN true
    WHEN json_extract("notes", '$.consent.sms') = 1 THEN true
    ELSE false
  END,
  "consentWhatsapp" = CASE
    WHEN "consentWhatsapp" = true THEN true
    WHEN json_extract("notes", '$.consent.whatsapp') = 1 THEN true
    ELSE false
  END,
  "sourceSubmissionId" = COALESCE("sourceSubmissionId", json_extract("notes", '$.submissionId')),
  "sourceSubmissionRef" = COALESCE("sourceSubmissionRef", json_extract("notes", '$.submissionRef')),
  "sourceSubmissionName" = COALESCE("sourceSubmissionName", json_extract("notes", '$.submissionName')),
  "sourceSubmissionType" = COALESCE("sourceSubmissionType", json_extract("notes", '$.submissionType')),
  "sourceSubmissionArea" = COALESCE("sourceSubmissionArea", json_extract("notes", '$.submissionArea')),
  "notes" = NULL
WHERE
  "notes" IS NOT NULL
  AND json_valid("notes")
  AND json_extract("notes", '$.profileExtras') = 1;
