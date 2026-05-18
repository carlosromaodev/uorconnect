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

describe("admin submission type editor", () => {
  it("allows admins to change a submission between project, business and product", () => {
    expect(workspaceSource).toContain("handleSubmissionTypeChange");
    expect(workspaceSource).toContain("submission-type-${submission.id}");
    expect(workspaceSource).toContain("Projeto");
    expect(workspaceSource).toContain("Negócio");
    expect(workspaceSource).toContain("Produto");
  });

  it("calls the protected submission type endpoint", () => {
    expect(apiSource).toContain("updateType: (");
    expect(apiSource).toContain("`/submissions/${id}/type`");
    expect(apiSource).toContain('method: "PATCH"');
  });
});
