import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Admin ODIN contract", () => {
  it("adds a dedicated ODIN security area to admin navigation", () => {
    const workspace = source("src/features/admin/AdminWorkspace.tsx");

    expect(workspace).toContain("AdminOdinTab");
    expect(workspace).toContain('id: "odin"');
    expect(workspace).toContain('label: "ODIN"');
    expect(workspace).toContain('permission: "SECURITY"');
    expect(workspace).toContain('activeTab === "odin"');
  });

  it("renders suspicious devices, students, projects and audited exclusion actions", () => {
    const odinTab = source("src/components/admin/AdminOdinTab.tsx");
    const api = source("src/lib/api.ts");

    expect(odinTab).toContain("Sala de Operações ODIN");
    expect(odinTab).toContain("Mesma cookie/dispositivo");
    expect(odinTab).toContain("Fila de prioridade");
    expect(odinTab).toContain("Ação imediata");
    expect(odinTab).toContain("Logins no dispositivo");
    expect(odinTab).toContain("loginTimeline");
    expect(odinTab).toContain("firstLoginAt");
    expect(odinTab).toContain("Zona restrita");
    expect(odinTab).toContain("Exclusão bloqueada até análise ODIN");
    expect(odinTab).toContain("Digite o número do estudante para confirmar");
    expect(odinTab).toContain("Excluír perfil e limpar ações");
    expect(odinTab).toContain("removeVotes");
    expect(odinTab).toContain("removePassport");
    expect(odinTab).toContain("api.odin.overview");
    expect(odinTab).toContain("api.odin.excludeStudent");
    expect(api).toContain("/security/odin/overview");
    expect(api).toContain("/security/odin/students/");
  });
});
