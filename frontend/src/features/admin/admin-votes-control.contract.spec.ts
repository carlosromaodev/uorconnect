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

describe("admin votes control UI contract", () => {
  it("shows a pause/resume control in the votes area", () => {
    expect(workspaceSource).toContain("handleProjectVotingPauseToggle");
    expect(workspaceSource).toContain("Pausar votação");
    expect(workspaceSource).toContain("Retomar votação");
    expect(workspaceSource).toContain("projectVotingPaused");
  });

  it("removes the SMS step from project vote reset", () => {
    expect(workspaceSource).not.toContain("Enviar código SMS");
    expect(workspaceSource).not.toContain("votesResetCode");
    expect(apiSource).not.toContain("requestVotesResetConfirmation");
    expect(apiSource).toContain("confirmVotesReset: (data: { confirmationText: string })");
  });

  it("calls the votes control endpoint", () => {
    expect(apiSource).toContain("updateVotesControl");
    expect(apiSource).toContain("`/interactions/admin/votes/control`");
    expect(apiSource).toContain('method: "PATCH"');
  });
});
