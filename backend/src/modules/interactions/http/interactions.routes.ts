import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { type Env } from "../../../config/env";
import { recordAdminAudit } from "../../audit/application/audit.service";
import {
  requestAdminSmsConfirmation,
  verifyAdminSmsConfirmation,
} from "../../admin-safety/admin-sms-confirmation";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { PrismaAdminVotesRepository } from "../infra/admin-votes.repository";
import { GetAdminVotesOverview, GetPublicLiveVotesOverview } from "../use-cases/admin-votes";
import { PrismaInteractionModerationRepository } from "../infra/moderation.repository";
import {
  DeleteLiveChatMessage,
  DeleteProjectComment,
  GetInteractionModerationOverview
} from "../use-cases/manage-moderation";
import { getSubmissionTypeLabel, isCompetitionEligible, normalizeSubmissionType } from "../../submission/domain/submission-policy";
import { getMissingImagePlaceholder } from "../../media/application/missing-media-placeholder";
import {
  buildSubmissionExcerpt,
  buildSubmissionSlug,
  formatTeamMembersLabel,
  normalizeTeamMembersInput
} from "../../submission/domain/submission-format";
import {
  sendWhatsAppAudienceAutomationEvent,
  sendWhatsAppAutomationEvent,
} from "../../whatsapp/http/whatsapp.routes";
import { sendSmsAudienceAutomationEvent } from "../../sms/http/sms.routes";
import { notifyExhibitorGameEvent } from "../../game-notifications/game-notification.service";
import {
  recordEmptyStandPenalty,
  recordExhibitorMemberDuty,
  recordExhibitorScoreAdjustment,
  recordJuryProjectVoteScore,
  recordStudentProjectVoteScore
} from "../../exhibitor-scoring/application/exhibitor-scoring.service";
import { reviewQualifiedFeedbackFromComment } from "../../exhibitor-scoring/application/exhibitor-scoring.feedback";
import {
  awardExhibitorAutomaticMissions,
  awardExhibitorMemberLevels,
  awardExhibitorTeamBonuses,
  buildExhibitorScoreRankingPdfHtml,
  detectExhibitorScoringAlerts,
  exportExhibitorScoreRanking,
  exportExhibitorScoreRankingCsv,
  freezeExhibitorScoreRanking,
  getExhibitorAmbassadorRanking,
  getExhibitorScoreConfig,
  recalculateUnlockedExhibitorScoreEvents,
  updateExhibitorScoreConfig,
} from "../../exhibitor-scoring/application/exhibitor-scoring.admin";
import { renderPdfFromHtml } from "../../reports/http/pdf-report.utils";

let optsEnvCache: Env;
const ENGAGEMENT_MILESTONE_THRESHOLD = 3;
const ACTIVE_PUBLIC_PROJECT_WHERE = {
  status: "APPROVED" as const,
  deletedAt: null,
} satisfies Prisma.SubmissionWhereInput;
export const PROJECT_FEED_PAYLOAD_LIMITS = {
  defaultPageSize: 18,
  maxPageSize: 48,
  defaultLikesPreview: 4,
  maxLikesPreview: 12,
  defaultCommentsPreview: 2,
  maxCommentsPreview: 8,
  defaultDetailComments: 50,
  maxDetailComments: 100,
} as const;
export const PROJECT_FEED_SORT_OPTIONS = [
  "recent_desc",
  "votes_desc",
  "likes_desc",
  "comments_desc",
] as const;
export const PROJECT_FEED_VIEW_OPTIONS = ["cards", "compact"] as const;
export const PROJECT_FEED_AUDIENCE_OPTIONS = ["all", "competition", "exhibitions"] as const;
export type ProjectFeedSort = typeof PROJECT_FEED_SORT_OPTIONS[number];
export type ProjectFeedView = typeof PROJECT_FEED_VIEW_OPTIONS[number];
export type ProjectFeedAudience = typeof PROJECT_FEED_AUDIENCE_OPTIONS[number];

export function buildProjectFeedOrderBy(sort: ProjectFeedSort): Prisma.SubmissionOrderByWithRelationInput[] {
  if (sort === "votes_desc") {
    return [
      { studentVotes: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ];
  }

  if (sort === "likes_desc") {
    return [
      { studentLikes: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ];
  }

  if (sort === "comments_desc") {
    return [
      { studentComments: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ];
  }

  return [
    { createdAt: "desc" },
    { id: "desc" },
  ];
}

export function resolveProjectFeedPreviewLimits({
  view,
  likesLimit,
  commentsLimit,
}: {
  view: ProjectFeedView;
  likesLimit: number;
  commentsLimit: number;
}) {
  if (view === "compact") {
    return {
      likesLimit: 0,
      commentsLimit: 0,
    };
  }

  return { likesLimit, commentsLimit };
}

export function buildProjectFeedWhere({
  q,
  course,
  audience,
}: {
  q?: string | null;
  course?: string | null;
  audience?: ProjectFeedAudience;
}): Prisma.SubmissionWhereInput {
  const filters: Prisma.SubmissionWhereInput[] = [ACTIVE_PUBLIC_PROJECT_WHERE];
  const search = q?.trim();
  const courseFilter = course?.trim();

  if (search) {
    const searchVariants = Array.from(new Set([
      search,
      search.toLocaleLowerCase("pt-PT"),
      search.toLocaleUpperCase("pt-PT"),
      `${search.charAt(0).toLocaleUpperCase("pt-PT")}${search.slice(1)}`,
    ]));
    const searchFields = ["name", "description", "course", "members", "area"] as const;
    filters.push({
      OR: searchVariants.flatMap((term) => (
        searchFields.map((field) => ({ [field]: { contains: term } }))
      )),
    });
  }

  if (courseFilter) {
    filters.push({ course: { contains: courseFilter } });
  }

  if (audience === "competition") {
    filters.push({
      AND: [
        { type: "PROJECT" },
        {
          NOT: [
            { area: { contains: "Negócio" } },
            { area: { contains: "negocio" } },
            { area: { contains: "Produto" } },
            { area: { contains: "produto" } },
          ],
        },
      ],
    });
  }

  if (audience === "exhibitions") {
    filters.push({
      OR: [
        { type: { in: ["BUSINESS", "PRODUCT"] } },
        { area: { contains: "Negócio" } },
        { area: { contains: "negocio" } },
        { area: { contains: "Produto" } },
        { area: { contains: "produto" } },
      ],
    });
  }

  return { AND: filters };
}

export function getProjectFeedCacheControl(view: ProjectFeedView) {
  if (view === "compact") return "public, max-age=15, stale-while-revalidate=30";
  return "public, max-age=5, stale-while-revalidate=15";
}
const liveChatAttachmentDir = path.resolve(process.cwd(), "public", "live-chat");
const liveChatReactionTypes = ["like", "applause", "love"] as const;
const liveChatReactionSchema = z.enum(liveChatReactionTypes);
const liveChatAttachmentSchema = z.object({
  dataUrl: z.string().max(7_000_000),
  fileName: z.string().max(120).optional(),
}).nullable().optional();
const adminDangerConfirmationSchema = z.object({
  success: z.literal(true),
  operation: z.string(),
  phone: z.string(),
  codeLast4: z.string(),
  expiresAt: z.string(),
});
const projectVotesResetConfirmBodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  confirmationText: z.string().trim(),
});
const projectVotesResetResultSchema = z.object({
  studentVotesDeleted: z.number(),
  legacyVotesDeleted: z.number(),
  scoreEventsDeleted: z.number(),
});
const exhibitorScoreAdjustmentSchema = z.object({
  submissionId: z.coerce.number().int().positive(),
  action: z.enum([
    "QUALIFIED_FEEDBACK",
    "PENALTY",
    "STAND_BONUS",
    "AMBASSADOR_MISSION",
    "EXHIBITOR_MISSION",
    "TEAM_BONUS",
  ]),
  points: z.coerce.number().min(-10_000).max(10_000).refine((value) => value !== 0, {
    message: "A pontuação deve ser diferente de zero.",
  }),
  reason: z.string().trim().min(3).max(400),
  sourceType: z.string().trim().min(2).max(60).optional(),
  sourceId: z.string().trim().min(1).max(120).optional(),
  studentId: z.coerce.number().int().positive().optional().nullable(),
  actorStudentId: z.coerce.number().int().positive().optional().nullable(),
  submissionMemberId: z.coerce.number().int().positive().optional().nullable(),
  role: z.string().trim().max(60).optional().nullable(),
  roundKey: z.string().trim().max(60).optional().nullable(),
  roundLabel: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.action === "PENALTY" && value.points > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["points"],
      message: "Penalizações devem ter pontos negativos.",
    });
  }

  if (value.action !== "PENALTY" && value.points < 0) {
    ctx.addIssue({
      code: "custom",
      path: ["points"],
      message: "Bónus e feedback devem ter pontos positivos.",
    });
  }
});
const exhibitorMemberDutySchema = z.object({
  submissionId: z.coerce.number().int().positive(),
  submissionMemberId: z.coerce.number().int().positive(),
  action: z.enum(["EXHIBITOR_CHECK_IN", "EXHIBITOR_CHECK_OUT"]),
  role: z.enum(["EXPOSITOR", "AMBASSADOR"]),
  roundKey: z.string().trim().max(60).optional().nullable(),
  roundLabel: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const exhibitorEmptyStandPenaltySchema = z.object({
  submissionId: z.coerce.number().int().positive(),
  roundKey: z.string().trim().min(1).max(60),
  roundLabel: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const exhibitorScoreRoundSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  multiplier: z.coerce.number().positive().max(10),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED", "DRAFT"]).default("ACTIVE"),
}).refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
  path: ["endsAt"],
  message: "O fim da ronda deve ser posterior ao início.",
});
const exhibitorScoreWeightsSchema = z.object({
  sameCourseVote: z.coerce.number().optional(),
  differentCourseVote: z.coerce.number().optional(),
  firstCourseVoteBonus: z.coerce.number().optional(),
  otherUniversityVoteBonus: z.coerce.number().optional(),
  qualifiedFeedback: z.coerce.number().optional(),
  juryVote: z.coerce.number().optional(),
  standVisit: z.coerce.number().optional(),
  lightPenalty: z.coerce.number().optional(),
  selfVoteAbusePenalty: z.coerce.number().optional(),
}).partial();
const exhibitorScoreConfigResponseSchema = z.object({
  version: z.number(),
  weights: z.record(z.string(), z.number()),
  streakBonuses: z.array(z.object({
    minCourses: z.number(),
    points: z.number(),
  })),
  rounds: z.array(exhibitorScoreRoundSchema),
});
const exhibitorScoreConfigUpdateSchema = z.object({
  weights: exhibitorScoreWeightsSchema.optional(),
  streakBonuses: z.array(z.object({
    minCourses: z.coerce.number().int().min(2).max(50),
    points: z.coerce.number().positive().max(10_000),
  })).optional(),
  rounds: z.array(exhibitorScoreRoundSchema).optional(),
});
const exhibitorScoreFreezeSchema = z.object({
  reason: z.string().trim().min(3).max(400).optional(),
});
const exhibitorScoreRecalculateSchema = z.object({
  reason: z.string().trim().min(3).max(400),
});
const exhibitorMemberLevelsResponseSchema = z.object({
  eventKey: z.string(),
  scannedMembers: z.number(),
  awarded: z.array(z.object({
    submissionId: z.number(),
    memberId: z.number(),
    memberName: z.string(),
    level: z.string(),
    points: z.number(),
  })),
});
const exhibitorAutomaticMissionsResponseSchema = z.object({
  eventKey: z.string(),
  scannedEvents: z.number(),
  awardedCount: z.number(),
  awardedPoints: z.number(),
  awarded: z.array(z.object({
    businessKey: z.string(),
    submissionId: z.number(),
    memberId: z.number().nullable(),
    action: z.string(),
    sourceType: z.string(),
    sourceId: z.string(),
    points: z.number(),
    reason: z.string(),
  })),
});
const exhibitorTeamBonusesResponseSchema = z.object({
  eventKey: z.string(),
  awardedCount: z.number(),
  awardedPoints: z.number(),
  awarded: z.array(z.object({
    businessKey: z.string(),
    submissionId: z.number(),
    sourceId: z.string(),
    points: z.number(),
  })),
});
const exhibitorScoreExportQuerySchema = z.object({
  frozenOnly: z.coerce.boolean().default(false),
});
const exhibitorAmbassadorRankingResponseSchema = z.object({
  eventKey: z.string(),
  generatedAt: z.string(),
  totalMembers: z.number(),
  members: z.array(z.object({
    rank: z.number(),
    submissionId: z.number(),
    submissionName: z.string(),
    memberId: z.number(),
    memberName: z.string(),
    conversions: z.number(),
    coursesReached: z.number(),
    missionPoints: z.number(),
    penalties: z.number(),
    scoreContribution: z.number(),
    level: z.string().nullable(),
    maxCourseStreak: z.number(),
    inactiveRounds: z.number(),
  })),
});
const exhibitorScoringAlertsResponseSchema = z.object({
  eventKey: z.string(),
  generatedAt: z.string(),
  totalAlerts: z.number(),
  alerts: z.array(z.object({
    type: z.string(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    submissionId: z.number(),
    submissionName: z.string(),
    memberId: z.number().nullable().optional(),
    memberName: z.string().nullable().optional(),
    message: z.string(),
    count: z.number(),
  })),
});
const exhibitorScoreExportProjectSchema = z.object({
  rank: z.number(),
  submissionId: z.number(),
  name: z.string(),
  course: z.string().nullable(),
  type: z.string(),
  area: z.string(),
  score: z.number(),
  votes: z.number(),
  breakdown: z.record(z.string(), z.number()),
  courses: z.array(z.object({
    course: z.string(),
    points: z.number(),
    events: z.number(),
  })),
});
const exhibitorScoreExportResponseSchema = z.object({
  eventKey: z.string(),
  generatedAt: z.string(),
  frozenOnly: z.boolean(),
  totalProjects: z.number(),
  totalScore: z.number(),
  weights: z.record(z.string(), z.number()),
  projects: z.array(exhibitorScoreExportProjectSchema),
});
const qualifiedFeedbackReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REVOKE"]),
  note: z.string().trim().min(3).max(400),
});

