CREATE TABLE "CredentialPrintTemplate" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "category" TEXT NOT NULL,
  "primaryColor" TEXT NOT NULL,
  "accentColor" TEXT NOT NULL,
  "lightColor" TEXT NOT NULL,
  "footerLabel" TEXT,
  "updatedByStudentNumber" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CredentialPrintTemplate_category_key" ON "CredentialPrintTemplate"("category");
CREATE INDEX "CredentialPrintTemplate_updatedAt_idx" ON "CredentialPrintTemplate"("updatedAt");
