import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Admin ODIN project penalty contract", () => {
  it("adds API bindings for project penalties", () => {
    const api = source("src/lib/api.ts");

    expect(api).toContain("OdinProjectPenaltyInput");
    expect(api).toContain("OdinProjectPenaltyResult");
    expect(api).toContain("penalizeProject");
    expect(api).toContain("/security/odin/projects/${submissionId}/penalties");
    expect(api).toContain("removedVoteCount");
    expect(api).toContain("removedPointCount");
  });

  it("renders protected penalty controls inside ODIN project pressure cards", () => {
    const odinTab = source("src/components/admin/AdminOdinTab.tsx");

    expect(odinTab).toContain("Penalizar projeto");
    expect(odinTab).toContain("penaltyDialogProject");
    expect(odinTab).toContain("handleApplyProjectPenalty");
    expect(odinTab).toContain("api.odin.penalizeProject");
    expect(odinTab).toContain("Remover votos suspeitos");
    expect(odinTab).toContain("Quantidade exata");
    expect(odinTab).toContain("Pontos a remover");
  });

  it("shows project penalty warnings to affected project members in Minha Área", () => {
    const api = source("src/lib/api.ts");
    const minhaArea = source("src/pages/MinhaArea.tsx");

    expect(api).toContain("odinPenaltyWarning");
    expect(minhaArea).toContain("odinPenaltyBlocker");
    expect(minhaArea).toContain("Penalização ODIN aplicada");
    expect(minhaArea).toContain("Votos removidos");
    expect(minhaArea).toContain("Pontos removidos");
  });
});
