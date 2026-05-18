import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(
  path.join(process.cwd(), "src/modules/interactions/http/interactions.routes.ts"),
  "utf8",
);

describe("admin votes control contract", () => {
  it("lets admins pause or resume public project voting", () => {
    expect(routesSource).toContain('"/admin/votes/control"');
    expect(routesSource).toContain("votingPaused: z.boolean()");
    expect(routesSource).toContain("projects.votes_control_updated");
    expect(routesSource).toContain("A votação pública está pausada pela organização.");
  });

  it("removes the SMS confirmation requirement from project vote reset", () => {
    expect(routesSource).not.toContain("requestAdminSmsConfirmation");
    expect(routesSource).not.toContain("verifyAdminSmsConfirmation");
    expect(routesSource).toContain("confirmationText: z.string().trim()");
    expect(routesSource).toContain("Todos os votos dos projectos foram removidos por confirmação administrativa.");
  });
});
