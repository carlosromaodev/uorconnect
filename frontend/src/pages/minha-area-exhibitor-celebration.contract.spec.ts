import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMinhaAreaSource() {
  return readFileSync(join(process.cwd(), "src/pages/MinhaArea.tsx"), "utf8");
}

describe("Minha Area exhibitor passport celebrations", () => {
  it("uses a dedicated game celebration when every exhibitor reaches Bronze+", () => {
    const source = readMinhaAreaSource();

    expect(source).toContain("buildExhibitorPassportCelebration");
    expect(source).toContain("TEAM_BRONZE_PLUS");
    expect(source).toContain("Equipa Bronze+ desbloqueada");
    expect(source).toContain('tone: "challenge"');
    expect(source).toContain('effect: "victory"');
    expect(source).toContain("showScanCelebration(celebration)");
  });
});
