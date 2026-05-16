import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("portal login institutional design", () => {
  it("uses a simple centered entrance without institution logo blocks", () => {
    const page = readSource("src/portal/pages/PortalLoginPage.tsx");

    expect(page).toContain("max-w-[420px]");
    expect(page).toContain("bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400");
    expect(page).toContain("Iniciar sessão");
    expect(page).toContain("Escolhe o teu tipo de acesso");
    expect(page).not.toContain("loginInstitutionLogos");
    expect(page).not.toContain("/logo-uor.png");
    expect(page).not.toContain("/logo-isptec.svg");
    expect(page).not.toContain("login-orbit");
    expect(page).not.toContain("lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,420px)]");
  });
});
