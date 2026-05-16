import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("AdminStudentsTab university and access type filters", () => {
  it("exposes university/access filtering and sends it to the paged students API", () => {
    const tab = readSource("./AdminStudentsTab.tsx");
    const workspace = readSource("../../features/admin/AdminWorkspace.tsx");
    const api = readSource("../../lib/api.ts");

    expect(tab).toContain("availableStudentUniversities");
    expect(tab).toContain("studentUniversityFilter");
    expect(tab).toContain("studentAccessTypeFilter");
    expect(tab).toContain("Todas as universidades");
    expect(tab).toContain("Todos os acessos");
    expect(tab).toContain("Oficiais");
    expect(tab).toContain("Temporários");
    expect(tab).toContain("Universidade:");
    expect(tab).toContain("Acesso:");
    expect(tab).toContain("universidades nesta página");
    expect(tab).toContain("accessType === \"OFFICIAL\"");

    expect(workspace).toContain("studentUniversityFilter");
    expect(workspace).toContain("studentAccessTypeFilter");
    expect(workspace).toContain("availableStudentUniversities");
    expect(workspace).toContain("university:");
    expect(workspace).toContain("accessType:");
    expect(workspace).toContain("studentUniversityFilter === \"todos\" ? undefined : studentUniversityFilter");
    expect(workspace).toContain("studentAccessTypeFilter === \"todos\" ? undefined : studentAccessTypeFilter");

    expect(api).toContain("university?: string");
    expect(api).toContain('accessType?: "OFFICIAL" | "TEMPORARY"');
    expect(api).toContain("university_asc");
  });
});