const liveChatReplySchema = z.object({
  id: z.number(),
  content: z.string(),
  studentName: z.string(),
  studentAvatarUrl: z.string().nullable().optional(),
});

const liveChatMessageSchema = z.object({
  id: z.number(),
  content: z.string(),
  attachmentUrl: z.string().nullable(),
  attachmentMime: z.string().nullable(),
  replyTo: liveChatReplySchema.nullable(),
  reactionCounts: z.record(z.string(), z.number()),
  isPinned: z.boolean(),
  isHighlighted: z.boolean(),
  createdAt: z.string(),
  studentName: z.string(),
  studentAvatarUrl: z.string().nullable().optional(),
  course: z.string().nullable(),
  courseColor: z.string().nullable()
});

type SubmissionEngagementMetric = "likes" | "comments";

type ProjectLike = Prisma.StudentLikeGetPayload<{ include: { student: true } }>;
type ProjectComment = Prisma.StudentCommentGetPayload<{ include: { student: true } }>;
type ProjectSubmission = Prisma.SubmissionGetPayload<{
  include: {
    _count: { select: { studentLikes: true; studentVotes: true; studentComments: true } };
    studentLikes: { include: { student: true } };
    studentComments: { include: { student: true } };
  };
}>;

function normalizeCourseName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function parseLiveChatAttachment(input?: { dataUrl: string; fileName?: string } | null) {
  if (!input?.dataUrl) return null;
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Formato de imagem inválido. Usa PNG, JPG ou WEBP.");
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return {
    mime,
    buffer,
    fileName: `${Date.now()}-${crypto.randomUUID()}.${extension}`,
  };
}

async function saveLiveChatAttachment(input?: { dataUrl: string; fileName?: string } | null) {
  const parsed = parseLiveChatAttachment(input);
  if (!parsed) return { attachmentUrl: null, attachmentMime: null };

  await fs.mkdir(liveChatAttachmentDir, { recursive: true });
  await fs.writeFile(path.join(liveChatAttachmentDir, parsed.fileName), parsed.buffer);

  return {
    attachmentUrl: `/interactions/live-chat/attachments/${parsed.fileName}`,
    attachmentMime: parsed.mime,
  };
}

function reactionCounts(reactions: Array<{ type: string }>) {
  return reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] ?? 0) + 1;
    return acc;
  }, {});
}

const courseColorCacheTtlMs = 1000 * 60 * 5;
let cachedCourseColorsAt = 0;
let cachedCourseColorMap: Map<string, string | null> | null = null;

async function getCourseColorMap() {
  const now = Date.now();
  if (cachedCourseColorMap && (now - cachedCourseColorsAt) < courseColorCacheTtlMs) {
    return cachedCourseColorMap;
  }

  const courses = await prisma.course.findMany({
    select: { name: true, courseColor: true }
  });

  cachedCourseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));
  cachedCourseColorsAt = now;
  return cachedCourseColorMap;
}

function resolvePublicOrigin(request: FastifyRequest, env: Env) {
  if (env.PUBLIC_APP_URL) {
    return env.PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const corsOrigins = env.CORS_ORIGIN
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("http://") || value.startsWith("https://"));

  if (corsOrigins.length > 0) {
    return corsOrigins[0].replace(/\/$/, "");
  }

  const originHeader = String(request.headers.origin ?? "").trim();
  if (originHeader.startsWith("http://") || originHeader.startsWith("https://")) {
    return originHeader.replace(/\/$/, "");
  }

  const refererHeader = String(request.headers.referer ?? "").trim();
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      // Ignore malformed referer and continue to forwarded headers.
    }
  }

  const forwardedProto = String(request.headers["x-forwarded-proto"] ?? request.protocol ?? "http").split(",")[0].trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].trim();
  if (!forwardedHost) return null;

  return `${forwardedProto}://${forwardedHost}`;
}

function buildProjectShareMetadata(request: FastifyRequest, env: Env, submission: { id: number; name: string }) {
  const slug = buildSubmissionSlug(submission.name, submission.id);
  const detailPath = `/projeto/${slug}`;
  const origin = resolvePublicOrigin(request, env);
  const shareUrl = origin ? `${origin}${detailPath}` : detailPath;

  return {
    slug,
    detailPath,
    shareUrl,
    qrCodeValue: shareUrl
  };
}

