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

describe("admin project freeze UI contract", () => {
  it("adds freeze and unfreeze actions to project administration", () => {
    expect(workspaceSource).toContain("handleSubmissionFreezeToggle");
    expect(workspaceSource).toContain("Congelar projeto");
    expect(workspaceSource).toContain("Descongelar projeto");
    expect(workspaceSource).toContain("Projeto suspenso");
    expect(workspaceSource).toContain("Procura a organização UOR Connect com urgência");
  });

  it("calls dedicated submission freeze endpoints", () => {
    expect(apiSource).toContain("freezeProject");
    expect(apiSource).toContain("unfreezeProject");
    expect(apiSource).toContain("`/submissions/${id}/freeze`");
    expect(apiSource).toContain("`/submissions/${id}/unfreeze`");
  });
});
