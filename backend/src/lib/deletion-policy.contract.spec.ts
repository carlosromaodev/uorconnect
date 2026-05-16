import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

describe("deletion policy contracts", () => {
  it("desativa estudante por soft delete preservando historico", () => {
    const repository = source("src/modules/auth/infra/student.repository.ts");

    expect(repository).toContain("deletedAt: new Date()");
    expect(repository).toContain("teamMembership.updateMany");
    expect(repository).not.toContain("student.delete({ where: { id } })");
  });

  it("desativa submissao por soft delete preservando interacoes", () => {
    const repository = source("src/modules/submission/infra/prisma/prisma.submission.repository.ts");

    expect(repository).toContain("deletedAt: new Date()");
    expect(repository).not.toContain("studentLike.deleteMany({ where: { submissionId: id } })");
    expect(repository).not.toContain("submission.delete({ where: { id } })");
  });

  it("desativa credencial em vez de apagar o registo", () => {
    const routes = source("src/modules/team-credentials/http/team-credentials.routes.ts");

    expect(routes).toContain('status: "DISABLED"');
    expect(routes).not.toContain("eventTeamCredential.delete");
  });
});
