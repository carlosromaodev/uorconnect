import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("home passport challenge promo", () => {
  it("renders a boarding-pass promo that sends students to Minha Area desafio", () => {
    const source = readSource("./Index.tsx");

    expect(source).toContain("function PassportChallengePromo");
    expect(source).toContain("Chegou o Desafio UOR Connect");
    expect(source).toContain('to="/minha-area?tab=desafio"');
    expect(source).toContain("Prime Video");
    expect(source).toContain("HBO");
    expect(source).toContain("Duolingo");
  });

  it("places the promo after stats and before Top Projetos", () => {
    const source = readSource("./Index.tsx");

    const statsIndex = source.indexOf("STATS BAR + QUICK LINKS");
    const promoIndex = source.indexOf("<PassportChallengePromo />");
    const topProjectsIndex = source.indexOf("TOP PROJETOS");

    expect(statsIndex).toBeGreaterThan(-1);
    expect(promoIndex).toBeGreaterThan(statsIndex);
    expect(topProjectsIndex).toBeGreaterThan(promoIndex);
  });
});
