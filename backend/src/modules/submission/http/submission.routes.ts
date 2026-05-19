import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PrismaSubmissionRepository, PrismaSubmissionConfigRepository, PrismaVoteRepository, PrismaReviewRepository } from "../infra/prisma/prisma.submission.repository";
import { CreateSubmission } from "../use-cases/create-submission";
import type { Submission } from "../domain/submission";
import { VoteSubmission } from "../use-cases/vote-submission";
import { ReviewSubmission } from "../use-cases/review-submission";
import { SelectWinnerSubmission } from "../use-cases/select-winner";
import { ClearWinnerSubmission } from "../use-cases/clear-winner";
import {
  DeleteSubmission,
  GetSubmissionConfig,
  ListDetailedSubmissions,
  UpdateSubmissionConfig,
  UpdateSubmissionPresentation,
  UpdateSubmissionStatus
} from "../use-cases/manage-submissions";
import { loadEnv } from "../../../config/env";
import { getSubmissionTypeLabel, isCompetitionEligible, normalizeSubmissionType } from "../domain/submission-policy";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, isAdminStudentNumber, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { verifyAuthToken } from "../../auth/utils/jwt";
import {
  buildSubmissionSlug,
  DEFAULT_SUBMISSION_PRIMARY_COLOR,
  DEFAULT_SUBMISSION_SECONDARY_COLOR,
  formatTeamMembersLabel,
  MAX_TEAM_MEMBERS,
  normalizeTeamMembersInput
} from "../domain/submission-format";
import { buildBoardingPassHtml, buildSubmissionCommunityUrl, parseStoredProof, proofExtensionFromMime } from "./submission-ticket";
import { loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { OFFICIAL_COURSES } from "../../../shared/official-courses";
import { prisma } from "../../../shared/prisma";
import { normalizeAngolaPhone } from "../../auth/domain/student-format";
import {
  buildStudentSubmissionListItem,
  buildStudentSubmissionReceiptResponse,
  canStudentEditSubmission,
} from "./student-submission-presenter";
import { recordAdminAudit } from "../../audit/application/audit.service";
import {
  sendWhatsAppAudienceAutomationEvent,
  sendWhatsAppAutomationEvent,
} from "../../whatsapp/http/whatsapp.routes";
import { sendSmsAudienceAutomationEvent } from "../../sms/http/sms.routes";
import { getCookie } from "../../../shared/cookies";
import {
  generateExhibitorPdfForSubmission,
  loadLatestExhibitorPdfMetadata,
  notifyExhibitorPdfReady,
  readExhibitorPdfFile,
  type ExhibitorPdfMetadata,
} from "./exhibitor-pdf";
import {
  addSubmissionTeamMember,
  adminConfirmExternalSubmissionTeamMember,
  adminConfirmSubmissionTeamMember,
  buildMemberJourneyLabel,
  buildSubmissionTeamPayload,
  confirmSubmissionTeamMember,
  loadSubmissionTeamByToken,
  replaceSubmissionTeamMembers,
  removeSubmissionTeamMember,
  setSubmissionTeamMemberExpectedStudentNumber,
} from "./submission-team";
import { isStoredMediaUrl, persistMediaValue, resolveStoredMediaFile } from "../../media/application/media-storage";
import { buildPaymentTimeline, isPaymentConfirmedByAdmin, normalizePaymentStatus, paymentStatusLabel } from "../../payments/payment-status";
import { getStudentExhibitorPassportSummary } from "../../exhibitor-scoring/application/exhibitor-passport-student";
import { getOdinExhibitorDeviceWarningsForStudent } from "../../security/application/odin.service";

const submissionRepo = new PrismaSubmissionRepository();
const submissionConfigRepo = new PrismaSubmissionConfigRepository();
const voteRepo = new PrismaVoteRepository();
const reviewRepo = new PrismaReviewRepository();

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6})$/);
const imageDataUrlSchema = z.string().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/);
const storedMediaUrlSchema = z.string().regex(/^\/(?:api\/)?media\/files\/.+/).max(700);
const teamMemberSchema = z.string().trim().min(2).max(80);
const leaderPhoneSchema = z.string()
  .trim()
  .transform((value) => normalizeAngolaPhone(value) ?? value.trim())
  .refine((value) => /^\+2449\d{8}$/.test(value), {
    message: "Número de telefone inválido.",
  });
const teamMembersInputSchema = z.union([
  z.array(teamMemberSchema).min(1).max(MAX_TEAM_MEMBERS),
  z.string().min(3)
]).refine((value) => {
  const members = normalizeTeamMembersInput(value);
  return members.length >= 1 && members.length <= MAX_TEAM_MEMBERS;
}, {
  message: `Adiciona entre 1 e ${MAX_TEAM_MEMBERS} nomes de membros da equipa.`
});

const typeSpecificSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PROJECT"),
    area: z.enum(["Engenharia", "Tecnologia", "Sustentabilidade", "Inovação", "Ciências Aplicadas", "Outra"]),
    course: z.enum(OFFICIAL_COURSES)
  }),
  z.object({
    type: z.literal("BUSINESS"),
    area: z.enum(["Tecnologia", "Comércio", "Serviços", "Alimentação", "Educação", "Saúde", "Outra"]),
    stage: z.enum(["Ideia", "Protótipo", "MVP", "Funcionando", "Já no Mercado"])
  }),
  z.object({
    type: z.literal("PRODUCT"),
    category: z.enum(["Hardware", "Software", "Alimentar", "Artesanato", "Vestuário", "Outro"]),
    productType: z.enum(["Físico", "Digital", "Híbrido"]),
    area: z.string().default("Produto")
  })
]);

const baseSubmissionSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().trim().max(500).refine((value) => value.length === 0 || value.length >= 10, {
    message: "Descrição deve ter entre 10 e 500 caracteres."
  }),
  members: teamMembersInputSchema,
  leaderName: z.string().trim().min(3).max(120),
  leaderPhone: leaderPhoneSchema,
  leaderEmail: z.string().trim().email().optional(),
  needs: z.array(
    z.enum([
      "Tomada elétrica",
      "Projetor multimédia",
      "Ligação à internet",
      "Mesa de exposição",
      "Espaço extra"
    ])
  ),
  paymentProof: z.union([
    z.string().regex(/^data:(application\/pdf|image\/png|image\/jpeg|image\/webp);base64,[A-Za-z0-9+/=]+$/),
    z.string().url(),
    storedMediaUrlSchema
  ]),
  paymentConfirmed: z.literal(true),
  repoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  observations: z.string().max(500).optional(),
  agreeRules: z.literal(true),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  bannerUrl: z.union([z.string().url(), storedMediaUrlSchema, imageDataUrlSchema]).nullable().optional()
});

const submissionConfigSchema = z.object({
  isOpen: z.boolean(),
  iban: z.string().min(5).max(80),
  accountName: z.string().min(3).max(120),
  paymentAmount: z.string().min(2).max(40),
  paymentInstructions: z.string().max(300).optional().nullable(),
  projectCommunityUrl: z.string().url().optional().nullable(),
  businessCommunityUrl: z.string().url().optional().nullable(),
  productCommunityUrl: z.string().url().optional().nullable()
});

const createSubmissionSchema = baseSubmissionSchema.and(typeSpecificSchema);
const optionalProjectUrlSchema = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().url().max(240).nullable().optional(),
);
const submissionPresentationSchema = z.object({
  description: z.string().trim().max(500).refine((value) => value.length === 0 || value.length >= 10, {
    message: "Descrição deve ter entre 10 e 500 caracteres."
  }).optional(),
  repoUrl: optionalProjectUrlSchema,
  websiteUrl: optionalProjectUrlSchema,
  instagramUrl: optionalProjectUrlSchema,
  facebookUrl: optionalProjectUrlSchema,
  linkedinUrl: optionalProjectUrlSchema,
  githubUrl: optionalProjectUrlSchema,
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  bannerUrl: z.union([z.string().url(), storedMediaUrlSchema, imageDataUrlSchema]).nullable().optional()
});

const submissionPresentationResponseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  detailPath: z.string(),
  description: z.string(),
  repoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  bannerUrl: z.string().nullable(),
  status: z.string().optional(),
});

const addTeamMemberSchema = z.object({
  name: teamMemberSchema,
});

const updateTeamMemberStudentNumberSchema = z.object({
  studentNumber: z.string().trim().min(8).max(20),
});

const updateTeamMemberExternalExceptionSchema = z.object({
  isExternal: z.boolean().default(true),
  externalOrganization: z.string().trim().min(2).max(160).optional().nullable(),
  externalReason: z.string().trim().min(3).max(400),
});

const confirmExternalTeamMemberSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(30),
  externalOrganization: z.string().trim().min(2).max(160),
  externalReason: z.string().trim().min(3).max(400).optional(),
});

const updateTeamMembersSchema = z.object({
  members: z.array(teamMemberSchema).min(1).max(MAX_TEAM_MEMBERS),
});

const projectFreezeStateSchema = {
  projectFrozen: z.boolean(),
  projectFrozenAt: z.string().nullable(),
  projectFrozenByStudentNumber: z.string().nullable(),
  projectFreezeReason: z.string().nullable(),
};

const odinPenaltyWarningSchema = z.object({
  id: z.number(),
  penaltyMode: z.string(),
  removedVoteCount: z.number(),
  removedPointCount: z.number(),
  reason: z.string(),
  automationProofSummary: z.string().nullable(),
  createdAt: z.string(),
}).nullable();

const odinExhibitorDeviceWarningSchema = z.object({
  id: z.string(),
  submissionId: z.number(),
  submissionName: z.string(),
  deviceId: z.string(),
  severity: z.enum(["MEDIUM", "HIGH"]),
  outsideVotes: z.number(),
  distinctAccounts: z.number(),
  firstDetectedAt: z.string(),
  lastDetectedAt: z.string(),
  outsideProjects: z.array(z.object({
    submissionId: z.number(),
    submissionName: z.string(),
    votes: z.number(),
  })),
  message: z.string(),
}).nullable();

const studentSubmissionListItemSchema = z.object({
  id: z.number(),
  referenceCode: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  type: z.string(),
  typeLabel: z.string(),
  createdAt: z.string(),
  detailPath: z.string(),
  repoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  ...projectFreezeStateSchema,
  odinPenaltyWarning: odinPenaltyWarningSchema,
  odinExhibitorDeviceWarning: odinExhibitorDeviceWarningSchema,
  receiptPath: z.string(),
  exhibitorPdfPath: z.string().nullable(),
  viewerRole: z.enum(["RESPONSAVEL", "MEMBRO"]),
  canManageTeam: z.boolean(),
  canManagePresentation: z.boolean(),
  canManageChallenge: z.boolean(),
  teamInviteUrl: z.string().nullable(),
  teamJourneyLabel: z.string(),
  teamTotalMembers: z.number(),
  teamConfirmedMembers: z.number(),
  teamAllConfirmed: z.boolean(),
  teamMembers: z.array(z.object({
    id: z.number(),
    name: z.string(),
    confirmed: z.boolean(),
    confirmedAt: z.string().nullable(),
    expectedStudentNumber: z.string().nullable(),
    studentNumber: z.string().nullable(),
    studentName: z.string().nullable(),
    studentCourse: z.string().nullable(),
    isExternal: z.boolean(),
    externalOrganization: z.string().nullable(),
    externalReason: z.string().nullable(),
    exceptionApprovedAt: z.string().nullable(),
    role: z.enum(["RESPONSAVEL", "MEMBRO"]),
    roleLabel: z.string(),
    isResponsible: z.boolean(),
  })),
});

