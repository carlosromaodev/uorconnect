import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/AdminWorkspace.tsx"),
  "utf8",
);
const projectObligationSource = readFileSync(
  path.join(process.cwd(), "src/features/admin/project-obligation-notices.ts"),
  "utf8",
);
const featureSource = `${workspaceSource}\n${projectObligationSource}`;

describe("admin project obligation notices", () => {
  it("lets admin choose the obligation notice type from project obligations", () => {
    expect(featureSource).toContain("ProjectObligationNoticeType");
    expect(featureSource).toContain("projectObligationNoticeOptions");
    expect(featureSource).toContain("Tipo de aviso");
    expect(featureSource).toContain("Membro por confirmar");
    expect(featureSource).toContain("Foto do projeto");
    expect(featureSource).toContain("Pergunta do desafio");
  });

  it("sends project-specific SMS notices using existing recipient and SMS APIs", () => {
    expect(featureSource).toContain("handleSendProjectObligationNotices");
    expect(featureSource).toContain("api.submissions.exhibitorPdfRecipients");
    expect(featureSource).toContain("api.sms.sendCampaign");
    expect(featureSource).toContain("api.whatsapp.sendCampaign");
    expect(featureSource).toContain("projectObligationNoticeChannel");
    expect(featureSource).toContain("Canal de envio");
    expect(featureSource).toContain("SMS + WhatsApp");
    expect(featureSource).toContain("selectedPhones");
    expect(featureSource).toContain("teamInviteUrl");
    expect(featureSource).toContain("-10 pontos");
  });
});
