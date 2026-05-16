import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("home sem projeto Laboratorio", () => {
  it("mostra Desafio apontando para Minha Area no lugar do Laboratorio", () => {
    const source = readSource("./Index.tsx");

    expect(source).toContain('label: "Desafio"');
    expect(source).toContain('path: "/minha-area?tab=desafio"');
    expect(source).toMatch(/import\s*\{[\s\S]*\bTrophy\b[\s\S]*\}\s*from\s*"lucide-react"/);
    expect(source).not.toContain("Entrar no Laboratório");
    expect(source).not.toContain("laboratorioHref");
    expect(source).not.toContain("getContestAbsoluteUrl");
  });

  it("nao mantem rotas visiveis do Laboratorio no app principal", () => {
    const source = readSource("../App.tsx");

    expect(source).not.toContain("ContestExperienceRedirect");
    expect(source).not.toContain("isContestLabHost");
    expect(source).not.toContain("isContestRoutePath");
    expect(source).toContain('to="/minha-area?tab=desafio"');
  });
});
