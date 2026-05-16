import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("profile accessibility contracts", () => {
  it("mantem labels visiveis nos campos de perfil", () => {
    const completarPerfil = source("../pages/CompletarPerfil.tsx");
    const adminProfileGate = source("../pages/Admin.tsx");
    const minhaArea = source("../pages/MinhaArea.tsx");
    const teamCredentialInvitation = source("../pages/TeamCredentialInvitation.tsx");

    expect(completarPerfil).toContain("{field.label}");
    expect(adminProfileGate).toContain(">Instagram</span>");
    expect(adminProfileGate).toContain(">LinkedIn</span>");
    expect(adminProfileGate).toContain(">GitHub</span>");
    expect(adminProfileGate).toContain(">Site / Portfólio</span>");
    expect(minhaArea).toContain(">{label}</span>");
    expect(teamCredentialInvitation).toContain("> Instagram</span>");
    expect(teamCredentialInvitation).toContain("> LinkedIn</span>");
    expect(teamCredentialInvitation).toContain("> GitHub</span>");
  });

  it("mantem foco visivel para navegacao por teclado em controlos base", () => {
    const button = source("../components/ui/button.tsx");
    const input = source("../components/ui/input.tsx");
    const textarea = source("../components/ui/textarea.tsx");
    const checkbox = source("../components/ui/checkbox.tsx");

    for (const content of [button, input, textarea, checkbox]) {
      expect(content).toContain("focus-visible:ring");
    }

    expect(input).toContain("focus-visible:ring-ring/70");
    expect(textarea).toContain("focus-visible:ring-ring/70");
  });
});
