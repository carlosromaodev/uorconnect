import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Minha Área project public details", () => {
  it("lets the project owner edit public description and links from the mobile project card", () => {
    const area = readSource("src/pages/MinhaArea.tsx");
    const api = readSource("src/lib/api.ts");

    expect(area).toContain("ProjectPublicDetailsDraft");
    expect(area).toContain("Detalhes públicos do projeto");
    expect(area).toContain("Guardar detalhes públicos");
    expect(area).toContain("handleSaveProjectPublicDetails");
    expect(area).toContain("instagramUrl");
    expect(area).toContain("linkedinUrl");
    expect(api).toContain("updateOwnPresentation");
    expect(api).toContain("description?: string");
    expect(api).toContain("githubUrl?: string | null");
  });

  it("shows the saved project social links on the public project page", () => {
    const detail = readSource("src/pages/ProjetoDetalhe.tsx");
    const api = readSource("src/lib/api.ts");

    expect(detail).toContain("projectPublicLinks");
    expect(detail).toContain("Instagram");
    expect(detail).toContain("LinkedIn");
    expect(detail).toContain("Facebook");
    expect(api).toContain("instagramUrl: string | null");
    expect(api).toContain("facebookUrl: string | null");
  });
});
