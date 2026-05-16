import { describe, expect, it } from "vitest";
import {
  SMS_CAMPAIGN_TITLE_MAX_LENGTH,
  normalizeSmsCampaignTitle,
  smsSendBodySchema,
} from "./sms.routes";

describe("SMS admin route logic", () => {
  it("accepts long internal campaign titles and normalizes them for storage", () => {
    const title = [
      "Manual do expositor para projeto com nome muito longo",
      "responsaveis com nomes completos muito extensos",
      "turma final UOR Connect 2026",
    ].join(" · ");

    const parsed = smsSendBodySchema.safeParse({
      title,
      sender: "UOR CONNECT",
      message: "Ola, temos uma atualizacao importante para ti.",
      audience: { type: "ALL_STUDENTS" },
    });

    expect(parsed.success).toBe(true);
    expect(normalizeSmsCampaignTitle(title)).toHaveLength(SMS_CAMPAIGN_TITLE_MAX_LENGTH);
    expect(normalizeSmsCampaignTitle(title)).toMatch(/\.\.\.$/);
  });

  it("accepts group representatives as a direct SMS audience", () => {
    const parsed = smsSendBodySchema.safeParse({
      title: "Aviso aos representantes",
      sender: "UOR CONNECT",
      message: "Ola {{nome}}, esta informacao deve ser repassada ao grupo.",
      audience: {
        type: "GROUP_REPRESENTATIVES",
        submissionStatuses: ["APPROVED"],
      },
    });

    expect(parsed.success).toBe(true);
  });
});
