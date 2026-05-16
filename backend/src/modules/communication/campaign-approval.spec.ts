import { describe, expect, it } from "vitest";
import {
  buildCampaignApprovalToken,
  COMMUNICATION_APPROVAL_MIN_RECIPIENTS,
  isCampaignApprovalRequired,
  isValidCampaignApprovalToken,
} from "./campaign-approval";

describe("communication campaign approval", () => {
  it("requires approval only for larger manual campaigns", () => {
    expect(isCampaignApprovalRequired(COMMUNICATION_APPROVAL_MIN_RECIPIENTS - 1)).toBe(false);
    expect(isCampaignApprovalRequired(COMMUNICATION_APPROVAL_MIN_RECIPIENTS)).toBe(true);
  });

  it("validates preview tokens independently from recipient manual selection", () => {
    const secret = "test-secret-with-enough-length";
    const audience = {
      type: "STUDENT_COURSE",
      studentCourses: ["Engenharia"],
      includeProviderTos: ["244923000000"],
    };

    const token = buildCampaignApprovalToken({ channel: "SMS", audience, secret });

    expect(isValidCampaignApprovalToken({
      channel: "SMS",
      audience: { ...audience, includeProviderTos: ["244923000001"], excludeProviderTos: ["244923000002"] },
      secret,
      token,
    })).toBe(true);
    expect(isValidCampaignApprovalToken({
      channel: "WHATSAPP",
      audience,
      secret,
      token,
    })).toBe(false);
  });
});