const studentSubmissionReceiptSchema = z.object({
  id: z.number(),
  referenceCode: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  type: z.string(),
  typeLabel: z.string(),
  area: z.string(),
  course: z.string().nullable(),
  stage: z.string().nullable(),
  category: z.string().nullable(),
  productType: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  members: z.string(),
  membersList: z.array(z.string()),
  teamSize: z.number(),
  leaderName: z.string().nullable(),
  leaderPhone: z.string().nullable(),
  leaderEmail: z.string().nullable(),
  needs: z.array(z.string()),
  observations: z.string().nullable(),
  repoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  bannerUrl: z.string().nullable(),
  ...projectFreezeStateSchema,
  communityUrl: z.string().nullable(),
  boardingPassPath: z.string(),
  exhibitorPdfPath: z.string().nullable(),
  paymentStatus: z.string(),
  paymentStatusLabel: z.string(),
  paymentSubmittedAt: z.string().nullable(),
  paymentReviewedAt: z.string().nullable(),
  paymentReviewedByStudentNumber: z.string().nullable(),
  paymentReviewNote: z.string().nullable(),
  paymentTimeline: z.array(z.object({
    key: z.string(),
    label: z.string(),
    status: z.string(),
    at: z.string().nullable(),
    by: z.string().nullable(),
    note: z.string().nullable(),
  })),
  paymentProofPath: z.string().nullable(),
  receiptPath: z.string(),
  detailPath: z.string(),
  canEdit: z.boolean(),
  viewerRole: z.enum(["RESPONSAVEL", "MEMBRO"]),
  canManageSubmission: z.boolean(),
});

const submissionTeamMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  confirmed: z.boolean(),
  confirmedAt: z.string().nullable(),
  expectedStudentNumber: z.string().nullable(),
  studentNumber: z.string().nullable(),
  studentName: z.string().nullable(),
  studentCourse: z.string().nullable(),
  isExternal: z.boolean(),
  externalOrganization: z.string().nullable(),
  externalReason: z.string().nullable(),
  exceptionApprovedAt: z.string().nullable(),
  role: z.enum(["RESPONSAVEL", "MEMBRO"]),
  roleLabel: z.string(),
  isResponsible: z.boolean(),
});

const exhibitorPdfRecipientSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(["RESPONSAVEL", "MEMBRO"]),
  confirmed: z.boolean(),
  studentNumber: z.string().nullable(),
  memberId: z.number().nullable(),
});

const submissionTeamPayloadSchema = z.object({
  submission: z.object({
    id: z.number(),
    referenceCode: z.string(),
    name: z.string(),
    status: z.string(),
    type: z.string(),
    typeLabel: z.string(),
    course: z.string().nullable(),
    leaderName: z.string().nullable(),
    detailPath: z.string(),
  }),
  inviteUrl: z.string().nullable(),
  token: z.string().nullable(),
  totalMembers: z.number(),
  confirmedMembers: z.number(),
  allConfirmed: z.boolean(),
  journeyLabel: z.string(),
  members: z.array(submissionTeamMemberSchema),
});

const externalTeamMemberCredentialsSchema = z.object({
  studentNumber: z.string(),
  temporaryPassword: z.string(),
});

const exhibitorPassportMissionSchema = z.object({
  key: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  points: z.number(),
  pointsEarned: z.number(),
  completions: z.number(),
  status: z.enum(["done", "available", "locked"]),
  completedAt: z.string().nullable(),
});

const exhibitorPassportBadgeSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  icon: z.string().nullable(),
  earned: z.boolean(),
  awardedAt: z.string().nullable(),
});

const exhibitorPassportRecentEventSchema = z.object({
  id: z.number(),
  businessKey: z.string(),
  submissionId: z.number(),
  submissionName: z.string(),
  action: z.string(),
  sourceType: z.string(),
  points: z.number(),
  reason: z.string().nullable(),
  roundLabel: z.string().nullable(),
  awardedAt: z.string(),
  effect: z.enum(["GAIN", "LOSS", "NEUTRAL"]),
});

const exhibitorPassportOpportunitySchema = z.object({
  key: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  pointsLabel: z.string(),
  icon: z.string().nullable(),
  completedCount: z.number(),
  pointsEarned: z.number(),
  status: z.enum(["done", "available", "attention", "locked"]),
});

const exhibitorPassportMemberEffortSchema = z.object({
  memberId: z.number().nullable(),
  name: z.string(),
  studentNumber: z.string().nullable(),
  role: z.enum(["RESPONSAVEL", "MEMBRO"]),
  confirmed: z.boolean(),
  points: z.number(),
  actions: z.number(),
  positiveActions: z.number(),
  penalties: z.number(),
  level: z.enum(["Ouro", "Prata", "Bronze", "Sem movimento"]),
  lastActivityAt: z.string().nullable(),
});

const exhibitorPassportRoundFlowItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  multiplier: z.number(),
  startsAt: z.string(),
  endsAt: z.string(),
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED", "DRAFT"]),
  phase: z.enum(["past", "current", "next", "upcoming", "closed"]),
  progressPercent: z.number(),
  minutesRemaining: z.number().nullable(),
  startsInMinutes: z.number().nullable(),
});

const exhibitorPassportRoundFlowSchema = z.object({
  generatedAt: z.string(),
  currentRoundKey: z.string().nullable(),
  currentLabel: z.string().nullable(),
  currentMultiplier: z.number(),
  minutesRemaining: z.number().nullable(),
  items: z.array(exhibitorPassportRoundFlowItemSchema),
  streakTargets: z.array(z.object({
    minCourses: z.number(),
    points: z.number(),
    label: z.string(),
  })),
});

const exhibitorPassportProjectSchema = z.object({
  submissionId: z.number(),
  referenceCode: z.string(),
  name: z.string(),
  course: z.string().nullable(),
  type: z.string(),
  area: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  viewerRole: z.enum(["RESPONSAVEL", "MEMBRO"]),
  score: z.number(),
  ranking: z.object({
    position: z.number(),
    totalProjects: z.number(),
    points: z.number(),
  }).nullable(),
  progressPercent: z.number(),
  completedMissions: z.number(),
  totalMissions: z.number(),
  totalAvailablePoints: z.number(),
  teamTotalMembers: z.number(),
  teamConfirmedMembers: z.number(),
  missions: z.array(exhibitorPassportMissionSchema),
  badges: z.array(exhibitorPassportBadgeSchema),
  continuousActions: z.array(exhibitorPassportOpportunitySchema),
  bonusOpportunities: z.array(exhibitorPassportOpportunitySchema),
  teamActivity: z.array(exhibitorPassportMemberEffortSchema),
  recentEvents: z.array(exhibitorPassportRecentEventSchema),
});

const exhibitorPassportSummarySchema = z.object({
  eventKey: z.string(),
  generatedAt: z.string(),
  hasExhibitorPassport: z.boolean(),
  activeProject: exhibitorPassportProjectSchema.nullable(),
  projects: z.array(exhibitorPassportProjectSchema),
  roundFlow: exhibitorPassportRoundFlowSchema.nullable(),
});

const adminSubmissionTeamStateSchema = {
  teamInviteUrl: z.string().nullable(),
  teamJourneyLabel: z.string(),
  teamTotalMembers: z.number(),
  teamConfirmedMembers: z.number(),
  teamAllConfirmed: z.boolean(),
  teamMembers: z.array(submissionTeamMemberSchema),
};

const adminTeamMembersUpdateResponseSchema = z.object({
  success: z.literal(true),
  members: z.string().nullable(),
  membersList: z.array(z.string()),
  teamSize: z.number(),
  ...adminSubmissionTeamStateSchema,
});

const adminTeamMemberConfirmResponseSchema = z.object({
  success: z.literal(true),
  ...adminSubmissionTeamStateSchema,
});

const adminSubmissionChallengeStateSchema = {
  exhibitorChallengeStatus: z.enum([
    "MISSING",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "PAUSED",
  ]),
  exhibitorChallengeQuestion: z.string().nullable(),
  exhibitorChallengeAnswersCount: z.number(),
  exhibitorChallengeUpdatedAt: z.string().nullable(),
};

const adminExternalTeamMemberConfirmResponseSchema = z.object({
  success: z.literal(true),
  credentials: externalTeamMemberCredentialsSchema,
  ...adminSubmissionTeamStateSchema,
});

const adminSubmissionQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  type: z.enum(["PROJECT", "BUSINESS", "PRODUCT"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(500).default(50),
  search: z.string().trim().max(160).optional(),
  sort: z.enum([
    "created_desc",
    "created_asc",
    "name_asc",
    "name_desc",
    "reference_asc",
    "reference_desc",
    "course_asc",
    "course_desc",
  ]).default("created_desc"),
});

const paymentReviewStatusSchema = z.enum([
  "SUBMITTED_BY_USER",
  "PENDING_REVIEW",
  "CONFIRMED_BY_ADMIN",
  "REJECTED",
  "CANCELED",
  "PENDING",
  "CONFIRMED",
  "APPROVED",
]);

const paymentReviewBodySchema = z.object({
  status: paymentReviewStatusSchema,
  note: z.string().trim().max(400).nullable().optional(),
});

const projectFreezeBodySchema = z.object({
  reason: z.string().trim().max(400).optional().nullable(),
});

