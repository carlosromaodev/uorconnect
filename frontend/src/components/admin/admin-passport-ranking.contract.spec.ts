import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const passportSource = readFileSync(
  path.join(process.cwd(), "src/components/admin/AdminPassportTab.tsx"),
  "utf8",
);
const workspaceSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/AdminWorkspace.tsx"),
  "utf8",
);

describe("admin passport ranking subpage", () => {
  it("exposes a dedicated Ranking subpage inside the passport admin area", () => {
    expect(workspaceSource).toContain("passportSubpages");
    expect(workspaceSource).toContain("activePassportSubpage");
    expect(workspaceSource).toContain('id: "ranking", label: "Ranking"');
    expect(workspaceSource).toContain('tab.id === "passport"');
    expect(workspaceSource).toContain("Passaporte · ${activePassportSubpageMeta.label}");
    expect(workspaceSource).toContain("activeSubpage={activePassportSubpage}");
    expect(passportSource).toContain("onSubpageChange");
    expect(passportSource).toContain("activePassportSubpage");
    expect(passportSource).toContain("setActivePassportSubpage(\"ranking\")");
    expect(passportSource).toContain("Ranking oficial");
    expect(passportSource).toContain("rankingRows.map");
  });
});
