import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/AdminWorkspace.tsx"),
  "utf8",
);
const apiSource = readFileSync(
  path.join(process.cwd(), "src/lib/api.ts"),
  "utf8",
);
const source = `${workspaceSource}\n${apiSource}`;

describe("admin submission project map", () => {
  it("adds a candidaturas subpage with responsible year filters and project statistics", () => {
    expect(source).toContain('"project-map"');
    expect(source).toContain("Mapa de projetos");
    expect(source).toContain("projectMapYearFilter");
    expect(source).toContain("projectMapSearchTerm");
    expect(source).toContain("api.submissions.projectMap");
    expect(source).toContain("/submissions/project-map");
    expect(source).toContain("Universidades alcançadas");
    expect(source).toContain("Cursos que mais votaram");
    expect(source).toContain("Turmas que mais votaram");
  });
});
