import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import {
  adminGuard,
  setDefaultAdminPermission,
} from "../../auth/http/admin.middleware";
import { recordAdminAudit } from "../../audit/application/audit.service";
import {
  requestAdminSmsConfirmation,
  verifyAdminSmsConfirmation,
} from "../../admin-safety/admin-sms-confirmation";
import {
  buildValidationQrUrl,
  buildValidationUrl,
} from "../../validation/application/validation-links";
import { renderQrDataUri } from "../../../shared/qr";
import { notifyPassportGameEvent } from "../../game-notifications/game-notification.service";
import {
  escapeHtml,
  loadLogoDataUri,
  renderPdfFromHtml,
} from "../../reports/http/pdf-report.utils";
import { renderChallengeManualPdf } from "./challenge-manual-pdf";
import {
  answerPassportChallenge,
  canAcceptPassportReferralInvite,
  createOrUpdateOwnedProjectChallenge,
  createPassportChallenge,
  createPassportQrActionToken,
  createPassportSurpriseQr,
  createPassportSurpriseQrBatch,
  ensureNetworkingQrForStudent,
  exportPassportWinners,
  freezePassportRanking,
  getPassportAdminOverview,
  getPassportAdminReports,
  getPassportLeaderboard,
  getPassportSummary,
  listPassportAdminLogs,
  listPassportChallenges,
  listPassportMissions,
  listOwnedProjectChallenges,
  listPassportSurpriseQrs,
  recordPassportConstructiveFeedback,
  recordPassportReferralJoin,
  recordPassportParticipation,
  requestPassportPointRecovery,
  resolvePassportReferralInvite,
  resetPassportChallengeProgress,
  reviewPassportScan,
  reviewPassportPointRecovery,
  revokePassportLedgerPoints,
  updatePassportChallenge,
  updatePassportSurpriseQr,
} from "../application/passport.service";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const passportMissionSchema = z.object({
  id: z.number(),
  key: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  points: z.number(),
  pointsEarned: z.number().optional(),
  completions: z.number().optional(),
  status: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  active: z.boolean().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  targetType: z.string().nullable().optional(),
  targetId: z.number().nullable().optional(),
  targetKey: z.string().nullable().optional(),
});

const passportBadgeSchema = z.object({
  id: z.number(),
  key: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  earned: z.boolean(),
  awardedAt: z.string().nullable(),
});

const passportScanSchema = z.object({
  id: z.number(),
  missionKey: z.string().nullable(),
  missionTitle: z.string().nullable(),
  missionType: z.string().nullable(),
  result: z.string(),
  pointsAwarded: z.number(),
  message: z.string().nullable(),
  scannedAt: z.string(),
});

const passportRecentSurpriseSchema = z.object({
  id: z.number(),
  displayCode: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable(),
  effectType: z.string(),
  effectValue: z.number(),
  rarity: z.string(),
  beforePoints: z.number(),
  afterPoints: z.number(),
  deltaPoints: z.number(),
  message: z.string().nullable(),
  appliedAt: z.string(),
});

const passportSummarySchema = z.object({
  studentNumber: z.string(),
  joinedAt: z.string().nullable(),
  participantCount: z.number(),
  points: z.number(),
  surpriseBonusPoints: z.number(),
  totalAvailablePoints: z.number(),
  pointCaps: z.object({
    missionPoints: z.number(),
    surprisePointsCap: z.number(),
    recoveryPointsCap: z.number(),
    totalAvailablePoints: z.number(),
  }),
  completedMissions: z.number(),
  totalMissions: z.number(),
  progressPercent: z.number(),
  ranking: z
    .object({
      position: z.number(),
      points: z.number(),
    })
    .nullable(),
  missions: z.array(passportMissionSchema),
  badges: z.array(passportBadgeSchema),
  recentScans: z.array(passportScanSchema),
  recentSurprises: z.array(passportRecentSurpriseSchema),
  referral: z.object({
    code: z.string().nullable(),
    url: z.string().nullable(),
    inviteCount: z.number(),
    pointsEarned: z.number(),
    nextMilestone: z.number(),
  }),
});

const passportLeaderboardRowSchema = z.object({
  position: z.number(),
  studentNumber: z.string(),
  studentName: z.string().nullable(),
  studentCourse: z.string().nullable(),
  points: z.number(),
  diversityScore: z.number(),
  workshops: z.number(),
  completedAt: z.string().nullable(),
});

const passportJoinBodySchema = z.object({
  visitorId: z.string().trim().min(8).max(120).optional().nullable(),
  referralCode: z.string().trim().min(8).max(180).optional().nullable(),
});

const passportRecoveryBodySchema = z.object({
  phone: z.string().trim().max(40).optional().nullable(),
  paymentReference: z.string().trim().max(120).optional().nullable(),
  paymentProofUrl: z.string().trim().max(800).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

const passportRecoverySchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  studentName: z.string().nullable(),
  phone: z.string().nullable(),
  amountKz: z.number(),
  requestedPoints: z.number(),
  awardedPoints: z.number(),
  status: z.string(),
  paymentReference: z.string().nullable(),
  paymentProofUrl: z.string().nullable(),
  note: z.string().nullable(),
  reviewedByStudentNumber: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
});

const passportRecoveryReviewBodySchema = z.object({
  status: z.enum(["CONFIRMED", "REJECTED"]),
  note: z.string().trim().max(500).optional().nullable(),
});

const passportReferralInviteSchema = z.object({
  code: z.string(),
  inviterStudentNumber: z.string(),
  inviterName: z.string(),
  inviterCourse: z.string().nullable(),
});

const missionBodySchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/i),
  type: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).optional().nullable(),
  points: z.number().int().min(0).max(500),
  active: z.boolean().optional(),
  status: z.enum(["PENDING_APPROVAL", "APPROVED", "PAUSED", "REJECTED"]).optional(),
  reviewNote: z.string().trim().max(500).optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  maxPointsPerStudent: z.number().int().min(1).optional().nullable(),
  targetType: z.string().trim().max(80).optional().nullable(),
  targetId: z.number().int().optional().nullable(),
  targetKey: z.string().trim().max(120).optional().nullable(),
  badgeKey: z.string().trim().max(80).optional().nullable(),
});

const passportChallengePublicSchema = z.object({
  id: z.number(),
  type: z.string(),
  question: z.string(),
  options: z.array(z.string()).nullable(),
  maxAttempts: z.number(),
  version: z.number(),
  explanation: z.string().nullable(),
});

const networkingQrSchema = z.object({
  token: z.string(),
  validationUrl: z.string(),
  qrImageUrl: z.string(),
  actionId: z.number(),
  label: z.string(),
});

const challengeAnswerBodySchema = z.object({
  answer: z.string().trim().min(1).max(300),
});

const constructiveFeedbackBodySchema = z.object({
  submissionId: z.coerce.number().int().positive(),
  content: z.string().trim().min(1).max(700),
  focus: z
    .enum(["clareza", "impacto", "viabilidade", "apresentacao", "experiencia"])
    .optional()
    .nullable(),
});

const constructiveFeedbackResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  pointsAwarded: z.number(),
  completedCount: z.number(),
  requiredCount: z.number(),
  missionCompleted: z.boolean(),
  comment: z
    .object({
      id: z.number(),
      content: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  submission: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .nullable(),
});

const challengeAnswerResponseSchema = z.object({
  ok: z.boolean(),
  status: z.string(),
  correct: z.boolean().optional(),
  pointsAwarded: z.number(),
  attemptsUsed: z.number().optional(),
  attemptsRemaining: z.number().optional(),
  message: z.string(),
  challenge: passportChallengePublicSchema.optional(),
});

