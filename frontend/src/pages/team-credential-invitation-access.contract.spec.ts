import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("team credential invitation access flow", () => {
  it("recovers invalid student sessions by returning to the academic login instead of blocking the possession link", () => {
    const invitation = source("./TeamCredentialInvitation.tsx");

    expect(invitation).toContain("setToken(null)");
    expect(invitation).toContain("setHasStudentSession(false)");
    expect(invitation).toContain("A tua sessão atual não é uma sessão académica UOR.");
  });

  it("offers the admin entry point after an approved possession request", () => {
    const invitation = source("./TeamCredentialInvitation.tsx");

    expect(invitation).toContain('to="/admin"');
    expect(invitation).toContain("Entrar na admin");
  });

  it("clears a rejected admin session before showing the authorized-login form", () => {
    const admin = source("./Admin.tsx");

    expect(admin).toContain('to="/admin/login"');
    expect(admin).toContain("onClick={() => setToken(null)}");
  });
});
