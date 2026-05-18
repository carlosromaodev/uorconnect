ALTER TABLE "OdinAiAnalysis" ADD COLUMN "patternType" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "actionUrgency" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "operationalState" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "ruleRiskScore" INTEGER;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "unifiedRiskScore" INTEGER;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "consistencyCheck" TEXT NOT NULL DEFAULT 'NOT_EVALUATED';
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "consistencyReason" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "evidenceSummary" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "commentAnalysis" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "alternativePlausibility" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "recommendedAction" TEXT;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "votesToReview" INTEGER;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "accountsToReview" INTEGER;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "notifyExpositor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OdinAiAnalysis" ADD COLUMN "cannotBeFalsePositiveIf" TEXT;

CREATE INDEX "OdinAiAnalysis_patternType_createdAt_idx" ON "OdinAiAnalysis"("patternType", "createdAt");
CREATE INDEX "OdinAiAnalysis_actionUrgency_createdAt_idx" ON "OdinAiAnalysis"("actionUrgency", "createdAt");
CREATE INDEX "OdinAiAnalysis_consistencyCheck_createdAt_idx" ON "OdinAiAnalysis"("consistencyCheck", "createdAt");
