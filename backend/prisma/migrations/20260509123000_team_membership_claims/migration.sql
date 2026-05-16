CREATE TABLE IF NOT EXISTS "TeamMembershipClaim" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "officialName" TEXT,
  "officialEmail" TEXT,
  "officialCourse" TEXT,
  "officialPhone" TEXT,
  "requestedCategory" TEXT NOT NULL DEFAULT 'NUCLEO',
  "requestedTeam" TEXT NOT NULL,
  "requestedRole" TEXT NOT NULL,
  "requestedAccessLevel" TEXT NOT NULL DEFAULT 'Membro',
  "requestedPermissions" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "photoUrl" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "course" TEXT,
  "organization" TEXT,
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
  "sourceToken" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByStudentNumber" TEXT,
  "teamMembershipId" INTEGER,
  "credentialId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMembershipClaim_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TeamMembershipClaim_teamMembershipId_fkey" FOREIGN KEY ("teamMembershipId") REFERENCES "TeamMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TeamMembershipClaim_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "EventTeamCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TeamMembershipClaim_studentNumber_status_idx" ON "TeamMembershipClaim"("studentNumber", "status");
CREATE INDEX IF NOT EXISTS "TeamMembershipClaim_status_createdAt_idx" ON "TeamMembershipClaim"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "TeamMembershipClaim_requestedTeam_requestedRole_idx" ON "TeamMembershipClaim"("requestedTeam", "requestedRole");
CREATE INDEX IF NOT EXISTS "TeamMembershipClaim_teamMembershipId_idx" ON "TeamMembershipClaim"("teamMembershipId");
CREATE INDEX IF NOT EXISTS "TeamMembershipClaim_credentialId_idx" ON "TeamMembershipClaim"("credentialId");
