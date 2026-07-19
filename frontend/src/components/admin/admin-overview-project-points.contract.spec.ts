import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const overviewSource = readFileSync(
  path.join(process.cwd(), "src/components/admin/AdminOverviewTab.tsx"),
  "utf8",
);

describe("admin overview project points contract", () => {
  it("shows audited points beside project votes in top projects", () => {
    expect(overviewSource).toContain("pontos: number");
    expect(overviewSource).toContain("project.votos");
    expect(overviewSource).toContain("project.pontos");
  });
});
