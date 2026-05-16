CREATE TABLE "CredentialValidationLog" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tokenHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "credentialId" TEXT,
  "status" TEXT,
  "valid" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'PUBLIC_VALIDATION',
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CredentialValidationLog_kind_createdAt_idx" ON "CredentialValidationLog"("kind", "createdAt");
CREATE INDEX "CredentialValidationLog_tokenHash_createdAt_idx" ON "CredentialValidationLog"("tokenHash", "createdAt");
CREATE INDEX "CredentialValidationLog_credentialId_createdAt_idx" ON "CredentialValidationLog"("credentialId", "createdAt");
