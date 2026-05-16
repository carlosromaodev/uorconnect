CREATE TABLE "StudentProfileExtra" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "studentId" INTEGER NOT NULL,
  "bio" TEXT,
  "address" TEXT,
  "instagramUrl" TEXT,
  "facebookUrl" TEXT,
  "linkedinUrl" TEXT,
  "githubUrl" TEXT,
  "websiteUrl" TEXT,
  "consentPhotoCredential" BOOLEAN NOT NULL DEFAULT false,
  "consentPublicProfile" BOOLEAN NOT NULL DEFAULT false,
  "consentSocialLinks" BOOLEAN NOT NULL DEFAULT false,
  "consentSms" BOOLEAN NOT NULL DEFAULT false,
  "consentWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "visibilityJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentProfileExtra_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "StudentProfileExtra" (
  "studentId",
  "bio",
  "address",
  "instagramUrl",
  "facebookUrl",
  "linkedinUrl",
  "githubUrl",
  "websiteUrl",
  "consentPhotoCredential",
  "consentPublicProfile",
  "consentSocialLinks"
)
SELECT
  "id",
  "bio",
  "address",
  "instagramUrl",
  "facebookUrl",
  "linkedinUrl",
  "githubUrl",
  "websiteUrl",
  CASE WHEN "avatarUrl" IS NOT NULL AND TRIM("avatarUrl") <> '' THEN true ELSE false END,
  CASE WHEN "profileCompletedAt" IS NOT NULL THEN true ELSE false END,
  CASE
    WHEN COALESCE(TRIM("instagramUrl"), '') <> ''
      OR COALESCE(TRIM("facebookUrl"), '') <> ''
      OR COALESCE(TRIM("linkedinUrl"), '') <> ''
      OR COALESCE(TRIM("githubUrl"), '') <> ''
      OR COALESCE(TRIM("websiteUrl"), '') <> ''
    THEN true
    ELSE false
  END
FROM "Student"
WHERE
  COALESCE(TRIM("bio"), '') <> ''
  OR COALESCE(TRIM("address"), '') <> ''
  OR COALESCE(TRIM("instagramUrl"), '') <> ''
  OR COALESCE(TRIM("facebookUrl"), '') <> ''
  OR COALESCE(TRIM("linkedinUrl"), '') <> ''
  OR COALESCE(TRIM("githubUrl"), '') <> ''
  OR COALESCE(TRIM("websiteUrl"), '') <> ''
  OR "avatarUrl" IS NOT NULL
  OR "profileCompletedAt" IS NOT NULL;

CREATE UNIQUE INDEX "StudentProfileExtra_studentId_key" ON "StudentProfileExtra"("studentId");
CREATE INDEX "StudentProfileExtra_studentId_idx" ON "StudentProfileExtra"("studentId");
CREATE INDEX "StudentProfileExtra_updatedAt_idx" ON "StudentProfileExtra"("updatedAt");

CREATE TRIGGER IF NOT EXISTS student_profile_extra_updated_at
AFTER UPDATE ON "StudentProfileExtra"
FOR EACH ROW
BEGIN
  UPDATE "StudentProfileExtra"
  SET "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."id";
END;