async function maybeSendSubmissionEngagementMilestoneNotification(
  env: Env,
  request: FastifyRequest,
  submissionId: number,
  metric: SubmissionEngagementMetric,
  count: number,
) {
  if (count !== ENGAGEMENT_MILESTONE_THRESHOLD + 1) return;

  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, ...ACTIVE_PUBLIC_PROJECT_WHERE },
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

  if (!submission) return;

  const share = buildProjectShareMetadata(request, env, submission);
  const metricLabel = metric === "likes" ? "curtidas" : "comentários";
  const detalhe = metric === "likes"
    ? `O projeto ultrapassou ${ENGAGEMENT_MILESTONE_THRESHOLD} curtidas e já soma ${count} curtidas na página pública.`
    : `O projeto ultrapassou ${ENGAGEMENT_MILESTONE_THRESHOLD} comentários e já soma ${count} comentários na página pública.`;

  try {
    await sendWhatsAppAutomationEvent(env, "SUBMISSION_ENGAGEMENT_MILESTONE", {
      phone: submission.leaderPhone ?? submission.student?.phone,
      studentId: submission.studentId,
      studentNumber: submission.student?.studentNumber ?? submission.studentNumberSnapshot,
      recipientName: submission.leaderName ?? submission.student?.name,
      recipientCourse: submission.course ?? submission.student?.course,
      values: {
        titulo: submission.name,
        referencia: submission.referenceCode,
        detalhe,
        link: share.shareUrl,
        total: String(count),
        interacoes: metricLabel,
      },
    });
  } catch (error) {
    request.log.warn(
      { err: error, submissionId, metric, count },
      "automatic submission engagement WhatsApp notification failed",
    );
  }
}

function formatProjectLike(like: ProjectLike) {
  const profile = normalizeStudentProfile(like.student);
  return {
    id: like.id,
    createdAt: like.createdAt.toISOString(),
    studentName: profile.name ?? `Estudante ${like.student.studentNumber}`,
    studentAvatarUrl: profile.avatarUrl ?? null,
    course: profile.course ?? null
  };
}

function formatProjectComment(comment: ProjectComment) {
  const profile = normalizeStudentProfile(comment.student);
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    studentName: profile.name ?? `Estudante ${comment.student.studentNumber}`,
    studentAvatarUrl: profile.avatarUrl ?? null,
    course: profile.course ?? null
  };
}

