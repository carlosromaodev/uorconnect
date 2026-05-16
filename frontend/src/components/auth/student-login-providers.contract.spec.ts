import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("student academic login providers", () => {
  it("offers only official UOR and ISPTEC academic login", () => {
    const form = readSource("src/components/auth/StudentLoginForm.tsx");
    const api = readSource("src/lib/api.ts");

    expect(form).toContain('useState<"uor" | "isptec">("uor")');
    expect(form).toContain('useState<"studentNumber" | "username">("studentNumber")');
    expect(form).toContain("Estudante ISPTEC");
    expect(form).toContain("Nome de utilizador");
    expect(form).toContain("maxLength={identifierType === \"username\" ? 40 : 12}");
    expect(form).toContain("identifierType");
    expect(form).toContain('loginMode === "isptec" ? "isptec" : "uor"');
    expect(form).not.toContain('"conventional"');
    expect(form).not.toContain("Acesso por SMS");
    expect(form).not.toContain("Enviar código por SMS");
    expect(form).not.toContain("conventionalRegister");
    expect(form).not.toContain("conventionalVerify");
    expect(api).toContain('provider?: "uor" | "isptec"');
    expect(api).toContain('identifierType?: "studentNumber" | "username"');
    expect(api).toContain("JSON.stringify({ studentNumber, password, origin, provider, identifierType })");
    expect(api).not.toContain("conventionalRegister");
    expect(api).not.toContain("conventionalVerify");
  });

  it("uses simple text buttons for the official login categories without institution logos", () => {
    const form = readSource("src/components/auth/StudentLoginForm.tsx");

    expect(form).toContain("academicLoginThemes");
    expect(form).toContain("Estudante UOR");
    expect(form).toContain("Estudante ISPTEC");
    expect(form).toContain("inline-flex items-center justify-center gap-2");
    expect(form).toContain("border-slate-950 bg-slate-950 text-white");
    expect(form).toContain("OU");
    expect(form).not.toContain("logoSrc");
    expect(form).not.toContain("/logo-uor.png");
    expect(form).not.toContain("/logo-isptec.svg");
    expect(form).toContain("Universidade Oscar Ribas");
    expect(form).toContain("Portal Académico ISPTEC");
    expect(form).toContain("activeAcademicTheme");
    expect(form).toContain("Entrar com UOR");
    expect(form).toContain("Entrar com ISPTEC");
  });
});
