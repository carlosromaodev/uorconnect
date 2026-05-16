ALTER TABLE "EventTeamCredential" ADD COLUMN "issuedAt" DATETIME;
ALTER TABLE "EventTeamCredential" ADD COLUMN "issuedByStudentNumber" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "EventTeamCredential" ADD COLUMN "revokedAt" DATETIME;
ALTER TABLE "EventTeamCredential" ADD COLUMN "revokedReason" TEXT;
ALTER TABLE "EventTeamCredential" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EventTeamCredential" ADD COLUMN "reissuedFromId" INTEGER;

CREATE INDEX "EventTeamCredential_expiresAt_idx" ON "EventTeamCredential"("expiresAt");
CREATE INDEX "EventTeamCredential_revokedAt_idx" ON "EventTeamCredential"("revokedAt");
CREATE INDEX "EventTeamCredential_reissuedFromId_idx" ON "EventTeamCredential"("reissuedFromId");