function getPublicProjectBannerUrl(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;

  // Registos antigos ainda podem ter imagem inline; nunca enviar base64 no feed publico.
  if (/^data:image\//i.test(normalized)) return null;

  return normalized;
}

function buildProjectResponse(submission: ProjectSubmission, request: FastifyRequest) {
  const normalizedType = normalizeSubmissionType(submission.type, submission.area);
  const competitionEligible = isCompetitionEligible(submission.type, submission.area);
  const membersList = normalizeTeamMembersInput(submission.members);
  const share = buildProjectShareMetadata(request, optsEnvCache, submission);

  return {
    id: submission.id,
    slug: share.slug,
    detailPath: share.detailPath,
    shareUrl: share.shareUrl,
    qrCodeValue: share.qrCodeValue,
    name: submission.name,
    summary: buildSubmissionExcerpt(submission.description),
    description: submission.description,
    area: submission.area,
    course: submission.course ?? null,
    stage: submission.stage ?? null,
    category: submission.category ?? null,
    productType: submission.productType ?? null,
    members: formatTeamMembersLabel(membersList),
    membersList,
    teamSize: membersList.length,
    type: normalizedType,
    typeLabel: getSubmissionTypeLabel(submission.type, submission.area),
    createdAt: submission.createdAt.toISOString(),
    isWinner: competitionEligible ? submission.isWinner : false,
    canVote: competitionEligible,
    canLike: submission.status === "APPROVED",
    eligibleForAward: competitionEligible,
    primaryColor: submission.primaryColor,
    secondaryColor: submission.secondaryColor,
    bannerUrl: getPublicProjectBannerUrl(submission.bannerUrl),
    repoUrl: submission.repoUrl ?? null,
    websiteUrl: submission.websiteUrl ?? null,
    instagramUrl: submission.instagramUrl ?? null,
    facebookUrl: submission.facebookUrl ?? null,
    linkedinUrl: submission.linkedinUrl ?? null,
    githubUrl: submission.githubUrl ?? null,
    likesCount: submission._count.studentLikes,
    votesCount: competitionEligible ? submission._count.studentVotes : 0,
    commentsCount: submission._count.studentComments,
    likes: submission.studentLikes.map((like) => formatProjectLike(like)),
    comments: submission.studentComments.map((comment) => formatProjectComment(comment))
  };
}

function extractSubmissionIdFromSlug(slug: string) {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;

  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export async function interactionsRoutes(app: FastifyInstance, opts: { env: Env }) {
  optsEnvCache = opts.env;
  const adminVotesRepository = new PrismaAdminVotesRepository();
  const adminVotesOverview = new GetAdminVotesOverview(adminVotesRepository);
  const publicLiveVotesOverview = new GetPublicLiveVotesOverview(adminVotesRepository);
  const moderationRepository = new PrismaInteractionModerationRepository();
  const interactionModerationOverview = new GetInteractionModerationOverview(moderationRepository);
  const deleteProjectComment = new DeleteProjectComment(moderationRepository);
  const deleteLiveChatMessage = new DeleteLiveChatMessage(moderationRepository);
  const projectLikeSchema = z.object({
    id: z.number(),
    createdAt: z.string(),
    studentName: z.string(),
    studentAvatarUrl: z.string().nullable().optional(),
    course: z.string().nullable()
  });
  const projectCommentSchema = z.object({
    id: z.number(),
    content: z.string(),
    createdAt: z.string(),
    studentName: z.string(),
    studentAvatarUrl: z.string().nullable().optional(),
    course: z.string().nullable()
  });
  const projectSchema = z.object({
    id: z.number(),
    slug: z.string(),
    detailPath: z.string(),
    shareUrl: z.string(),
    qrCodeValue: z.string(),
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    area: z.string(),
    course: z.string().nullable(),
    stage: z.string().nullable(),
    category: z.string().nullable(),
    productType: z.string().nullable(),
    members: z.string(),
    membersList: z.array(z.string()),
    teamSize: z.number(),
    type: z.string(),
    typeLabel: z.string(),
    createdAt: z.string(),
    isWinner: z.boolean(),
    canVote: z.boolean(),
    canLike: z.boolean(),
    eligibleForAward: z.boolean(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    bannerUrl: z.string().nullable(),
    repoUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    instagramUrl: z.string().nullable(),
    facebookUrl: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    githubUrl: z.string().nullable(),
    likesCount: z.number(),
    votesCount: z.number(),
    commentsCount: z.number(),
    likes: z.array(projectLikeSchema),
    comments: z.array(projectCommentSchema)
  });
  const projectFeedQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(6).max(PROJECT_FEED_PAYLOAD_LIMITS.maxPageSize).default(PROJECT_FEED_PAYLOAD_LIMITS.defaultPageSize),
    likesLimit: z.coerce.number().int().min(0).max(PROJECT_FEED_PAYLOAD_LIMITS.maxLikesPreview).default(PROJECT_FEED_PAYLOAD_LIMITS.defaultLikesPreview),
    commentsLimit: z.coerce.number().int().min(0).max(PROJECT_FEED_PAYLOAD_LIMITS.maxCommentsPreview).default(PROJECT_FEED_PAYLOAD_LIMITS.defaultCommentsPreview),
    sort: z.enum(PROJECT_FEED_SORT_OPTIONS).default("recent_desc"),
    view: z.enum(PROJECT_FEED_VIEW_OPTIONS).default("cards"),
    q: z.string().trim().max(80).optional().default(""),
    course: z.string().trim().max(120).optional().default(""),
    audience: z.enum(PROJECT_FEED_AUDIENCE_OPTIONS).default("all"),
  });
  const projectDetailQuerySchema = z.object({
    likesLimit: z.coerce.number().int().min(0).max(24).default(PROJECT_FEED_PAYLOAD_LIMITS.maxLikesPreview),
    commentsLimit: z.coerce.number().int().min(0).max(PROJECT_FEED_PAYLOAD_LIMITS.maxDetailComments).default(PROJECT_FEED_PAYLOAD_LIMITS.defaultDetailComments),
  });
  const projectPageSchema = z.object({
    items: z.array(projectSchema),
    total: z.number(),
    page: z.number(),
    totalPages: z.number(),
  });

  app.get(
    "/projects",
    {
      schema: {
        querystring: projectFeedQuerySchema,
        response: {
          200: projectPageSchema
        }
      }
    },
    async (request, reply) => {
      const query = projectFeedQuerySchema.parse(request.query);
      const previewLimits = resolveProjectFeedPreviewLimits(query);
      const where = buildProjectFeedWhere(query);
      reply.header("Cache-Control", getProjectFeedCacheControl(query.view));
      const [total, submissions] = await Promise.all([
        prisma.submission.count({ where }),
        prisma.submission.findMany({
          where,
          include: {
            _count: {
              select: {
                studentLikes: true,
                studentVotes: true,
                studentComments: true,
              },
            },
            studentLikes: {
              include: { student: true },
              orderBy: { createdAt: "desc" },
              take: previewLimits.likesLimit,
            },
            studentComments: {
              include: { student: true },
              orderBy: { createdAt: "asc" },
              take: previewLimits.commentsLimit,
            }
          },
          orderBy: buildProjectFeedOrderBy(query.sort),
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);

      return reply.send({
        items: submissions.map((submission) => buildProjectResponse(submission, request)),
        total,
        page: query.page,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      });
    }
  );

  app.get(
    "/projects/:slug",
    {
      schema: {
        params: z.object({ slug: z.string().min(3) }),
        querystring: projectDetailQuerySchema,
        response: {
          200: projectSchema,
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const query = projectDetailQuerySchema.parse(request.query);
      const id = extractSubmissionIdFromSlug(slug);
      if (!id) {
        return reply.status(404).send({ message: "Project not found" });
      }
      reply.header("Cache-Control", "public, max-age=10, stale-while-revalidate=30");

      const submission = await prisma.submission.findFirst({
        where: { id, ...ACTIVE_PUBLIC_PROJECT_WHERE },
        include: {
          _count: {
            select: {
              studentLikes: true,
              studentVotes: true,
              studentComments: true,
            },
          },
          studentLikes: {
            include: { student: true },
            orderBy: { createdAt: "desc" },
            take: query.likesLimit,
          },
          studentComments: {
            include: { student: true },
            orderBy: { createdAt: "asc" },
            take: query.commentsLimit,
          }
        }
      });

      if (!submission) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const derivedSlug = buildSubmissionSlug(submission.name, submission.id);
      if (derivedSlug !== slug) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return reply.send(buildProjectResponse(submission, request));
    }
  );

  app.get(
    "/activity-feed",
    {
      schema: {
        response: {
          200: z.array(z.object({
            id: z.string(),
            type: z.enum(["vote", "comment", "submission"]),
            message: z.string(),
            actorName: z.string(),
            actorAvatarUrl: z.string().nullable().optional(),
            actorCourse: z.string().nullable(),
            actorCourseColor: z.string().nullable(),
            subject: z.string(),
            createdAt: z.string()
          }))
        }
      }
    },
    async (_, reply) => {
      const [votes, comments, submissions, courses] = await Promise.all([
        prisma.studentVote.findMany({
          where: { submission: { is: ACTIVE_PUBLIC_PROJECT_WHERE } },
          include: { student: true, submission: true },
          orderBy: { createdAt: "desc" },
          take: 12
        }),
        prisma.studentComment.findMany({
          where: { submission: { is: ACTIVE_PUBLIC_PROJECT_WHERE } },
          include: { student: true, submission: true },
          orderBy: { createdAt: "desc" },
          take: 12
        }),
        prisma.submission.findMany({
          where: ACTIVE_PUBLIC_PROJECT_WHERE,
          orderBy: { createdAt: "desc" },
          take: 12
        }),
        prisma.course.findMany({
          select: {
            name: true,
            courseColor: true
          }
        })
      ]);

      const courseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));

      const items = [
        ...votes.map((vote) => {
          const profile = normalizeStudentProfile(vote.student);
          const actorName = profile.name ?? `Estudante ${vote.student.studentNumber}`;
          return {
            id: `vote-${vote.id}`,
            type: "vote" as const,
            message: "votou neste projeto",
            actorName,
            actorAvatarUrl: profile.avatarUrl ?? null,
            actorCourse: profile.course ?? null,
            actorCourseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null,
            subject: vote.submission.name,
            createdAt: vote.createdAt.toISOString()
          };
        }),
        ...comments.map((comment) => {
          const profile = normalizeStudentProfile(comment.student);
          const actorName = profile.name ?? `Estudante ${comment.student.studentNumber}`;
          return {
            id: `comment-${comment.id}`,
            type: "comment" as const,
            message: comment.content,
            actorName,
            actorAvatarUrl: profile.avatarUrl ?? null,
            actorCourse: profile.course ?? null,
            actorCourseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null,
            subject: comment.submission.name,
            createdAt: comment.createdAt.toISOString()
          };
        }),
        ...submissions.map((submission) => ({
          id: `submission-${submission.id}`,
          type: "submission" as const,
          message: `Novo projeto aprovado: ${submission.name}`,
          actorName: "Sistema",
          actorAvatarUrl: null,
          actorCourse: submission.course ?? null,
          actorCourseColor: courseColorMap.get(normalizeCourseName(submission.course)) ?? null,
          subject: submission.name,
          createdAt: submission.createdAt.toISOString()
        }))
      ]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 12);

      return reply.send(items);
    }
  );

  app.get(
    "/live-chat",
    {
      schema: {
        response: {
          200: z.array(liveChatMessageSchema)
        }
      }
    },
    async (_, reply) => {
      const [messages, courses] = await Promise.all([
        prisma.liveChatMessage.findMany({
          where: { hiddenAt: null },
          include: {
            student: true,
            reactions: true,
          },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
          take: 30
        }),
        prisma.course.findMany({
          select: {
            name: true,
            courseColor: true
          }
        })
      ]);

      const courseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));
      const replyIds = Array.from(new Set(messages.map((message) => message.replyToMessageId).filter((id): id is number => typeof id === "number")));
      const replies = replyIds.length
        ? await prisma.liveChatMessage.findMany({
            where: { id: { in: replyIds } },
            include: { student: true },
          })
        : [];
      const replyMap = new Map(replies.map((reply) => {
        const profile = normalizeStudentProfile(reply.student);
        return [reply.id, {
          id: reply.id,
          content: reply.content,
          studentName: profile.name ?? `Estudante ${reply.student.studentNumber}`,
          studentAvatarUrl: profile.avatarUrl ?? null,
        }];
      }));

      return reply.send(messages.map((message) => {
        const profile = normalizeStudentProfile(message.student);
        return {
          id: message.id,
          content: message.content,
          attachmentUrl: message.attachmentUrl,
          attachmentMime: message.attachmentMime,
          replyTo: message.replyToMessageId ? replyMap.get(message.replyToMessageId) ?? null : null,
          reactionCounts: reactionCounts(message.reactions),
          isPinned: message.isPinned,
          isHighlighted: message.isHighlighted,
          createdAt: message.createdAt.toISOString(),
          studentName: profile.name ?? `Estudante ${message.student.studentNumber}`,
          studentAvatarUrl: profile.avatarUrl ?? null,
          course: profile.course ?? null,
          courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
        };
      }));
    }
  );

  app.get(
    "/live-chat/attachments/:fileName",
    {
      schema: {
        params: z.object({
          fileName: z.string().regex(/^[0-9]+-[0-9a-f-]+\.(png|jpg|webp)$/i)
        })
      }
    },
    async (request: FastifyRequest<{ Params: { fileName: string } }>, reply) => {
      const filePath = path.join(liveChatAttachmentDir, request.params.fileName);
      try {
        const data = await fs.readFile(filePath);
        const mime = request.params.fileName.endsWith(".png")
          ? "image/png"
          : request.params.fileName.endsWith(".webp")
            ? "image/webp"
            : "image/jpeg";
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        reply.type(mime);
        return reply.send(data);
      } catch {
        const placeholder = getMissingImagePlaceholder(`/interactions/live-chat/attachments/${request.params.fileName}`);
        if (placeholder) {
          reply.header("Cache-Control", "no-store");
          reply.type(placeholder.mimeType);
          return reply.send(placeholder.body);
        }

        return reply.notFound("Attachment not found");
      }
    }
  );

  app.get(
    "/votes/live",
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: 60_000,
        }
      },
      schema: {
        response: {
          200: z.object({
            generatedAt: z.string(),
            totals: z.object({
              votes: z.number(),
              projects: z.number(),
              activeCourses: z.number(),
              recentVotes: z.number(),
              pageViews: z.number(),
              uniqueVisitors: z.number(),
              authenticatedVisitors: z.number(),
              score: z.number(),
            }),
            leader: z.object({
              id: z.number(),
              name: z.string(),
              detailPath: z.string(),
              type: z.string(),
              votes: z.number(),
              score: z.number(),
              comments: z.number(),
              averageRating: z.number(),
              pageViews: z.number(),
              uniqueVisitors: z.number(),
              authenticatedVisitors: z.number(),
              rank: z.number(),
              share: z.number(),
              recentVotes: z.number(),
            }).nullable(),
            projects: z.array(z.object({
              id: z.number(),
              name: z.string(),
              detailPath: z.string(),
              type: z.string(),
              votes: z.number(),
              score: z.number(),
              comments: z.number(),
              averageRating: z.number(),
              pageViews: z.number(),
              uniqueVisitors: z.number(),
              authenticatedVisitors: z.number(),
              rank: z.number(),
              share: z.number(),
              recentVotes: z.number(),
            })),
            courses: z.array(z.object({
              course: z.string(),
              votes: z.number(),
              students: z.number(),
              recentVotes: z.number(),
              lastVoteAt: z.string().nullable()
            })),
            moments: z.array(z.object({
              id: z.number(),
              course: z.string(),
              project: z.string(),
              createdAt: z.string()
            })),
          })
        }
      }
    },
    async (_, reply) => {
      reply.header("Cache-Control", "no-store");
      return reply.send(await publicLiveVotesOverview.execute());
    }
  );

  const submissionIdSchema = z.object({
    submissionId: z.coerce.number().int().positive()
  });
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);
      setDefaultAdminPermission(adminApp, ["VOTES", "LIVE"]);

      adminApp.get(
        "/admin/moderation",
        {
          schema: {
            response: {
              200: z.object({
                projectComments: z.array(z.object({
                  id: z.number(),
                  content: z.string(),
                  createdAt: z.string(),
                  studentName: z.string(),
                  studentNumber: z.string(),
                  course: z.string().nullable(),
                  submissionId: z.number(),
                  submissionName: z.string(),
                  moderationStatus: z.string(),
                  feedbackReviewedAt: z.string().nullable(),
                  feedbackReviewedByStudentNumber: z.string().nullable(),
                  feedbackReviewNote: z.string().nullable(),
                  feedbackScoredAt: z.string().nullable(),
                })),
                liveChatMessages: z.array(liveChatMessageSchema.extend({
                  reportCount: z.number(),
                  hiddenAt: z.string().nullable(),
                  replyTo: liveChatReplySchema.nullable(),
                  id: z.number(),
                  studentNumber: z.string(),
                }))
              }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() })
            }
          }
        },
        async (_, reply) => {
          return reply.send(await interactionModerationOverview.execute());
        }
      );

      adminApp.delete(
        "/admin/comments/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().positive() }),
            response: {
              200: z.object({ success: z.literal(true) }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() })
            }
          }
        },
        async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
          try {
            return reply.send(await deleteProjectComment.execute(request.params.id));
          } catch (error) {
            return reply.status(404).send({ message: error instanceof Error ? error.message : "Project comment not found" });
          }
        }
      );

      adminApp.post(
        "/admin/comments/:id/qualified-feedback",
        {
          config: requireAdminPermission(["VOTES", "LIVE"]),
          schema: {
            params: z.object({ id: z.coerce.number().int().positive() }),
            body: qualifiedFeedbackReviewSchema,
            response: {
              200: z.object({
                success: z.literal(true),
                action: z.enum(["APPROVE", "REJECT", "REVOKE"]),
                scoreDelta: z.number(),
              }).passthrough(),
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request: FastifyRequest<{ Params: { id: number }; Body: z.infer<typeof qualifiedFeedbackReviewSchema> }>, reply) => {
          const body = qualifiedFeedbackReviewSchema.parse(request.body);

          try {
            const result = await reviewQualifiedFeedbackFromComment({
              commentId: request.params.id,
              action: body.action,
              note: body.note,
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.qualified_feedback_reviewed",
              entityType: "StudentComment",
              entityId: String(request.params.id),
              summary: `Feedback de comentário ${request.params.id} revisto como ${body.action}.`,
              metadata: {
                commentId: request.params.id,
                action: body.action,
                note: body.note,
                scoreDelta: result.scoreDelta,
              },
            });

            return reply.send(result);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao rever feedback.";
            if (/not found/i.test(message)) return reply.status(404).send({ message });
            return reply.status(400).send({ message });
          }
        },
      );

      adminApp.delete(
        "/admin/live-chat/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().positive() }),
            response: {
              200: z.object({ success: z.literal(true) }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() })
            }
          }
        },
        async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
          try {
            return reply.send(await deleteLiveChatMessage.execute(request.params.id));
          } catch (error) {
            return reply.status(404).send({ message: error instanceof Error ? error.message : "Live chat message not found" });
          }
        }
      );

      adminApp.patch(
        "/admin/live-chat/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().positive() }),
            body: z.object({
              isPinned: z.boolean().optional(),
              isHighlighted: z.boolean().optional(),
              hidden: z.boolean().optional(),
            }),
            response: {
              200: z.object({ success: z.literal(true) }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() })
            }
          }
        },
        async (request: FastifyRequest<{ Params: { id: number }; Body: { isPinned?: boolean; isHighlighted?: boolean; hidden?: boolean } }>, reply) => {
          const exists = await prisma.liveChatMessage.findUnique({ where: { id: request.params.id }, select: { id: true } });
          if (!exists) return reply.status(404).send({ message: "Live chat message not found" });

          await prisma.liveChatMessage.update({
            where: { id: request.params.id },
            data: {
              ...(typeof request.body.isPinned === "boolean" ? { isPinned: request.body.isPinned } : {}),
              ...(typeof request.body.isHighlighted === "boolean" ? { isHighlighted: request.body.isHighlighted } : {}),
              ...(typeof request.body.hidden === "boolean" ? { hiddenAt: request.body.hidden ? new Date() : null } : {}),
            },
          });

          return reply.send({ success: true as const });
        }
      );

      adminApp.get(
        "/admin/votes",
        {
          config: requireAdminPermission(["OVERVIEW", "VOTES", "WINNERS"]),
          schema: {
            response: {
              200: z.object({
                projects: z.array(z.object({
	                  id: z.number(),
	                  name: z.string(),
	                  detailPath: z.string(),
                  type: z.string(),
                  votes: z.number(),
                  score: z.number(),
                  comments: z.number(),
                  averageRating: z.number(),
                  pageViews: z.number(),
                  uniqueVisitors: z.number(),
                  authenticatedVisitors: z.number()
                })),
                votes: z.array(z.object({
                  id: z.number(),
                  studentId: z.number(),
	                  studentNumber: z.string(),
	                  studentName: z.string().nullable(),
	                  studentEmail: z.string().nullable(),
	                  studentCourse: z.string().nullable(),
	                  submissionId: z.number(),
	                  submissionName: z.string(),
	                  createdAt: z.string()
	                })),
	                courses: z.array(z.object({
	                  course: z.string(),
	                  votes: z.number(),
	                  students: z.number(),
	                  recentVotes: z.number(),
	                  lastVoteAt: z.string().nullable()
	                }))
	              }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() })
            }
          }
        },
        async (_, reply) => {
          return reply.send(await adminVotesOverview.execute());
        }
      );

      adminApp.get(
        "/admin/votes/paged",
        {
          config: requireAdminPermission(["OVERVIEW", "VOTES", "WINNERS"]),
          schema: {
            querystring: z.object({
              projectsPage: z.coerce.number().int().min(1).default(1),
              projectsLimit: z.coerce.number().int().min(10).max(200).default(50),
              votesPage: z.coerce.number().int().min(1).default(1),
              votesLimit: z.coerce.number().int().min(10).max(200).default(50),
            }),
            response: {
              200: z.object({
                projects: z.object({
                  items: z.array(z.object({
	                    id: z.number(),
	                    name: z.string(),
	                    detailPath: z.string(),
                    type: z.string(),
                    votes: z.number(),
                    score: z.number(),
                    comments: z.number(),
                    averageRating: z.number(),
                    pageViews: z.number(),
                    uniqueVisitors: z.number(),
                    authenticatedVisitors: z.number()
                  })),
                  total: z.number(),
                  page: z.number(),
                  totalPages: z.number(),
                }),
                votes: z.object({
                  items: z.array(z.object({
                    id: z.number(),
                    studentId: z.number(),
	                    studentNumber: z.string(),
	                    studentName: z.string().nullable(),
	                    studentEmail: z.string().nullable(),
	                    studentCourse: z.string().nullable(),
	                    submissionId: z.number(),
	                    submissionName: z.string(),
	                    createdAt: z.string()
	                  })),
	                  total: z.number(),
	                  page: z.number(),
	                  totalPages: z.number(),
	                }),
	                courses: z.array(z.object({
	                  course: z.string(),
	                  votes: z.number(),
	                  students: z.number(),
	                  recentVotes: z.number(),
	                  lastVoteAt: z.string().nullable()
	                })),
	              }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            }
          }
        },
        async (request, reply) => {
          const { projectsPage, projectsLimit, votesPage, votesLimit } = request.query as {
            projectsPage: number;
            projectsLimit: number;
            votesPage: number;
            votesLimit: number;
          };

	          const [projects, votes, courses] = await Promise.all([
	            adminVotesRepository.listProjectSummariesPaged({ page: projectsPage, limit: projectsLimit }),
	            adminVotesRepository.listVotesPaged({ page: votesPage, limit: votesLimit }),
	            adminVotesRepository.listCourseSummaries(),
	          ]);

          return reply.send({ projects, votes, courses });
	        }
	      );

      adminApp.get(
        "/admin/votes/scoring/config",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: exhibitorScoreConfigResponseSchema,
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (_, reply) => {
          return reply.send(await getExhibitorScoreConfig("main-event"));
        },
      );

      adminApp.patch(
        "/admin/votes/scoring/config",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: exhibitorScoreConfigUpdateSchema,
            response: {
              200: exhibitorScoreConfigResponseSchema,
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = exhibitorScoreConfigUpdateSchema.parse(request.body);

          try {
            const config = await updateExhibitorScoreConfig({
              eventKey: "main-event",
              weights: body.weights,
              streakBonuses: body.streakBonuses,
              rounds: body.rounds,
              createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.score_config_updated",
              entityType: "ExhibitorScoreConfig",
              entityId: String(config.version),
              summary: `Configuração de pontuação atualizada para a versão ${config.version}.`,
              metadata: {
                version: config.version,
                weights: body.weights ?? null,
                streakBonuses: body.streakBonuses ?? null,
                rounds: body.rounds ?? null,
              },
            });

            return reply.send(config);
          } catch (error) {
            return reply.status(400).send({
              message: error instanceof Error ? error.message : "Falha ao atualizar configuração.",
            });
          }
        },
      );

      adminApp.post(
        "/admin/votes/scoring/freeze",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: exhibitorScoreFreezeSchema,
            response: {
              200: z.object({
                freezeId: z.number(),
                eventKey: z.string(),
                frozenAt: z.string(),
                lockedEvents: z.number(),
                totalProjects: z.number(),
              }),
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = exhibitorScoreFreezeSchema.parse(request.body);

          try {
            const result = await freezeExhibitorScoreRanking({
              eventKey: "main-event",
              reason: body.reason ?? "Congelamento administrativo",
              createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.score_ranking_frozen",
              entityType: "ExhibitorScoreEvent",
              entityId: "main-event",
              summary: `${result.lockedEvents} evento(s) de pontuação foram congelados.`,
              metadata: {
                ...result,
                reason: body.reason ?? null,
              },
            });

            return reply.send(result);
          } catch (error) {
            return reply.status(400).send({
              message: error instanceof Error ? error.message : "Falha ao congelar ranking.",
            });
          }
        },
      );

      adminApp.post(
        "/admin/votes/scoring/recalculate",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: exhibitorScoreRecalculateSchema,
            response: {
              200: z.object({
                eventKey: z.string(),
                scannedEvents: z.number(),
                changedEvents: z.number(),
                beforeTotal: z.number(),
                afterTotal: z.number(),
              }),
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = exhibitorScoreRecalculateSchema.parse(request.body);

          try {
            const result = await recalculateUnlockedExhibitorScoreEvents({
              eventKey: "main-event",
              reason: body.reason,
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.score_events_recalculated",
              entityType: "ExhibitorScoreEvent",
              entityId: "main-event",
              summary: `${result.changedEvents} evento(s) recalculado(s) de ${result.scannedEvents} analisado(s).`,
              metadata: {
                ...result,
                reason: body.reason,
              },
            });

            return reply.send(result);
          } catch (error) {
            return reply.status(400).send({
              message: error instanceof Error ? error.message : "Falha ao recalcular pontuação.",
            });
          }
        },
      );

      adminApp.post(
        "/admin/votes/scoring/member-levels",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: exhibitorMemberLevelsResponseSchema,
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          try {
            const result = await awardExhibitorMemberLevels({
              eventKey: "main-event",
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.member_levels_awarded",
              entityType: "ExhibitorScoreEvent",
              entityId: "main-event",
              summary: `${result.awarded.length} bónus de nível atribuído(s) em ${result.scannedMembers} membro(s) analisado(s).`,
              metadata: result,
            });

            return reply.send(result);
          } catch (error) {
            return reply.status(400).send({
              message: error instanceof Error ? error.message : "Falha ao atribuir níveis dos membros.",
            });
          }
        },
      );

      adminApp.post(
        "/admin/votes/scoring/automatic-missions",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: exhibitorAutomaticMissionsResponseSchema,
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          try {
            const result = await awardExhibitorAutomaticMissions({
              eventKey: "main-event",
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.automatic_missions_awarded",
              entityType: "ExhibitorScoreEvent",
              entityId: "main-event",
              summary: `${result.awardedCount} missão(ões)/bónus automático(s) atribuídos.`,
              metadata: result,
            });

            return reply.send(result);
          } catch (error) {
            return reply.status(400).send({
              message: error instanceof Error ? error.message : "Falha ao atribuir missões automáticas.",
            });
          }
        },
      );

      adminApp.post(
        "/admin/votes/scoring/team-bonuses",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: exhibitorTeamBonusesResponseSchema,
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          try {
            const result = await awardExhibitorTeamBonuses({
              eventKey: "main-event",
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.team_bonuses_awarded",
              entityType: "ExhibitorScoreEvent",
              entityId: "main-event",
              summary: `${result.awardedCount} bónus MVP/equipa atribuído(s).`,
              metadata: result,
            });

            return reply.send(result);
          } catch (error) {
            return reply.status(400).send({
              message: error instanceof Error ? error.message : "Falha ao atribuir bónus de equipa.",
            });
          }
        },
      );

      adminApp.get(
        "/admin/votes/scoring/ambassadors",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: exhibitorAmbassadorRankingResponseSchema,
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (_, reply) => {
          return reply.send(await getExhibitorAmbassadorRanking({ eventKey: "main-event" }));
        },
      );

      adminApp.get(
        "/admin/votes/scoring/alerts",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: exhibitorScoringAlertsResponseSchema,
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (_, reply) => {
          return reply.send(await detectExhibitorScoringAlerts({ eventKey: "main-event" }));
        },
      );

      adminApp.get(
        "/admin/votes/scoring/export",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            querystring: exhibitorScoreExportQuerySchema,
            response: {
              200: exhibitorScoreExportResponseSchema,
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const query = exhibitorScoreExportQuerySchema.parse(request.query);
          const result = await exportExhibitorScoreRanking({
            eventKey: "main-event",
            frozenOnly: query.frozenOnly,
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
            actorRole: request.jury ? "jury_admin" : "admin",
            action: "projects.score_ranking_exported",
            entityType: "ExhibitorScoreEvent",
            entityId: "main-event",
            summary: `Ranking de pontuação exportado com ${result.totalProjects} projeto(s).`,
            metadata: {
              frozenOnly: query.frozenOnly,
              totalProjects: result.totalProjects,
              totalScore: result.totalScore,
            },
          });

          return reply.send(result);
        },
      );

      adminApp.get(
        "/admin/votes/scoring/export.csv",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            querystring: exhibitorScoreExportQuerySchema,
            response: {
              200: z.string(),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const query = exhibitorScoreExportQuerySchema.parse(request.query);
          const csv = await exportExhibitorScoreRankingCsv({
            eventKey: "main-event",
            frozenOnly: query.frozenOnly,
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
            actorRole: request.jury ? "jury_admin" : "admin",
            action: "projects.score_ranking_csv_exported",
            entityType: "ExhibitorScoreEvent",
            entityId: "main-event",
            summary: "Ranking de pontuação exportado em CSV.",
            metadata: {
              frozenOnly: query.frozenOnly,
            },
          });

          return reply
            .header("content-type", "text/csv; charset=utf-8")
            .header("content-disposition", "attachment; filename=\"ranking-pontuacao.csv\"")
            .send(csv);
        },
      );

      adminApp.get(
        "/admin/votes/scoring/export.pdf",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            querystring: exhibitorScoreExportQuerySchema,
            response: {
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const query = exhibitorScoreExportQuerySchema.parse(request.query);
          const html = await buildExhibitorScoreRankingPdfHtml({
            eventKey: "main-event",
            frozenOnly: query.frozenOnly,
          });
          const pdf = await renderPdfFromHtml(html, {
            footerLabel: "UOR Connect - Ranking de Pontuação",
            displayHeaderFooter: true,
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
            actorRole: request.jury ? "jury_admin" : "admin",
            action: "projects.score_ranking_pdf_exported",
            entityType: "ExhibitorScoreEvent",
            entityId: "main-event",
            summary: "Ranking de pontuação exportado em PDF.",
            metadata: {
              frozenOnly: query.frozenOnly,
            },
          });

          const fileName = query.frozenOnly
            ? "ranking-pontuacao-congelado.pdf"
            : "ranking-pontuacao-atual.pdf";

          return reply
            .header("Content-Type", "application/pdf")
            .header("Content-Disposition", `attachment; filename="${fileName}"`)
            .send(pdf);
        },
      );

      adminApp.post(
        "/admin/votes/member-duty",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: exhibitorMemberDutySchema,
            response: {
              200: z.object({
                success: z.literal(true),
                message: z.string(),
                votesCount: z.number(),
                score: z.number(),
                scoreDelta: z.number(),
                scoringEvents: z.array(z.object({
                  action: z.string(),
                  points: z.number(),
                  reason: z.string(),
                })),
              }),
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = exhibitorMemberDutySchema.parse(request.body);

          try {
            const result = await recordExhibitorMemberDuty({
              submissionId: body.submissionId,
              submissionMemberId: body.submissionMemberId,
              eventKey: "main-event",
              action: body.action,
              role: body.role,
              roundKey: body.roundKey ?? null,
              roundLabel: body.roundLabel ?? null,
              metadata: body.metadata,
              createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.member_duty_recorded",
              entityType: "SubmissionMember",
              entityId: String(body.submissionMemberId),
              summary: `${body.action} registado para membro ${body.submissionMemberId} no projeto ${body.submissionId}.`,
              metadata: {
                submissionId: body.submissionId,
                submissionMemberId: body.submissionMemberId,
                action: body.action,
                role: body.role,
                roundKey: body.roundKey ?? null,
              },
            });

            return reply.send({
              success: true as const,
              message: result.message,
              votesCount: result.votesCount,
              score: result.score,
              scoreDelta: result.scoreDelta,
              scoringEvents: result.scoringEvents.map((event) => ({
                action: event.action,
                points: event.points,
                reason: event.reason,
              })),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao registar função do membro.";
            if (/not found/i.test(message)) return reply.status(404).send({ message });
            return reply.status(400).send({ message });
          }
        },
      );

      adminApp.post(
        "/admin/votes/stand-empty-penalty",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: exhibitorEmptyStandPenaltySchema,
            response: {
              200: z.object({
                success: z.literal(true),
                message: z.string(),
                votesCount: z.number(),
                score: z.number(),
                scoreDelta: z.number(),
                scoringEvents: z.array(z.object({
                  action: z.string(),
                  points: z.number(),
                  reason: z.string(),
                })),
              }),
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = exhibitorEmptyStandPenaltySchema.parse(request.body);

          try {
            const result = await recordEmptyStandPenalty({
              submissionId: body.submissionId,
              eventKey: "main-event",
              roundKey: body.roundKey,
              roundLabel: body.roundLabel ?? null,
              metadata: body.metadata,
              createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.empty_stand_penalty_checked",
              entityType: "Submission",
              entityId: String(body.submissionId),
              summary: result.scoreDelta < 0
                ? `Penalização de stand vazio aplicada ao projeto ${body.submissionId}.`
                : `Stand vazio verificado sem nova penalização no projeto ${body.submissionId}.`,
              metadata: {
                submissionId: body.submissionId,
                roundKey: body.roundKey,
                roundLabel: body.roundLabel ?? null,
                scoreDelta: result.scoreDelta,
              },
            });

            return reply.send({
              success: true as const,
              message: result.message,
              votesCount: result.votesCount,
              score: result.score,
              scoreDelta: result.scoreDelta,
              scoringEvents: result.scoringEvents.map((event) => ({
                action: event.action,
                points: event.points,
                reason: event.reason,
              })),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao verificar stand vazio.";
            if (/not found/i.test(message)) return reply.status(404).send({ message });
            return reply.status(400).send({ message });
          }
        },
      );

      adminApp.post(
        "/admin/votes/score-events",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: exhibitorScoreAdjustmentSchema,
            response: {
              200: z.object({
                success: z.literal(true),
                message: z.string(),
                votesCount: z.number(),
                score: z.number(),
                scoreDelta: z.number(),
                scoringEvents: z.array(z.object({
                  action: z.string(),
                  points: z.number(),
                  reason: z.string(),
                })),
              }),
              400: z.object({ message: z.string() }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = exhibitorScoreAdjustmentSchema.parse(request.body);

          try {
            const result = await recordExhibitorScoreAdjustment({
              submissionId: body.submissionId,
              eventKey: "main-event",
              action: body.action,
              sourceType: body.sourceType ?? "ADMIN_ADJUSTMENT",
              sourceId: body.sourceId ?? crypto.randomUUID(),
              studentId: body.studentId ?? null,
              actorStudentId: body.actorStudentId ?? null,
              submissionMemberId: body.submissionMemberId ?? null,
              points: body.points,
              reason: body.reason,
              role: body.role ?? null,
              roundKey: body.roundKey ?? null,
              roundLabel: body.roundLabel ?? null,
              metadata: body.metadata,
              createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
            });

            adminVotesRepository.invalidateCache();
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
              actorRole: request.jury ? "jury_admin" : "admin",
              action: "projects.score_event_created",
              entityType: "ExhibitorScoreEvent",
              entityId: String(body.submissionId),
              summary: `${body.action} aplicado ao projeto ${body.submissionId}: ${body.points} ponto(s).`,
              metadata: {
                submissionId: body.submissionId,
                action: body.action,
                points: body.points,
                reason: body.reason,
                scoreDelta: result.scoreDelta,
              },
            });

            return reply.send({
              success: true as const,
              message: result.message,
              votesCount: result.votesCount,
              score: result.score,
              scoreDelta: result.scoreDelta,
              scoringEvents: result.scoringEvents.map((event) => ({
                action: event.action,
                points: event.points,
                reason: event.reason,
              })),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao registar pontuação.";
            if (/not found/i.test(message)) return reply.status(404).send({ message });
            return reply.status(400).send({ message });
          }
        }
      );

      adminApp.post(
        "/admin/votes/reset/request-confirmation",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            response: {
              200: adminDangerConfirmationSchema,
              400: z.object({ message: z.string() }),
              502: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          try {
            const confirmation = await requestAdminSmsConfirmation({
              env: opts.env,
              operation: "PROJECT_VOTES_RESET",
              actorStudentNumber: request.student?.studentNumber ?? null,
            });
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "projects.votes_reset_confirmation_requested",
              entityType: "StudentVote",
              summary: "Código SMS solicitado para remover todos os votos dos projectos.",
              metadata: {
                phone: confirmation.phone,
                expiresAt: confirmation.expiresAt,
              },
            });
            return confirmation;
          } catch (error) {
            return reply.code(502).send({
              message: error instanceof Error ? error.message : "Falha ao enviar código SMS.",
            });
          }
        },
      );

      adminApp.post(
        "/admin/votes/reset/confirm",
        {
          config: requireAdminPermission(["VOTES", "WINNERS"]),
          schema: {
            body: projectVotesResetConfirmBodySchema,
            response: {
              200: projectVotesResetResultSchema,
              400: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = projectVotesResetConfirmBodySchema.parse(request.body);
          if (body.confirmationText !== "REMOVER VOTOS") {
            return reply.code(400).send({
              message: "Escreve REMOVER VOTOS para confirmar esta ação.",
            });
          }

          const verification = await verifyAdminSmsConfirmation({
            env: opts.env,
            operation: "PROJECT_VOTES_RESET",
            code: body.code,
          });
          if (!verification.ok) {
            return reply.code(400).send({ message: verification.message });
          }

          const [studentVotes, legacyVotes, scoreEvents] = await prisma.$transaction([
            prisma.studentVote.deleteMany({}),
            prisma.vote.deleteMany({}),
            prisma.exhibitorScoreEvent.deleteMany({}),
          ]);
          adminVotesRepository.invalidateCache();
          const result = {
            studentVotesDeleted: studentVotes.count,
            legacyVotesDeleted: legacyVotes.count,
            scoreEventsDeleted: scoreEvents.count,
          };

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "projects.votes_reset",
            entityType: "StudentVote",
            summary: "Todos os votos dos projectos foram removidos com confirmação SMS.",
            metadata: result,
          });
          return result;
        },
      );
    });

    protectedApp.post(
      "/live-chat",
      {
        config: {
          rateLimit: {
            max: 30,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: z.object({
            content: z.string().trim().max(280).default(""),
            attachment: liveChatAttachmentSchema,
            replyToMessageId: z.number().int().positive().nullable().optional(),
          }),
          response: {
            201: liveChatMessageSchema
          }
        }
      },
      async (request: FastifyRequest<{ Body: { content: string; attachment?: { dataUrl: string; fileName?: string } | null; replyToMessageId?: number | null } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode enviar mensagens no chat ao vivo." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }

        if (!request.body.content.trim() && !request.body.attachment?.dataUrl) {
          return reply.status(400).send({ message: "Escreve uma mensagem ou adiciona uma imagem." });
        }

        let attachment: { attachmentUrl: string | null; attachmentMime: string | null };
        try {
          attachment = await saveLiveChatAttachment(request.body.attachment);
        } catch (error) {
          return reply.status(400).send({ message: error instanceof Error ? error.message : "Imagem inválida." });
        }

        const replyToMessage = request.body.replyToMessageId
          ? await prisma.liveChatMessage.findUnique({
              where: { id: request.body.replyToMessageId },
              include: { student: true },
            })
          : null;

        const created = await prisma.liveChatMessage.create({
          data: {
            content: request.body.content.trim(),
            attachmentUrl: attachment.attachmentUrl,
            attachmentMime: attachment.attachmentMime,
            replyToMessageId: replyToMessage?.id ?? null,
            studentId: student.id
          },
          include: {
            student: true,
            reactions: true,
          }
        });

        const profile = normalizeStudentProfile(created.student);
        const courseColorMap = await getCourseColorMap();
        const contextualClassCodes = created.student.classCode?.trim() ? [created.student.classCode.trim()] : [];
        const contextualCourses = profile.course?.trim() ? [profile.course.trim()] : [];

        if (contextualClassCodes.length > 0 || contextualCourses.length > 0) {
          const contextualAudience = {
            type: "STUDENT_CLASS_OR_COURSE" as const,
            studentClassCodes: contextualClassCodes,
            studentCourses: contextualCourses,
          };
          const contextualValues = {
            evento: "Ao Vivo",
            detalhe: "Um colega publicou uma nova interação no Ao Vivo.",
            colega: profile.name ?? `Estudante ${created.student.studentNumber}`,
            turma: created.student.classCode,
            curso: profile.course,
            link: resolvePublicOrigin(request, optsEnvCache),
          };

          const [whatsAppResult, smsResult] = await Promise.allSettled([
            sendWhatsAppAudienceAutomationEvent(optsEnvCache, "LIVE_CHAT_CONTEXT_AUDIENCE", {
              audience: contextualAudience,
              excludeStudentId: created.student.id,
              recipientCourse: profile.course,
              values: contextualValues,
            }),
            sendSmsAudienceAutomationEvent(optsEnvCache, "LIVE_CHAT_CONTEXT_AUDIENCE", {
              audience: contextualAudience,
              excludeStudentId: created.student.id,
              values: contextualValues,
            }),
          ]);

          if (whatsAppResult.status === "rejected") {
            request.log.warn({ err: whatsAppResult.reason }, "contextual live chat WhatsApp audience notification failed");
          }
          if (smsResult.status === "rejected") {
            request.log.warn({ err: smsResult.reason }, "contextual live chat SMS audience notification failed");
          }
        }

        return reply.code(201).send({
          id: created.id,
          content: created.content,
          attachmentUrl: created.attachmentUrl,
          attachmentMime: created.attachmentMime,
          replyTo: replyToMessage ? {
            id: replyToMessage.id,
            content: replyToMessage.content,
            studentName: normalizeStudentProfile(replyToMessage.student).name ?? `Estudante ${replyToMessage.student.studentNumber}`,
            studentAvatarUrl: normalizeStudentProfile(replyToMessage.student).avatarUrl ?? null,
          } : null,
          reactionCounts: reactionCounts(created.reactions),
          isPinned: created.isPinned,
          isHighlighted: created.isHighlighted,
          createdAt: created.createdAt.toISOString(),
          studentName: profile.name ?? `Estudante ${created.student.studentNumber}`,
          studentAvatarUrl: profile.avatarUrl ?? null,
          course: profile.course ?? null,
          courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
        });
      }
    );

    protectedApp.post(
      "/live-chat/:id/reactions",
      {
        config: {
          rateLimit: {
            max: 80,
            timeWindow: 60_000,
          }
        },
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          body: z.object({ type: liveChatReactionSchema }),
          response: {
            200: z.object({
              reacted: z.boolean(),
              reactionCounts: z.record(z.string(), z.number()),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Params: { id: number }; Body: { type: string } }>, reply) => {
        const student = request.student;
        if (!student) return reply.status(request.jury ? 403 : 401).send({ message: request.jury ? "Acesso de júri ainda não pode reagir no chat." : "Unauthorized" });

        const message = await prisma.liveChatMessage.findUnique({
          where: { id: request.params.id },
          select: { id: true, hiddenAt: true },
        });
        if (!message || message.hiddenAt) return reply.status(404).send({ message: "Live chat message not found" });

        const existing = await prisma.liveChatReaction.findUnique({
          where: {
            messageId_studentId_type: {
              messageId: request.params.id,
              studentId: student.id,
              type: request.body.type,
            },
          },
        });

        if (existing) {
          await prisma.liveChatReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.liveChatReaction.create({
            data: {
              messageId: request.params.id,
              studentId: student.id,
              type: request.body.type,
            },
          });
        }

        const reactions = await prisma.liveChatReaction.findMany({
          where: { messageId: request.params.id },
          select: { type: true },
        });

        return reply.send({ reacted: !existing, reactionCounts: reactionCounts(reactions) });
      }
    );

    protectedApp.post(
      "/live-chat/:id/report",
      {
        config: {
          rateLimit: {
            max: 10,
            timeWindow: 60_000,
          }
        },
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: z.object({ success: z.literal(true) }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
        const student = request.student;
        if (!student) return reply.status(request.jury ? 403 : 401).send({ message: request.jury ? "Acesso de júri ainda não pode denunciar mensagens." : "Unauthorized" });

        const message = await prisma.liveChatMessage.findUnique({ where: { id: request.params.id }, select: { id: true } });
        if (!message) return reply.status(404).send({ message: "Live chat message not found" });

        await prisma.liveChatMessage.update({
          where: { id: request.params.id },
          data: { reportCount: { increment: 1 } },
        });

        return reply.send({ success: true as const });
      }
    );

    protectedApp.post(
      "/like",
      {
        config: {
          rateLimit: {
            max: 60,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: submissionIdSchema,
          response: {
            200: z.object({
              liked: z.boolean(),
              likesCount: z.number()
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { submissionId: number } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode registar likes." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const { submissionId } = request.body;
        const submission = await prisma.submission.findFirst({
          where: { id: submissionId, ...ACTIVE_PUBLIC_PROJECT_WHERE },
        });
        if (!submission) {
          return reply.status(404).send({ message: "Submission not found" });
        }

        const existing = await prisma.studentLike.findUnique({
          where: { studentId_submissionId: { studentId: student.id, submissionId } }
        });

        if (existing) {
          await prisma.studentLike.delete({ where: { id: existing.id } });
          return reply.send({
            liked: false,
            likesCount: await prisma.studentLike.count({ where: { submissionId } })
          });
        }

        await prisma.studentLike.create({
          data: { studentId: student.id, submissionId }
        });

        const likesCount = await prisma.studentLike.count({ where: { submissionId } });
        await maybeSendSubmissionEngagementMilestoneNotification(opts.env, request, submissionId, "likes", likesCount);

        return reply.send({
          liked: true,
          likesCount
        });
      }
    );

    protectedApp.post(
      "/vote",
      {
        config: {
          rateLimit: {
            max: 30,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: submissionIdSchema,
          response: {
            200: z.object({
              voted: z.literal(true),
              votesCount: z.number(),
              score: z.number(),
              scoreDelta: z.number(),
              message: z.string(),
              scoringEvents: z.array(z.object({
                action: z.string(),
                points: z.number(),
                reason: z.string(),
              })),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { submissionId: number } }>, reply: FastifyReply) => {
        const student = request.student;
        const jury = request.jury;
        if (!student && !jury) {
          return reply.status(401).send({ message: "Unauthorized" });
        }
        const { submissionId } = request.body;

        const submission = await prisma.submission.findFirst({
          where: { id: submissionId, ...ACTIVE_PUBLIC_PROJECT_WHERE },
        });
        if (!submission) {
          return reply.status(404).send({ message: "Submission not found" });
        }
        if (!isCompetitionEligible(submission.type, submission.area)) {
          return reply.status(403).send({ message: "A votação pública está disponível apenas para projetos académicos aprovados." });
        }

        const scoringResult = jury
          ? await recordJuryProjectVoteScore({
            submissionId,
            juryId: jury.id,
            juryPhone: jury.phone,
          })
          : await recordStudentProjectVoteScore({
            submissionId,
            studentId: student!.id,
          });

        if (!scoringResult.accepted) {
          return reply.status(403).send({ message: scoringResult.message });
        }

        if (!jury && scoringResult.scoreDelta !== 0 && submission.studentId) {
          try {
            const owner = await prisma.student.findUnique({
              where: { id: submission.studentId },
              select: { id: true, studentNumber: true, name: true, course: true, phone: true },
            });
            if (owner) {
              await notifyExhibitorGameEvent(opts.env, {
                student: owner,
                kind: scoringResult.scoreDelta > 0 ? "EXHIBITOR_POINTS_GAINED" : "EXHIBITOR_POINTS_LOST",
                projectName: submission.name,
                deltaPoints: scoringResult.scoreDelta,
                reason: scoringResult.scoringEvents.map((event) => event.reason).filter(Boolean).join("; "),
                currentScore: scoringResult.score,
              });
            }
          } catch (error) {
            request.log.warn({ err: error, submissionId }, "exhibitor game notification failed");
          }
        }

        adminVotesRepository.invalidateCache();

        return reply.send({
          voted: true,
          votesCount: scoringResult.votesCount,
          score: scoringResult.score,
          scoreDelta: scoringResult.scoreDelta,
          message: scoringResult.message,
          scoringEvents: scoringResult.scoringEvents.map((event) => ({
            action: event.action,
            points: event.points,
            reason: event.reason,
          })),
        });
      }
    );

    protectedApp.post(
      "/comment",
      {
        config: {
          rateLimit: {
            max: 20,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: z.object({
            submissionId: z.coerce.number().int().positive(),
            content: z.string().trim().min(1).max(500)
          }),
          response: {
            201: z.object({
              id: z.number(),
              content: z.string(),
              createdAt: z.string(),
              studentName: z.string(),
              studentAvatarUrl: z.string().nullable().optional(),
              course: z.string().nullable(),
              courseColor: z.string().nullable()
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { submissionId: number; content: string } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode publicar comentários." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }
        const { submissionId, content } = request.body;

        const submission = await prisma.submission.findFirst({
          where: { id: submissionId, ...ACTIVE_PUBLIC_PROJECT_WHERE },
        });
        if (!submission) {
          return reply.status(404).send({ message: "Submission not found" });
        }

        const comment = await prisma.studentComment.create({
          data: {
            studentId: student.id,
            submissionId,
            content
          },
          include: {
            student: true
          }
        });

        const courseColorMap = await getCourseColorMap();
        const profile = normalizeStudentProfile(comment.student);
        const commentsCount = await prisma.studentComment.count({ where: { submissionId } });
        await maybeSendSubmissionEngagementMilestoneNotification(opts.env, request, submissionId, "comments", commentsCount);

        return reply.code(201).send({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          studentName: profile.name ?? `Estudante ${comment.student.studentNumber}`,
          studentAvatarUrl: profile.avatarUrl ?? null,
          course: profile.course ?? null,
          courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
        });
      }
    );

    protectedApp.get(
      "/me",
      async (request, reply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            const juryMember = await prisma.juryMember.findUnique({
              where: { id: request.jury.id },
              select: { id: true, name: true, phone: true, isActive: true, lastCodeSentAt: true },
            });

            if (!juryMember || !juryMember.isActive) {
              return reply.status(403).send({ message: "Sessão de júri inválida ou desativada." });
            }

            return reply.send({
              student: null,
              jury: {
                id: juryMember.id,
                name: juryMember.name,
                phone: juryMember.phone,
                lastCodeSentAt: juryMember.lastCodeSentAt?.toISOString() ?? null,
              },
              stats: {
                likes: 0,
                votes: 0,
                comments: 0,
              },
            });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const [profile, likeCount, voteCount, commentCount] = await Promise.all([
          prisma.student.findUnique({ where: { id: student.id } }),
          prisma.studentLike.count({
            where: {
              studentId: student.id,
              submission: { is: ACTIVE_PUBLIC_PROJECT_WHERE },
            },
          }),
          prisma.studentVote.count({
            where: {
              studentId: student.id,
              submission: { is: ACTIVE_PUBLIC_PROJECT_WHERE },
            },
          }),
          prisma.studentComment.count({
            where: {
              studentId: student.id,
              submission: { is: ACTIVE_PUBLIC_PROJECT_WHERE },
            },
          })
        ]);

        return reply.send({
          student: profile ? normalizeStudentProfile(profile) : null,
          stats: {
            likes: likeCount,
            votes: voteCount,
            comments: commentCount
          }
        });
      }
    );
  });
}
