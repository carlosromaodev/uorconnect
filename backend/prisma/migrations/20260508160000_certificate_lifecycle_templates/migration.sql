ALTER TABLE "Certificate" ADD COLUMN "revokedReason" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Certificate" ADD COLUMN "reissuedFromId" INTEGER;
ALTER TABLE "Certificate" ADD COLUMN "templateKey" TEXT;

CREATE INDEX "Certificate_reissuedFromId_idx" ON "Certificate"("reissuedFromId");
CREATE INDEX "Certificate_templateKey_idx" ON "Certificate"("templateKey");
