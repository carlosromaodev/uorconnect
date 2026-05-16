import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("MinhaArea exhibitor round flow", () => {
  it("types and renders the horizontal round multiplier flow for exhibitors", () => {
    const api = readSource("src/lib/api.ts");
    const page = readSource("src/pages/MinhaArea.tsx");
    const css = readSource("src/index.css");

    expect(api).toContain("export interface ExhibitorPassportRoundFlow");
    expect(api).toContain("roundFlow: ExhibitorPassportRoundFlow | null");
    expect(api).toContain("export interface ExhibitorPassportMemberEffort");
    expect(api).toContain("teamActivity: ExhibitorPassportMemberEffort[]");
    expect(page).toContain("exhibitorRoundFlow");
    expect(page).toContain("renderExhibitorTeamActivity");
    expect(page).toContain("desafio-round-flow");
    expect(page).toContain("desafio-round-flow__timer");
    expect(page).toContain("--round-height");
    expect(page).toContain("Multiplicadores por ronda");
    expect(page).toContain("Streaks grandes");
    expect(page).toContain("Empenho da equipa");
    expect(css).toContain(".desafio-round-flow");
    expect(css).toContain(".desafio-round-flow__track");
    expect(css).toContain(".desafio-round-flow__timer");
    expect(css).toContain(".desafio-team-activity");
  });
});
