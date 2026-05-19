import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const interactionsSource = readFileSync(
  path.join(process.cwd(), "src/modules/interactions/http/interactions.routes.ts"),
  "utf8",
);

const adminVotesRepositorySource = readFileSync(
  path.join(process.cwd(), "src/modules/interactions/infra/admin-votes.repository.ts"),
  "utf8",
);

const adminVotesUseCaseSource = readFileSync(
  path.join(process.cwd(), "src/modules/interactions/use-cases/admin-votes.ts"),
  "utf8",
);

describe("project freeze voting contract", () => {
  it("blocks votes on frozen projects with an operational Portuguese message", () => {
    expect(interactionsSource).toContain("PROJECT_FROZEN_MESSAGE");
    expect(interactionsSource).toContain("submission.projectFrozen");
    expect(interactionsSource).toContain("Projeto congelado. Procura a organização UOR Connect com urgência.");
  });

  it("keeps frozen projects visible to admin votes while marking them suspended", () => {
    expect(adminVotesUseCaseSource).toContain("projectFrozen: boolean");
    expect(adminVotesUseCaseSource).toContain("projectFrozenAt: string | null");
    expect(adminVotesRepositorySource).toContain("projectFrozen: true");
    expect(adminVotesRepositorySource).toContain("projectFrozenAt: true");
  });
});
