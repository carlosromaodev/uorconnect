import { describe, expect, it } from "vitest";
import {
  buildProjectObligationMessage,
  getProjectObligationNoticeTargets,
  projectObligationChannelUsesSms,
  projectObligationChannelUsesWhatsApp,
  uniqueProjectObligationPhones,
  type ProjectObligationSubmission,
} from "./project-obligation-notices";

const baseSubmission: ProjectObligationSubmission = {
  id: 1,
  referenceCode: "UOR-001",
  nome: "UOR Connect",
  bannerUrl: "https://cdn.test/photo.jpg",
  teamInviteUrl: "https://uorconnect.space/equipa/abc",
  teamTotalMembers: 3,
  teamConfirmedMembers: 3,
  teamAllConfirmed: true,
  teamMembers: [
    { id: 10, name: "Responsavel", confirmed: true },
    { id: 11, name: "Membro A", confirmed: true },
    { id: 12, name: "Membro B", confirmed: true },
  ],
  exhibitorChallengeStatus: "APPROVED",
};

function submission(
  override: Partial<ProjectObligationSubmission>,
): ProjectObligationSubmission {
  return { ...baseSubmission, ...override };
}

describe("project obligation notice filters", () => {
  it("targets only projects with pending members and a confirmation link", () => {
    const pending = submission({
      id: 2,
      nome: "Projeto pendente",
      teamAllConfirmed: false,
      teamConfirmedMembers: 1,
      teamMembers: [
        { id: 20, name: "Confirmado", confirmed: true },
        { id: 21, name: "Membro X", confirmed: false },
      ],
    });
    const missingLink = submission({
      id: 3,
      teamAllConfirmed: false,
      teamInviteUrl: null,
      teamMembers: [{ id: 30, name: "Membro Y", confirmed: false }],
    });

    expect(
      getProjectObligationNoticeTargets(
        [baseSubmission, pending, missingLink],
        "member_confirmation",
      ).map((item) => item.id),
    ).toEqual([2]);
  });

  it("targets only projects missing the selected obligation", () => {
    const noPhoto = submission({ id: 4, bannerUrl: null });
    const noQuestion = submission({ id: 5, exhibitorChallengeStatus: "MISSING" });
    const rejectedQuestion = submission({ id: 6, exhibitorChallengeStatus: "REJECTED" });

    expect(
      getProjectObligationNoticeTargets(
        [baseSubmission, noPhoto, noQuestion, rejectedQuestion],
        "project_photo",
      ).map((item) => item.id),
    ).toEqual([4]);

    expect(
      getProjectObligationNoticeTargets(
        [baseSubmission, noPhoto, noQuestion, rejectedQuestion],
        "challenge_question",
      ).map((item) => item.id),
    ).toEqual([5, 6]);
  });

  it("builds a project-specific message without crossing project data", () => {
    const pending = submission({
      nome: "Rede Escolar",
      teamAllConfirmed: false,
      teamConfirmedMembers: 1,
      teamMembers: [
        { id: 20, name: "Confirmado", confirmed: true },
        { id: 21, name: "Membro X", confirmed: false },
      ],
    });

    const message = buildProjectObligationMessage(pending, "member_confirmation");

    expect(message).toContain('projeto "Rede Escolar"');
    expect(message).toContain("Membro X");
    expect(message).toContain("https://uorconnect.space/equipa/abc");
  });

  it("deduplicates recipients by phone and supports SMS, WhatsApp or both", () => {
    expect(
      uniqueProjectObligationPhones([
        { phone: "+244923000000" },
        { phone: " +244923000000 " },
        { phone: "+244924000000" },
        { phone: null },
      ]),
    ).toEqual(["+244923000000", "+244924000000"]);

    expect(projectObligationChannelUsesSms("sms")).toBe(true);
    expect(projectObligationChannelUsesSms("both")).toBe(true);
    expect(projectObligationChannelUsesSms("whatsapp")).toBe(false);
    expect(projectObligationChannelUsesWhatsApp("whatsapp")).toBe(true);
    expect(projectObligationChannelUsesWhatsApp("both")).toBe(true);
    expect(projectObligationChannelUsesWhatsApp("sms")).toBe(false);
  });
});
