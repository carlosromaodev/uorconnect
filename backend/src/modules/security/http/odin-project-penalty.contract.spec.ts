import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("ODIN project penalty contract", () => {
  it("stores project penalties as auditable ODIN records", () => {
    const schema = source("prisma/schema.prisma");
    const deploySchema = source("prisma/schema.deploy.prisma");

    for (const prismaSchema of [schema, deploySchema]) {
      expect(prismaSchema).toContain("model OdinProjectPenalty");
      expect(prismaSchema).toContain("penaltyMode");
      expect(prismaSchema).toContain("removedVoteCount");
      expect(prismaSchema).toContain("removedPointCount");
      expect(prismaSchema).toContain("automationProofSummary");
      expect(prismaSchema).toContain("automationProofUrl");
      expect(prismaSchema).toContain("automationEvidenceJson");
      expect(prismaSchema).toContain("automationConfidence");
      expect(prismaSchema).toContain("notifiedProjectMembers");
      expect(prismaSchema).toContain("odinProjectPenalties");
      expect(prismaSchema).toContain("@@index([submissionId, createdAt])");
    }
  });

  it("exposes a protected ODIN route that can remove suspicious votes or exact votes and points", () => {
    const routes = source("src/modules/security/http/odin.routes.ts");
    const service = source("src/modules/security/application/odin.service.ts");

    expect(routes).toContain('adminApp.post("/odin/projects/:submissionId/penalties"');
    expect(routes).toContain("odinProjectPenaltyBodySchema");
    expect(routes).toContain("recordOdinProjectPenalty");
    expect(routes).toContain("odin.project_penalty");
    expect(routes).toContain('setDefaultAdminPermission(adminApp, ["SECURITY"])');

    expect(service).toContain("recordOdinProjectPenalty");
    expect(service).toContain("SUSPECT_VOTES");
    expect(service).toContain("EXACT_VOTES");
    expect(service).toContain("AUTOMATION_PROOF");
    expect(service).toContain("normalizeOdinAutomationProof");
    expect(service).toContain("A penalização por automação exige um resumo da prova");
    expect(service).toContain("ODIN_PROJECT_PENALTY");
    expect(service).toContain("studentVote.deleteMany");
    expect(service).toContain("exhibitorScoreEvent.create");
  });

  it("requires automation evidence in the protected route and audit payload", () => {
    const routes = source("src/modules/security/http/odin.routes.ts");

    expect(routes).toContain("automationProofSummary");
    expect(routes).toContain("automationProofUrl");
    expect(routes).toContain("automationEvidence");
    expect(routes).toContain("automationConfidence");
    expect(routes).toContain("AUTOMATION_PROOF");
  });

  it("surfaces the latest penalty warning to project members in Minha Área", () => {
    const presenter = source("src/modules/submission/http/student-submission-presenter.ts");
    const routes = source("src/modules/submission/http/submission.routes.ts");

    expect(presenter).toContain("odinPenaltyWarning");
    expect(presenter).toContain("automationProofSummary");
    expect(presenter).toContain("latestOdinProjectPenalty");
    expect(routes).toContain("odinProjectPenalty.findFirst");
    expect(routes).toContain("automationProofSummary");
    expect(routes).toContain("createdAt: \"desc\"");
  });
});
