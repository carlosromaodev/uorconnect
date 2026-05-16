ALTER TABLE "EventTeamCredential" ADD COLUMN "invitationExpiresAt" DATETIME;

CREATE INDEX "EventTeamCredential_invitationExpiresAt_idx" ON "EventTeamCredential"("invitationExpiresAt");
