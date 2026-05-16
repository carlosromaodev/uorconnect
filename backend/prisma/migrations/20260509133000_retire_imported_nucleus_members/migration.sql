UPDATE "TeamMembership"
SET
  "status" = 'REMOVED',
  "notes" = COALESCE("notes", 'Removido pela transição para tomada de posse por solicitação aprovada.'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "source" = 'NUCLEO_IMPORT'
  AND "status" <> 'REMOVED';

UPDATE "EventTeamCredential"
SET
  "status" = 'DISABLED',
  "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP),
  "revokedReason" = COALESCE("revokedReason", 'Credencial desativada pela transição para tomada de posse por solicitação aprovada.')
WHERE "category" = 'NUCLEO'
  AND "status" NOT IN ('DISABLED', 'REVOKED')
  AND "teamMembershipId" IN (
    SELECT "id"
    FROM "TeamMembership"
    WHERE "source" = 'NUCLEO_IMPORT'
  );
