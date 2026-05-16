ALTER TABLE "EventTeamCredential" ADD COLUMN "teamMembershipId" INTEGER REFERENCES "TeamMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "EventTeamCredential_teamMembershipId_idx" ON "EventTeamCredential"("teamMembershipId");
