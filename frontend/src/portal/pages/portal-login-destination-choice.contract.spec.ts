import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("portal login destination choice", () => {
  it("asks normal student logins whether to open the challenge or projects", () => {
    const page = readSource("src/portal/pages/PortalLoginPage.tsx");

    expect(page).toContain('type LoginStage = "idle" | "processing" | "welcome" | "choice"');
    expect(page).toContain("shouldShowStudentDestinationChoice");
    expect(page).toContain("Escolhe por onde queres começar");
    expect(page).toContain("Ver desafio disponível");
    expect(page).toContain("Ver projetos");
    expect(page).toContain('navigate("/minha-area?tab=desafio")');
    expect(page).toContain('navigate("/projetos")');
  });
});
