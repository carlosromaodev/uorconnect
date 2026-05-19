import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(
  path.join(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);

const deploySchemaSource = readFileSync(
  path.join(process.cwd(), "prisma/schema.deploy.prisma"),
  "utf8",
);

const submissionRoutesSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission.routes.ts"),
  "utf8",
);

const presenterSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/student-submission-presenter.ts"),
  "utf8",
);

describe("project freeze contract", () => {
  it("persists a reversible frozen state on submissions in both prisma schemas", () => {
    for (const source of [schemaSource, deploySchemaSource]) {
      expect(source).toContain("projectFrozen");
      expect(source).toContain("projectFrozenAt");
      expect(source).toContain("projectFrozenByStudentNumber");
      expect(source).toContain("projectFreezeReason");
      expect(source).toContain("@@index([projectFrozen, status, createdAt])");
    }
  });

  it("exposes admin freeze and unfreeze endpoints with audit-friendly Portuguese labels", () => {
    expect(submissionRoutesSource).toContain('adminApp.patch("/:id/freeze"');
    expect(submissionRoutesSource).toContain('adminApp.patch("/:id/unfreeze"');
    expect(submissionRoutesSource).toContain("submission.project_freeze");
    expect(submissionRoutesSource).toContain("submission.project_unfreeze");
    expect(submissionRoutesSource).toContain("Projeto congelado");
    expect(submissionRoutesSource).toContain("Projeto descongelado");
  });

  it("serializes frozen status to admin and student project payloads", () => {
    expect(submissionRoutesSource).toContain("projectFrozen: s.projectFrozen");
    expect(submissionRoutesSource).toContain("projectFreezeReason: s.projectFreezeReason");
    expect(presenterSource).toContain("projectFrozen: submission.projectFrozen");
    expect(presenterSource).toContain("projectFreezeReason: submission.projectFreezeReason");
  });
});
