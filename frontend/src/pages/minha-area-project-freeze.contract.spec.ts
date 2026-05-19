import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const minhaAreaSource = readFileSync(
  path.join(process.cwd(), "src/pages/MinhaArea.tsx"),
  "utf8",
);

const apiSource = readFileSync(
  path.join(process.cwd(), "src/lib/api.ts"),
  "utf8",
);

const projetosSource = readFileSync(
  path.join(process.cwd(), "src/pages/Projetos.tsx"),
  "utf8",
);

describe("student project freeze experience", () => {
  it("shows a blocking modal in Minha Área for members of frozen projects", () => {
    expect(minhaAreaSource).toContain("frozenProjectBlocker");
    expect(minhaAreaSource).toContain("Projeto congelado");
    expect(minhaAreaSource).toContain("Procura a organização UOR Connect com urgência");
    expect(minhaAreaSource).toContain("open={Boolean(frozenProjectBlocker)}");
  });

  it("types frozen projects and prevents public vote actions in project cards", () => {
    expect(apiSource).toContain("projectFrozen: boolean");
    expect(apiSource).toContain("projectFrozenAt: string | null");
    expect(projetosSource).toContain("project.projectFrozen");
    expect(projetosSource).toContain("Projeto suspenso");
  });
});
