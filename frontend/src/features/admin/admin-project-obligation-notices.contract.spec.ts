import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/AdminWorkspace.tsx"),
  "utf8",
);

describe("admin project obligation notices", () => {
  it("lets admin choose the obligation notice type from project obligations", () => {
    expect(workspaceSource).toContain("ProjectObligationNoticeType");
    expect(workspaceSource).toContain("projectObligationNoticeOptions");
    expect(workspaceSource).toContain("Tipo de aviso");
    expect(workspaceSource).toContain("Membro por confirmar");
    expect(workspaceSource).toContain("Foto do projeto");
    expect(workspaceSource).toContain("Pergunta do desafio");
  });

  it("sends project-specific SMS notices using existing recipient and SMS APIs", () => {
    expect(workspaceSource).toContain("handleSendProjectObligationNotices");
    expect(workspaceSource).toContain("api.submissions.exhibitorPdfRecipients");
    expect(workspaceSource).toContain("api.sms.sendCampaign");
    expect(workspaceSource).toContain("selectedPhones");
    expect(workspaceSource).toContain("teamInviteUrl");
    expect(workspaceSource).toContain("-10 pontos");
  });
});
