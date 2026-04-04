import { getSubmissionTypeLabel, normalizeSubmissionType } from "../domain/submission-policy";
import { buildSubmissionSlug, formatTeamMembersLabel, normalizeTeamMembersInput } from "../domain/submission-format";
import { buildSubmissionCommunityUrl } from "./submission-ticket";

type StudentSubmissionPresenterInput = {
  id: number;
  referenceCode: string;
  name: string;
  description: string;
  status: string;
  type: "PROJECT" | "BUSINESS" | "PRODUCT";
  area: string;
  course?: string | null;
  stage?: string | null;
  category?: string | null;
  productType?: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: string[] | string;
  leaderName?: string | null;
  leaderPhone?: string | null;
  leaderEmail?: string | null;
  needs: string[];
  observations?: string | null;
  repoUrl?: string | null;
  websiteUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl?: string | null;
};

export function getSubmissionStatusLabel(status: string) {
  switch (status) {
    case "APPROVED":
      return "Aprovado";
    case "REJECTED":
      return "Rejeitado";
    case "PENDING":
    default:
      return "Em análise";
  }
}

export function canStudentEditSubmission(status: string) {
  return status === "PENDING" || status === "REJECTED";
}

export function buildStudentSubmissionReceiptResponse(
  submission: StudentSubmissionPresenterInput,
  config: {
    projectCommunityUrl?: string | null;
    businessCommunityUrl?: string | null;
    productCommunityUrl?: string | null;
  }
) {
  const normalizedType = normalizeSubmissionType(submission.type, submission.area);
  const typeLabel = getSubmissionTypeLabel(submission.type, submission.area);
  const membersList = normalizeTeamMembersInput(submission.members);
  const slug = buildSubmissionSlug(submission.name, submission.id);
  const detailPath = `/projeto/${slug}`;
  const receiptPath = `/submissoes/${submission.id}`;

  return {
    id: submission.id,
    referenceCode: submission.referenceCode,
    name: submission.name,
    description: submission.description,
    status: submission.status,
    statusLabel: getSubmissionStatusLabel(submission.status),
    type: normalizedType,
    typeLabel,
    area: submission.area,
    course: submission.course ?? null,
    stage: submission.stage ?? null,
    category: submission.category ?? null,
    productType: submission.productType ?? null,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    members: formatTeamMembersLabel(membersList),
    membersList,
    teamSize: membersList.length,
    leaderName: submission.leaderName ?? null,
    leaderPhone: submission.leaderPhone ?? null,
    leaderEmail: submission.leaderEmail ?? null,
    needs: submission.needs,
    observations: submission.observations ?? null,
    repoUrl: submission.repoUrl ?? null,
    websiteUrl: submission.websiteUrl ?? null,
    primaryColor: submission.primaryColor,
    secondaryColor: submission.secondaryColor,
    bannerUrl: submission.bannerUrl ?? null,
    communityUrl: buildSubmissionCommunityUrl(submission.type, config),
    boardingPassPath: `/submissions/${submission.id}/boarding-pass.pdf`,
    paymentProofPath: `/submissions/${submission.id}/payment-proof`,
    receiptPath,
    detailPath,
    canEdit: canStudentEditSubmission(submission.status),
  };
}

export function buildStudentSubmissionListItem(submission: Pick<
  StudentSubmissionPresenterInput,
  "id" | "referenceCode" | "name" | "status" | "type" | "area" | "createdAt" | "bannerUrl"
>) {
  const normalizedType = normalizeSubmissionType(submission.type, submission.area);
  const typeLabel = getSubmissionTypeLabel(submission.type, submission.area);
  const slug = buildSubmissionSlug(submission.name, submission.id);

  return {
    id: submission.id,
    referenceCode: submission.referenceCode,
    name: submission.name,
    status: submission.status,
    statusLabel: getSubmissionStatusLabel(submission.status),
    type: normalizedType,
    typeLabel,
    createdAt: submission.createdAt.toISOString(),
    detailPath: `/projeto/${slug}`,
    bannerUrl: submission.bannerUrl ?? null,
    receiptPath: `/submissoes/${submission.id}`,
  };
}
