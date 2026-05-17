CREATE TABLE "OdinAiAnalysis" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "caseType" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "narrative" TEXT NOT NULL,
  "fraudProbability" INTEGER NOT NULL,
  "legitimateProbability" INTEGER NOT NULL,
  "mostLikelyScenario" TEXT NOT NULL,
  "alternativeScenario" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "confidenceLevel" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "tokensUsed" INTEGER,
  "payloadHash" TEXT NOT NULL,
  "rawResponseJson" TEXT,
  "createdByStudentNumber" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "OdinAiFeedback" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "analysisId" INTEGER NOT NULL,
  "actorStudentNumber" TEXT,
  "useful" BOOLEAN NOT NULL,
  "recommendationCorrect" BOOLEAN,
  "realityMatched" BOOLEAN,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OdinAiFeedback_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "OdinAiAnalysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OdinAiAnalysis_caseType_caseId_createdAt_idx" ON "OdinAiAnalysis"("caseType", "caseId", "createdAt");
CREATE INDEX "OdinAiAnalysis_riskLevel_createdAt_idx" ON "OdinAiAnalysis"("riskLevel", "createdAt");
CREATE INDEX "OdinAiAnalysis_actionType_createdAt_idx" ON "OdinAiAnalysis"("actionType", "createdAt");
CREATE INDEX "OdinAiAnalysis_payloadHash_idx" ON "OdinAiAnalysis"("payloadHash");
CREATE INDEX "OdinAiFeedback_analysisId_createdAt_idx" ON "OdinAiFeedback"("analysisId", "createdAt");
CREATE INDEX "OdinAiFeedback_actorStudentNumber_createdAt_idx" ON "OdinAiFeedback"("actorStudentNumber", "createdAt");
