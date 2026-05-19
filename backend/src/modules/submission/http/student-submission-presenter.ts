import { getSubmissionTypeLabel, normalizeSubmissionType } from "../domain/submission-policy";
import { buildSubmissionSlug, formatTeamMembersLabel, normalizeTeamMembersInput } from "../domain/submission-format";
import { buildSubmissionCommunityUrl } from "./submission-ticket";
import { buildPaymentTimeline, isPaymentConfirmedByAdmin, paymentStatusLabel } from "../../payments/payment-status";

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
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl?: string | null;
  projectFrozen?: boolean;
  projectFrozenAt?: Date | null;
  projectFrozenByStudentNumber?: string | null;
  projectFreezeReason?: string | null;
  paymentStatus?: string | null;
  paymentSubmittedAt?: Date | null;
  paymentReviewedAt?: Date | null;
  paymentReviewedByStudentNumber?: string | null;
  paymentReviewNote?: string | null;
  latestOdinProjectPenalty?: {
    id: number;
    penaltyMode: string;
    removedVoteCount: number;
    removedPointCount: number;
    reason: string;
    createdAt: Date;
  } | null;
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
  const paymentConfirmedByAdmin = isPaymentConfirmedByAdmin(submission.paymentStatus);
  const exhibitorPdfPath = submission.status === "APPROVED" && paymentConfirmedByAdmin
    ? `/submissions/${submission.id}/exhibitor-pack.pdf`
    : null;

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
    instagramUrl: submission.instagramUrl ?? null,
    facebookUrl: submission.facebookUrl ?? null,
    linkedinUrl: submission.linkedinUrl ?? null,
    githubUrl: submission.githubUrl ?? null,
    primaryColor: submission.primaryColor,
    secondaryColor: submission.secondaryColor,
    bannerUrl: submission.bannerUrl ?? null,
    projectFrozen: submission.projectFrozen ?? false,
    projectFrozenAt: submission.projectFrozenAt?.toISOString() ?? null,
    projectFrozenByStudentNumber: submission.projectFrozenByStudentNumber ?? null,
    projectFreezeReason: submission.projectFreezeReason ?? null,
    communityUrl: submission.status === "APPROVED" && paymentConfirmedByAdmin ? buildSubmissionCommunityUrl(submission.type, config) : null,
    boardingPassPath: `/submissions/${submission.id}/boarding-pass.pdf`,
    exhibitorPdfPath,
    paymentStatus: submission.paymentStatus ?? "PENDING_REVIEW",
    paymentStatusLabel: paymentStatusLabel(submission.paymentStatus, true),
    paymentSubmittedAt: submission.paymentSubmittedAt?.toISOString() ?? null,
    paymentReviewedAt: submission.paymentReviewedAt?.toISOString() ?? null,
    paymentReviewedByStudentNumber: submission.paymentReviewedByStudentNumber ?? null,
    paymentReviewNote: submission.paymentReviewNote ?? null,
    paymentTimeline: buildPaymentTimeline({
      status: submission.paymentStatus,
      submittedAt: submission.paymentSubmittedAt ?? submission.createdAt,
      reviewedAt: submission.paymentReviewedAt,
      reviewedBy: submission.paymentReviewedByStudentNumber,
      reviewNote: submission.paymentReviewNote,
    }),
    paymentProofPath: `/submissions/${submission.id}/payment-proof`,
    receiptPath,
    detailPath,
    canEdit: canStudentEditSubmission(submission.status),
  };
}

export function buildStudentSubmissionListItem(submission: Pick<
  StudentSubmissionPresenterInput,
  "id" | "referenceCode" | "name" | "description" | "status" | "type" | "area" | "createdAt" | "bannerUrl" | "paymentStatus" | "repoUrl" | "websiteUrl" | "instagramUrl" | "facebookUrl" | "linkedinUrl" | "githubUrl" | "projectFrozen" | "projectFrozenAt" | "projectFrozenByStudentNumber" | "projectFreezeReason" | "latestOdinProjectPenalty"
>) {
  const normalizedType = normalizeSubmissionType(submission.type, submission.area);
  const typeLabel = getSubmissionTypeLabel(submission.type, submission.area);
  const slug = buildSubmissionSlug(submission.name, submission.id);

  return {
    id: submission.id,
    referenceCode: submission.referenceCode,
    name: submission.name,
    description: submission.description,
    status: submission.status,
    statusLabel: getSubmissionStatusLabel(submission.status),
    type: normalizedType,
    typeLabel,
    createdAt: submission.createdAt.toISOString(),
    detailPath: `/projeto/${slug}`,
    repoUrl: submission.repoUrl ?? null,
    websiteUrl: submission.websiteUrl ?? null,
    instagramUrl: submission.instagramUrl ?? null,
    facebookUrl: submission.facebookUrl ?? null,
    linkedinUrl: submission.linkedinUrl ?? null,
    githubUrl: submission.githubUrl ?? null,
    bannerUrl: submission.bannerUrl ?? null,
    projectFrozen: submission.projectFrozen ?? false,
    projectFrozenAt: submission.projectFrozenAt?.toISOString() ?? null,
    projectFrozenByStudentNumber: submission.projectFrozenByStudentNumber ?? null,
    projectFreezeReason: submission.projectFreezeReason ?? null,
    odinPenaltyWarning: submission.latestOdinProjectPenalty ? {
      id: submission.latestOdinProjectPenalty.id,
      penaltyMode: submission.latestOdinProjectPenalty.penaltyMode,
      removedVoteCount: submission.latestOdinProjectPenalty.removedVoteCount,
      removedPointCount: submission.latestOdinProjectPenalty.removedPointCount,
      reason: submission.latestOdinProjectPenalty.reason,
      createdAt: submission.latestOdinProjectPenalty.createdAt.toISOString(),
    } : null,
    receiptPath: `/submissoes/${submission.id}`,
    exhibitorPdfPath: submission.status === "APPROVED" && isPaymentConfirmedByAdmin(submission.paymentStatus)
      ? `/submissions/${submission.id}/exhibitor-pack.pdf`
      : null,
  };
}
