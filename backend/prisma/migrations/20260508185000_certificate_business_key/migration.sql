ALTER TABLE "Certificate" ADD COLUMN "businessKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_businessKey_key"
  ON "Certificate"("businessKey");
