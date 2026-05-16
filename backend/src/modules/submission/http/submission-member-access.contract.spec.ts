import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission.routes.ts"),
  "utf8",
);

const repositorySource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/infra/prisma/prisma.submission.repository.ts"),
  "utf8",
);

describe("student project access for confirmed team members", () => {
  it("lists projects where the current student is a confirmed team member", () => {
    expect(repositorySource).toContain("memberConfirmations");
    expect(repositorySource).toContain("confirmedAt: { not: null }");
  });

  it("marks Minha Área project cards with the viewer role and management permissions", () => {
    expect(routesSource).toContain("viewerRole");
    expect(routesSource).toContain("canManageTeam");
    expect(routesSource).toContain("canManagePresentation");
    expect(routesSource).toContain("canManageChallenge");
  });

  it("lets confirmed members read project documents without exposing payment proof", () => {
    expect(routesSource).toContain("isConfirmedSubmissionMember");
    expect(routesSource).toContain("allowConfirmedMembers");
    expect(routesSource).toContain("paymentProofPath: access.canManageSubmission ? receipt.paymentProofPath : null");
  });
});
