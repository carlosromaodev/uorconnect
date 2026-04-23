CREATE TABLE "JuryMember" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastCodeSentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "JuryAccessCode" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "juryMemberId" INTEGER NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeLast4" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByStudentNumber" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "providerResponseJson" TEXT,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  CONSTRAINT "JuryAccessCode_juryMemberId_fkey" FOREIGN KEY ("juryMemberId") REFERENCES "JuryMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "JuryMember_phone_key" ON "JuryMember"("phone");
CREATE INDEX "JuryMember_isActive_createdAt_idx" ON "JuryMember"("isActive", "createdAt");

CREATE INDEX "JuryAccessCode_juryMemberId_sentAt_idx" ON "JuryAccessCode"("juryMemberId", "sentAt");
CREATE INDEX "JuryAccessCode_expiresAt_idx" ON "JuryAccessCode"("expiresAt");
CREATE INDEX "JuryAccessCode_usedAt_idx" ON "JuryAccessCode"("usedAt");
