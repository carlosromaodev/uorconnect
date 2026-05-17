export type ProjectObligationNoticeType =
  | "member_confirmation"
  | "project_photo"
  | "challenge_question";

export type ProjectObligationNoticeChannel = "sms" | "whatsapp" | "both";

export type ProjectObligationSubmission = {
  id: number;
  referenceCode: string;
  nome: string;
  bannerUrl: string | null;
  teamInviteUrl: string | null;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  teamAllConfirmed: boolean;
  teamMembers: Array<{
    id: number;
    name: string;
    confirmed: boolean;
  }>;
  exhibitorChallengeStatus:
    | "MISSING"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "PAUSED";
};

export type ProjectObligationRecipient = {
  phone?: string | null;
};

export const projectObligationNoticeOptions: Array<{
  id: ProjectObligationNoticeType;
  label: string;
  description: string;
}> = [
  {
    id: "member_confirmation",
    label: "Membro por confirmar",
    description:
      "Envia aviso aos membros já confirmados para cobrarem quem ainda não confirmou presença.",
  },
  {
    id: "project_photo",
    label: "Foto do projeto",
    description:
      "Envia aviso aos grupos sem foto/capa do projeto no sistema.",
  },
  {
    id: "challenge_question",
    label: "Pergunta do desafio",
    description:
      "Envia aviso aos grupos sem pergunta válida e reforça o risco de -10 pontos.",
  },
];

export const projectObligationChannelOptions: Array<{
  id: ProjectObligationNoticeChannel;
  label: string;
  description: string;
}> = [
  {
    id: "sms",
    label: "SMS",
    description: "Envia pela central SMS.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Envia pela instância WhatsApp conectada.",
  },
  {
    id: "both",
    label: "SMS + WhatsApp",
    description: "Envia nos dois canais para máxima cobertura.",
  },
];

export function getPendingTeamMemberNames(
  submission: ProjectObligationSubmission,
) {
  const structuredPending = submission.teamMembers
    .filter((member) => !member.confirmed)
    .map((member) => member.name.trim())
    .filter(Boolean);

  if (structuredPending.length > 0) return structuredPending;
  const missingCount = Math.max(
    submission.teamTotalMembers - submission.teamConfirmedMembers,
    0,
  );
  return missingCount > 0
    ? [`${missingCount} membro(s) por confirmar`]
    : [];
}

export function projectHasValidChallengeQuestion(
  submission: ProjectObligationSubmission,
) {
  return (
    submission.exhibitorChallengeStatus === "APPROVED" ||
    submission.exhibitorChallengeStatus === "PENDING_APPROVAL" ||
    submission.exhibitorChallengeStatus === "PAUSED"
  );
}

export function submissionNeedsProjectObligationNotice(
  submission: ProjectObligationSubmission,
  noticeType: ProjectObligationNoticeType,
) {
  if (noticeType === "member_confirmation") {
    return (
      !submission.teamAllConfirmed &&
      getPendingTeamMemberNames(submission).length > 0 &&
      Boolean(submission.teamInviteUrl)
    );
  }

  if (noticeType === "project_photo") {
    return !submission.bannerUrl;
  }

  return !projectHasValidChallengeQuestion(submission);
}

export function getProjectObligationNoticeTargets<
  Submission extends ProjectObligationSubmission,
>(
  submissions: Submission[],
  noticeType: ProjectObligationNoticeType,
) {
  return submissions.filter((submission) =>
    submissionNeedsProjectObligationNotice(submission, noticeType),
  );
}

export function buildProjectObligationMessage(
  submission: ProjectObligationSubmission,
  noticeType: ProjectObligationNoticeType,
) {
  if (noticeType === "member_confirmation") {
    const pendingMembers = getPendingTeamMemberNames(submission).join(", ");
    return [
      `UOR Connect: no projeto "${submission.nome}", ainda falta ${pendingMembers} confirmar presença.`,
      `Partilhem este link com o membro pendente para confirmar: ${submission.teamInviteUrl}`,
      "A regularização evita bloqueios no manual, passes e organização da feira.",
    ].join("\n");
  }

  if (noticeType === "project_photo") {
    return [
      `UOR Connect: o projeto "${submission.nome}" ainda está sem foto/capa no sistema.`,
      "Entrem em Minha Área e adicionem uma imagem clara do projeto para melhorar a apresentação pública e o manual do expositor.",
    ].join("\n");
  }

  return [
    `UOR Connect: o projeto "${submission.nome}" ainda não tem pergunta válida no Desafio do Expositor.`,
    "Entrem em Minha Área e submetam/corrijam a pergunta. A falta de responsabilidade pode fazer o grupo iniciar a feira com -10 pontos.",
  ].join("\n");
}

export function projectObligationNoticeCampaignTitle(
  submission: ProjectObligationSubmission,
  noticeType: ProjectObligationNoticeType,
) {
  const option = projectObligationNoticeOptions.find(
    (item) => item.id === noticeType,
  );
  return `Obrigação ${option?.label ?? "Projeto"} · ${submission.referenceCode}`;
}

export function uniqueProjectObligationPhones(
  recipients: ProjectObligationRecipient[],
) {
  return Array.from(
    new Set(
      recipients
        .map((recipient) => recipient.phone?.trim())
        .filter((phone): phone is string => Boolean(phone)),
    ),
  );
}

export function projectObligationChannelUsesSms(
  channel: ProjectObligationNoticeChannel,
) {
  return channel === "sms" || channel === "both";
}

export function projectObligationChannelUsesWhatsApp(
  channel: ProjectObligationNoticeChannel,
) {
  return channel === "whatsapp" || channel === "both";
}