const challengeBodySchema = z.object({
  missionId: z.number().int().min(1).optional().nullable(),
  qrActionId: z.number().int().min(1).optional().nullable(),
  type: z.enum(["EXHIBITOR_CHALLENGE", "SPECIAL_QUIZ"]),
  question: z.string().trim().min(6).max(500),
  options: z
    .array(z.string().trim().min(1).max(160))
    .max(8)
    .optional()
    .nullable(),
  correctAnswer: z.string().trim().min(1).max(300).optional(),
  explanation: z.string().trim().max(500).optional().nullable(),
  maxAttempts: z.number().int().min(1).max(5).optional().nullable(),
  active: z.boolean().optional(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

const ownedProjectChallengeBodySchema = z.object({
  submissionId: z.number().int().min(1),
  question: z.string().trim().min(8).max(500),
  options: z.array(z.string().trim().min(1).max(160)).min(2).max(8),
  correctAnswer: z.string().trim().min(1).max(300),
  explanation: z.string().trim().max(500).optional().nullable(),
  maxAttempts: z.number().int().min(1).max(5).optional().nullable(),
});

const ownedProjectChallengeSchema = z.object({
  submissionId: z.number(),
  submissionName: z.string(),
  submissionType: z.string(),
  status: z.string(),
  qrActionId: z.number().nullable(),
  validationUrl: z.string().nullable(),
  qrImageUrl: z.string().nullable(),
  challenge: z
    .object({
      id: z.number(),
      question: z.string(),
      options: z.array(z.string()).nullable(),
      explanation: z.string().nullable(),
      maxAttempts: z.number(),
      active: z.boolean(),
      status: z.string(),
      reviewNote: z.string().nullable(),
      version: z.number(),
      approvedAt: z.string().nullable(),
      approvedByStudentNumber: z.string().nullable(),
      answersCount: z.number(),
      createdAt: z.string(),
    })
    .nullable(),
});

const adminChallengeSchema = z.object({
  id: z.number(),
  missionId: z.number().nullable(),
  missionTitle: z.string().nullable(),
  missionPoints: z.number().nullable(),
  qrActionId: z.number().nullable(),
  qrActionLabel: z.string().nullable(),
  qrActionType: z.string().nullable(),
  type: z.string(),
  question: z.string(),
  options: z.array(z.string()).nullable(),
  explanation: z.string().nullable(),
  maxAttempts: z.number(),
  active: z.boolean(),
  status: z.string(),
  reviewNote: z.string().nullable(),
  version: z.number(),
  approvedAt: z.string().nullable(),
  approvedByStudentNumber: z.string().nullable(),
  pendingApproval: z.boolean(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  answersCount: z.number(),
  createdAt: z.string(),
});

const surpriseEffectWeightSchema = z.object({
  ADD_POINTS: z.number().int().min(0).max(1000).optional(),
  SUBTRACT_POINTS: z.number().int().min(0).max(1000).optional(),
  MULTIPLY_BONUS: z.number().int().min(0).max(1000).optional(),
  DIVIDE_BONUS: z.number().int().min(0).max(1000).optional(),
  NEUTRAL_HINT: z.number().int().min(0).max(1000).optional(),
  RECOVERY_POINTS: z.number().int().min(0).max(1000).optional(),
});

const surpriseEffectValueSchema = z.object({
  ADD_POINTS: z.number().int().min(0).max(500).optional(),
  SUBTRACT_POINTS: z.number().int().min(0).max(500).optional(),
  MULTIPLY_BONUS: z.number().int().min(2).max(5).optional(),
  DIVIDE_BONUS: z.number().int().min(2).max(5).optional(),
  NEUTRAL_HINT: z.number().int().min(0).max(500).optional(),
  RECOVERY_POINTS: z.number().int().min(0).max(500).optional(),
});

const surpriseConcreteEffectSchema = z.enum([
  "ADD_POINTS",
  "SUBTRACT_POINTS",
  "MULTIPLY_BONUS",
  "DIVIDE_BONUS",
  "NEUTRAL_HINT",
  "RECOVERY_POINTS",
]);

const surpriseBodySchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).optional().nullable(),
  displayCode: z.string().trim().min(2).max(40).optional().nullable(),
  batchCode: z.string().trim().min(2).max(80).optional().nullable(),
  effectType: z.enum([
    "ADD_POINTS",
    "SUBTRACT_POINTS",
    "MULTIPLY_BONUS",
    "DIVIDE_BONUS",
    "UNIVERSAL_DYNAMIC",
  ]),
  effectValue: z.number().int().min(0).max(500),
  dynamicRules: z.object({
    mode: z.enum(["UNIVERSAL_DYNAMIC"]).optional().nullable(),
    weights: surpriseEffectWeightSchema.optional().nullable(),
    values: surpriseEffectValueSchema.optional().nullable(),
    lossAdjustment: z.object({
      afterLosses: z.number().int().min(1).max(999).optional().nullable(),
      weights: surpriseEffectWeightSchema.optional().nullable(),
      values: surpriseEffectValueSchema.optional().nullable(),
    }).optional().nullable(),
    convertAfterLosses: z.number().int().min(1).max(999).optional().nullable(),
    convertToEffectType: surpriseConcreteEffectSchema.optional().nullable(),
    convertToEffectValue: z.number().int().min(1).max(500).optional().nullable(),
    hintAfterLoss: z.string().trim().max(240).optional().nullable(),
  }).optional().nullable(),
  targetScope: z.string().trim().max(80).optional().nullable(),
  rarity: z.enum(["COMMON", "RARE", "SECRET", "TEMPORARY"]).optional(),
  visibility: z.enum(["VISIBLE", "SEMI_HIDDEN", "SECRET"]).optional(),
  maxUsesTotal: z.number().int().min(1).optional().nullable(),
  maxUsesPerStudent: z.number().int().min(1).max(5).optional().nullable(),
  negativeCapPerStudent: z.number().int().min(0).max(500).optional().nullable(),
  active: z.boolean().optional(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
});

const surpriseBatchBodySchema = surpriseBodySchema.extend({
  quantity: z.number().int().min(1).max(120),
  codePrefix: z.string().trim().min(1).max(12).optional().nullable(),
  startNumber: z.number().int().min(1).max(9999).optional().nullable(),
});

const passportMissionQrTypes = [
  "POINT_BATTLE_QR",
  "CLUE_CHAIN_QR",
  "COOPERATIVE_MISSION_QR",
  "RECOVERY_SMART_QR",
] as const;

const missionQrBodySchema = z.object({
  missionId: z.number().int().min(1),
  type: z.enum(passportMissionQrTypes),
  label: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).optional().nullable(),
  cooperativeThreshold: z.number().int().min(2).max(20).optional().nullable(),
  active: z.boolean().optional(),
  maxScans: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

const adminMissionQrSchema = z.object({
  id: z.number(),
  token: z.string(),
  type: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  missionId: z.number().nullable(),
  missionTitle: z.string().nullable(),
  validationUrl: z.string(),
  qrImageUrl: z.string(),
  active: z.boolean(),
  maxScans: z.number().nullable(),
  expiresAt: z.string().nullable(),
  scansCount: z.number(),
  createdAt: z.string(),
});

const passportAdminOverviewSchema = z.object({
  participants: z.number(),
  activePlayers: z.number(),
  totalScans: z.number(),
  totalPoints: z.number(),
  missions: z.array(
    z.object({
      id: z.number(),
      key: z.string(),
      type: z.string(),
      title: z.string(),
      points: z.number(),
      active: z.boolean(),
      scansCount: z.number(),
      ledgerCount: z.number(),
    }),
  ),
  leaderboard: z.array(
    z.object({
      position: z.number(),
      studentNumber: z.string(),
      studentName: z.string().nullable(),
      studentCourse: z.string().nullable(),
      points: z.number(),
    }),
  ),
});

const passportAdminReportsSchema = z.object({
  ranking: z.array(passportLeaderboardRowSchema),
  rankingFrozen: z
    .object({
      id: z.number(),
      frozenAt: z.string(),
      frozenByStudentNumber: z.string().nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
  byCourse: z.array(
    z.object({
      course: z.string(),
      participants: z.number(),
      points: z.number(),
    }),
  ),
  byMissionType: z.array(
    z.object({
      type: z.string(),
      title: z.string(),
      points: z.number(),
      entries: z.number(),
    }),
  ),
  byPeriod: z.array(
    z.object({
      date: z.string(),
      points: z.number(),
      scans: z.number(),
    }),
  ),
  attendanceByActivity: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      scans: z.number(),
      uniqueStudents: z.number(),
    }),
  ),
  visitorsByExhibitor: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      scans: z.number(),
      uniqueStudents: z.number(),
    }),
  ),
  operational: z.object({
    scansPerMinuteLast15m: z.number(),
    suspiciousScans: z.number(),
    burstStudents: z.array(
      z.object({
        studentNumber: z.string(),
        scansLast15m: z.number(),
      }),
    ),
  }),
});

const passportAdminLogsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      studentNumber: z.string(),
      studentName: z.string().nullable(),
      studentCourse: z.string().nullable(),
      missionKey: z.string().nullable(),
      missionType: z.string().nullable(),
      missionTitle: z.string().nullable(),
      qrActionId: z.number().nullable(),
      qrActionType: z.string().nullable(),
      qrActionLabel: z.string().nullable(),
      result: z.string(),
      reviewStatus: z.string(),
      pointsAwarded: z.number(),
      message: z.string().nullable(),
      metadata: z.record(z.string(), jsonValueSchema).nullable(),
      scannedAt: z.string(),
      reviewedAt: z.string().nullable(),
      reviewedByStudentNumber: z.string().nullable(),
      reviewNote: z.string().nullable(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  totalPages: z.number(),
});

const passportRecalculateResponseSchema = z.object({
  overview: passportAdminOverviewSchema,
  reports: passportAdminReportsSchema,
});

const passportRankingFreezeSchema = z.object({
  id: z.number(),
  active: z.boolean(),
  note: z.string().nullable(),
  frozenAt: z.string(),
  frozenByStudentNumber: z.string().nullable(),
});

const passportWinnerSchema = passportLeaderboardRowSchema.extend({
  prize: z.string(),
});

const passportReviewResponseSchema = z.object({
  id: z.number(),
  reviewStatus: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedByStudentNumber: z.string().nullable(),
  reviewNote: z.string().nullable(),
});

const passportLedgerRevokeResponseSchema = z.object({
  id: z.number(),
  status: z.string(),
  revokedAt: z.string().nullable(),
  revokedByStudentNumber: z.string().nullable(),
  revokeReason: z.string().nullable(),
});

const passportAdminLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(30),
  search: z.string().trim().max(120).optional(),
  result: z.string().trim().max(80).optional(),
  reviewStatus: z.enum(["AUTO", "OK", "SUSPECT", "REJECTED"]).optional(),
});

const passportReviewBodySchema = z.object({
  reviewStatus: z.enum(["AUTO", "OK", "SUSPECT", "REJECTED"]),
  note: z.string().trim().max(500).optional().nullable(),
});

const passportFreezeBodySchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});

const adminDangerConfirmationSchema = z.object({
  success: z.literal(true),
  operation: z.string(),
  phone: z.string(),
  codeLast4: z.string(),
  expiresAt: z.string(),
});

const passportResetConfirmBodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  confirmationText: z.string().trim(),
});

const passportResetResultSchema = z.object({
  challengeAnswersDeleted: z.number(),
  surpriseEffectsDeleted: z.number(),
  scansDeleted: z.number(),
  studentBadgesDeleted: z.number(),
  rankingFreezesDeleted: z.number(),
  pointLedgerDeleted: z.number(),
  qrActionScansDeleted: z.number(),
});

const passportRevokeLedgerBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const adminSurpriseQrSchema = z.object({
  id: z.number(),
  qrActionId: z.number(),
  token: z.string(),
  validationUrl: z.string(),
  qrImageUrl: z.string(),
  qrActionType: z.string(),
  displayCode: z.string().nullable(),
  batchCode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  effectType: z.string(),
  effectValue: z.number(),
  dynamicRules: z.record(z.string(), jsonValueSchema).nullable(),
  targetScope: z.string(),
  rarity: z.string(),
  visibility: z.string(),
  maxUsesTotal: z.number().nullable(),
  maxUsesPerStudent: z.number(),
  negativeCapPerStudent: z.number().nullable(),
  active: z.boolean(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  printedAt: z.string().nullable(),
  effectsCount: z.number(),
  createdAt: z.string(),
});

const adminSurpriseQrBatchSchema = z.object({
  batchCode: z.string(),
  quantity: z.number(),
  items: z.array(adminSurpriseQrSchema),
});

function serializeMission(mission: {
  id: number;
  key: string;
  type: string;
  title: string;
  description: string | null;
  points: number;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  targetType: string | null;
  targetId: number | null;
  targetKey: string | null;
}) {
  return {
    id: mission.id,
    key: mission.key,
    type: mission.type,
    title: mission.title,
    description: mission.description,
    points: mission.points,
    active: mission.active,
    startsAt: mission.startsAt?.toISOString() ?? null,
    endsAt: mission.endsAt?.toISOString() ?? null,
    targetType: mission.targetType,
    targetId: mission.targetId,
    targetKey: mission.targetKey,
  };
}

function parseOptions(optionsJson?: string | null) {
  if (!optionsJson) return null;
  try {
    const parsed = JSON.parse(optionsJson) as unknown;
    if (!Array.isArray(parsed)) return null;
    const options = parsed.filter(
      (item): item is string => typeof item === "string",
    );
    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

function serializeAdminChallenge(challenge: {
  id: number;
  missionId: number | null;
  qrActionId: number | null;
  type: string;
  question: string;
  optionsJson: string | null;
  explanation: string | null;
  maxAttempts: number;
  active: boolean;
  status?: string | null;
  reviewNote?: string | null;
  version?: number | null;
  approvedAt?: Date | null;
  approvedByStudentNumber?: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  mission?: { title: string; points: number } | null;
  qrAction?: { label: string; type: string } | null;
  _count?: { answers: number };
}) {
  return {
    id: challenge.id,
    missionId: challenge.missionId,
    missionTitle: challenge.mission?.title ?? null,
    missionPoints: challenge.mission?.points ?? null,
    qrActionId: challenge.qrActionId,
    qrActionLabel: challenge.qrAction?.label ?? null,
    qrActionType: challenge.qrAction?.type ?? null,
    type: challenge.type,
    question: challenge.question,
    options: parseOptions(challenge.optionsJson),
    explanation: challenge.explanation,
    maxAttempts: challenge.maxAttempts,
    active: challenge.active,
    status: challenge.status ?? (challenge.active ? "APPROVED" : challenge.approvedAt ? "PAUSED" : "PENDING_APPROVAL"),
    reviewNote: challenge.reviewNote ?? null,
    version: challenge.version ?? 1,
    approvedAt: challenge.approvedAt?.toISOString() ?? null,
    approvedByStudentNumber: challenge.approvedByStudentNumber ?? null,
    pendingApproval: (challenge.status ?? null) === "PENDING_APPROVAL" || (!challenge.active && !challenge.approvedAt),
    startsAt: challenge.startsAt?.toISOString() ?? null,
    endsAt: challenge.endsAt?.toISOString() ?? null,
    answersCount: challenge._count?.answers ?? 0,
    createdAt: challenge.createdAt.toISOString(),
  };
}

function serializeOwnedProjectChallenge(
  env: Env,
  item: {
    submission: { id: number; name: string; type: string };
    status: string;
    qrAction: { id: number; token: string } | null;
    challenge: {
      id: number;
      question: string;
      optionsJson: string | null;
      explanation: string | null;
      maxAttempts: number;
      active: boolean;
      status?: string | null;
      reviewNote?: string | null;
      version?: number | null;
      approvedAt: Date | null;
      approvedByStudentNumber: string | null;
      createdAt: Date;
    } | null;
    answersCount: number;
  },
) {
  const challenge = item.challenge;
  return {
    submissionId: item.submission.id,
    submissionName: item.submission.name,
    submissionType: item.submission.type,
    status: item.status,
    qrActionId: item.qrAction?.id ?? null,
    validationUrl: item.qrAction
      ? buildValidationUrl(env, item.qrAction.token)
      : null,
    qrImageUrl: item.qrAction
      ? buildValidationQrUrl(env, item.qrAction.token)
      : null,
    challenge: challenge
      ? {
          id: challenge.id,
          question: challenge.question,
          options: parseOptions(challenge.optionsJson),
          explanation: challenge.explanation,
          maxAttempts: challenge.maxAttempts,
          active: challenge.active,
          status: challenge.status ?? (challenge.active ? "APPROVED" : challenge.approvedAt ? "PAUSED" : "PENDING_APPROVAL"),
          reviewNote: challenge.reviewNote ?? null,
          version: challenge.version ?? 1,
          approvedAt: challenge.approvedAt?.toISOString() ?? null,
          approvedByStudentNumber: challenge.approvedByStudentNumber ?? null,
          answersCount: item.answersCount,
          createdAt: challenge.createdAt.toISOString(),
        }
      : null,
  };
}

function serializeAdminSurpriseQr(
  env: Env,
  surprise: {
    id: number;
    qrActionId: number;
    displayCode: string | null;
    batchCode: string | null;
    name: string;
    description: string | null;
    effectType: string;
    effectValue: number;
    dynamicRulesJson: string | null;
    targetScope: string;
    rarity: string;
    visibility: string;
    maxUsesTotal: number | null;
    maxUsesPerStudent: number;
    negativeCapPerStudent: number | null;
    active: boolean;
    startsAt: Date | null;
    endsAt: Date | null;
    printedAt: Date | null;
    createdAt: Date;
    qrAction?: { token: string; type: string; active: boolean } | null;
    _count?: { effects: number };
  },
) {
  const token = surprise.qrAction?.token ?? "";
  return {
    id: surprise.id,
    qrActionId: surprise.qrActionId,
    token,
    validationUrl: token ? buildValidationUrl(env, token) : "",
    qrImageUrl: token ? buildValidationQrUrl(env, token) : "",
    qrActionType: surprise.qrAction?.type ?? "",
    displayCode: surprise.displayCode,
    batchCode: surprise.batchCode,
    name: surprise.name,
    description: surprise.description,
    effectType: surprise.effectType,
    effectValue: surprise.effectValue,
    dynamicRules: parseJsonRecord(surprise.dynamicRulesJson),
    targetScope: surprise.targetScope,
    rarity: surprise.rarity,
    visibility: surprise.visibility,
    maxUsesTotal: surprise.maxUsesTotal,
    maxUsesPerStudent: surprise.maxUsesPerStudent,
    negativeCapPerStudent: surprise.negativeCapPerStudent,
    active: surprise.active && (surprise.qrAction?.active ?? true),
    startsAt: surprise.startsAt?.toISOString() ?? null,
    endsAt: surprise.endsAt?.toISOString() ?? null,
    printedAt: surprise.printedAt?.toISOString() ?? null,
    effectsCount: surprise._count?.effects ?? 0,
    createdAt: surprise.createdAt.toISOString(),
  };
}

function parseJsonRecord(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function serializeAdminMissionQr(
  env: Env,
  action: {
    id: number;
    token: string;
    type: string;
    label: string;
    description: string | null;
    passportMissionId: number | null;
    active: boolean;
    maxScans: number | null;
    expiresAt: Date | null;
    createdAt: Date;
    passportMission?: { title: string } | null;
    _count?: { scans: number };
  },
) {
  return {
    id: action.id,
    token: action.token,
    type: action.type,
    label: action.label,
    description: action.description,
    missionId: action.passportMissionId,
    missionTitle: action.passportMission?.title ?? null,
    validationUrl: buildValidationUrl(env, action.token),
    qrImageUrl: buildValidationQrUrl(env, action.token),
    active: action.active,
    maxScans: action.maxScans,
    expiresAt: action.expiresAt?.toISOString() ?? null,
    scansCount: action._count?.scans ?? 0,
    createdAt: action.createdAt.toISOString(),
  };
}

function serializePassportRecovery(recovery: {
  id: number;
  studentNumber: string;
  studentName: string | null;
  phone: string | null;
  amountKz: number;
  requestedPoints: number;
  awardedPoints: number;
  status: string;
  paymentReference: string | null;
  paymentProofUrl: string | null;
  note: string | null;
  reviewedByStudentNumber: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: recovery.id,
    studentNumber: recovery.studentNumber,
    studentName: recovery.studentName,
    phone: recovery.phone,
    amountKz: recovery.amountKz,
    requestedPoints: recovery.requestedPoints,
    awardedPoints: recovery.awardedPoints,
    status: recovery.status,
    paymentReference: recovery.paymentReference,
    paymentProofUrl: recovery.paymentProofUrl,
    note: recovery.note,
    reviewedByStudentNumber: recovery.reviewedByStudentNumber,
    reviewedAt: recovery.reviewedAt?.toISOString() ?? null,
    createdAt: recovery.createdAt.toISOString(),
  };
}

async function passportPointBalanceForNotification(studentNumber: string) {
  const aggregate = await prisma.passportPointLedger.aggregate({
    where: { studentNumber, status: "VALID" },
    _sum: { points: true },
  });
  return aggregate._sum.points ?? 0;
}

function surpriseQrPdfTheme() {
  return {
    emoji: "?",
    label: "QR Surpresa",
    tone: "Escaneia para revelar o efeito no Passaporte Digital.",
    accent: "#22c55e",
    glow: "rgba(34,197,94,.24)",
  };
}

async function renderSurpriseQrPdf(
  env: Env,
  surprise: {
    name: string;
    displayCode?: string | null;
    description: string | null;
    effectType: string;
    effectValue: number;
    rarity: string;
    visibility: string;
    maxUsesPerStudent: number;
    qrAction: { token: string; active: boolean };
  },
) {
  const validationUrl = buildValidationUrl(env, surprise.qrAction.token);
  const [qrDataUri, logoDataUri] = await Promise.all([
    renderQrDataUri(validationUrl, 720),
    loadLogoDataUri(),
  ]);
  const theme = surpriseQrPdfTheme();

  const html = `<!doctype html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8" />
  <title>QR Surpresa · UOR Connect</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 210mm; min-height: 297mm; font-family: Arial, Helvetica, sans-serif; color: #fff; background: #07090f; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .sheet { position: relative; min-height: 297mm; overflow: hidden; padding: 18mm; background: radial-gradient(circle at 50% 28%, ${theme.glow}, transparent 34%), linear-gradient(145deg, #05070c 0%, #111827 50%, #05070c 100%); }
    .sheet::before { content: ""; position: absolute; inset: 10mm; border: .35mm solid rgba(255,255,255,.08); border-radius: 9mm; }
    .sheet::after { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px); background-size: 9mm 9mm; mask-image: radial-gradient(circle at center, #000 0%, transparent 72%); }
    .poster { position: relative; z-index: 1; min-height: 261mm; display: grid; grid-template-rows: auto 1fr auto; gap: 11mm; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8mm; }
    .brand { display: flex; align-items: center; gap: 4mm; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78); }
    .brand img { max-width: 38mm; max-height: 12mm; object-fit: contain; filter: brightness(0) invert(1); }
    .status { border: .3mm solid rgba(255,255,255,.16); border-radius: 999px; padding: 2.4mm 5mm; color: ${theme.accent}; background: rgba(255,255,255,.06); font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .center { display: grid; place-items: center; text-align: center; }
    .emoji { width: 30mm; height: 30mm; display: grid; place-items: center; margin: 0 auto 6mm; border: .35mm solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(255,255,255,.08); box-shadow: 0 0 24mm ${theme.glow}; font-size: 42px; }
    .label { margin: 0; color: ${theme.accent}; font-size: 13px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 4mm auto 0; max-width: 150mm; font-size: 42px; line-height: 1.02; font-weight: 950; }
    .desc { margin: 5mm auto 0; max-width: 128mm; color: rgba(255,255,255,.68); font-size: 15px; line-height: 1.5; }
    .qr-wrap { width: 92mm; height: 92mm; margin: 11mm auto 0; display: grid; place-items: center; border-radius: 8mm; background: #fff; border: 1.4mm solid ${theme.accent}; box-shadow: 0 12mm 42mm rgba(0,0,0,.45), 0 0 25mm ${theme.glow}; }
    .qr-wrap img { width: 78mm; height: 78mm; }
    .hint { margin: 6mm auto 0; max-width: 122mm; color: rgba(255,255,255,.74); font-size: 13px; font-weight: 800; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
    .box { min-height: 23mm; border: .3mm solid rgba(255,255,255,.12); border-radius: 4mm; padding: 4mm; background: rgba(255,255,255,.06); }
    .box span { display: block; color: rgba(255,255,255,.48); font-size: 8px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    .box strong { display: block; margin-top: 2mm; color: #fff; font-size: 13px; line-height: 1.2; }
    .url { margin-top: 5mm; color: rgba(255,255,255,.38); font-size: 8px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="poster">
      <header class="top">
        <div class="brand">${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : "UOR Connect"}</div>
        <div class="status">${surprise.qrAction.active ? "Ativo" : "Pausado"}</div>
      </header>
      <section class="center">
        <div>
          <div class="emoji">${theme.emoji}</div>
          <p class="label">${escapeHtml(surprise.displayCode ?? theme.label)}</p>
          <h1>QR Surpresa</h1>
          <p class="desc">${escapeHtml(theme.tone)}</p>
          <div class="qr-wrap"><img src="${qrDataUri}" alt="QR surpresa" /></div>
          <p class="hint">Escaneia no Passaporte Digital UOR Connect</p>
        </div>
      </section>
      <footer>
        <div class="meta">
          <div class="box"><span>Missão</span><strong>Caça aos QR</strong></div>
          <div class="box"><span>Código</span><strong>${escapeHtml(surprise.displayCode ?? "QR")}</strong></div>
          <div class="box"><span>Leitura</span><strong>Passaporte Digital</strong></div>
          <div class="box"><span>Resultado</span><strong>Revelado no telemóvel</strong></div>
        </div>
        <p class="url">${escapeHtml(validationUrl)}</p>
      </footer>
    </section>
  </main>
</body>
</html>`;

  return renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

async function renderSurpriseQrBatchPdf(
  env: Env,
  surprises: Array<{
    name: string;
    displayCode: string | null;
    qrAction: { token: string; active: boolean };
  }>,
) {
  const [logoDataUri, qrItems] = await Promise.all([
    loadLogoDataUri(),
    Promise.all(surprises.map(async (surprise) => ({
      ...surprise,
      validationUrl: buildValidationUrl(env, surprise.qrAction.token),
      qrDataUri: await renderQrDataUri(buildValidationUrl(env, surprise.qrAction.token), 280),
    }))),
  ]);

  const itemsPerQrPage = 9;
  const qrPages: Array<typeof qrItems> = [];
  for (let index = 0; index < qrItems.length; index += itemsPerQrPage) {
    qrPages.push(qrItems.slice(index, index + itemsPerQrPage));
  }

  const renderHeader = (title: string, subtitle: string) => `
    <header>
      <div>${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : "<h1>UOR Connect</h1>"}</div>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </div>
    </header>
  `;

  const renderQrPage = (items: typeof qrItems, pageNumber: number) => `
    <section class="page qr-page">
      ${renderHeader("Lote de QR surpresa", `${surprises.length} códigos numerados · página ${pageNumber}`)}
      <main class="grid">
        ${items.map((item) => `
          <article class="qr-card">
            <div class="code">${escapeHtml(item.displayCode ?? "QR")}</div>
            <img src="${item.qrDataUri}" alt="${escapeHtml(item.displayCode ?? item.name)}" />
            <strong>${escapeHtml(item.name)}</strong>
            <span>Passaporte Digital</span>
          </article>
        `).join("")}
      </main>
    </section>
  `;

  const renderExplanationPage = (pageNumber: number) => `
    <section class="page explanation-page">
      <div class="explanation-shell">
        <div class="explanation-brand">${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : "UOR Connect"}</div>
        <p class="eyebrow">Passaporte Digital UOR Connect</p>
        <h1>Encontraste um QR do Passaporte Digital</h1>
        <p class="lead">Entra em <strong>uorconnect.space</strong>, faz login, abre a Minha Área e participa no desafio.</p>
        <div class="steps">
          <div><span>1</span><strong>Faz login oficial</strong><small>Usa o teu acesso UOR/ISPTEC para entrar no sistema.</small></div>
          <div><span>2</span><strong>Escaneia os QR</strong><small>Cada código pode revelar pontos, pistas, bónus ou pequenos riscos.</small></div>
          <div><span>3</span><strong>Acompanha o ranking</strong><small>Os teus pontos aparecem na Minha Área com histórico auditável.</small></div>
        </div>
        <p class="notice">O efeito só aparece depois do scan. Repetir o mesmo QR pode não gerar novos pontos.</p>
        <p class="page-mark">Guia do desafio · página explicativa ${pageNumber}</p>
      </div>
    </section>
  `;

  const pages = qrPages.flatMap((items, index) => {
    const pageNumber = index + 1;
    const page = renderQrPage(items, pageNumber);
    if (pageNumber % 3 === 0) {
      return [page, renderExplanationPage(Math.floor(pageNumber / 3))];
    }
    return [page];
  }).join("");

  const html = `<!doctype html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8" />
  <title>Lote de QR Surpresa · UOR Connect</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { min-height: 277mm; break-after: page; page-break-after: always; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7mm; border-bottom: .35mm solid #e5e7eb; padding-bottom: 4mm; }
    header img { max-width: 34mm; max-height: 11mm; object-fit: contain; }
    header h1 { margin: 0; font-size: 18px; letter-spacing: .06em; text-transform: uppercase; }
    header p { margin: 1mm 0 0; color: #6b7280; font-size: 10px; text-align: right; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
    .qr-card { break-inside: avoid; min-height: 72mm; border: .35mm dashed #cbd5e1; border-radius: 4mm; padding: 4mm; display: grid; place-items: center; text-align: center; }
    .code { width: 100%; border-radius: 999px; background: #111827; color: #fff; padding: 1.8mm 3mm; font-size: 12px; font-weight: 900; letter-spacing: .12em; }
    .qr-card img { width: 42mm; height: 42mm; margin: 2mm auto; }
    .qr-card strong { display: block; max-width: 100%; font-size: 10px; line-height: 1.2; }
    .qr-card span { color: #64748b; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
    .explanation-page { display: grid; place-items: center; color: #fff; background: radial-gradient(circle at 78% 18%, rgba(249,115,22,.32), transparent 30%), linear-gradient(145deg, #05070c 0%, #111827 58%, #05070c 100%); margin: -10mm; padding: 18mm; min-height: 297mm; }
    .explanation-shell { width: 100%; min-height: 261mm; border: .35mm solid rgba(255,255,255,.12); border-radius: 8mm; padding: 13mm; display: grid; align-content: center; gap: 7mm; position: relative; overflow: hidden; }
    .explanation-shell::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 10mm 10mm; opacity: .45; }
    .explanation-shell > * { position: relative; z-index: 1; }
    .explanation-brand img { max-width: 42mm; max-height: 13mm; object-fit: contain; filter: brightness(0) invert(1); }
    .eyebrow { margin: 0; color: #fb923c; font-size: 11px; font-weight: 950; letter-spacing: .2em; text-transform: uppercase; }
    .explanation-page h1 { max-width: 150mm; margin: 0; font-size: 40px; line-height: 1.02; letter-spacing: -.01em; }
    .lead { max-width: 136mm; margin: 0; color: rgba(255,255,255,.78); font-size: 17px; line-height: 1.48; }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .steps div { min-height: 42mm; border: .3mm solid rgba(255,255,255,.13); border-radius: 5mm; background: rgba(255,255,255,.07); padding: 5mm; }
    .steps span { display: grid; place-items: center; width: 10mm; height: 10mm; border-radius: 999px; background: #f97316; color: #111827; font-size: 13px; font-weight: 950; }
    .steps strong { display: block; margin-top: 4mm; font-size: 14px; }
    .steps small { display: block; margin-top: 2mm; color: rgba(255,255,255,.68); font-size: 10px; line-height: 1.45; }
    .notice { margin: 0; border-left: 1mm solid #f97316; padding: 3mm 4mm; background: rgba(249,115,22,.12); color: rgba(255,255,255,.82); font-size: 13px; line-height: 1.45; }
    .page-mark { margin: 0; color: rgba(255,255,255,.42); font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;

  return renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

// renderChallengeManualPdf is imported from ./challenge-manual-pdf.ts

export async function passportRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.get(
    "/referrals/:code",
    {
      schema: {
        params: z.object({ code: z.string().trim().min(8).max(180) }),
        response: {
          200: passportReferralInviteSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { code: string };
      const invite = await resolvePassportReferralInvite({
        referralCode: params.code,
        secret: opts.env.JWT_SECRET,
      });
      if (!invite)
        return reply.code(404).send({ message: "Convite não encontrado." });
      return invite;
    },
  );

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.get(
      "/me",
      {
        schema: {
          response: {
            200: passportSummarySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const summary = await getPassportSummary(student.id, {
          referralSecret: opts.env.JWT_SECRET,
          publicAppUrl: opts.env.PUBLIC_APP_URL,
        });
        if (!summary)
          return reply.code(404).send({ message: "Estudante não encontrado." });
        return summary;
      },
    );

    protectedApp.post(
      "/me/recoveries",
      {
        schema: {
          body: passportRecoveryBodySchema,
          response: {
            200: passportRecoverySchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const body = passportRecoveryBodySchema.parse(request.body);
        try {
          const recovery = await requestPassportPointRecovery({
            studentId: student.id,
            ...body,
          });
          return serializePassportRecovery(recovery);
        } catch (error) {
          return reply.code(400).send({
            message: error instanceof Error
              ? error.message
              : "Não foi possível solicitar recuperação de pontos.",
          });
        }
      },
    );

    protectedApp.get(
      "/me/challenge-manual.pdf",
      {
        schema: {
          response: {
            401: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const fullStudent = await prisma.student.findUnique({
          where: { id: student.id },
          select: { name: true, studentNumber: true, course: true },
        });
        if (!fullStudent)
          return reply.code(404).send({ message: "Estudante não encontrado." });

        const pdf = await renderChallengeManualPdf(fullStudent, opts.env);
        reply
          .header("Content-Type", "application/pdf")
          .header(
            "Content-Disposition",
            'attachment; filename="manual-desafio-uor-connect.pdf"',
          );
        return reply.send(pdf);
      },
    );

    protectedApp.get(
      "/me/networking-qr",
      {
        schema: {
          response: {
            200: networkingQrSchema,
            401: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const result = await ensureNetworkingQrForStudent(student.id);
        if (!result)
          return reply.code(404).send({ message: "Estudante não encontrado." });

        return {
          token: result.qrAction.token,
          validationUrl: buildValidationUrl(opts.env, result.qrAction.token),
          qrImageUrl: buildValidationQrUrl(opts.env, result.qrAction.token),
          actionId: result.qrAction.id,
          label: result.qrAction.label,
        };
      },
    );

    protectedApp.get(
      "/me/project-challenges",
      {
        schema: {
          response: {
            200: z.array(ownedProjectChallengeSchema),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const challenges = await listOwnedProjectChallenges(student.id);
        return challenges.map((item) =>
          serializeOwnedProjectChallenge(opts.env, item),
        );
      },
    );

    protectedApp.post(
      "/me/project-challenges",
      {
        schema: {
          body: ownedProjectChallengeBodySchema,
          response: {
            200: ownedProjectChallengeSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const body = ownedProjectChallengeBodySchema.parse(request.body);
        try {
          const result = await createOrUpdateOwnedProjectChallenge({
            submissionId: body.submissionId,
            ownerStudentId: student.id,
            ownerStudentNumber: student.studentNumber,
            question: body.question,
            options: body.options,
            correctAnswer: body.correctAnswer,
            explanation: body.explanation ?? null,
            maxAttempts: body.maxAttempts ?? 1,
          });

          return serializeOwnedProjectChallenge(opts.env, {
            submission: result.submission,
            qrAction: result.qrAction,
            challenge: result.challenge,
            status: result.status,
            answersCount: 0,
          });
        } catch (error) {
          return reply
            .code(400)
            .send({
              message:
                error instanceof Error
                  ? error.message
                  : "Não foi possível guardar o desafio.",
            });
        }
      },
    );

    protectedApp.post(
      "/join",
      {
        schema: {
          body: passportJoinBodySchema.optional(),
          response: {
            200: z.object({
              joinedAt: z.string(),
              summary: passportSummarySchema,
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const body = passportJoinBodySchema
          .optional()
          .parse(request.body ?? {});
        if (body?.referralCode) {
          const invitee = await prisma.student.findUnique({
            where: { id: student.id },
            select: {
              academicSyncedAt: true,
              registrationSource: true,
              isUorStudent: true,
            },
          });

          if (!invitee)
            return reply.code(404).send({ message: "Estudante não encontrado." });

          if (!canAcceptPassportReferralInvite(invitee)) {
            return reply.code(403).send({
              message:
                "Este convite do desafio é exclusivo para estudantes UOR com sessão académica validada.",
            });
          }
        }

        const participationBusinessKey = `passport-participation:${student.studentNumber}`;
        const alreadyJoined = await prisma.passportPointLedger.findUnique({
          where: { businessKey: participationBusinessKey },
          select: { id: true },
        });

        const participation = await recordPassportParticipation({
          studentId: student.id,
          visitorId: body?.visitorId ?? null,
        });
        if (!participation)
          return reply.code(404).send({ message: "Estudante não encontrado." });

        if (!alreadyJoined && body?.referralCode) {
          await recordPassportReferralJoin({
            inviteeStudentId: student.id,
            referralCode: body.referralCode,
            secret: opts.env.JWT_SECRET,
            env: opts.env,
          });
        }

        const summary = await getPassportSummary(student.id, {
          referralSecret: opts.env.JWT_SECRET,
          publicAppUrl: opts.env.PUBLIC_APP_URL,
        });
        if (!summary)
          return reply.code(404).send({ message: "Estudante não encontrado." });

        if (!alreadyJoined && participation.points > 0) {
          try {
            const fullStudent = await prisma.student.findUnique({
              where: { id: student.id },
              select: { id: true, studentNumber: true, name: true, course: true, phone: true },
            });
            if (fullStudent) {
              await notifyPassportGameEvent(opts.env, {
                student: fullStudent,
                kind: "PASSPORT_POINTS_GAINED",
                deltaPoints: participation.points,
                currentPoints: summary.points,
                hint: "abre o mapa do desafio e procura os QR numerados da primeira ronda.",
              });
            }
          } catch (error) {
            request.log.warn({ err: error, studentId: student.id }, "passport participation game notification failed");
          }
        }

        return {
          joinedAt: participation.awardedAt.toISOString(),
          summary,
        };
      },
    );

    protectedApp.get(
      "/leaderboard",
      {
        schema: {
          querystring: z.object({
            limit: z.coerce.number().int().min(3).max(50).default(10),
          }),
          response: {
            200: z.array(passportLeaderboardRowSchema),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        if (!request.student)
          return reply.status(401).send({ message: "Unauthorized" });
        const query = request.query as { limit: number };
        return getPassportLeaderboard(query.limit);
      },
    );

    protectedApp.post(
      "/constructive-feedback",
      {
        config: {
          rateLimit: {
            max: 12,
            timeWindow: 60_000,
          },
        },
        schema: {
          body: constructiveFeedbackBodySchema,
          response: {
            200: constructiveFeedbackResponseSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const body = constructiveFeedbackBodySchema.parse(request.body);
        const result = await recordPassportConstructiveFeedback({
          studentId: student.id,
          submissionId: body.submissionId,
          content: body.content,
          focus: body.focus ?? null,
        });

        if (result.status === "INVALID_CONTENT")
          return reply.code(400).send({ message: result.message });
        if (result.status === "PASSPORT_NOT_JOINED" || result.status === "OWN_PROJECT" || result.status === "MISSION_UNAVAILABLE")
          return reply.code(403).send({ message: result.message });
        if (result.status === "STUDENT_NOT_FOUND" || result.status === "SUBMISSION_NOT_FOUND")
          return reply.code(404).send({ message: result.message });

        if (result.pointsAwarded !== 0) {
          try {
            const fullStudent = await prisma.student.findUnique({
              where: { id: student.id },
              select: { id: true, studentNumber: true, name: true, course: true, phone: true },
            });
            if (fullStudent) {
              const currentPoints = await passportPointBalanceForNotification(fullStudent.studentNumber);
              await notifyPassportGameEvent(opts.env, {
                student: fullStudent,
                kind: result.pointsAwarded > 0 ? "PASSPORT_POINTS_GAINED" : "PASSPORT_POINTS_LOST",
                deltaPoints: result.pointsAwarded,
                currentPoints,
                hint: "feedback construtivo tambem ajuda os expositores a melhorar a apresentacao.",
              });
            }
          } catch (error) {
            request.log.warn({ err: error, submissionId: body.submissionId }, "passport feedback game notification failed");
          }
        }

        return result;
      },
    );

    protectedApp.post(
      "/challenges/:id/answer",
      {
        schema: {
          params: z.object({ id: z.coerce.number().int().min(1) }),
          body: challengeAnswerBodySchema,
          response: {
            200: challengeAnswerResponseSchema,
            401: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const student = request.student;
        if (!student)
          return reply.status(401).send({ message: "Unauthorized" });

        const fullStudent = await prisma.student.findUnique({
          where: { id: student.id },
          select: { id: true, studentNumber: true, name: true, course: true, phone: true },
        });
        if (!fullStudent)
          return reply.code(404).send({ message: "Estudante não encontrado." });

        const params = request.params as { id: number };
        const body = challengeAnswerBodySchema.parse(request.body);
        const result = await answerPassportChallenge({
          challengeId: params.id,
          student: fullStudent,
          answer: body.answer,
        });
        if (result.status === "NOT_FOUND")
          return reply.code(404).send({ message: result.message });
        if (result.pointsAwarded !== 0) {
          try {
            const currentPoints = await passportPointBalanceForNotification(fullStudent.studentNumber);
            await notifyPassportGameEvent(opts.env, {
              student: fullStudent,
              kind: result.pointsAwarded > 0 ? "PASSPORT_POINTS_GAINED" : "PASSPORT_POINTS_LOST",
              deltaPoints: result.pointsAwarded,
              currentPoints,
              hint: result.correct
                ? "segue para a proxima etapa no mapa e procura um QR surpresa numerado."
                : "revê a pista no mapa antes da proxima tentativa.",
            });
          } catch (error) {
            request.log.warn({ err: error, challengeId: params.id }, "passport challenge game notification failed");
          }
        }
        return result;
      },
    );

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);
      setDefaultAdminPermission(adminApp, ["ATTENDANCE", "ANALYTICS"]);

      adminApp.get(
        "/admin/overview",
        {
          schema: {
            response: {
              200: passportAdminOverviewSchema,
            },
          },
        },
        async () => getPassportAdminOverview(),
      );

      adminApp.get(
        "/admin/missions",
        {
          schema: {
            response: {
              200: z.array(passportMissionSchema),
            },
          },
        },
        async () => {
          const missions = await listPassportMissions();
          return missions.map(serializeMission);
        },
      );

      adminApp.get(
        "/admin/challenges",
        {
          schema: {
            response: {
              200: z.array(adminChallengeSchema),
            },
          },
        },
        async () => {
          const challenges = await listPassportChallenges();
          return challenges.map(serializeAdminChallenge);
        },
      );

      adminApp.get(
        "/admin/surprise-qrs",
        {
          schema: {
            response: {
              200: z.array(adminSurpriseQrSchema),
            },
          },
        },
        async () => {
          const surprises = await listPassportSurpriseQrs();
          return surprises.map((item) =>
            serializeAdminSurpriseQr(opts.env, item),
          );
        },
      );

      adminApp.get(
        "/admin/recoveries",
        {
          schema: {
            response: {
              200: z.array(passportRecoverySchema),
            },
          },
        },
        async () => {
          const recoveries = await prisma.passportPointRecovery.findMany({
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            take: 200,
          });
          return recoveries.map(serializePassportRecovery);
        },
      );

      adminApp.patch(
        "/admin/recoveries/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            body: passportRecoveryReviewBodySchema,
            response: {
              200: passportRecoverySchema,
              400: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const params = request.params as { id: number };
          const body = passportRecoveryReviewBodySchema.parse(request.body);
          try {
            const recovery = await reviewPassportPointRecovery({
              id: params.id,
              status: body.status,
              note: body.note,
              actorStudentNumber: request.student?.studentNumber ?? null,
            });
            if (!recovery)
              return reply.code(404).send({ message: "Pedido de recuperação não encontrado." });
            return serializePassportRecovery(recovery);
          } catch (error) {
            return reply.code(400).send({
              message: error instanceof Error
                ? error.message
                : "Não foi possível rever a recuperação.",
            });
          }
        },
      );

      adminApp.get(
        "/admin/mission-qrs",
        {
          schema: {
            response: {
              200: z.array(adminMissionQrSchema),
            },
          },
        },
        async () => {
          const actions = await prisma.qrAction.findMany({
            where: { type: { in: [...passportMissionQrTypes] } },
            include: {
              passportMission: { select: { title: true } },
              _count: { select: { scans: true } },
            },
            orderBy: [{ active: "desc" }, { createdAt: "desc" }],
          });
          return actions.map((action) => serializeAdminMissionQr(opts.env, action));
        },
      );

      adminApp.get(
        "/admin/surprise-qrs/:id/pdf",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            response: {
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const params = request.params as { id: number };
          const surprise = await prisma.passportSurpriseQr.findUnique({
            where: { id: params.id },
            include: {
              qrAction: { select: { token: true, active: true } },
            },
          });
          if (!surprise)
            return reply
              .code(404)
              .send({ message: "QR surpresa não encontrado." });

          const pdf = await renderSurpriseQrPdf(opts.env, surprise);
          reply
            .header("Content-Type", "application/pdf")
            .header(
              "Content-Disposition",
              `attachment; filename="qr-surpresa-${surprise.id}.pdf"`,
            );
          return reply.send(pdf);
        },
      );

      adminApp.get(
        "/admin/surprise-qrs/batch/:batchCode/pdf",
        {
          schema: {
            params: z.object({ batchCode: z.string().trim().min(2).max(120) }),
            response: {
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const params = request.params as { batchCode: string };
          const surprises = await prisma.passportSurpriseQr.findMany({
            where: { batchCode: params.batchCode },
            include: {
              qrAction: { select: { token: true, active: true } },
            },
            orderBy: [{ displayCode: "asc" }, { id: "asc" }],
          });
          if (surprises.length === 0)
            return reply
              .code(404)
              .send({ message: "Lote de QR surpresa não encontrado." });

          const pdf = await renderSurpriseQrBatchPdf(opts.env, surprises);
          await prisma.passportSurpriseQr.updateMany({
            where: { batchCode: params.batchCode },
            data: { printedAt: new Date() },
          });
          reply
            .header("Content-Type", "application/pdf")
            .header(
              "Content-Disposition",
              `attachment; filename="qr-surpresa-lote-${params.batchCode}.pdf"`,
            );
          return reply.send(pdf);
        },
      );

      adminApp.get(
        "/admin/reports",
        {
          schema: {
            response: {
              200: passportAdminReportsSchema,
            },
          },
        },
        async () => getPassportAdminReports(),
      );

      adminApp.get(
        "/admin/logs",
        {
          schema: {
            querystring: passportAdminLogsQuerySchema,
            response: {
              200: passportAdminLogsResponseSchema,
            },
          },
        },
        async (request) => {
          const query = passportAdminLogsQuerySchema.parse(request.query);
          return listPassportAdminLogs(query);
        },
      );

      adminApp.post(
        "/admin/recalculate",
        {
          schema: {
            response: {
              200: passportRecalculateResponseSchema,
            },
          },
        },
        async (request) => {
          const [overview, reports] = await Promise.all([
            getPassportAdminOverview(),
            getPassportAdminReports(),
          ]);

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.ranking_recalculate",
            entityType: "PassportPointLedger",
            summary: "Ranking do Passaporte recalculado a partir do ledger.",
            metadata: {
              totalPoints: overview.totalPoints,
              participants: overview.participants,
            },
          });

          return { overview, reports };
        },
      );

      adminApp.post(
        "/admin/reset/request-confirmation",
        {
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
              operation: "PASSPORT_CHALLENGE_RESET",
              actorStudentNumber: request.student?.studentNumber ?? null,
            });
            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "passport.reset_confirmation_requested",
              entityType: "PassportPointLedger",
              summary: "Código SMS solicitado para reiniciar o desafio do Passaporte Digital.",
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
        "/admin/reset/confirm",
        {
          schema: {
            body: passportResetConfirmBodySchema,
            response: {
              200: passportResetResultSchema,
              400: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = passportResetConfirmBodySchema.parse(request.body);
          if (body.confirmationText !== "REINICIAR DESAFIO") {
            return reply.code(400).send({
              message: "Escreve REINICIAR DESAFIO para confirmar esta ação.",
            });
          }

          const verification = await verifyAdminSmsConfirmation({
            env: opts.env,
            operation: "PASSPORT_CHALLENGE_RESET",
            code: body.code,
          });
          if (!verification.ok) {
            return reply.code(400).send({ message: verification.message });
          }

          const result = await resetPassportChallengeProgress();
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.challenge_reset",
            entityType: "PassportPointLedger",
            summary: "Desafio do Passaporte Digital reiniciado com confirmação SMS.",
            metadata: result,
          });
          return result;
        },
      );

      adminApp.post(
        "/admin/ranking/freeze",
        {
          schema: {
            body: passportFreezeBodySchema,
            response: {
              200: passportRankingFreezeSchema,
            },
          },
        },
        async (request) => {
          const body = passportFreezeBodySchema.parse(request.body);
          const freeze = await freezePassportRanking({
            note: body.note,
            actorStudentNumber: request.student?.studentNumber ?? null,
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.ranking_freeze",
            entityType: "PassportRankingFreeze",
            entityId: freeze.id,
            summary:
              "Ranking do Passaporte congelado para anúncio de vencedores.",
            metadata: {
              note: freeze.note,
              frozenAt: freeze.frozenAt.toISOString(),
            },
          });

          return {
            id: freeze.id,
            active: freeze.active,
            note: freeze.note,
            frozenAt: freeze.frozenAt.toISOString(),
            frozenByStudentNumber: freeze.frozenByStudentNumber,
          };
        },
      );

      adminApp.get(
        "/admin/winners/export",
        {
          schema: {
            querystring: z.object({
              limit: z.coerce.number().int().min(1).max(100).default(10),
            }),
            response: {
              200: z.object({
                generatedAt: z.string(),
                winners: z.array(passportWinnerSchema),
              }),
            },
          },
        },
        async (request) => {
          const query = request.query as { limit: number };
          const winners = await exportPassportWinners(query.limit);

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.winners_export",
            entityType: "PassportPointLedger",
            summary: `Exportação de ${winners.length} vencedor(es) do Passaporte.`,
            metadata: { limit: query.limit, total: winners.length },
          });

          return { generatedAt: new Date().toISOString(), winners };
        },
      );

      adminApp.patch(
        "/admin/scans/:id/review",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            body: passportReviewBodySchema,
            response: {
              200: passportReviewResponseSchema,
            },
          },
        },
        async (request) => {
          const params = request.params as { id: number };
          const body = passportReviewBodySchema.parse(request.body);
          const scan = await reviewPassportScan({
            scanId: params.id,
            reviewStatus: body.reviewStatus,
            note: body.note,
            actorStudentNumber: request.student?.studentNumber ?? null,
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.scan_review",
            entityType: "PassportScan",
            entityId: scan.id,
            summary: `Scan do Passaporte marcado como ${scan.reviewStatus}.`,
            metadata: {
              note: scan.reviewNote,
              result: scan.result,
              studentNumber: scan.studentNumber,
            },
          });

          return {
            id: scan.id,
            reviewStatus: scan.reviewStatus,
            reviewedAt: scan.reviewedAt?.toISOString() ?? null,
            reviewedByStudentNumber: scan.reviewedByStudentNumber,
            reviewNote: scan.reviewNote,
          };
        },
      );

      adminApp.post(
        "/admin/ledger/:id/revoke",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            body: passportRevokeLedgerBodySchema,
            response: {
              200: passportLedgerRevokeResponseSchema,
            },
          },
        },
        async (request) => {
          const params = request.params as { id: number };
          const body = passportRevokeLedgerBodySchema.parse(request.body);
          const ledger = await revokePassportLedgerPoints({
            ledgerId: params.id,
            reason: body.reason,
            actorStudentNumber: request.student?.studentNumber ?? null,
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.ledger_revoke",
            entityType: "PassportPointLedger",
            entityId: ledger.id,
            summary: `Pontos do Passaporte revogados para ${ledger.studentNumber}.`,
            metadata: {
              points: ledger.points,
              reason: ledger.revokeReason,
              sourceType: ledger.sourceType,
              sourceId: ledger.sourceId,
            },
          });

          return {
            id: ledger.id,
            status: ledger.status,
            revokedAt: ledger.revokedAt?.toISOString() ?? null,
            revokedByStudentNumber: ledger.revokedByStudentNumber,
            revokeReason: ledger.revokeReason,
          };
        },
      );

      adminApp.post(
        "/admin/missions",
        {
          schema: {
            body: missionBodySchema,
            response: {
              200: passportMissionSchema,
              400: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = missionBodySchema.parse(request.body);
          const existing = await prisma.passportMission.findUnique({
            where: { key: body.key },
          });
          if (existing)
            return reply
              .code(400)
              .send({ message: "Já existe uma missão com esta chave." });

          const mission = await prisma.passportMission.create({
            data: {
              key: body.key,
              type: body.type,
              title: body.title,
              description: body.description ?? null,
              points: body.points,
              active: body.active ?? true,
              startsAt: body.startsAt ? new Date(body.startsAt) : null,
              endsAt: body.endsAt ? new Date(body.endsAt) : null,
              maxPointsPerStudent: body.maxPointsPerStudent ?? null,
              targetType: body.targetType ?? null,
              targetId: body.targetId ?? null,
              targetKey: body.targetKey ?? null,
              badgeKey: body.badgeKey ?? null,
            },
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.mission_create",
            entityType: "PassportMission",
            entityId: mission.id,
            summary: `Missão do Passaporte criada: ${mission.title}.`,
            metadata: {
              key: mission.key,
              type: mission.type,
              points: mission.points,
            },
          });

          return serializeMission(mission);
        },
      );

      adminApp.post(
        "/admin/challenges",
        {
          schema: {
            body: challengeBodySchema.extend({
              correctAnswer: z.string().trim().min(1).max(300),
            }),
            response: {
              200: adminChallengeSchema,
              400: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = challengeBodySchema
            .extend({
              correctAnswer: z.string().trim().min(1).max(300),
            })
            .parse(request.body);

          try {
            const challenge = await createPassportChallenge({
              ...body,
              createdByStudentNumber: request.student?.studentNumber ?? null,
              approvedByStudentNumber: request.student?.studentNumber ?? null,
            });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "passport.challenge_create",
              entityType: "PassportChallenge",
              entityId: challenge.id,
              summary: `Desafio do Passaporte criado: ${challenge.question.slice(0, 80)}.`,
              metadata: {
                type: challenge.type,
                missionId: challenge.missionId,
                qrActionId: challenge.qrActionId,
              },
            });

            const fullChallenge = await prisma.passportChallenge.findUnique({
              where: { id: challenge.id },
              include: {
                mission: { select: { title: true, points: true } },
                qrAction: { select: { label: true, type: true } },
                _count: { select: { answers: true } },
              },
            });
            return serializeAdminChallenge(
              fullChallenge ?? { ...challenge, _count: { answers: 0 } },
            );
          } catch (error) {
            return reply
              .code(400)
              .send({
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível criar o desafio.",
              });
          }
        },
      );

      adminApp.post(
        "/admin/surprise-qrs",
        {
          schema: {
            body: surpriseBodySchema,
            response: {
              200: adminSurpriseQrSchema,
              400: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = surpriseBodySchema.parse(request.body);

          try {
            const surprise = await createPassportSurpriseQr({
              ...body,
              createdByStudentNumber: request.student?.studentNumber ?? null,
            });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "passport.surprise_qr_create",
              entityType: "PassportSurpriseQr",
              entityId: surprise.id,
              summary: `QR surpresa criado: ${surprise.name}.`,
              metadata: {
                effectType: surprise.effectType,
                effectValue: surprise.effectValue,
                rarity: surprise.rarity,
              },
            });

            return serializeAdminSurpriseQr(opts.env, surprise);
          } catch (error) {
            return reply
              .code(400)
              .send({
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível criar o QR surpresa.",
              });
          }
        },
      );

      adminApp.post(
        "/admin/surprise-qrs/batch",
        {
          schema: {
            body: surpriseBatchBodySchema,
            response: {
              200: adminSurpriseQrBatchSchema,
              400: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = surpriseBatchBodySchema.parse(request.body);

          try {
            const batch = await createPassportSurpriseQrBatch({
              ...body,
              createdByStudentNumber: request.student?.studentNumber ?? null,
            });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "passport.surprise_qr_batch_create",
              entityType: "PassportSurpriseQr",
              entityId: batch.items[0]?.id ?? 0,
              summary: `Lote de QR surpresa criado: ${batch.batchCode} (${batch.quantity}).`,
              metadata: {
                batchCode: batch.batchCode,
                quantity: batch.quantity,
                effectType: body.effectType,
                effectValue: body.effectValue,
              },
            });

            return {
              batchCode: batch.batchCode,
              quantity: batch.quantity,
              items: batch.items.map((item) =>
                serializeAdminSurpriseQr(opts.env, item),
              ),
            };
          } catch (error) {
            return reply
              .code(400)
              .send({
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível criar o lote de QR surpresa.",
              });
          }
        },
      );

      adminApp.post(
        "/admin/mission-qrs",
        {
          schema: {
            body: missionQrBodySchema,
            response: {
              200: adminMissionQrSchema,
              400: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const body = missionQrBodySchema.parse(request.body);
          const mission = await prisma.passportMission.findUnique({
            where: { id: body.missionId },
          });
          if (!mission)
            return reply.code(404).send({ message: "Missão não encontrada." });

          const metadata = {
            mechanicType: body.type,
            cooperativeThreshold:
              body.type === "COOPERATIVE_MISSION_QR"
                ? body.cooperativeThreshold ?? 3
                : null,
          };
          const action = await prisma.qrAction.create({
            data: {
              token: createPassportQrActionToken(),
              type: body.type,
              label: body.label,
              description: body.description ?? null,
              targetMeta: JSON.stringify(metadata),
              eventKey: `passport:${body.type.toLowerCase()}:${mission.key}`,
              eventLabel: mission.title,
              passportMissionId: mission.id,
              active: body.active ?? true,
              maxScans: body.maxScans ?? null,
              expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            },
            include: {
              passportMission: { select: { title: true } },
              _count: { select: { scans: true } },
            },
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.mission_qr_create",
            entityType: "QrAction",
            entityId: action.id,
            summary: `QR de etapa criado: ${action.label}.`,
            metadata: {
              type: action.type,
              missionId: action.passportMissionId,
            },
          });

          return serializeAdminMissionQr(opts.env, action);
        },
      );

      adminApp.patch(
        "/admin/missions/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            body: missionBodySchema.partial().omit({ key: true }),
            response: {
              200: passportMissionSchema,
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const params = request.params as { id: number };
          const body = missionBodySchema
            .partial()
            .omit({ key: true })
            .parse(request.body);
          const existing = await prisma.passportMission.findUnique({
            where: { id: params.id },
          });
          if (!existing)
            return reply.code(404).send({ message: "Missão não encontrada." });

          const mission = await prisma.passportMission.update({
            where: { id: params.id },
            data: {
              ...(body.type !== undefined ? { type: body.type } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
              ...(body.description !== undefined
                ? { description: body.description ?? null }
                : {}),
              ...(body.points !== undefined ? { points: body.points } : {}),
              ...(body.active !== undefined ? { active: body.active } : {}),
              ...(body.startsAt !== undefined
                ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
                : {}),
              ...(body.endsAt !== undefined
                ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
                : {}),
              ...(body.maxPointsPerStudent !== undefined
                ? { maxPointsPerStudent: body.maxPointsPerStudent ?? null }
                : {}),
              ...(body.targetType !== undefined
                ? { targetType: body.targetType ?? null }
                : {}),
              ...(body.targetId !== undefined
                ? { targetId: body.targetId ?? null }
                : {}),
              ...(body.targetKey !== undefined
                ? { targetKey: body.targetKey ?? null }
                : {}),
              ...(body.badgeKey !== undefined
                ? { badgeKey: body.badgeKey ?? null }
                : {}),
            },
          });

          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber ?? "unknown",
            action: "passport.mission_update",
            entityType: "PassportMission",
            entityId: mission.id,
            summary: `Missão do Passaporte atualizada: ${mission.title}.`,
            metadata: {
              key: mission.key,
              type: mission.type,
              points: mission.points,
              active: mission.active,
            },
          });

          return serializeMission(mission);
        },
      );

      adminApp.patch(
        "/admin/surprise-qrs/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            body: surpriseBodySchema.partial(),
            response: {
              200: adminSurpriseQrSchema,
              400: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const params = request.params as { id: number };
          const body = surpriseBodySchema.partial().parse(request.body);

          try {
            const surprise = await updatePassportSurpriseQr(params.id, body);
            if (!surprise)
              return reply
                .code(404)
                .send({ message: "QR surpresa não encontrado." });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "passport.surprise_qr_update",
              entityType: "PassportSurpriseQr",
              entityId: surprise.id,
              summary: `QR surpresa atualizado: ${surprise.name}.`,
              metadata: {
                effectType: surprise.effectType,
                effectValue: surprise.effectValue,
                active: surprise.active,
              },
            });

            return serializeAdminSurpriseQr(opts.env, surprise);
          } catch (error) {
            return reply
              .code(400)
              .send({
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar o QR surpresa.",
              });
          }
        },
      );

      adminApp.patch(
        "/admin/challenges/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().min(1) }),
            body: challengeBodySchema.partial(),
            response: {
              200: adminChallengeSchema,
              400: z.object({ message: z.string() }),
              404: z.object({ message: z.string() }),
            },
          },
        },
        async (request, reply) => {
          const params = request.params as { id: number };
          const body = challengeBodySchema.partial().parse(request.body);

          try {
            const challenge = await updatePassportChallenge(params.id, {
              ...body,
              approvedByStudentNumber: request.student?.studentNumber ?? null,
            });
            if (!challenge)
              return reply
                .code(404)
                .send({ message: "Desafio não encontrado." });

            await recordAdminAudit({
              actorStudentNumber: request.student?.studentNumber ?? "unknown",
              action: "passport.challenge_update",
              entityType: "PassportChallenge",
              entityId: challenge.id,
              summary: `Desafio do Passaporte atualizado: ${challenge.question.slice(0, 80)}.`,
              metadata: {
                type: challenge.type,
                missionId: challenge.missionId,
                qrActionId: challenge.qrActionId,
                active: challenge.active,
              },
            });

            const fullChallenge = await prisma.passportChallenge.findUnique({
              where: { id: challenge.id },
              include: {
                mission: { select: { title: true, points: true } },
                qrAction: { select: { label: true, type: true } },
                _count: { select: { answers: true } },
              },
            });
            return serializeAdminChallenge(
              fullChallenge ?? { ...challenge, _count: { answers: 0 } },
            );
          } catch (error) {
            return reply
              .code(400)
              .send({
                message:
                  error instanceof Error
                    ? error.message
                    : "Não foi possível atualizar o desafio.",
              });
          }
        },
      );
    });
  });
}
