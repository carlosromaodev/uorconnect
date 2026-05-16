import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("external project team members", () => {
  it("lets the project responsible confirm an external member with generated login credentials", () => {
    const area = readSource("src/pages/MinhaArea.tsx");
    const api = readSource("src/lib/api.ts");

    expect(area).toContain("teamMemberExternalDrafts");
    expect(area).toContain("handleConfirmExternalTeamMember");
    expect(area).toContain("Outra universidade / instituto médio");
    expect(area).toContain("Senha temporária");
    expect(api).toContain("confirmTeamMemberExternal");
    expect(api).toContain("`/submissions/${id}/team/members/${memberId}/confirm-external`");
  });

  it("lets the project responsible remove non-responsible members from Minha Area", () => {
    const area = readSource("src/pages/MinhaArea.tsx");
    const api = readSource("src/lib/api.ts");

    expect(area).toContain("handleRemoveTeamMember");
    expect(area).toContain("Remover membro");
    expect(api).toContain("removeTeamMember");
    expect(api).toContain("`/submissions/${id}/team/members/${memberId}`");
  });
});