function hexToRgb(value: string) {
  const normalized = value.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getLuminance(value: string) {
  const { r, g, b } = hexToRgb(value);

  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
}

function getContrastRatio(left: string, right: string) {
  const [lighter, darker] = [getLuminance(left), getLuminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateSubmissionTheme(primaryColor: string, secondaryColor: string) {
  if (primaryColor.toLowerCase() === secondaryColor.toLowerCase()) {
    return "As cores primária e secundária precisam ser diferentes.";
  }

  const pairContrast = getContrastRatio(primaryColor, secondaryColor);
  const primaryReadableContrast = Math.max(
    getContrastRatio(primaryColor, "#FFFFFF"),
    getContrastRatio(primaryColor, "#152434")
  );
  const secondaryReadableContrast = Math.max(
    getContrastRatio(secondaryColor, "#FFFFFF"),
    getContrastRatio(secondaryColor, "#152434")
  );

  if (pairContrast < 1.2 || primaryReadableContrast < 3 || secondaryReadableContrast < 3) {
    return "Escolhe uma combinação de cores com melhor contraste para manter os cards e detalhes legíveis.";
  }

  return null;
}

function parseSubmissionNeeds(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

type AdminSubmissionLike = Submission | Prisma.SubmissionGetPayload<object>;

function toAdminSubmissionResponse(
  s: AdminSubmissionLike,
  team?: Awaited<ReturnType<typeof buildSubmissionTeamPayload>> | null,
  challengeState?: Awaited<ReturnType<typeof buildAdminSubmissionChallengeState>> | null,
) {
  const membersList = normalizeTeamMembersInput(s.members);
  const needsList = parseSubmissionNeeds(s.needs);
  const competitionEligible = isCompetitionEligible(s.type, s.area);
  const slug = buildSubmissionSlug(s.name, s.id);
  const challenge = challengeState ?? {
    status: "MISSING" as const,
    question: null,
    answersCount: 0,
    updatedAt: null,
  };

  return {
    id: s.id,
    slug,
    detailPath: `/projeto/${slug}`,
    referenceCode: s.referenceCode,
    name: s.name,
    description: s.description,
    status: s.status,
    type: normalizeSubmissionType(s.type, s.area),
    area: s.area ?? null,
    createdAt: s.createdAt ?? null,
    course: s.course ?? null,
    members: membersList.length > 0 ? formatTeamMembersLabel(membersList) : null,
    membersList,
    teamSize: membersList.length,
    leaderName: s.leaderName ?? null,
    leaderPhone: s.leaderPhone ?? null,
    paymentStatus: s.paymentStatus ?? "PENDING_REVIEW",
    paymentStatusLabel: paymentStatusLabel(s.paymentStatus, Boolean(s.paymentProof)),
    paymentSubmittedAt: s.paymentSubmittedAt?.toISOString() ?? null,
    paymentReviewedAt: s.paymentReviewedAt?.toISOString() ?? null,
    paymentReviewedByStudentNumber: s.paymentReviewedByStudentNumber ?? null,
    paymentReviewNote: s.paymentReviewNote ?? null,
    paymentTimeline: buildPaymentTimeline({
      status: s.paymentStatus,
      submittedAt: s.paymentSubmittedAt ?? s.createdAt,
      reviewedAt: s.paymentReviewedAt,
      reviewedBy: s.paymentReviewedByStudentNumber,
      reviewNote: s.paymentReviewNote,
    }),
    needs: needsList,
    observations: s.observations ?? null,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    bannerUrl: s.bannerUrl ?? null,
    projectFrozen: s.projectFrozen ?? false,
    projectFrozenAt: s.projectFrozenAt?.toISOString() ?? null,
    projectFrozenByStudentNumber: s.projectFrozenByStudentNumber ?? null,
    projectFreezeReason: s.projectFreezeReason ?? null,
    isWinner: competitionEligible ? s.isWinner ?? false : false,
    canVote: competitionEligible && !s.projectFrozen,
    eligibleForAward: competitionEligible,
    teamInviteUrl: team?.inviteUrl ?? null,
    teamJourneyLabel: team?.journeyLabel ?? buildMemberJourneyLabel({ total: membersList.length, confirmed: 0 }),
    teamTotalMembers: team?.totalMembers ?? membersList.length,
    teamConfirmedMembers: team?.confirmedMembers ?? 0,
    teamAllConfirmed: team?.allConfirmed ?? false,
    teamMembers: team?.members ?? [],
    exhibitorChallengeStatus: challenge.status,
    exhibitorChallengeQuestion: challenge.question,
    exhibitorChallengeAnswersCount: challenge.answersCount,
    exhibitorChallengeUpdatedAt: challenge.updatedAt,
  };
}

async function buildAdminSubmissionChallengeState(submissionId: number) {
  const qrAction = await prisma.qrAction.findFirst({
    where: {
      type: "EXHIBITOR_CHALLENGE",
      targetId: submissionId,
    },
    include: {
      passportChallenge: {
        include: {
          _count: { select: { answers: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const challenge = qrAction?.passportChallenge ?? null;
  if (!challenge) {
    return {
      status: "MISSING" as const,
      question: null,
      answersCount: 0,
      updatedAt: null,
    };
  }

  const lifecycle =
    challenge.status ??
    (challenge.active ? "APPROVED" : challenge.approvedAt ? "PAUSED" : "PENDING_APPROVAL");
  const status =
    lifecycle === "APPROVED" && challenge.active
      ? "APPROVED"
      : lifecycle === "REJECTED"
        ? "REJECTED"
        : challenge.approvedAt
          ? "PAUSED"
          : "PENDING_APPROVAL";

  return {
    status,
    question: challenge.question,
    answersCount: challenge._count?.answers ?? 0,
    updatedAt: challenge.updatedAt?.toISOString() ?? null,
  };
}

function formatSubmissionStatusLabel(status: "PENDING" | "APPROVED" | "REJECTED") {
  switch (status) {
    case "APPROVED":
      return "aprovada";
    case "REJECTED":
      return "excluída";
    default:
      return "em análise";
  }
}

function isDuplicateSubmissionError(error: unknown) {
  return error instanceof Error && /submission already exists/i.test(error.message);
}

function isOwnedSubmissionDuplicate(
  submission: { studentId?: number | null; studentNumberSnapshot?: string | null },
  student: { id: number; studentNumber: string },
) {
  return submission.studentId === student.id || submission.studentNumberSnapshot === student.studentNumber;
}

function isSubmissionPaymentProofSelfReference(value: string, submissionId: number) {
  const trimmed = value.trim();
  const expectedPath = `/submissions/${submissionId}/payment-proof`;

  if (trimmed === expectedPath || trimmed === `/api${expectedPath}`) {
    return true;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  try {
    const { pathname } = new URL(trimmed);
    const normalizedPath = pathname.startsWith("/api/") ? pathname.slice(4) : pathname;
    return normalizedPath === expectedPath;
  } catch {
    return false;
  }
}

function getRequestAuthToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring("Bearer ".length);
  }

  return getCookie(request, "uor_auth");
}

function isResponsibleSubmissionViewer(submission: {
  studentId?: number | null;
  studentNumberSnapshot?: string | null;
}, student: { id: number; studentNumber: string }) {
  return submission.studentId === student.id
    || (!!submission.studentNumberSnapshot && submission.studentNumberSnapshot === student.studentNumber);
}

async function isConfirmedSubmissionMember(submissionId: number, student: { id: number; studentNumber: string }) {
  const member = await prisma.submissionMember.findFirst({
    where: {
      submissionId,
      confirmedAt: { not: null },
      OR: [
        { studentId: student.id },
        { studentNumber: student.studentNumber },
      ],
    },
    select: { id: true },
  });

  return Boolean(member);
}

async function resolveSubmissionViewerAccess(submission: {
  id: number;
  studentId?: number | null;
  studentNumberSnapshot?: string | null;
}, student: { id: number; studentNumber: string }) {
  if (isResponsibleSubmissionViewer(submission, student)) {
    return {
      allowed: true,
      viewerRole: "RESPONSAVEL" as const,
      canManageSubmission: true,
    };
  }

  if (await isConfirmedSubmissionMember(submission.id, student)) {
    return {
      allowed: true,
      viewerRole: "MEMBRO" as const,
      canManageSubmission: false,
    };
  }

  return {
    allowed: false,
    viewerRole: "MEMBRO" as const,
    canManageSubmission: false,
  };
}

async function canReadExhibitorPdf(request: FastifyRequest, env: ReturnType<typeof loadEnv>, input: {
  submission: {
    id: number;
    studentId: number | null;
    studentNumberSnapshot: string | null;
  };
  token?: string | null;
  metadata?: ExhibitorPdfMetadata | null;
  allowConfirmedMembers?: boolean;
}) {
  if (input.token && input.metadata?.accessToken && input.token === input.metadata.accessToken) {
    return { allowed: true as const };
  }

  const authToken = getRequestAuthToken(request);
  if (!authToken) {
    return { allowed: false as const, status: 401 as const, message: "Sessão inválida ou expirada. Inicia sessão novamente." };
  }

  try {
    const payload = verifyAuthToken(authToken, env);

    if (payload.role === "jury") {
      return { allowed: true as const };
    }

    if (payload.role === "trainer") {
      return { allowed: false as const, status: 403 as const, message: "Access denied" };
    }

    const ownsSubmission = input.submission.studentId === payload.sub
      || input.submission.studentNumberSnapshot === payload.studentNumber;
    if (ownsSubmission || await isAdminStudentNumber(payload.studentNumber)) {
      return { allowed: true as const };
    }

    if (
      input.allowConfirmedMembers
      && await isConfirmedSubmissionMember(input.submission.id, {
        id: payload.sub,
        studentNumber: payload.studentNumber,
      })
    ) {
      return { allowed: true as const };
    }

    return { allowed: false as const, status: 403 as const, message: "Access denied" };
  } catch {
    return { allowed: false as const, status: 401 as const, message: "Invalid token" };
  }
}

async function canReadSubmissionDocument(request: FastifyRequest, env: ReturnType<typeof loadEnv>, submission: {
  id: number;
  studentId?: number | null;
  studentNumberSnapshot?: string | null;
}, options?: { allowConfirmedMembers?: boolean }) {
  return canReadExhibitorPdf(request, env, {
    submission: {
      id: submission.id,
      studentId: submission.studentId ?? null,
      studentNumberSnapshot: submission.studentNumberSnapshot ?? null,
    },
    allowConfirmedMembers: options?.allowConfirmedMembers ?? false,
  });
}

function serializeExhibitorPdfMetadata(metadata: ExhibitorPdfMetadata, created: boolean) {
  return {
    submissionId: metadata.submissionId,
    fileName: metadata.fileName,
    pdfPath: metadata.pdfPath,
    publicUrl: metadata.publicUrl,
    generatedAt: metadata.generatedAt,
    version: metadata.version,
    created,
  };
}

function buildSubmissionCreateResponse(submission: {
  id: number;
  referenceCode: string;
  status: string;
  type: "PROJECT" | "BUSINESS" | "PRODUCT";
  paymentStatus?: string | null;
}, config: {
  projectCommunityUrl?: string | null;
  businessCommunityUrl?: string | null;
  productCommunityUrl?: string | null;
}) {
  const communityUrl = submission.status === "APPROVED" && isPaymentConfirmedByAdmin(submission.paymentStatus)
    ? buildSubmissionCommunityUrl(submission.type, config)
    : null;

  return {
    referenceCode: submission.referenceCode,
    status: submission.status,
    id: submission.id,
    communityUrl,
    paymentStatus: submission.paymentStatus ?? "PENDING_REVIEW",
    paymentStatusLabel: paymentStatusLabel(submission.paymentStatus, true),
    boardingPassPath: `/submissions/${submission.id}/boarding-pass.pdf`,
    paymentProofPath: `/submissions/${submission.id}/payment-proof`,
    receiptPath: `/submissoes/${submission.id}`,
  };
}

function formatSubmissionCommunityDetail(communityUrl: string | null) {
  if (!communityUrl) {
    return "Acompanha os próximos passos no teu recibo.";
  }

  if (/api\.whatsapp\.com\/send|wa\.me\//i.test(communityUrl)) {
    return `WhatsApp da organização: ${communityUrl}`;
  }

  if (/chat\.whatsapp\.com|whatsapp\.com\/channel/i.test(communityUrl)) {
    return `Comunidade: ${communityUrl}`;
  }

  return `Ligação de acompanhamento: ${communityUrl}`;
}

export async function submissionRoutes(app: FastifyInstance, { env }: { env: ReturnType<typeof loadEnv> }) {
  const createSubmission = new CreateSubmission(submissionRepo);
  const voteSubmission = new VoteSubmission(submissionRepo, voteRepo);
  const reviewSubmission = new ReviewSubmission(submissionRepo, reviewRepo);
  const selectWinnerSubmission = new SelectWinnerSubmission(submissionRepo);
  const clearWinnerSubmission = new ClearWinnerSubmission(submissionRepo);
  const listDetailedSubmissions = new ListDetailedSubmissions(submissionRepo);
  const getSubmissionConfig = new GetSubmissionConfig(submissionConfigRepo);
  const updateSubmissionConfig = new UpdateSubmissionConfig(submissionConfigRepo);
  const updateSubmissionStatus = new UpdateSubmissionStatus(submissionRepo);
  const updateSubmissionPresentation = new UpdateSubmissionPresentation(submissionRepo);
  const deleteSubmission = new DeleteSubmission(submissionRepo);
  const publicAppUrl = env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:5173";

  app.get("/config", {
    schema: {
      response: {
        200: submissionConfigSchema.extend({
          key: z.string(),
          createdAt: z.coerce.date(),
          updatedAt: z.coerce.date()
        })
      }
    }
  }, async () => {
    return getSubmissionConfig.execute();
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env });

    protectedApp.post("/", {
      schema: {
        body: createSubmissionSchema,
        response: {
          200: z.object({
            referenceCode: z.string(),
            status: z.string(),
            id: z.number(),
            communityUrl: z.string().nullable(),
            paymentStatus: z.string(),
            paymentStatusLabel: z.string(),
            boardingPassPath: z.string(),
            paymentProofPath: z.string().nullable(),
            receiptPath: z.string(),
          }),
          201: z.object({
            referenceCode: z.string(),
            status: z.string(),
            id: z.number(),
            communityUrl: z.string().nullable(),
            boardingPassPath: z.string(),
            paymentProofPath: z.string().nullable(),
            receiptPath: z.string(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          409: z.object({ message: z.string(), receiptPath: z.string().optional() })
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const payload = request.body as z.infer<typeof createSubmissionSchema>;
      const normalizedMembers = normalizeTeamMembersInput(payload.members);
      const primaryColor = payload.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR;
      const secondaryColor = payload.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR;
      const themeError = validateSubmissionTheme(primaryColor, secondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const config = await getSubmissionConfig.execute();
      if (!config.isOpen) {
        return reply.code(403).send({ message: "As candidaturas estão fechadas neste momento." });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.student.id },
      });

      if (!student) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      let result;
      const storedPaymentProof = await persistMediaValue(env, payload.paymentProof, {
        purpose: "submission-payment-proofs",
        allowDocuments: true,
      });
      const storedBannerUrl = await persistMediaValue(env, payload.bannerUrl ?? null, {
        purpose: "submission-banners",
        maxImageDimension: 1600,
      });
      try {
        result = await createSubmission.execute({
          ...payload,
          paymentProof: storedPaymentProof ?? payload.paymentProof,
          paymentStatus: "PENDING_REVIEW",
          paymentSubmittedAt: new Date(),
          paymentReviewedAt: null,
          paymentReviewedByStudentNumber: null,
          paymentReviewNote: null,
          members: normalizedMembers,
          primaryColor,
          secondaryColor,
          bannerUrl: storedBannerUrl ?? null,
          studentId: student.id,
          studentNumberSnapshot: student.studentNumber,
        });
      } catch (error) {
        if (!isDuplicateSubmissionError(error)) {
          throw error;
        }

        const existing = await prisma.submission.findFirst({
          where: {
            name: payload.name,
            leaderPhone: payload.leaderPhone,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            referenceCode: true,
            status: true,
            type: true,
            paymentStatus: true,
            studentId: true,
            studentNumberSnapshot: true,
          },
        });

        if (existing && isOwnedSubmissionDuplicate(existing, student)) {
          return reply.code(200).send(buildSubmissionCreateResponse(existing, config));
        }

        return reply.code(409).send({
          message: "Já existe uma candidatura com este nome e contacto. Usa outro título ou acompanha a candidatura já registada.",
          ...(existing ? { receiptPath: `/submissoes/${existing.id}` } : {}),
        });
      }

      const communityUrl = result.status === "APPROVED" && isPaymentConfirmedByAdmin(result.paymentStatus)
        ? buildSubmissionCommunityUrl(result.type, config)
        : null;
      const submissionCourse = "course" in payload ? payload.course : null;

      try {
        await sendWhatsAppAutomationEvent(env, "SUBMISSION_CREATED", {
          phone: payload.leaderPhone ?? student.phone,
          studentId: student.id,
          studentNumber: student.studentNumber,
          recipientName: payload.leaderName ?? student.name,
          recipientCourse: submissionCourse ?? student.course,
          values: {
            titulo: payload.name,
            referencia: result.referenceCode,
            detalhe: formatSubmissionCommunityDetail(communityUrl),
            link: `${publicAppUrl}/submissoes/${result.id}`,
          },
        });
      } catch (error) {
        request.log.warn({ err: error }, "automatic submission WhatsApp notification failed");
      }

      try {
        const contextualClassCodes = student.classCode?.trim() ? [student.classCode.trim()] : [];
        const contextualCourses = (submissionCourse ?? student.course)?.trim() ? [(submissionCourse ?? student.course)!.trim()] : [];
        if (contextualClassCodes.length > 0 || contextualCourses.length > 0) {
          const contextualAudience = {
            type: "STUDENT_CLASS_OR_COURSE" as const,
            studentClassCodes: contextualClassCodes,
            studentCourses: contextualCourses,
          };
          const contextualValues = {
            titulo: payload.name,
            referencia: result.referenceCode,
            colega: payload.leaderName ?? student.name ?? `Estudante ${student.studentNumber}`,
            turma: student.classCode,
            curso: submissionCourse ?? student.course,
            link: `${publicAppUrl}/submissoes/${result.id}`,
          };

          const [whatsAppResult, smsResult] = await Promise.allSettled([
            sendWhatsAppAudienceAutomationEvent(env, "SUBMISSION_CONTEXT_AUDIENCE", {
              audience: contextualAudience,
              excludeStudentId: student.id,
              recipientCourse: submissionCourse ?? student.course,
              values: contextualValues,
            }),
            sendSmsAudienceAutomationEvent(env, "SUBMISSION_CONTEXT_AUDIENCE", {
              audience: {
                type: "STUDENT_CLASS_OR_COURSE",
                studentClassCodes: contextualClassCodes,
                studentCourses: contextualCourses,
              },
              excludeStudentId: student.id,
              values: contextualValues,
            }),
          ]);

          if (whatsAppResult.status === "rejected") {
            request.log.warn({ err: whatsAppResult.reason }, "contextual submission WhatsApp audience notification failed");
          }
          if (smsResult.status === "rejected") {
            request.log.warn({ err: smsResult.reason }, "contextual submission SMS audience notification failed");
          }
        }
      } catch (error) {
        request.log.warn({ err: error, submissionId: result.id }, "contextual submission notifications failed");
      }

      return reply.code(201).send(buildSubmissionCreateResponse(result, config));
    });

    protectedApp.get("/mine", {
      schema: {
        response: {
          200: z.array(studentSubmissionListItemSchema),
          401: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const [submissions, odinDeviceWarnings] = await Promise.all([
        submissionRepo.listByStudent(request.student.id),
        getOdinExhibitorDeviceWarningsForStudent({
          studentId: request.student.id,
          studentNumber: request.student.studentNumber,
          windowHours: 48,
        }),
      ]);
      const odinDeviceWarningBySubmission = new Map(
        odinDeviceWarnings.map((warning) => [warning.submissionId, warning]),
      );
      const items = await Promise.all(submissions.map(async (submission) => {
        const latestOdinProjectPenalty = await prisma.odinProjectPenalty.findFirst({
          where: {
            submissionId: submission.id,
            revokedAt: null,
            notifiedProjectMembers: true,
          },
          select: {
            id: true,
            penaltyMode: true,
            removedVoteCount: true,
            removedPointCount: true,
            reason: true,
            automationProofSummary: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
        const base = buildStudentSubmissionListItem({
          ...submission,
          latestOdinProjectPenalty,
          latestOdinExhibitorDeviceWarning: odinDeviceWarningBySubmission.get(submission.id) ?? null,
        });
        const team = await buildSubmissionTeamPayload(env, submission);
        const access = await resolveSubmissionViewerAccess(submission, request.student!);
        const canManageSubmission = access.canManageSubmission;
        return {
          ...base,
          viewerRole: access.viewerRole,
          canManageTeam: canManageSubmission,
          canManagePresentation: canManageSubmission,
          canManageChallenge: canManageSubmission,
          teamInviteUrl: canManageSubmission ? team.inviteUrl : null,
          teamJourneyLabel: team.journeyLabel,
          teamTotalMembers: team.totalMembers,
          teamConfirmedMembers: team.confirmedMembers,
          teamAllConfirmed: team.allConfirmed,
          teamMembers: team.members,
        };
      }));
      return reply.send(items);
    });

    protectedApp.get("/exhibitor-passport/mine", {
      schema: {
        response: {
          200: exhibitorPassportSummarySchema,
          401: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      return reply.send(await getStudentExhibitorPassportSummary({
        studentId: request.student.id,
        eventKey: "main-event",
      }));
    });

    protectedApp.get("/:id/team", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: submissionTeamPayloadSchema,
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const submission = await submissionRepo.findOwnedById((request.params as { id: number }).id, request.student.id);
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      return reply.send(await buildSubmissionTeamPayload(env, submission));
    });

    protectedApp.post("/:id/team/members", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: addTeamMemberSchema,
        response: {
          200: submissionTeamPayloadSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const submission = await submissionRepo.findOwnedById((request.params as { id: number }).id, request.student.id);
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      try {
        return reply.send(await addSubmissionTeamMember(
          env,
          submission,
          (request.body as z.infer<typeof addTeamMemberSchema>).name,
        ));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível adicionar este membro.";
        if (/recusada/i.test(message)) {
          return reply.code(403).send({ message });
        }
        return reply.code(400).send({ message });
      }
    });

    protectedApp.patch("/:id/team/members/:memberId/student-number", {
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive(),
          memberId: z.coerce.number().int().positive(),
        }),
        body: updateTeamMemberStudentNumberSchema,
        response: {
          200: submissionTeamPayloadSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const params = request.params as { id: number; memberId: number };
      const submission = await submissionRepo.findOwnedById(params.id, request.student.id);
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      try {
        return reply.send(await setSubmissionTeamMemberExpectedStudentNumber(
          env,
          submission,
          params.memberId,
          (request.body as z.infer<typeof updateTeamMemberStudentNumberSchema>).studentNumber,
        ));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível guardar o número deste membro.";
        if (/recusada|responsável/i.test(message)) {
          return reply.code(403).send({ message });
        }
        return reply.code(400).send({ message });
      }
    });

    protectedApp.delete("/:id/team/members/:memberId", {
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive(),
          memberId: z.coerce.number().int().positive(),
        }),
        response: {
          200: submissionTeamPayloadSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const params = request.params as { id: number; memberId: number };
      const submission = await submissionRepo.findOwnedById(params.id, request.student.id);
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      try {
        const team = await removeSubmissionTeamMember(env, submission, params.memberId);

        await recordAdminAudit({
          actorStudentNumber: request.student.studentNumber,
          action: "submission.team_member_remove_responsible",
          entityType: "SubmissionMember",
          entityId: params.memberId,
          summary: `Responsável removeu um membro da candidatura ${submission.referenceCode}.`,
          metadata: {
            submissionId: submission.id,
            memberId: params.memberId,
          },
        });

        return reply.send(team);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível remover este membro.";
        if (/responsável|recusada/i.test(message)) {
          return reply.code(403).send({ message });
        }
        return reply.code(400).send({ message });
      }
    });

    protectedApp.post("/:id/team/members/:memberId/confirm-external", {
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive(),
          memberId: z.coerce.number().int().positive(),
        }),
        body: confirmExternalTeamMemberSchema,
        response: {
          200: submissionTeamPayloadSchema.extend({
            credentials: externalTeamMemberCredentialsSchema,
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const params = request.params as { id: number; memberId: number };
      let submission = await submissionRepo.findOwnedById(params.id, request.student.id);
      const adminActor = !submission && await isAdminStudentNumber(request.student.studentNumber);
      if (!submission && adminActor) {
        submission = await submissionRepo.findById(params.id);
      }
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      try {
        const result = await adminConfirmExternalSubmissionTeamMember(
          env,
          submission,
          params.memberId,
          {
            ...(request.body as z.infer<typeof confirmExternalTeamMemberSchema>),
            actorStudentNumber: request.student.studentNumber,
          },
        );
        if (adminActor) {
          await recordAdminAudit({
            actorStudentNumber: request.student.studentNumber,
            action: "submission.team_member_confirm_external",
            entityType: "SubmissionMember",
            entityId: params.memberId,
            summary: `Membro externo da candidatura ${submission.referenceCode} confirmado com credenciais locais.`,
            metadata: {
              submissionId: params.id,
              memberId: params.memberId,
              externalOrganization: (request.body as z.infer<typeof confirmExternalTeamMemberSchema>).externalOrganization,
            },
          });
        }
        return reply.send({
          ...result.team,
          credentials: result.credentials,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível confirmar este membro externo.";
        if (/não encontrado/i.test(message)) {
          return reply.code(404).send({ message });
        }
        if (/já está ligado|já confirmou|outro estudante/i.test(message)) {
          return reply.code(409).send({ message });
        }
        if (/recusada|responsável/i.test(message)) {
          return reply.code(403).send({ message });
        }
        return reply.code(400).send({ message });
      }
    });

    protectedApp.get("/:id/receipt", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: studentSubmissionReceiptSchema,
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const submission = await submissionRepo.findById((request.params as { id: number }).id);
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      const access = await resolveSubmissionViewerAccess(submission, request.student);
      if (!access.allowed) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      const config = await getSubmissionConfig.execute();
      const receipt = buildStudentSubmissionReceiptResponse(submission, config);
      return reply.send({
        ...receipt,
        canEdit: access.canManageSubmission && receipt.canEdit,
        viewerRole: access.viewerRole,
        canManageSubmission: access.canManageSubmission,
        paymentProofPath: access.canManageSubmission ? receipt.paymentProofPath : null,
      });
    });

    protectedApp.patch("/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: createSubmissionSchema,
        response: {
          200: studentSubmissionReceiptSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const submissionId = (request.params as { id: number }).id;
      const existing = await submissionRepo.findOwnedById(submissionId, request.student.id);
      if (!existing) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      if (!canStudentEditSubmission(existing.status)) {
        return reply.code(403).send({ message: "Esta submissão já não pode ser editada." });
      }

      const payload = request.body as z.infer<typeof createSubmissionSchema>;
      const normalizedMembers = normalizeTeamMembersInput(payload.members);
      const primaryColor = payload.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR;
      const secondaryColor = payload.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR;
      const themeError = validateSubmissionTheme(primaryColor, secondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.student.id },
      });

      if (!student) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const paymentProof = isSubmissionPaymentProofSelfReference(payload.paymentProof, submissionId)
        ? existing.paymentProof
        : await persistMediaValue(env, payload.paymentProof, {
          purpose: "submission-payment-proofs",
          allowDocuments: true,
        }) ?? payload.paymentProof;
      const storedBannerUrl = await persistMediaValue(env, payload.bannerUrl ?? null, {
        purpose: "submission-banners",
        maxImageDimension: 1600,
      });

      const updated = await submissionRepo.updateOwnedSubmission(submissionId, request.student.id, {
        ...payload,
        members: normalizedMembers,
        paymentProof,
        paymentStatus: "PENDING_REVIEW",
        paymentSubmittedAt: new Date(),
        paymentReviewedAt: null,
        paymentReviewedByStudentNumber: null,
        paymentReviewNote: null,
        primaryColor,
        secondaryColor,
        bannerUrl: storedBannerUrl ?? null,
        studentId: student.id,
        studentNumberSnapshot: student.studentNumber,
      });

      const config = await getSubmissionConfig.execute();
      return reply.send(buildStudentSubmissionReceiptResponse(updated, config));
    });

    protectedApp.patch("/:id/presentation/mine", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: submissionPresentationSchema,
        response: {
          200: submissionPresentationResponseSchema.extend({ status: z.string() }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const { id } = request.params as { id: number };
      const body = request.body as z.infer<typeof submissionPresentationSchema>;
      const existing = await submissionRepo.findOwnedById(id, request.student.id);

      if (!existing) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      if (existing.status !== "APPROVED") {
        return reply.code(403).send({ message: "A personalização da capa só fica disponível depois da aprovação." });
      }

      const nextPrimaryColor = body.primaryColor ?? existing.primaryColor;
      const nextSecondaryColor = body.secondaryColor ?? existing.secondaryColor;
      const themeError = validateSubmissionTheme(nextPrimaryColor, nextSecondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const hasBannerUpdate = Object.prototype.hasOwnProperty.call(body, "bannerUrl");
      const storedBannerUrl = hasBannerUpdate
        ? await persistMediaValue(env, body.bannerUrl ?? null, {
          purpose: "submission-banners",
          maxImageDimension: 1600,
        })
        : undefined;
      const presentationPayload = {
        ...body,
        ...(hasBannerUpdate ? { bannerUrl: storedBannerUrl ?? null } : {}),
      };

      const updated = await updateSubmissionPresentation.execute(id, presentationPayload);
      const slug = buildSubmissionSlug(updated.name, updated.id);

      return reply.send({
        id: updated.id,
        slug,
        detailPath: `/projeto/${slug}`,
        description: updated.description,
        repoUrl: updated.repoUrl ?? null,
        websiteUrl: updated.websiteUrl ?? null,
        instagramUrl: updated.instagramUrl ?? null,
        facebookUrl: updated.facebookUrl ?? null,
        linkedinUrl: updated.linkedinUrl ?? null,
        githubUrl: updated.githubUrl ?? null,
        primaryColor: updated.primaryColor,
        secondaryColor: updated.secondaryColor,
        bannerUrl: updated.bannerUrl ?? null,
        status: updated.status,
      });
    });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);
      setDefaultAdminPermission(adminApp, ["OVERVIEW", "SUBMISSIONS", "VOTES", "WINNERS"]);

      adminApp.put("/config", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        body: submissionConfigSchema,
        response: {
          200: submissionConfigSchema.extend({
            key: z.string(),
            createdAt: z.coerce.date(),
            updatedAt: z.coerce.date()
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request) => {
        const payload = request.body as z.infer<typeof submissionConfigSchema>;
        return updateSubmissionConfig.execute(payload);
      });

      adminApp.get("/", {
      schema: {
        querystring: z.object({ status: z.string().optional(), type: z.string().optional() }),
        response: {
          200: z.array(z.object({
            id: z.number(),
            slug: z.string(),
            detailPath: z.string(),
            referenceCode: z.string(),
            name: z.string(),
            description: z.string(),
            status: z.string(),
            type: z.string(),
            area: z.string().nullable(),
            createdAt: z.coerce.date().nullable(),
            course: z.string().nullable(),
            members: z.string().nullable(),
            membersList: z.array(z.string()),
            teamSize: z.number(),
            leaderName: z.string().nullable(),
            leaderPhone: z.string().nullable(),
            paymentStatus: z.string(),
            paymentStatusLabel: z.string(),
            paymentSubmittedAt: z.string().nullable(),
            paymentReviewedAt: z.string().nullable(),
            paymentReviewedByStudentNumber: z.string().nullable(),
            paymentReviewNote: z.string().nullable(),
            paymentTimeline: z.array(z.object({
              key: z.string(),
              label: z.string(),
              status: z.string(),
              at: z.string().nullable(),
              by: z.string().nullable(),
              note: z.string().nullable(),
            })),
            needs: z.array(z.string()),
            observations: z.string().nullable(),
            primaryColor: z.string(),
            secondaryColor: z.string(),
            bannerUrl: z.string().nullable(),
            ...projectFreezeStateSchema,
            isWinner: z.boolean(),
            canVote: z.boolean(),
            eligibleForAward: z.boolean(),
            ...adminSubmissionChallengeStateSchema,
            ...adminSubmissionTeamStateSchema,
          })),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request) => {
        const query = adminSubmissionQuerySchema.pick({ status: true, type: true }).partial().parse(request.query);
        const list = await listDetailedSubmissions.execute(query.status, query.type);
        return Promise.all(list.map(async (submission) => {
          const [team, challengeState] = await Promise.all([
            buildSubmissionTeamPayload(env, submission),
            buildAdminSubmissionChallengeState(submission.id),
          ]);
          return toAdminSubmissionResponse(submission, team, challengeState);
        }));
      });

      adminApp.get("/paged", {
      schema: {
        querystring: adminSubmissionQuerySchema,
        response: {
          200: z.object({
            items: z.array(z.object({
              id: z.number(),
              slug: z.string(),
              detailPath: z.string(),
              referenceCode: z.string(),
              name: z.string(),
              description: z.string(),
              status: z.string(),
              type: z.string(),
              area: z.string().nullable(),
              createdAt: z.coerce.date().nullable(),
              course: z.string().nullable(),
              members: z.string().nullable(),
              membersList: z.array(z.string()),
              teamSize: z.number(),
              leaderName: z.string().nullable(),
              leaderPhone: z.string().nullable(),
              paymentStatus: z.string(),
              paymentStatusLabel: z.string(),
              paymentSubmittedAt: z.string().nullable(),
              paymentReviewedAt: z.string().nullable(),
              paymentReviewedByStudentNumber: z.string().nullable(),
              paymentReviewNote: z.string().nullable(),
              paymentTimeline: z.array(z.object({
                key: z.string(),
                label: z.string(),
                status: z.string(),
                at: z.string().nullable(),
                by: z.string().nullable(),
                note: z.string().nullable(),
              })),
              needs: z.array(z.string()),
              observations: z.string().nullable(),
              primaryColor: z.string(),
              secondaryColor: z.string(),
              bannerUrl: z.string().nullable(),
              ...projectFreezeStateSchema,
              isWinner: z.boolean(),
              canVote: z.boolean(),
              eligibleForAward: z.boolean(),
              ...adminSubmissionChallengeStateSchema,
              ...adminSubmissionTeamStateSchema,
            })),
            total: z.number(),
            page: z.number(),
            totalPages: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const query = adminSubmissionQuerySchema.parse(request.query);
        const page = query.page;
        const limit = query.limit;
        const search = query.search?.trim();
        const where = {
          deletedAt: null,
          ...(query.status ? { status: query.status } : {}),
          ...(query.type ? { type: query.type } : {}),
          ...(search
            ? {
              OR: [
                { name: { contains: search } },
                { referenceCode: { contains: search } },
                { course: { contains: search } },
                { leaderName: { contains: search } },
                { leaderPhone: { contains: search } },
              ],
            }
            : {}),
        };

        const orderBy = query.sort === "created_asc"
          ? [{ createdAt: "asc" as const }]
          : query.sort === "name_asc"
            ? [{ name: "asc" as const }, { createdAt: "desc" as const }]
            : query.sort === "name_desc"
              ? [{ name: "desc" as const }, { createdAt: "desc" as const }]
              : query.sort === "reference_asc"
                ? [{ referenceCode: "asc" as const }, { createdAt: "desc" as const }]
                : query.sort === "reference_desc"
                  ? [{ referenceCode: "desc" as const }, { createdAt: "desc" as const }]
                  : query.sort === "course_asc"
                    ? [{ course: "asc" as const }, { createdAt: "desc" as const }]
                    : query.sort === "course_desc"
                      ? [{ course: "desc" as const }, { createdAt: "desc" as const }]
                      : [{ createdAt: "desc" as const }];

        const [total, items] = await Promise.all([
          prisma.submission.count({ where }),
          prisma.submission.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
          }),
        ]);

        const responseItems = await Promise.all(items.map(async (item) => {
          const [team, challengeState] = await Promise.all([
            buildSubmissionTeamPayload(env, item),
            buildAdminSubmissionChallengeState(item.id),
          ]);
          return toAdminSubmissionResponse(item, team, challengeState);
        }));

        return reply.send({
          items: responseItems,
          total,
          page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        });
      });

      adminApp.patch("/:id/team/members", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: updateTeamMembersSchema,
        response: {
          200: adminTeamMembersUpdateResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const { members } = updateTeamMembersSchema.parse(request.body);
        const submission = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            referenceCode: true,
            type: true,
            status: true,
            name: true,
            area: true,
            course: true,
            members: true,
            leaderName: true,
            studentId: true,
            studentNumberSnapshot: true,
          },
        });

        if (!submission) {
          return reply.code(404).send({ message: "Submission not found" });
        }

        const normalizedMembers = normalizeTeamMembersInput(members);

        try {
          const team = await replaceSubmissionTeamMembers(env, submission, normalizedMembers);

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.team_members_update",
            entityType: "Submission",
            entityId: id,
            summary: `Lista de membros da candidatura ${submission.referenceCode} atualizada pela administração.`,
            metadata: {
              members: normalizedMembers,
              totalMembers: normalizedMembers.length,
            },
          });

          return reply.send({
            success: true as const,
            members: normalizedMembers.length > 0 ? formatTeamMembersLabel(normalizedMembers) : null,
            membersList: normalizedMembers,
            teamSize: normalizedMembers.length,
            teamInviteUrl: team.inviteUrl,
            teamJourneyLabel: team.journeyLabel,
            teamTotalMembers: team.totalMembers,
            teamConfirmedMembers: team.confirmedMembers,
            teamAllConfirmed: team.allConfirmed,
            teamMembers: team.members,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível atualizar a equipa.";
          return reply.code(400).send({ message });
        }
      });

      adminApp.post("/:id/team/members/:memberId/confirm", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive(),
          memberId: z.coerce.number().int().positive(),
        }),
        response: {
          200: adminTeamMemberConfirmResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        }
      }
      }, async (request, reply) => {
        const { id, memberId } = request.params as { id: number; memberId: number };
        const submission = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            referenceCode: true,
            type: true,
            status: true,
            name: true,
            area: true,
            course: true,
            members: true,
            leaderName: true,
            studentId: true,
            studentNumberSnapshot: true,
          },
        });

        if (!submission) {
          return reply.code(404).send({ message: "Submission not found" });
        }

        try {
          const team = await adminConfirmSubmissionTeamMember(env, submission, memberId);

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.team_member_confirm_admin",
            entityType: "SubmissionMember",
            entityId: memberId,
            summary: `Membro da candidatura ${submission.referenceCode} confirmado pela administração após login pela Secretaria.`,
            metadata: {
              submissionId: id,
              memberId,
            },
          });

          return reply.send({
            success: true as const,
            teamInviteUrl: team.inviteUrl,
            teamJourneyLabel: team.journeyLabel,
            teamTotalMembers: team.totalMembers,
            teamConfirmedMembers: team.confirmedMembers,
            teamAllConfirmed: team.allConfirmed,
            teamMembers: team.members,
          });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível confirmar este membro.";
        if (/não encontrado/i.test(message)) {
          return reply.code(404).send({ message });
          }
          if (/já está ligado|já confirmou|outro estudante/i.test(message)) {
            return reply.code(409).send({ message });
          }
          if (/recusada/i.test(message)) {
            return reply.code(403).send({ message });
          }
        return reply.code(400).send({ message });
      }
      });

      // adminApp.post("/:id/team/members/:memberId/confirm-external")
      // is handled by the shared protected route above to avoid duplicate
      // Fastify registration while allowing both project owners and admins.

      adminApp.patch("/:id/team/members/:memberId/external-exception", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({
          id: z.coerce.number().int().positive(),
          memberId: z.coerce.number().int().positive(),
        }),
        body: updateTeamMemberExternalExceptionSchema,
        response: {
          200: adminTeamMemberConfirmResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
      }, async (request, reply) => {
        const { id, memberId } = request.params as { id: number; memberId: number };
        const body = updateTeamMemberExternalExceptionSchema.parse(request.body);
        const submission = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            referenceCode: true,
            type: true,
            status: true,
            name: true,
            area: true,
            course: true,
            members: true,
            leaderName: true,
            studentId: true,
            studentNumberSnapshot: true,
          },
        });

        if (!submission) {
          return reply.code(404).send({ message: "Submission not found" });
        }

        const member = await prisma.submissionMember.findFirst({
          where: { id: memberId, submissionId: id },
          select: { id: true },
        });

        if (!member) {
          return reply.code(404).send({ message: "Submission member not found" });
        }

        await prisma.submissionMember.update({
          where: { id: memberId },
          data: {
            isExternal: body.isExternal,
            externalOrganization: body.externalOrganization?.trim() || null,
            externalReason: body.externalReason.trim(),
            exceptionApprovedAt: body.isExternal ? new Date() : null,
            exceptionApprovedByStudentNumber: body.isExternal ? request.student?.studentNumber ?? null : null,
          },
        });

        const team = await buildSubmissionTeamPayload(env, submission);

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.team_member_external_exception",
          entityType: "SubmissionMember",
          entityId: memberId,
          summary: `Exceção de membro externo atualizada na candidatura ${submission.referenceCode}.`,
          metadata: {
            submissionId: id,
            memberId,
            isExternal: body.isExternal,
            externalOrganization: body.externalOrganization ?? null,
            externalReason: body.externalReason,
          },
        });

        return reply.send({
          success: true as const,
          teamInviteUrl: team.inviteUrl,
          teamJourneyLabel: team.journeyLabel,
          teamTotalMembers: team.totalMembers,
          teamConfirmedMembers: team.confirmedMembers,
          teamAllConfirmed: team.allConfirmed,
          teamMembers: team.members,
        });
      });

      adminApp.patch("/:id/payment-status", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: paymentReviewBodySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            paymentStatus: z.string(),
            paymentStatusLabel: z.string(),
            paymentReviewedAt: z.string().nullable(),
            paymentReviewedByStudentNumber: z.string().nullable(),
            paymentReviewNote: z.string().nullable(),
            paymentTimeline: z.array(z.object({
              key: z.string(),
              label: z.string(),
              status: z.string(),
              at: z.string().nullable(),
              by: z.string().nullable(),
              note: z.string().nullable(),
            })),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const body = paymentReviewBodySchema.parse(request.body);
        const nextStatus = normalizePaymentStatus(body.status);
        const reviewedAt = ["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(nextStatus) ? new Date() : null;

        const existingSubmission = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });
        if (!existingSubmission) {
          return reply.code(404).send({ message: "Submission not found" });
        }

        const updated = await prisma.submission.update({
          where: { id },
          data: {
            paymentStatus: nextStatus,
            paymentReviewedAt: reviewedAt,
            paymentReviewedByStudentNumber: reviewedAt ? request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : null) : null,
            paymentReviewNote: reviewedAt ? body.note?.trim() || null : null,
            paymentSubmittedAt: nextStatus === "PENDING_REVIEW" || nextStatus === "SUBMITTED_BY_USER" ? new Date() : undefined,
          },
          select: {
            id: true,
            referenceCode: true,
            status: true,
            paymentStatus: true,
            paymentSubmittedAt: true,
            paymentReviewedAt: true,
            paymentReviewedByStudentNumber: true,
            paymentReviewNote: true,
            createdAt: true,
          },
        }).catch(() => null);

        if (!updated) {
          return reply.code(404).send({ message: "Submission not found" });
        }

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.payment_review",
          entityType: "Submission",
          entityId: id,
          summary: `Estado financeiro da candidatura ${updated.referenceCode} atualizado para ${nextStatus}.`,
          metadata: {
            paymentStatus: nextStatus,
            note: updated.paymentReviewNote,
          },
        });

        if (updated.status === "APPROVED" && isPaymentConfirmedByAdmin(updated.paymentStatus)) {
          void generateExhibitorPdfForSubmission(env, id).catch((error) => {
            request.log.warn({ err: error, submissionId: id }, "automatic exhibitor PDF generation after payment review failed");
          });
        }

        return reply.send({
          success: true as const,
          paymentStatus: updated.paymentStatus,
          paymentStatusLabel: paymentStatusLabel(updated.paymentStatus, true),
          paymentReviewedAt: updated.paymentReviewedAt?.toISOString() ?? null,
          paymentReviewedByStudentNumber: updated.paymentReviewedByStudentNumber ?? null,
          paymentReviewNote: updated.paymentReviewNote ?? null,
          paymentTimeline: buildPaymentTimeline({
            status: updated.paymentStatus,
            submittedAt: updated.paymentSubmittedAt ?? updated.createdAt,
            reviewedAt: updated.paymentReviewedAt,
            reviewedBy: updated.paymentReviewedByStudentNumber,
            reviewNote: updated.paymentReviewNote,
          }),
        });
      });

      adminApp.patch("/:id/status", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: z.object({
          status: z.enum(["PENDING", "APPROVED", "REJECTED"])
        }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const { status } = request.body as { status: "PENDING" | "APPROVED" | "REJECTED" };

        try {
          await updateSubmissionStatus.execute(id, status);
          const updatedSubmission = await prisma.submission.findUnique({
            where: { id },
            include: {
              student: {
                select: {
                  id: true,
                  studentNumber: true,
                  name: true,
                  course: true,
                  phone: true,
                },
              },
            },
          });

          if (updatedSubmission) {
            try {
              await sendWhatsAppAutomationEvent(env, "SUBMISSION_STATUS_UPDATED", {
                phone: updatedSubmission.leaderPhone ?? updatedSubmission.student?.phone,
                studentId: updatedSubmission.studentId,
                studentNumber: updatedSubmission.student?.studentNumber ?? updatedSubmission.studentNumberSnapshot,
                recipientName: updatedSubmission.leaderName ?? updatedSubmission.student?.name,
                recipientCourse: updatedSubmission.course ?? updatedSubmission.student?.course,
                values: {
                  titulo: updatedSubmission.name,
                  referencia: updatedSubmission.referenceCode,
                  estado: formatSubmissionStatusLabel(status),
                  detalhe: status === "APPROVED"
                    ? "A candidatura foi aprovada e está confirmada para a próxima etapa do UOR Connect."
                    : status === "REJECTED"
                      ? "A candidatura foi excluída desta fase e não seguirá para a etapa pública."
                      : "A candidatura voltou para análise da equipa.",
                  link: `${publicAppUrl}/submissoes/${updatedSubmission.id}`,
                },
              });
            } catch (error) {
              request.log.warn({ err: error, submissionId: id }, "automatic submission status WhatsApp notification failed");
            }

            if (status === "APPROVED" && isPaymentConfirmedByAdmin(updatedSubmission.paymentStatus)) {
              void (async () => {
                const result = await generateExhibitorPdfForSubmission(env, id);
                if (result.created) {
                  await notifyExhibitorPdfReady(env, result);
                }
              })().catch((error) => {
                request.log.warn({ err: error, submissionId: id }, "automatic exhibitor PDF generation failed");
              });
            } else if (status === "APPROVED") {
              request.log.info({ submissionId: id }, "exhibitor PDF deferred until payment is confirmed by admin");
            }
          }

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.update_status",
            entityType: "Submission",
            entityId: id,
            summary: `Estado da candidatura ${id} atualizado para ${status}.`,
            metadata: { status },
          });
          return reply.send({ success: true });
        } catch (error) {
          return reply.code(404).send({ message: error instanceof Error ? error.message : "Submission not found" });
        }
      });

      adminApp.patch("/:id/freeze", {
        config: requireAdminPermission(["SUBMISSIONS", "VOTES"]),
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          body: projectFreezeBodySchema.optional().default({}),
          response: {
            200: z.object({
              success: z.literal(true),
              message: z.string(),
              ...projectFreezeStateSchema,
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const body = projectFreezeBodySchema.parse(request.body ?? {});
        const existing = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, referenceCode: true, name: true, projectFrozen: true },
        });

        if (!existing) {
          return reply.code(404).send({ message: "Candidatura não encontrada." });
        }

        const now = new Date();
        const updated = await prisma.submission.update({
          where: { id },
          data: {
            projectFrozen: true,
            projectFrozenAt: existing.projectFrozen ? undefined : now,
            projectFrozenByStudentNumber: request.student?.studentNumber ?? "unknown",
            projectFreezeReason: body.reason?.trim() || "Projeto congelado pela organização UOR Connect.",
          },
          select: {
            projectFrozen: true,
            projectFrozenAt: true,
            projectFrozenByStudentNumber: true,
            projectFreezeReason: true,
          },
        });

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.project_freeze",
          entityType: "Submission",
          entityId: id,
          summary: `Projeto congelado: ${existing.referenceCode} · ${existing.name}.`,
          metadata: {
            reason: updated.projectFreezeReason,
            projectFrozenAt: updated.projectFrozenAt?.toISOString() ?? null,
          },
        });

        return reply.send({
          success: true as const,
          message: "Projeto congelado. Os membros devem procurar a organização UOR Connect com urgência.",
          projectFrozen: updated.projectFrozen,
          projectFrozenAt: updated.projectFrozenAt?.toISOString() ?? null,
          projectFrozenByStudentNumber: updated.projectFrozenByStudentNumber ?? null,
          projectFreezeReason: updated.projectFreezeReason ?? null,
        });
      });

      adminApp.patch("/:id/unfreeze", {
        config: requireAdminPermission(["SUBMISSIONS", "VOTES"]),
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: z.object({
              success: z.literal(true),
              message: z.string(),
              ...projectFreezeStateSchema,
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const existing = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, referenceCode: true, name: true },
        });

        if (!existing) {
          return reply.code(404).send({ message: "Candidatura não encontrada." });
        }

        const updated = await prisma.submission.update({
          where: { id },
          data: {
            projectFrozen: false,
            projectFrozenAt: null,
            projectFrozenByStudentNumber: null,
            projectFreezeReason: null,
          },
          select: {
            projectFrozen: true,
            projectFrozenAt: true,
            projectFrozenByStudentNumber: true,
            projectFreezeReason: true,
          },
        });

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.project_unfreeze",
          entityType: "Submission",
          entityId: id,
          summary: `Projeto descongelado: ${existing.referenceCode} · ${existing.name}.`,
        });

        return reply.send({
          success: true as const,
          message: "Projeto descongelado. O acesso dos membros e a votação voltaram ao estado normal.",
          projectFrozen: updated.projectFrozen,
          projectFrozenAt: updated.projectFrozenAt?.toISOString() ?? null,
          projectFrozenByStudentNumber: updated.projectFrozenByStudentNumber ?? null,
          projectFreezeReason: updated.projectFreezeReason ?? null,
        });
      });

      adminApp.patch("/:id/type", {
        config: requireAdminPermission(["SUBMISSIONS"]),
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          body: z.object({
            type: z.enum(["PROJECT", "BUSINESS", "PRODUCT"])
          }),
          response: {
            200: z.object({
              success: z.literal(true),
              id: z.number(),
              type: z.string(),
              canVote: z.boolean(),
              eligibleForAward: z.boolean(),
              isWinner: z.boolean(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const { type } = request.body as { type: "PROJECT" | "BUSINESS" | "PRODUCT" };

        const existing = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: { id: true, type: true, name: true },
        });

        if (!existing) {
          return reply.code(404).send({ message: "Candidatura não encontrada." });
        }

        const updated = await prisma.submission.update({
          where: { id },
          data: { type },
        });
        const eligibleForAward = isCompetitionEligible(updated.type, updated.area);

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.update_type",
          entityType: "Submission",
          entityId: id,
          summary: `Categoria da candidatura ${id} atualizada para ${getSubmissionTypeLabel(type)}.`,
          metadata: {
            previousType: existing.type,
            type,
          },
        });

        return reply.send({
          success: true as const,
          id: updated.id,
          type: normalizeSubmissionType(updated.type, updated.area),
          canVote: eligibleForAward,
          eligibleForAward,
          isWinner: eligibleForAward ? updated.isWinner ?? false : false,
        });
      });

      adminApp.patch("/:id/winner", {
      config: requireAdminPermission(["WINNERS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
      const { id } = request.params as { id: number };

      try {
        await selectWinnerSubmission.execute(id);
        const winnerSubmission = await prisma.submission.findUnique({
          where: { id },
          include: {
            student: {
              select: {
                id: true,
                studentNumber: true,
                name: true,
                course: true,
                phone: true,
              },
            },
          },
        });

        if (winnerSubmission) {
          try {
            await sendWhatsAppAutomationEvent(env, "SUBMISSION_MARKED_WINNER", {
              phone: winnerSubmission.leaderPhone ?? winnerSubmission.student?.phone,
              studentId: winnerSubmission.studentId,
              studentNumber: winnerSubmission.student?.studentNumber ?? winnerSubmission.studentNumberSnapshot,
              recipientName: winnerSubmission.leaderName ?? winnerSubmission.student?.name,
              recipientCourse: winnerSubmission.course ?? winnerSubmission.student?.course,
              values: {
                titulo: winnerSubmission.name,
                referencia: winnerSubmission.referenceCode,
                detalhe: "Parabéns. A equipa destacou a tua candidatura como vencedora.",
                link: `${publicAppUrl}/submissoes/${winnerSubmission.id}`,
              },
            });
          } catch (error) {
            request.log.warn({ err: error, submissionId: id }, "automatic winner WhatsApp notification failed");
          }
        }

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.select_winner",
          entityType: "Submission",
          entityId: id,
          summary: `Candidatura ${id} marcada como vencedora.`,
        });
        return reply.send({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to select winner";
        if (message === "Submission not found") {
          return reply.code(404).send({ message });
        }
        return reply.code(400).send({ message });
      }
      });

      adminApp.patch("/:id/presentation", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: submissionPresentationSchema,
        response: {
          200: submissionPresentationResponseSchema.omit({ status: true }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
      const { id } = request.params as { id: number };
      const body = request.body as z.infer<typeof submissionPresentationSchema>;
      const existing = await submissionRepo.findById(id);

      if (!existing) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      const nextPrimaryColor = body.primaryColor ?? existing.primaryColor;
      const nextSecondaryColor = body.secondaryColor ?? existing.secondaryColor;
      const themeError = validateSubmissionTheme(nextPrimaryColor, nextSecondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const hasBannerUpdate = Object.prototype.hasOwnProperty.call(body, "bannerUrl");
      const storedBannerUrl = hasBannerUpdate
        ? await persistMediaValue(env, body.bannerUrl ?? null, {
          purpose: "submission-banners",
          maxImageDimension: 1600,
        })
        : undefined;
      const presentationPayload = {
        ...body,
        ...(hasBannerUpdate ? { bannerUrl: storedBannerUrl ?? null } : {}),
      };

      const updated = await updateSubmissionPresentation.execute(id, presentationPayload);
      const slug = buildSubmissionSlug(updated.name, updated.id);

      await recordAdminAudit({
        actorStudentNumber: request.student?.studentNumber,
        action: "submission.update_presentation",
        entityType: "Submission",
        entityId: id,
        summary: `Apresentação da candidatura ${id} atualizada.`,
        metadata: {
          primaryColor: updated.primaryColor,
          secondaryColor: updated.secondaryColor,
          hasBanner: Boolean(updated.bannerUrl),
        },
      });

      return reply.send({
        id: updated.id,
        slug,
        detailPath: `/projeto/${slug}`,
        description: updated.description,
        repoUrl: updated.repoUrl ?? null,
        websiteUrl: updated.websiteUrl ?? null,
        instagramUrl: updated.instagramUrl ?? null,
        facebookUrl: updated.facebookUrl ?? null,
        linkedinUrl: updated.linkedinUrl ?? null,
        githubUrl: updated.githubUrl ?? null,
        primaryColor: updated.primaryColor,
        secondaryColor: updated.secondaryColor,
        bannerUrl: updated.bannerUrl ?? null
      });
      });

      adminApp.post("/:id/exhibitor-pack/regenerate", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({
            submissionId: z.number(),
            fileName: z.string(),
            pdfPath: z.string(),
            publicUrl: z.string().nullable(),
            generatedAt: z.string(),
            version: z.number(),
            created: z.boolean(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };

        try {
          const submission = await prisma.submission.findFirst({
            where: { id, deletedAt: null },
            select: { paymentStatus: true },
          });
          if (!submission) {
            return reply.code(404).send({ message: "Submission not found" });
          }
          if (!isPaymentConfirmedByAdmin(submission.paymentStatus)) {
            return reply.code(400).send({ message: "Confirma o pagamento pela organização antes de gerar a credencial/PDF de expositor." });
          }

          const result = await generateExhibitorPdfForSubmission(env, id, { force: true });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.regenerate_exhibitor_pdf",
            entityType: "Submission",
            entityId: id,
            summary: `PDF do expositor regenerado para a candidatura ${id}.`,
            metadata: {
              fileName: result.metadata.fileName,
              version: result.metadata.version,
            },
          });

          return reply.send(serializeExhibitorPdfMetadata(result.metadata, result.created));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to generate exhibitor PDF";
          if (message === "Submission not found") {
            return reply.code(404).send({ message });
          }
          return reply.code(400).send({ message });
        }
      });

      adminApp.get("/:id/exhibitor-pack/link", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({
            submissionId: z.number(),
            fileName: z.string(),
            pdfPath: z.string(),
            publicUrl: z.string().nullable(),
            generatedAt: z.string(),
            version: z.number(),
            created: z.boolean(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };

        try {
          const submission = await prisma.submission.findFirst({
            where: { id, deletedAt: null },
            select: { paymentStatus: true },
          });
          if (!submission) {
            return reply.code(404).send({ message: "Submission not found" });
          }
          if (!isPaymentConfirmedByAdmin(submission.paymentStatus)) {
            return reply.code(400).send({ message: "Confirma o pagamento pela organização antes de gerar o link de expositor." });
          }

          const result = await generateExhibitorPdfForSubmission(env, id);
          return reply.send(serializeExhibitorPdfMetadata(result.metadata, result.created));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to generate exhibitor PDF link";
          if (message === "Submission not found") {
            return reply.code(404).send({ message });
          }
          return reply.code(400).send({ message });
        }
      });

      adminApp.get("/:id/exhibitor-pack/recipients", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({
            submissionId: z.number(),
            teamTotalMembers: z.number(),
            teamConfirmedMembers: z.number(),
            recipients: z.array(exhibitorPdfRecipientSchema),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const submission = await prisma.submission.findFirst({
          where: { id, deletedAt: null },
          select: {
            id: true,
            referenceCode: true,
            type: true,
            status: true,
            name: true,
            area: true,
            course: true,
            members: true,
            leaderName: true,
            leaderPhone: true,
            studentId: true,
            studentNumberSnapshot: true,
            student: {
              select: {
                studentNumber: true,
                name: true,
                phone: true,
                alternatePhone: true,
              },
            },
          },
        });

        if (!submission) {
          return reply.code(404).send({ message: "Submission not found" });
        }

        const team = await buildSubmissionTeamPayload(env, submission);
        const confirmedMembers = await prisma.submissionMember.findMany({
          where: {
            submissionId: id,
            confirmedAt: { not: null },
          },
          include: {
            student: {
              select: {
                studentNumber: true,
                name: true,
                phone: true,
                alternatePhone: true,
              },
            },
          },
          orderBy: [{ confirmedAt: "asc" }, { name: "asc" }],
        });

        const seenPhones = new Set<string>();
        const recipients: z.infer<typeof exhibitorPdfRecipientSchema>[] = [];
        const addRecipient = (recipient: z.infer<typeof exhibitorPdfRecipientSchema>) => {
          const normalizedPhone = recipient.phone ? normalizeAngolaPhone(recipient.phone) ?? recipient.phone : null;
          if (normalizedPhone && seenPhones.has(normalizedPhone)) return;
          if (normalizedPhone) seenPhones.add(normalizedPhone);
          recipients.push({ ...recipient, phone: normalizedPhone });
        };

        addRecipient({
          id: "leader",
          name: submission.leaderName ?? submission.student?.name ?? "Responsável",
          phone: submission.student?.alternatePhone ?? submission.leaderPhone ?? submission.student?.phone ?? null,
          role: "RESPONSAVEL",
          confirmed: true,
          studentNumber: submission.studentNumberSnapshot ?? submission.student?.studentNumber ?? null,
          memberId: null,
        });

        for (const member of confirmedMembers) {
          addRecipient({
            id: `member-${member.id}`,
            name: member.studentName ?? member.student?.name ?? member.name,
            phone: member.student?.alternatePhone ?? member.studentPhone ?? member.student?.phone ?? null,
            role: "MEMBRO",
            confirmed: true,
            studentNumber: member.studentNumber ?? member.student?.studentNumber ?? null,
            memberId: member.id,
          });
        }

        return reply.send({
          submissionId: id,
          teamTotalMembers: team.totalMembers,
          teamConfirmedMembers: team.confirmedMembers,
          recipients,
        });
      });

      adminApp.delete("/winner", {
      config: requireAdminPermission(["WINNERS"]),
      schema: {
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        await clearWinnerSubmission.execute();
        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.clear_winner",
          entityType: "Submission",
          summary: "Vencedor de candidaturas removido.",
        });
        return reply.send({ success: true });
      });

      adminApp.delete("/:id", {
      config: requireAdminPermission(["SUBMISSIONS"]),
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        try {
          const submissionToDelete = await prisma.submission.findFirst({
            where: { id, deletedAt: null },
            include: {
              student: {
                select: {
                  id: true,
                  studentNumber: true,
                  name: true,
                  course: true,
                  phone: true,
                },
              },
            },
          });

          if (!submissionToDelete) {
            return reply.code(404).send({ message: "Submission not found" });
          }

          try {
            await sendWhatsAppAutomationEvent(env, "SUBMISSION_STATUS_UPDATED", {
              phone: submissionToDelete.leaderPhone ?? submissionToDelete.student?.phone,
              studentId: submissionToDelete.studentId,
              studentNumber: submissionToDelete.student?.studentNumber ?? submissionToDelete.studentNumberSnapshot,
              recipientName: submissionToDelete.leaderName ?? submissionToDelete.student?.name,
              recipientCourse: submissionToDelete.course ?? submissionToDelete.student?.course,
              values: {
                titulo: submissionToDelete.name,
                referencia: submissionToDelete.referenceCode,
                estado: "excluída",
                detalhe: "A candidatura foi removida pela organização e já não ficará disponível no UOR Connect.",
                link: publicAppUrl,
              },
            });
          } catch (error) {
            request.log.warn({ err: error, submissionId: id }, "automatic submission deletion WhatsApp notification failed");
          }

          await deleteSubmission.execute(id);
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.delete",
            entityType: "Submission",
            entityId: id,
            summary: `Candidatura ${id} removida.`,
          });
          return reply.send({ success: true });
        } catch (error) {
          return reply.code(404).send({ message: error instanceof Error ? error.message : "Submission not found" });
        }
      });
    });
  });

  app.get("/team-invitations/:token", {
    schema: {
      params: z.object({ token: z.string().trim().min(8) }),
      response: {
        200: submissionTeamPayloadSchema,
        404: z.object({ message: z.string() }),
      }
    }
  }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const payload = await loadSubmissionTeamByToken(env, token);
    if (!payload) {
      return reply.code(404).send({ message: "Convite de equipa não encontrado." });
    }

    return reply.send(payload);
  });

  app.register(async (teamApp) => {
    teamApp.register(authGuard, { env });

    teamApp.post("/team-invitations/:token/confirm", {
      schema: {
        params: z.object({ token: z.string().trim().min(8) }),
        body: z.object({ memberId: z.coerce.number().int().positive() }),
        response: {
          200: z.object({
            member: submissionTeamMemberSchema,
            team: submissionTeamPayloadSchema,
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      const { token } = request.params as { token: string };
      const { memberId } = request.body as { memberId: number };
      const student = await prisma.student.findUnique({
        where: { id: request.student.id },
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
          phone: true,
          academicSyncedAt: true,
        },
      });

      if (!student) {
        return reply.code(401).send({ message: "Sessão inválida ou expirada. Inicia sessão novamente." });
      }

      try {
        return reply.send(await confirmSubmissionTeamMember(env, {
          token,
          memberId,
          student,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível confirmar este membro.";
        if (/convite|invitation/i.test(message)) {
          return reply.code(404).send({ message });
        }
        if (/já confirmou|já foi confirmado|outro estudante/i.test(message)) {
          return reply.code(409).send({ message });
        }
        return reply.code(400).send({ message });
      }
    });
  });

  app.get("/:id/summary", {
    schema: {
      params: z.object({ id: z.coerce.number().int() }),
      response: {
        200: z.object({
          id: z.number(),
          referenceCode: z.string(),
          name: z.string(),
          status: z.string(),
          type: z.string(),
          votes: z.number(),
          averageRating: z.number(),
          reviews: z.array(z.object({ user: z.string(), rating: z.number(), comment: z.string().nullable(), createdAt: z.string() }))
        }).nullable()
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: number };
    const summary = await submissionRepo.summary(id);
    if (!summary) return null;
    return {
      ...summary,
      reviews: summary.reviews.map((r: { user: string; rating: number; comment?: string | null; createdAt: Date }) => ({
        ...r,
        comment: r.comment ?? null,
        createdAt: r.createdAt.toISOString()
      }))
    };
  });

  app.get("/:id/exhibitor-pack.pdf", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      querystring: z.object({ token: z.string().trim().optional() }),
      response: {
        400: z.object({ message: z.string() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const { token } = request.query as { token?: string };
    const submission = await prisma.submission.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        studentId: true,
        studentNumberSnapshot: true,
      },
    });

    if (!submission) {
      return reply.code(404).send({ message: "Submission not found" });
    }
    if (submission.status !== "APPROVED") {
      return reply.code(400).send({ message: "Submission not approved" });
    }
    if (!isPaymentConfirmedByAdmin(submission.paymentStatus)) {
      return reply.code(400).send({ message: "Pagamento do expositor ainda não confirmado pela organização." });
    }

    const latestMetadata = await loadLatestExhibitorPdfMetadata(env, id);
    const access = await canReadExhibitorPdf(request, env, {
      submission,
      token,
      metadata: latestMetadata,
      allowConfirmedMembers: true,
    });

    if (!access.allowed) {
      return reply.code(access.status).send({ message: access.message });
    }

    try {
      const result = await generateExhibitorPdfForSubmission(env, id);
      const pdf = await readExhibitorPdfFile(env, result.metadata);

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Length", String(pdf.byteLength));
      reply.header("Content-Disposition", `attachment; filename="${result.metadata.fileName}"`);
      return reply.send(pdf);
    } catch (error) {
      request.log.warn({ err: error, submissionId: id }, "exhibitor PDF download failed");
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Unable to generate exhibitor PDF" });
    }
  });

  app.get("/:id/boarding-pass.pdf", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: {
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const submission = await submissionRepo.findById(id);

    if (!submission) {
      return reply.code(404).send({ message: "Submission not found" });
    }

    const access = await canReadSubmissionDocument(request, env, submission, {
      allowConfirmedMembers: true,
    });
    if (!access.allowed) {
      return reply.code(access.status).send({ message: access.message });
    }

    const generatedAt = new Date();
    const logoDataUri = await loadLogoDataUri();
    const publicAppUrl = env.PUBLIC_APP_URL ?? env.CORS_ORIGIN.split(",").map((item) => item.trim()).find((item) => item.startsWith("http")) ?? null;
    const publicApiUrl = env.PUBLIC_API_URL?.replace(/\/$/, "") ?? null;
    const html = buildBoardingPassHtml(submission, {
      generatedAt,
      logoDataUri,
      publicAppUrl,
      pdfUrl: publicApiUrl ? `${publicApiUrl}/submissions/${submission.id}/boarding-pass.pdf` : null
    });
    const pdf = await renderPdfFromHtml(html, {
      footerLabel: `Talão ${submission.referenceCode}`
    });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${submission.referenceCode.toLowerCase()}-talao-embarque.pdf"`);
    return reply.send(pdf);
  });

  app.get("/:id/payment-proof", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: {
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const submission = await submissionRepo.findById(id);

    if (!submission) {
      return reply.code(404).send({ message: "Submission not found" });
    }

    const access = await canReadSubmissionDocument(request, env, submission);
    if (!access.allowed) {
      return reply.code(access.status).send({ message: access.message });
    }

    const proof = parseStoredProof(submission.paymentProof);

    if (proof.kind === "data-url") {
      const extension = proofExtensionFromMime(proof.mimeType);
      reply.header("Content-Type", proof.mimeType);
      reply.header("Content-Disposition", `inline; filename="${submission.referenceCode.toLowerCase()}-comprovativo.${extension}"`);
      return reply.send(proof.buffer);
    }

    if (proof.kind === "url" && isSubmissionPaymentProofSelfReference(proof.url, submission.id)) {
      return reply.code(409).send({ message: "Comprovativo indisponível para esta candidatura." });
    }

    if (proof.kind === "url" && isStoredMediaUrl(proof.url)) {
      const media = await resolveStoredMediaFile(env, proof.url).catch(() => null);
      if (!media) {
        return reply.code(409).send({ message: "Comprovativo indisponível para esta candidatura." });
      }

      reply.header("Content-Type", media.mimeType);
      reply.header("Content-Disposition", `inline; filename="${submission.referenceCode.toLowerCase()}-comprovativo.${media.mimeType.includes("pdf") ? "pdf" : "webp"}"`);
      return reply.send(media.stream);
    }

    if (proof.kind === "url") {
      return reply.redirect(proof.url);
    }

    return reply.code(409).send({ message: "Comprovativo indisponível para esta candidatura." });
  });

  app.post("/:id/vote", {
    schema: {
      params: z.object({ id: z.coerce.number().int() }),
      body: z.object({ email: z.string().email() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const { email } = request.body as { email: string };
    await voteSubmission.execute(id, email);
    return reply.code(204).send();
  });

  app.post("/:id/review", {
    schema: {
      params: z.object({ id: z.coerce.number().int() }),
      body: z.object({
        email: z.string().email(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(10).max(500).optional()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const { email, rating, comment } = request.body as { email: string; rating: number; comment?: string };
    await reviewSubmission.execute(id, email, rating, comment);
    return reply.code(204).send();
  });
}
