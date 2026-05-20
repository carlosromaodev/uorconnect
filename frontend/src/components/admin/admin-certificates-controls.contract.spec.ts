import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("admin certificates controls contract", () => {
  it("exposes official competition certificate types and editable signature fields", () => {
    const component = source("src/components/admin/AdminCertificatesTab.tsx");
    const api = source("src/lib/api.ts");

    expect(api).toContain("\"PHYSICS_CONTEST_WINNER\"");
    expect(api).toContain("\"PROGRAMMING_CONTEST_WINNER\"");
    expect(api).toContain("\"STUDENT_VOTED_BEST_PROJECT\"");
    expect(api).toContain("\"JURY_SELECTED_BEST_PROJECT\"");
    expect(api).toContain("\"FAIR_OUTSTANDING_PARTICIPATION\"");

    expect(component).toContain("Entidade organizadora");
    expect(component).toContain("Título do Reitor");
    expect(component).toContain("Nome do Reitor");
    expect(component).toContain("Título da autoridade direita");
    expect(component).toContain("Nome da autoridade direita");
    expect(component).toContain("buildCertificateMetadata()");
  });
});
