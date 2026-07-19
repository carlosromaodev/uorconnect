import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const winnersSource = readFileSync(
  path.join(process.cwd(), "src/components/admin/AdminWinnersTab.tsx"),
  "utf8",
);
const workspaceSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/AdminWorkspace.tsx"),
  "utf8",
);

describe("admin winners points contract", () => {
  it("orders winners by audited points and shows points next to votes", () => {
    expect(winnersSource).toContain("pontos: number");
    expect(winnersSource).toContain("b.pontos - a.pontos");
    expect(winnersSource).toContain("project.pontos");
    expect(winnersSource).toContain("ponto(s)");
    expect(workspaceSource).toContain('status: submissionStatusMap.get(project.id) ?? "aprovado"');
  });
});
