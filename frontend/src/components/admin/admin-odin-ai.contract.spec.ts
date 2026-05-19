import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Admin ODIN 2.0 AI contract", () => {
  it("adds API bindings for Gemini-assisted ODIN analysis and feedback", () => {
    const api = source("src/lib/api.ts");

    expect(api).toContain("OdinAiAnalysis");
    expect(api).toContain("analyzeCase");
    expect(api).toContain("/security/odin/ai/analyze");
    expect(api).toContain("sendAiFeedback");
    expect(api).toContain("/security/odin/ai/analyses/${analysisId}/feedback");
    expect(api).toContain("downloadProjectSecurityReportPdf");
    expect(api).toContain("/security/odin/projects/${submissionId}/report.pdf");
  });

  it("renders AI narrative, probability, recommendation and feedback in ODIN admin", () => {
    const odinTab = source("src/components/admin/AdminOdinTab.tsx");

    expect(odinTab).toContain("ODIN 2.0");
    expect(odinTab).toContain("Analisar com AI");
    expect(odinTab).toContain("fraudProbability");
    expect(odinTab).toContain("patternType");
    expect(odinTab).toContain("consistencyCheck");
    expect(odinTab).toContain("recommendedAction");
    expect(odinTab).toContain("legitimateProbability");
    expect(odinTab).toContain("Cenário alternativo");
    expect(odinTab).toContain("Útil");
    expect(odinTab).toContain("api.odin.analyzeCase");
    expect(odinTab).toContain("api.odin.sendAiFeedback");
    expect(odinTab).toContain("Relatório do projeto");
    expect(odinTab).toContain("api.odin.downloadProjectSecurityReportPdf");
  });
});
