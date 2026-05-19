ALTER TABLE "OdinProjectPenalty"
  ADD COLUMN "automationProofSummary" TEXT,
  ADD COLUMN "automationProofUrl" TEXT,
  ADD COLUMN "automationEvidenceJson" TEXT,
  ADD COLUMN "automationConfidence" INTEGER;
