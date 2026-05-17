import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";

const DEFAULT_EVENT_KEY = "main-event";
const CONSTRUCTIVE_FEEDBACK_MISSION_KEY = "constructive-feedback";
const CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS = 3;
const CONSTRUCTIVE_FEEDBACK_POINTS_PER_PROJECT = 5;
const CONSTRUCTIVE_FEEDBACK_MIN_LENGTH = 60;
const CONSTRUCTIVE_FEEDBACK_MIN_WORDS = 8;

export const PASSPORT_QR_ACTION_TYPES = [
  "CHECKIN",
  "WORKSHOP_CHECKIN",
  "STAND_VISIT",
  "EXHIBITOR_VOTE",
  "EXHIBITOR_CHALLENGE",
  "NETWORKING_CROSS_COURSE",
  "NUCLEUS_MEMBER_BONUS",
  "SPECIAL_QUIZ",
  "FAIR_BONUS_QR",
  "FAIR_PENALTY_QR",
  "FAIR_MULTIPLIER_QR",
  "FAIR_DIVIDER_QR",
  "POINT_BATTLE_QR",
  "CLUE_CHAIN_QR",
  "COOPERATIVE_MISSION_QR",
  "RECOVERY_SMART_QR",
] as const;

export type PassportMissionStatus = "done" | "available" | "locked" | "expired";

type PassportCatalogMission = {
  key: string;
  type: string;
  title: string;
  description: string;
  points: number;
  active?: boolean;
};

type PassportCatalogBadge = {
  key: string;
  label: string;
  description: string;
  icon: string;
  ruleType: string;
  ruleValue: number;
};

type StudentContext = {
  id: number;
  studentNumber: string;
  name: string | null;
  course: string | null;
};

type QrActionContext = {
  id: number;
  type: string;
  label: string;
  targetId: number | null;
  targetMeta: string | null;
  eventKey: string | null;
  eventLabel: string | null;
  passportMissionId?: number | null;
};

type QrActionScanContext = {
  id: number;
  result: string;
  message: string | null;
  scannedAt: Date;
};

type PassportChallengeRecord = {
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
  version?: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type PassportChallengePublic = {
  id: number;
  type: string;
  question: string;
  options: string[] | null;
  maxAttempts: number;
  version: number;
  explanation: string | null;
};

const challengeQrActionTypes = new Set(["EXHIBITOR_CHALLENGE", "SPECIAL_QUIZ", "CLUE_CHAIN_QR"]);
const surpriseQrActionTypes = new Set(["FAIR_BONUS_QR", "FAIR_PENALTY_QR", "FAIR_MULTIPLIER_QR", "FAIR_DIVIDER_QR"]);

export const PASSPORT_SURPRISE_POINTS_CAP = 120;
export const PASSPORT_RECOVERY_PRICE_KZ = 300;
export const PASSPORT_RECOVERY_POINTS = 60;

export type PassportSurpriseConcreteEffectType =
  | "ADD_POINTS"
  | "SUBTRACT_POINTS"
  | "MULTIPLY_BONUS"
  | "DIVIDE_BONUS"
  | "NEUTRAL_HINT"
  | "RECOVERY_POINTS";

export type PassportSurpriseEffectType =
  | PassportSurpriseConcreteEffectType
  | "UNIVERSAL_DYNAMIC";

type PassportSurpriseEffectWeights = Partial<Record<PassportSurpriseConcreteEffectType, number>>;
type PassportSurpriseEffectValues = Partial<Record<PassportSurpriseConcreteEffectType, number>>;

type PassportSurpriseDynamicRules = {
  mode?: "UNIVERSAL_DYNAMIC" | null;
  weights?: PassportSurpriseEffectWeights | null;
  values?: PassportSurpriseEffectValues | null;
  lossAdjustment?: {
    afterLosses?: number | null;
    weights?: PassportSurpriseEffectWeights | null;
    values?: PassportSurpriseEffectValues | null;
  } | null;
  convertAfterLosses?: number | null;
  convertToEffectType?: PassportSurpriseEffectType | null;
  convertToEffectValue?: number | null;
  hintAfterLoss?: string | null;
};

type PassportSurpriseQrContext = {
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
};

export type PassportSurpriseReveal = {
  id: number;
  displayCode: string | null;
  name: string;
  description: string | null;
  effectType: string;
  effectValue: number;
  targetScope: string;
  rarity: string;
  visibility: string;
  beforePoints: number;
  afterPoints: number;
  deltaPoints: number;
  message: string;
};

const defaultPassportMissions: PassportCatalogMission[] = [
  {
    key: "accept-challenge",
    type: "PASSPORT_JOIN",
    title: "Aceitar o desafio",
    description: "Ativa o Passaporte Digital e entra oficialmente no ranking.",
    points: 10,
  },
  {
    key: "affiliate-invite",
    type: "PASSPORT_REFERRAL",
    title: "Convidar colegas",
    description: "Opcional: partilha o teu link e ganha 5 pontos por cada colega que entrar no desafio.",
    points: 5,
  },
  {
    key: "event-checkin",
    type: "EVENT_CHECKIN",
    title: "Entrada no evento",
    description: "QR principal da receção.",
    points: 10,
  },
  {
    key: "workshop-checkin",
    type: "WORKSHOP_CHECKIN",
    title: "Workshop ou palestra",
    description: "QR na entrada do auditório.",
    points: 20,
  },
  {
    key: "workshop-master-combo",
    type: "WORKSHOP_MASTER_COMBO",
    title: "Mestre dos workshops",
    description: "Participa em 2 workshops ou palestras validadas.",
    points: 15,
  },
  {
    key: "stand-visit",
    type: "STAND_VISIT",
    title: "Visita a stand",
    description: "QR do stand ou passe do expositor.",
    points: 10,
  },
  {
    key: "stand-explorer-combo",
    type: "STAND_EXPLORER_COMBO",
    title: "Explorador de stands",
    description: "Visita 3 stands ou projetos diferentes.",
    points: 15,
  },
  {
    key: "exhibitor-challenge",
    type: "EXHIBITOR_CHALLENGE",
    title: "Desafio do expositor",
    description: "Pergunta liberada pelo QR do expositor.",
    points: 15,
  },
  {
    key: CONSTRUCTIVE_FEEDBACK_MISSION_KEY,
    type: "PROJECT_CONSTRUCTIVE_FEEDBACK",
    title: "Crítica construtiva",
    description: "Dá críticas construtivas em 3 projetos diferentes. O expositor só recebe bónus depois da validação da organização.",
    points: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS * CONSTRUCTIVE_FEEDBACK_POINTS_PER_PROJECT,
  },
  {
    key: "cross-course-networking",
    type: "NETWORKING_CROSS_COURSE",
    title: "Networking intercurso",
    description: "QR pessoal de estudante de outro curso.",
    points: 10,
  },
  {
    key: "networking-triad-combo",
    type: "NETWORKING_TRIAD_COMBO",
    title: "Rede intercurso",
    description: "Valida networking com 3 estudantes de cursos diferentes.",
    points: 15,
  },
  {
    key: "nucleus-member-bonus",
    type: "NUCLEUS_MEMBER_BONUS",
    title: "Pontos Núcleo",
    description: "Passe oficial de membro do núcleo validado no Passaporte.",
    points: 10,
  },
  {
    key: "perfect-sequence-combo",
    type: "PERFECT_SEQUENCE_COMBO",
    title: "Sequência perfeita",
    description: "Visita stand, acerta desafio e faz networking em até 15 minutos.",
    points: 20,
  },
  {
    key: "balanced-explorer-combo",
    type: "BALANCED_EXPLORER_COMBO",
    title: "Explorador balanceado",
    description: "Pontos por visitar stands de áreas diferentes.",
    points: 15,
  },
  {
    key: "mentor-found-bonus",
    type: "MENTOR_FOUND_BONUS",
    title: "Mentor encontrado",
    description: "Pontos ao validar passe de membro estratégico do núcleo.",
    points: 15,
  },
  {
    key: "special-quiz",
    type: "SPECIAL_QUIZ",
    title: "Quiz especial",
    description: "Pergunta oficial liberada pela organização.",
    points: 15,
  },
  {
    key: "fair-surprise",
    type: "FAIR_SURPRISE_QR",
    title: "Caça aos QR",
    description: "QR surpresa espalhados pela feira.",
    points: 0,
  },
  {
    key: "point-battle",
    type: "POINT_BATTLE",
    title: "Batalha de pontos",
    description: "Disputa saudável por ranking, viradas e checkpoints oficiais da organização.",
    points: 0,
  },
  {
    key: "clue-chain",
    type: "CLUE_CHAIN",
    title: "Pistas encadeadas",
    description: "QR com pistas em sequência que abrem desafios ligados pela admin.",
    points: 10,
  },
  {
    key: "cooperative-mission",
    type: "COOPERATIVE_MISSION",
    title: "Missão cooperativa",
    description: "Pontos liberados quando o grupo mínimo valida o mesmo QR.",
    points: 20,
  },
  {
    key: "smart-recovery",
    type: "RECOVERY_SMART",
    title: "Recuperação inteligente",
    description: "QR de recuperação para estudantes que perderam pontos em QR surpresa.",
    points: 10,
  },
  {
    key: "journey-complete",
    type: "JOURNEY_COMPLETION",
    title: "Jornada completa",
    description: "Pontos quando as missões principais forem fechadas.",
    points: 30,
  },
];

const coreJourneyMissionKeys = [
  "event-checkin",
  "workshop-checkin",
  "stand-visit",
  "exhibitor-challenge",
  "cross-course-networking",
] as const;

const defaultPassportBadges: PassportCatalogBadge[] = [
  {
    key: "presence-confirmed",
    label: "Presença confirmada",
    description: "Fez check-in no evento.",
    icon: "MapPinCheck",
    ruleType: "MISSION_EVENT_CHECKIN",
    ruleValue: 1,
  },
  {
    key: "stand-explorer",
    label: "Explorador de Stands",
    description: "Visitou pelo menos 3 stands.",
    icon: "Rocket",
    ruleType: "MISSION_STAND_VISIT_COUNT",
    ruleValue: 3,
  },
  {
    key: "workshop-master",
    label: "Mestre dos Workshops",
    description: "Participou em 2 ou mais workshops/palestras.",
    icon: "CalendarClock",
    ruleType: "MISSION_WORKSHOP_CHECKIN_COUNT",
    ruleValue: 2,
  },
  {
    key: "cross-course-connector",
    label: "Conector Intercurso",
    description: "Validou networking com estudante de outro curso.",
    icon: "Network",
    ruleType: "MISSION_NETWORKING_CROSS_COURSE_COUNT",
    ruleValue: 1,
  },
  {
    key: "challenger",
    label: "Desafiante",
    description: "Concluiu desafio de expositor ou quiz.",
    icon: "Puzzle",
    ruleType: "MISSION_CHALLENGE_COUNT",
    ruleValue: 1,
  },
  {
    key: "constructive-critic",
    label: "Crítico Construtivo",
    description: "Deu críticas construtivas a 3 projetos diferentes.",
    icon: "FileText",
    ruleType: "MISSION_CONSTRUCTIVE_FEEDBACK_COUNT",
    ruleValue: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
  },
  {
    key: "surprise-hunter",
    label: "Caçador de QR",
    description: "Encontrou QR surpresa pela feira.",
    icon: "Sparkles",
    ruleType: "MISSION_FAIR_SURPRISE_COUNT",
    ruleValue: 1,
  },
  {
    key: "discreet-hunter",
    label: "Caçador Discreto",
    description: "Encontrou um QR surpresa secreto.",
    icon: "EyeOff",
    ruleType: "MISSION_SECRET_SURPRISE_COUNT",
    ruleValue: 1,
  },
  {
    key: "journey-complete",
    label: "Jornada completa",
    description: "Concluiu as missões principais.",
    icon: "Trophy",
    ruleType: "MISSION_JOURNEY_COMPLETION",
    ruleValue: 1,
  },
];

function normalizePassportText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-PT");
}

function normalizeCourseKey(value?: string | null) {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-PT");
  return normalized || null;
}

function hashPassportAnswer(value: string) {
  return createHash("sha256").update(normalizePassportText(value)).digest("hex");
}

function createQrActionToken() {
  return `qra_${randomUUID().replace(/-/g, "")}`;
}

export function createPassportQrActionToken() {
  return createQrActionToken();
}

function parseOptions(optionsJson?: string | null) {
  if (!optionsJson) return null;
  try {
    const parsed = JSON.parse(optionsJson) as unknown;
    if (!Array.isArray(parsed)) return null;
    const options = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

function serializePassportChallenge(challenge: PassportChallengeRecord): PassportChallengePublic {
  return {
    id: challenge.id,
    type: challenge.type,
    question: challenge.question,
    options: parseOptions(challenge.optionsJson),
    maxAttempts: challenge.maxAttempts,
    version: challenge.version ?? 1,
    explanation: challenge.explanation,
  };
}

export function isPassportChallengeQrActionType(type: string) {
  return challengeQrActionTypes.has(type);
}

export function isPassportSurpriseQrActionType(type: string) {
  return surpriseQrActionTypes.has(type);
}

export function defaultPassportMissionKeyForQrAction(type: string) {
  if (type === "CHECKIN") return "event-checkin";
  if (type === "WORKSHOP_CHECKIN") return "workshop-checkin";
  if (type === "STAND_VISIT" || type === "EXHIBITOR_VOTE") return "stand-visit";
  if (type === "EXHIBITOR_CHALLENGE") return "exhibitor-challenge";
  if (type === "NETWORKING_CROSS_COURSE") return "cross-course-networking";
  if (type === "NUCLEUS_MEMBER_BONUS") return "nucleus-member-bonus";
  if (type === "SPECIAL_QUIZ") return "special-quiz";
  if (isPassportSurpriseQrActionType(type)) return "fair-surprise";
  if (type === "POINT_BATTLE_QR") return "point-battle";
  if (type === "CLUE_CHAIN_QR") return "clue-chain";
  if (type === "COOPERATIVE_MISSION_QR") return "cooperative-mission";
  if (type === "RECOVERY_SMART_QR") return "smart-recovery";
  return null;
}

export async function ensurePassportCatalog() {
  const [missions, badges] = await Promise.all([
    Promise.all(defaultPassportMissions.map((mission) => (
      prisma.passportMission.upsert({
        where: { key: mission.key },
        update: {
          type: mission.type,
          title: mission.title,
          description: mission.description,
          points: mission.points,
          active: mission.active ?? true,
        },
        create: {
          key: mission.key,
          type: mission.type,
          title: mission.title,
          description: mission.description,
          points: mission.points,
          active: mission.active ?? true,
        },
      })
    ))),
    Promise.all(defaultPassportBadges.map((badge) => (
      prisma.passportBadge.upsert({
        where: { key: badge.key },
        update: {
          label: badge.label,
          description: badge.description,
          icon: badge.icon,
          ruleType: badge.ruleType,
          ruleValue: badge.ruleValue,
          active: true,
        },
        create: {
          key: badge.key,
          label: badge.label,
          description: badge.description,
          icon: badge.icon,
          ruleType: badge.ruleType,
          ruleValue: badge.ruleValue,
          active: true,
        },
      })
    ))),
  ]);

  return { missions, badges };
}

function sourceForQrAction(action: QrActionContext) {
  if (action.type === "CHECKIN") {
    return { sourceType: "EVENT", sourceId: action.eventKey || DEFAULT_EVENT_KEY };
  }

  if (action.type === "WORKSHOP_CHECKIN") {
    return {
      sourceType: "WORKSHOP",
      sourceId: action.targetId ? `agenda:${action.targetId}` : `qr:${action.id}`,
    };
  }

  if (action.type === "STAND_VISIT" || action.type === "EXHIBITOR_VOTE") {
    return {
      sourceType: "STAND",
      sourceId: action.targetId ? `submission:${action.targetId}` : `qr:${action.id}`,
    };
  }

  if (action.type === "EXHIBITOR_CHALLENGE") {
    return {
      sourceType: "EXHIBITOR_CHALLENGE",
      sourceId: action.targetId ? `challenge:${action.targetId}` : `qr:${action.id}`,
    };
  }

  if (action.type === "NETWORKING_CROSS_COURSE") {
    return {
      sourceType: "NETWORKING",
      sourceId: action.targetId ? `student:${action.targetId}` : `qr:${action.id}`,
    };
  }

  if (action.type === "NUCLEUS_MEMBER_BONUS") {
    const metadata = parsePassportMetadata(action.targetMeta);
    const credentialId = metadata && typeof metadata.credentialId === "number"
      ? metadata.credentialId
      : action.targetId;
    return {
      sourceType: "NUCLEUS_MEMBER",
      sourceId: credentialId ? `credential:${credentialId}` : `qr:${action.id}`,
    };
  }

  if (action.type === "SPECIAL_QUIZ") {
    return {
      sourceType: "SPECIAL_QUIZ",
      sourceId: action.targetId ? `quiz:${action.targetId}` : `qr:${action.id}`,
    };
  }

  return { sourceType: "QR_ACTION", sourceId: `qr:${action.id}` };
}

async function resolveMissionForQrAction(action: QrActionContext) {
  await ensurePassportCatalog();

  if (action.passportMissionId) {
    const explicitMission = await prisma.passportMission.findUnique({
      where: { id: action.passportMissionId },
    });
    if (explicitMission?.active) return explicitMission;
  }

  const missionKey = defaultPassportMissionKeyForQrAction(action.type);
  if (!missionKey) return null;

  return prisma.passportMission.findUnique({ where: { key: missionKey } });
}

function buildPassportPointBusinessKey(input: {
  studentNumber: string;
  missionKey: string;
  sourceType: string;
  sourceId: string;
}) {
  return [
    "passport-point",
    input.studentNumber,
    input.missionKey,
    input.sourceType,
    input.sourceId,
  ].join(":");
}

async function awardMissionPoints(input: {
  student: StudentContext;
  mission: { id: number; key: string; points: number; title: string };
  sourceType: string;
  sourceId: string;
  reason: string;
  points?: number;
  metadata?: Record<string, unknown>;
}) {
  const businessKey = buildPassportPointBusinessKey({
    studentNumber: input.student.studentNumber,
    missionKey: input.mission.key,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  });

  const existing = await prisma.passportPointLedger.findUnique({ where: { businessKey } });
  if (existing) {
    return { created: false, pointsAwarded: 0, ledger: existing };
  }

  const points = input.points ?? input.mission.points;
  const ledger = await prisma.passportPointLedger.create({
    data: {
      businessKey,
      studentId: input.student.id,
      studentNumber: input.student.studentNumber,
      studentName: input.student.name,
      studentCourse: input.student.course,
      missionId: input.mission.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      points,
      reason: input.reason,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  return { created: true, pointsAwarded: ledger.points, ledger };
}

type PassportReferralStatus =
  | "AWARDED"
  | "INVALID_REFERRAL"
  | "INVITER_NOT_FOUND"
  | "INVITEE_NOT_FOUND"
  | "INVITEE_NOT_UOR_STUDENT"
  | "SELF_REFERRAL"
  | "ALREADY_REFERRED"
  | "MISSION_UNAVAILABLE";

type PassportReferralSmsSender = (payload: {
  to: string;
  message: string;
}) => Promise<{ ok: boolean; providerMessageId?: string | null; error?: string | null }>;

function referralSignature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`passport-referral:${payload}`)
    .digest("base64url")
    .slice(0, 18);
}

export function canAcceptPassportReferralInvite(student: {
  academicSyncedAt?: Date | string | null;
  registrationSource?: string | null;
  isUorStudent?: boolean | null;
}) {
  const registrationSource = student.registrationSource?.trim().toUpperCase() ?? "";
  if (registrationSource === "CONVENTIONAL_SMS") return false;

  return Boolean(
    student.academicSyncedAt ||
      student.isUorStudent === true ||
      registrationSource.includes("SECRETARIA") ||
      registrationSource.includes("OFFICIAL") ||
      registrationSource.includes("IMPORT"),
  );
}

export function createPassportReferralCode(studentNumber: string, secret: string) {
  const payload = Buffer.from(studentNumber.trim(), "utf8").toString("base64url");
  return `${payload}.${referralSignature(payload, secret)}`;
}

export function parsePassportReferralCode(code: string | null | undefined, secret: string) {
  const [payload, signature] = code?.trim().split(".") ?? [];
  if (!payload || !signature) return null;
  const expected = referralSignature(payload, secret);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const studentNumber = Buffer.from(payload, "base64url").toString("utf8").trim();
    return studentNumber || null;
  } catch {
    return null;
  }
}

function normalizePassportReferralPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 12 && digits.startsWith("244")) return digits.slice(3);
  if (digits.length === 9) return digits;
  return null;
}

function normalizePassportSmsSender(value?: string | null) {
  const sender = value?.trim().toUpperCase() || "UOR CONNECT";
  return /^[A-Z0-9 _-]{3,16}$/.test(sender) ? sender : "UOR CONNECT";
}

async function sendPassportReferralMilestoneSms(env: Env, payload: { to: string; message: string }) {
  const token = env.OMBALA_API_TOKEN?.trim();
  if (!token) return { ok: false, error: "Integração SMS não configurada." };

  try {
    const response = await fetch(`${env.OMBALA_API_BASE_URL.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: normalizePassportSmsSender(env.OMBALA_SMS_DEFAULT_SENDER),
        to: payload.to,
        message: payload.message,
      }),
    });
    const raw = await response.text();
    let providerPayload: unknown = null;
    if (raw) {
      try {
        providerPayload = JSON.parse(raw);
      } catch {
        providerPayload = raw;
      }
    }
    const providerMessageId =
      providerPayload && typeof providerPayload === "object"
        ? String((providerPayload as Record<string, unknown>).id ?? (providerPayload as Record<string, unknown>).message_id ?? "")
        : null;
    return {
      ok: response.ok,
      providerMessageId: providerMessageId || null,
      error: response.ok ? null : `status ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha de rede ao enviar SMS.",
    };
  }
}

async function notifyPassportReferralMilestone(input: {
  referrer: StudentContext & {
    phone?: string | null;
    profileExtra?: { consentSms?: boolean | null } | null;
  };
  inviteCount: number;
  env?: Env;
  sendSms?: PassportReferralSmsSender;
}) {
  if (input.inviteCount <= 0 || input.inviteCount % 10 !== 0) return null;
  if (input.referrer.profileExtra?.consentSms === false) return null;
  const to = normalizePassportReferralPhone(input.referrer.phone);
  if (!to) return null;

  const milestone = input.inviteCount;
  const businessKey = `passport-referral-sms:${input.referrer.studentNumber}:${milestone}`;
  const alreadyNotified = await prisma.passportPointLedger.findUnique({
    where: { businessKey },
  });
  if (alreadyNotified) return null;

  const message = [
    `UOR Connect: +${milestone} pessoas ja entraram no desafio pelo teu link.`,
    "Continua a puxar a tua rede na feira.",
  ].join(" ");
  const sender = input.sendSms ?? (input.env ? ((payload) => sendPassportReferralMilestoneSms(input.env!, payload)) : null);
  if (!sender) return null;
  const result = await sender({ to, message });

  await prisma.passportPointLedger.upsert({
    where: { businessKey },
    update: {
      metadataJson: JSON.stringify({
        milestone,
        sent: result.ok,
        providerMessageId: result.providerMessageId ?? null,
        error: result.error ?? null,
      }),
    },
    create: {
      businessKey,
      studentId: input.referrer.id,
      studentNumber: input.referrer.studentNumber,
      studentName: input.referrer.name,
      studentCourse: input.referrer.course,
      missionId: null,
      sourceType: "PASSPORT_REFERRAL_SMS",
      sourceId: String(milestone),
      points: 0,
      reason: `SMS de marco de convite +${milestone}.`,
      metadataJson: JSON.stringify({
        milestone,
        sent: result.ok,
        providerMessageId: result.providerMessageId ?? null,
        error: result.error ?? null,
      }),
    },
  });

  return { milestone, sent: result.ok };
}

export async function resolvePassportReferralInvite(input: {
  referralCode: string;
  secret: string;
}) {
  const studentNumber = parsePassportReferralCode(input.referralCode, input.secret);
  if (!studentNumber) return null;
  const referrer = await prisma.student.findUnique({
    where: { studentNumber },
    select: { studentNumber: true, name: true, course: true },
  });
  if (!referrer) return null;
  return {
    code: input.referralCode,
    inviterStudentNumber: referrer.studentNumber,
    inviterName: referrer.name?.trim() || "um estudante UOR Connect",
    inviterCourse: referrer.course ?? null,
  };
}

export async function recordPassportReferralJoin(input: {
  inviteeStudentId: number;
  referralCode?: string | null;
  secret: string;
  env?: Env;
  sendSms?: PassportReferralSmsSender;
}): Promise<{ status: PassportReferralStatus; pointsAwarded: number; inviteCount?: number }> {
  const referrerStudentNumber = parsePassportReferralCode(input.referralCode, input.secret);
  if (!referrerStudentNumber) return { status: "INVALID_REFERRAL", pointsAwarded: 0 };

  const [invitee, referrer] = await Promise.all([
    prisma.student.findUnique({
      where: { id: input.inviteeStudentId },
      select: {
        id: true,
        studentNumber: true,
        name: true,
        course: true,
        academicSyncedAt: true,
        registrationSource: true,
        isUorStudent: true,
      },
    }),
    prisma.student.findUnique({
      where: { studentNumber: referrerStudentNumber },
      select: {
        id: true,
        studentNumber: true,
        name: true,
        course: true,
        phone: true,
        profileExtra: { select: { consentSms: true } },
      },
    }),
  ]);

  if (!invitee) return { status: "INVITEE_NOT_FOUND", pointsAwarded: 0 };
  if (!referrer) return { status: "INVITER_NOT_FOUND", pointsAwarded: 0 };
  if (!canAcceptPassportReferralInvite(invitee)) {
    return { status: "INVITEE_NOT_UOR_STUDENT", pointsAwarded: 0 };
  }
  if (invitee.studentNumber === referrer.studentNumber) {
    return { status: "SELF_REFERRAL", pointsAwarded: 0 };
  }

  const existingInviteeReferral = await prisma.passportPointLedger.findFirst({
    where: {
      sourceType: "PASSPORT_REFERRAL",
      sourceId: invitee.studentNumber,
      status: "VALID",
    },
  });
  if (existingInviteeReferral) {
    return { status: "ALREADY_REFERRED", pointsAwarded: 0 };
  }

  await ensurePassportCatalog();
  const mission = await prisma.passportMission.findUnique({
    where: { key: "affiliate-invite" },
  });
  if (!mission?.active) return { status: "MISSION_UNAVAILABLE", pointsAwarded: 0 };

  const awarded = await awardMissionPoints({
    student: referrer,
    mission,
    sourceType: "PASSPORT_REFERRAL",
    sourceId: invitee.studentNumber,
    reason: `Convite aceite por ${invitee.name ?? invitee.studentNumber}.`,
    metadata: {
      inviteeStudentNumber: invitee.studentNumber,
      inviteeName: invitee.name,
      inviteeCourse: invitee.course,
    },
  });
  if (!awarded.created) return { status: "ALREADY_REFERRED", pointsAwarded: 0 };

  const inviteCount = await prisma.passportPointLedger.count({
    where: {
      studentNumber: referrer.studentNumber,
      sourceType: "PASSPORT_REFERRAL",
      status: "VALID",
    },
  });
  await notifyPassportReferralMilestone({
    referrer,
    inviteCount,
    env: input.env,
    sendSms: input.sendSms,
  });

  return { status: "AWARDED", pointsAwarded: awarded.pointsAwarded, inviteCount };
}

function normalizeSurpriseEffectType(value: string): PassportSurpriseEffectType {
  if (
    value === "ADD_POINTS" ||
    value === "SUBTRACT_POINTS" ||
    value === "MULTIPLY_BONUS" ||
    value === "DIVIDE_BONUS" ||
    value === "NEUTRAL_HINT" ||
    value === "RECOVERY_POINTS" ||
    value === "UNIVERSAL_DYNAMIC"
  ) {
    return value;
  }
  throw new Error("Efeito de QR surpresa inválido.");
}

function normalizeConcreteSurpriseEffectType(value: string): PassportSurpriseConcreteEffectType {
  const normalized = normalizeSurpriseEffectType(value);
  if (normalized === "UNIVERSAL_DYNAMIC") return "ADD_POINTS";
  return normalized;
}

function qrActionTypeForSurpriseEffect(effectType: string) {
  if (effectType === "ADD_POINTS") return "FAIR_BONUS_QR";
  if (effectType === "SUBTRACT_POINTS") return "FAIR_PENALTY_QR";
  if (effectType === "MULTIPLY_BONUS") return "FAIR_MULTIPLIER_QR";
  if (effectType === "DIVIDE_BONUS") return "FAIR_DIVIDER_QR";
  return "FAIR_BONUS_QR";
}

function normalizeSurpriseRarity(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return ["COMMON", "RARE", "SECRET", "TEMPORARY"].includes(normalized ?? "") ? normalized! : "COMMON";
}

function normalizeSurpriseVisibility(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return ["VISIBLE", "SEMI_HIDDEN", "SECRET"].includes(normalized ?? "") ? normalized! : "VISIBLE";
}

function clampSurpriseEffectValue(effectType: PassportSurpriseEffectType, value: number) {
  const normalized = Number.isFinite(value) ? Math.round(value) : 0;
  if (effectType === "UNIVERSAL_DYNAMIC" || effectType === "NEUTRAL_HINT") {
    return Math.max(0, Math.min(500, normalized));
  }
  if (effectType === "MULTIPLY_BONUS" || effectType === "DIVIDE_BONUS") {
    return Math.max(2, Math.min(5, normalized || 2));
  }
  return Math.max(0, Math.min(500, normalized));
}

const universalSurpriseEffectTypes: PassportSurpriseConcreteEffectType[] = [
  "ADD_POINTS",
  "SUBTRACT_POINTS",
  "MULTIPLY_BONUS",
  "DIVIDE_BONUS",
  "NEUTRAL_HINT",
  "RECOVERY_POINTS",
];

const defaultUniversalSurpriseWeights: Record<PassportSurpriseConcreteEffectType, number> = {
  ADD_POINTS: 50,
  SUBTRACT_POINTS: 25,
  MULTIPLY_BONUS: 10,
  DIVIDE_BONUS: 10,
  NEUTRAL_HINT: 5,
  RECOVERY_POINTS: 0,
};

const defaultUniversalSurpriseValues: Record<PassportSurpriseConcreteEffectType, number> = {
  ADD_POINTS: 10,
  SUBTRACT_POINTS: 5,
  MULTIPLY_BONUS: 2,
  DIVIDE_BONUS: 2,
  NEUTRAL_HINT: 0,
  RECOVERY_POINTS: 10,
};

function parseSurpriseWeights(value: unknown): PassportSurpriseEffectWeights | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const weights: PassportSurpriseEffectWeights = {};
  for (const effectType of universalSurpriseEffectTypes) {
    const numeric = Number(record[effectType]);
    if (Number.isFinite(numeric)) {
      weights[effectType] = Math.max(0, Math.min(1000, Math.floor(numeric)));
    }
  }
  return Object.keys(weights).length > 0 ? weights : null;
}

function parseSurpriseValues(value: unknown): PassportSurpriseEffectValues | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const values: PassportSurpriseEffectValues = {};
  for (const effectType of universalSurpriseEffectTypes) {
    const numeric = Number(record[effectType]);
    if (Number.isFinite(numeric)) {
      values[effectType] = clampSurpriseEffectValue(effectType, numeric);
    }
  }
  return Object.keys(values).length > 0 ? values : null;
}

function normalizeSurpriseWeights(input?: PassportSurpriseEffectWeights | null) {
  if (!input) return null;
  const weights: PassportSurpriseEffectWeights = {};
  for (const effectType of universalSurpriseEffectTypes) {
    const numeric = Number(input[effectType]);
    if (Number.isFinite(numeric)) {
      weights[effectType] = Math.max(0, Math.min(1000, Math.floor(numeric)));
    }
  }
  return Object.keys(weights).length > 0 ? weights : null;
}

function normalizeSurpriseValues(input?: PassportSurpriseEffectValues | null) {
  if (!input) return null;
  const values: PassportSurpriseEffectValues = {};
  for (const effectType of universalSurpriseEffectTypes) {
    const numeric = Number(input[effectType]);
    if (Number.isFinite(numeric)) {
      values[effectType] = clampSurpriseEffectValue(effectType, numeric);
    }
  }
  return Object.keys(values).length > 0 ? values : null;
}

function parseSurpriseDynamicRules(value?: string | null): PassportSurpriseDynamicRules | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const convertAfterLosses = Number(record.convertAfterLosses);
    const convertToEffectType = typeof record.convertToEffectType === "string"
      ? normalizeSurpriseEffectType(record.convertToEffectType)
      : null;
    const convertToEffectValue = Number(record.convertToEffectValue);
    const lossAdjustmentRecord =
      record.lossAdjustment && typeof record.lossAdjustment === "object" && !Array.isArray(record.lossAdjustment)
        ? record.lossAdjustment as Record<string, unknown>
        : null;
    const lossAdjustmentAfterLosses = Number(lossAdjustmentRecord?.afterLosses);
    return {
      mode: record.mode === "UNIVERSAL_DYNAMIC" ? "UNIVERSAL_DYNAMIC" : null,
      weights: parseSurpriseWeights(record.weights),
      values: parseSurpriseValues(record.values),
      lossAdjustment: lossAdjustmentRecord
        ? {
            afterLosses: Number.isFinite(lossAdjustmentAfterLosses) && lossAdjustmentAfterLosses > 0
              ? Math.min(999, Math.floor(lossAdjustmentAfterLosses))
              : null,
            weights: parseSurpriseWeights(lossAdjustmentRecord.weights),
            values: parseSurpriseValues(lossAdjustmentRecord.values),
          }
        : null,
      convertAfterLosses: Number.isFinite(convertAfterLosses) && convertAfterLosses > 0
        ? Math.min(999, Math.floor(convertAfterLosses))
        : null,
      convertToEffectType,
      convertToEffectValue: Number.isFinite(convertToEffectValue) && convertToEffectValue > 0
        ? Math.min(500, Math.floor(convertToEffectValue))
        : null,
      hintAfterLoss: typeof record.hintAfterLoss === "string" ? record.hintAfterLoss.trim().slice(0, 240) : null,
    };
  } catch {
    return null;
  }
}

function normalizeSurpriseDynamicRules(input?: PassportSurpriseDynamicRules | null) {
  if (!input) return null;
  const weights = normalizeSurpriseWeights(input.weights);
  const values = normalizeSurpriseValues(input.values);
  const lossAdjustmentWeights = normalizeSurpriseWeights(input.lossAdjustment?.weights);
  const lossAdjustmentValues = normalizeSurpriseValues(input.lossAdjustment?.values);
  const lossAdjustmentAfterLosses = Number(input.lossAdjustment?.afterLosses);
  const hasUniversalRules = input.mode === "UNIVERSAL_DYNAMIC" || Boolean(weights) || Boolean(values) || Boolean(lossAdjustmentWeights);
  const normalized: PassportSurpriseDynamicRules = {};

  if (hasUniversalRules) {
    normalized.mode = "UNIVERSAL_DYNAMIC";
    if (weights) normalized.weights = weights;
    if (values) normalized.values = values;
    if (
      Number.isFinite(lossAdjustmentAfterLosses) &&
      lossAdjustmentAfterLosses > 0
    ) {
      normalized.lossAdjustment = {
        afterLosses: Math.max(1, Math.min(999, Math.floor(lossAdjustmentAfterLosses))),
        ...(lossAdjustmentWeights ? { weights: lossAdjustmentWeights } : {}),
        ...(lossAdjustmentValues ? { values: lossAdjustmentValues } : {}),
      };
    }
  }

  if (!input.convertAfterLosses) {
    return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : null;
  }

  const convertToEffectType = input.convertToEffectType ?? "ADD_POINTS";
  const convertToEffectValue = clampSurpriseEffectValue(
    convertToEffectType,
    input.convertToEffectValue ?? PASSPORT_RECOVERY_POINTS,
  );
  return JSON.stringify({
    ...normalized,
    convertAfterLosses: Math.max(1, Math.min(999, Math.floor(input.convertAfterLosses))),
    convertToEffectType,
    convertToEffectValue,
    ...(input.hintAfterLoss?.trim() ? { hintAfterLoss: input.hintAfterLoss.trim().slice(0, 240) } : {}),
  });
}

export function resolveDynamicSurpriseEffect(
  surprise: PassportSurpriseQrContext,
  stats: {
    lossCount: number;
    gainCount?: number;
    neutralCount?: number;
    studentLossCount?: number;
    qrActionScanId?: number;
    studentNumber?: string;
    scannedAt?: Date;
  },
) {
  const rules = parseSurpriseDynamicRules(surprise.dynamicRulesJson);
  const isUniversalDynamic = surprise.effectType === "UNIVERSAL_DYNAMIC" || rules?.mode === "UNIVERSAL_DYNAMIC";

  if (isUniversalDynamic) {
    const baseWeights = {
      ...defaultUniversalSurpriseWeights,
      ...(rules?.weights ?? {}),
    };
    let adjustedWeights = { ...baseWeights };
    let values = {
      ...defaultUniversalSurpriseValues,
      ...(rules?.values ?? {}),
    };
    const reasons = ["UNIVERSAL_DYNAMIC"];

    if (
      rules?.lossAdjustment?.afterLosses &&
      stats.lossCount >= rules.lossAdjustment.afterLosses
    ) {
      adjustedWeights = {
        ...adjustedWeights,
        ...(rules.lossAdjustment.weights ?? {}),
      };
      values = {
        ...values,
        ...(rules.lossAdjustment.values ?? {}),
      };
      reasons.push(`QR_LOSS_THRESHOLD_${rules.lossAdjustment.afterLosses}`);
    }

    if ((stats.studentLossCount ?? 0) >= 2) {
      adjustedWeights.SUBTRACT_POINTS = 0;
      reasons.push("STUDENT_LOSS_GUARD");
    }

    const totalWeight = universalSurpriseEffectTypes.reduce(
      (sum, effectType) => sum + Math.max(0, adjustedWeights[effectType] ?? 0),
      0,
    );
    const safeWeights = totalWeight > 0
      ? adjustedWeights
      : { ...defaultUniversalSurpriseWeights, SUBTRACT_POINTS: 0 };
    const safeTotalWeight = universalSurpriseEffectTypes.reduce(
      (sum, effectType) => sum + Math.max(0, safeWeights[effectType] ?? 0),
      0,
    );
    const seed = [
      "passport-surprise-universal-v1",
      surprise.id,
      surprise.displayCode ?? "",
      stats.studentNumber ?? "",
      stats.qrActionScanId ?? "",
      stats.scannedAt?.toISOString() ?? "",
      stats.lossCount,
      stats.gainCount ?? 0,
    ].join("|");
    const hash = createHash("sha256").update(seed).digest("hex");
    const randomRoll = safeTotalWeight > 0
      ? parseInt(hash.slice(0, 12), 16) % safeTotalWeight
      : 0;
    let cursor = 0;
    let selectedEffectType: PassportSurpriseConcreteEffectType = "ADD_POINTS";

    for (const effectType of universalSurpriseEffectTypes) {
      cursor += Math.max(0, safeWeights[effectType] ?? 0);
      if (randomRoll < cursor) {
        selectedEffectType = effectType;
        break;
      }
    }

    const effectValue = clampSurpriseEffectValue(
      selectedEffectType,
      values[selectedEffectType] ?? defaultUniversalSurpriseValues[selectedEffectType],
    );

    return {
      surprise: {
        ...surprise,
        effectType: selectedEffectType,
        effectValue,
      },
      dynamicActivated: true,
      rules,
      resolver: {
        resolverVersion: "universal-dynamic-v1",
        seed,
        randomRoll,
        baseWeights,
        adjustedWeights: safeWeights,
        selectedEffectType,
        reasons,
        qrStats: {
          lossCount: stats.lossCount,
          gainCount: stats.gainCount ?? 0,
          neutralCount: stats.neutralCount ?? 0,
        },
      },
    };
  }

  const shouldConvert = surprise.effectType === "SUBTRACT_POINTS"
    && Boolean(rules?.convertAfterLosses)
    && stats.lossCount >= Number(rules?.convertAfterLosses);

  if (!shouldConvert) {
    return { surprise, dynamicActivated: false, rules, resolver: null };
  }

  const effectType = rules?.convertToEffectType ?? "ADD_POINTS";
  const effectValue = clampSurpriseEffectValue(effectType, rules?.convertToEffectValue ?? PASSPORT_RECOVERY_POINTS);
  return {
    surprise: {
      ...surprise,
      effectType,
      effectValue,
    },
    dynamicActivated: true,
    rules,
    resolver: null,
  };
}

function surpriseMessage(input: {
  name: string;
  effectType: string;
  effectValue: number;
  beforePoints: number;
  afterPoints: number;
  deltaPoints: number;
}) {
  if (input.deltaPoints > 0) {
    return `Surpresa revelada: +${input.deltaPoints} pontos no Passaporte.`;
  }
  if (input.deltaPoints < 0) {
    return `Surpresa revelada: ${input.deltaPoints} pontos. Continuas na corrida.`;
  }
  return "Surpresa revelada: os teus pontos mantêm-se por agora.";
}

async function passportPointBalance(studentNumber: string) {
  const aggregate = await prisma.passportPointLedger.aggregate({
    where: {
      studentNumber,
      status: "VALID",
    },
    _sum: { points: true },
  });
  return aggregate._sum.points ?? 0;
}

async function negativeSurpriseTotal(studentNumber: string) {
  const aggregate = await prisma.passportSurpriseEffectLedger.aggregate({
    where: {
      studentNumber,
      deltaPoints: { lt: 0 },
      status: "VALID",
    },
    _sum: { deltaPoints: true },
  });
  return Math.abs(aggregate._sum.deltaPoints ?? 0);
}

function computeSurpriseEffect(input: {
  surprise: PassportSurpriseQrContext;
  beforePoints: number;
  previousNegativeTotal: number;
}) {
  const effectType = normalizeConcreteSurpriseEffectType(input.surprise.effectType);
  const effectValue = clampSurpriseEffectValue(effectType, input.surprise.effectValue);
  let afterPoints = input.beforePoints;

  if (effectType === "ADD_POINTS") {
    afterPoints = input.beforePoints + effectValue;
  } else if (effectType === "SUBTRACT_POINTS") {
    const cap = input.surprise.negativeCapPerStudent ?? effectValue;
    const remainingNegativeAllowance = Math.max(0, cap - input.previousNegativeTotal);
    const subtract = Math.min(effectValue, remainingNegativeAllowance);
    afterPoints = input.beforePoints - subtract;
  } else if (effectType === "MULTIPLY_BONUS") {
    afterPoints = input.beforePoints > 0 ? input.beforePoints * effectValue : input.beforePoints;
  } else if (effectType === "DIVIDE_BONUS") {
    afterPoints = input.beforePoints > 0 ? Math.floor(input.beforePoints / effectValue) : input.beforePoints;
  } else if (effectType === "RECOVERY_POINTS") {
    afterPoints = input.beforePoints < 0 ? Math.min(0, input.beforePoints + effectValue) : input.beforePoints;
  } else if (effectType === "NEUTRAL_HINT") {
    afterPoints = input.beforePoints;
  }

  return {
    effectType,
    effectValue,
    beforePoints: input.beforePoints,
    afterPoints,
    deltaPoints: afterPoints - input.beforePoints,
  };
}

function serializeSurpriseReveal(input: {
  surprise: PassportSurpriseQrContext;
  beforePoints: number;
  afterPoints: number;
  deltaPoints: number;
  message: string;
}): PassportSurpriseReveal {
  return {
    id: input.surprise.id,
    displayCode: input.surprise.displayCode,
    name: input.surprise.name,
    description: input.surprise.description,
    effectType: input.surprise.effectType,
    effectValue: input.surprise.effectValue,
    targetScope: input.surprise.targetScope,
    rarity: input.surprise.rarity,
    visibility: input.surprise.visibility,
    beforePoints: input.beforePoints,
    afterPoints: input.afterPoints,
    deltaPoints: input.deltaPoints,
    message: input.message,
  };
}

async function recordPassportScan(input: {
  student: StudentContext;
  missionId: number | null;
  action: QrActionContext;
  qrActionScan: QrActionScanContext;
  pointsAwarded: number;
  result: string;
  message: string | null;
  metadata?: Record<string, unknown>;
}) {
  const businessKey = `passport-scan:${input.qrActionScan.id}`;

  await prisma.passportScan.upsert({
    where: { businessKey },
    update: {
      result: input.result,
      pointsAwarded: input.pointsAwarded,
      message: input.message,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    create: {
      businessKey,
      studentId: input.student.id,
      studentNumber: input.student.studentNumber,
      studentName: input.student.name,
      studentCourse: input.student.course,
      missionId: input.missionId,
      qrActionId: input.action.id,
      qrActionScanId: input.qrActionScan.id,
      result: input.result,
      pointsAwarded: input.pointsAwarded,
      message: input.message,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      scannedAt: input.qrActionScan.scannedAt,
    },
  });
}

function parsePassportMetadata(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function textFromMetadata(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFromMetadata(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isStrategicNucleusRole(metadata: Record<string, unknown> | null) {
  const combined = [
    textFromMetadata(metadata, "memberRole"),
    textFromMetadata(metadata, "memberTeam"),
    textFromMetadata(metadata, "memberAccessLevel"),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT");

  return /\b(mentor|coordenador|coord|direcao|diretor|lider|estrategic|estrategico|admin)\b/.test(combined);
}

function challengeLifecycleStatus(challenge: {
  active: boolean;
  approvedAt?: Date | null;
  status?: string | null;
}) {
  if (challenge.status) return challenge.status;
  if (challenge.active) return "APPROVED";
  if (challenge.approvedAt) return "PAUSED";
  return "PENDING_APPROVAL";
}

async function getScoredChallengeSubmissionContext(challenge: {
  qrActionId: number | null;
  type: string;
}) {
  if (!challenge.qrActionId || challenge.type !== "EXHIBITOR_CHALLENGE") {
    return { submission: null, unavailable: false };
  }

  const qrAction = await prisma.qrAction.findUnique({
    where: { id: challenge.qrActionId },
    select: { targetId: true, targetMeta: true },
  });
  if (!qrAction?.targetId) return { submission: null, unavailable: false };

  const submission = await prisma.submission.findFirst({
    where: { id: qrAction.targetId, status: "APPROVED", deletedAt: null },
    select: {
      id: true,
      name: true,
      area: true,
      studentNumberSnapshot: true,
      student: { select: { studentNumber: true } },
      memberConfirmations: {
        where: { confirmedAt: { not: null } },
        select: { studentNumber: true },
      },
    },
  });

  return { submission, unavailable: !submission };
}

function submissionOwnerNumbers(submission: {
  studentNumberSnapshot?: string | null;
  student?: { studentNumber: string | null } | null;
  memberConfirmations?: Array<{ studentNumber: string | null }>;
} | null) {
  return new Set([
    submission?.studentNumberSnapshot,
    submission?.student?.studentNumber,
    ...(submission?.memberConfirmations?.map((member) => member.studentNumber) ?? []),
  ].filter((value): value is string => Boolean(value)));
}

async function requireChallengeQrScan(challenge: {
  qrActionId: number | null;
}, student: StudentContext) {
  if (!challenge.qrActionId) return true;
  const scan = await prisma.qrActionScan.findFirst({
    where: {
      qrActionId: challenge.qrActionId,
      studentId: student.id,
      result: "SUCCESS",
    },
    orderBy: { scannedAt: "desc" },
  });
  return Boolean(scan);
}

async function awardComboMission(input: {
  student: StudentContext;
  missionKey: string;
  sourceId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const mission = await prisma.passportMission.findUnique({ where: { key: input.missionKey } });
  if (!mission?.active) return 0;

  const awarded = await awardMissionPoints({
    student: input.student,
    mission,
    sourceType: "PASSPORT_COMBO",
    sourceId: input.sourceId,
    reason: input.reason,
    metadata: input.metadata,
  });

  return awarded.pointsAwarded;
}

async function awardPerfectSequenceCombo(student: StudentContext) {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recentLedgers = await prisma.passportPointLedger.findMany({
    where: {
      studentNumber: student.studentNumber,
      status: "VALID",
      awardedAt: { gte: since },
      sourceType: { in: ["STAND", "PASSPORT_CHALLENGE", "NETWORKING_PAIR"] },
    },
    select: { sourceType: true, awardedAt: true },
  });

  const seen = new Set(recentLedgers.map((ledger) => ledger.sourceType));
  if (!seen.has("STAND") || !seen.has("PASSPORT_CHALLENGE") || !seen.has("NETWORKING_PAIR")) {
    return 0;
  }

  return awardComboMission({
    student,
    missionKey: "perfect-sequence-combo",
    sourceId: "stand-challenge-networking-15m",
    reason: "Pontos por sequência perfeita: stand, desafio e networking em até 15 minutos.",
    metadata: { windowMinutes: 15 },
  });
}

async function awardBalancedExplorerCombo(student: StudentContext) {
  const standLedgers = await prisma.passportPointLedger.findMany({
    where: {
      studentNumber: student.studentNumber,
      status: "VALID",
      sourceType: "STAND",
    },
    select: { metadataJson: true },
  });
  const areas = new Set<string>();
  for (const ledger of standLedgers) {
    const metadata = parsePassportMetadata(ledger.metadataJson);
    const area = normalizeCourseKey(textFromMetadata(metadata, "submissionArea"));
    if (area) areas.add(area);
  }

  if (areas.size < 3) return 0;

  return awardComboMission({
    student,
    missionKey: "balanced-explorer-combo",
    sourceId: "three-stand-areas",
    reason: "Pontos por explorar stands de áreas diferentes.",
    metadata: { areas: Array.from(areas).sort() },
  });
}

async function awardStandExplorerCombo(student: StudentContext) {
  const standLedgers = await prisma.passportPointLedger.findMany({
    where: {
      studentNumber: student.studentNumber,
      status: "VALID",
      sourceType: "STAND",
    },
    select: { sourceId: true },
  });
  const stands = new Set(standLedgers.map((ledger) => ledger.sourceId));
  if (stands.size < 3) return 0;

  return awardComboMission({
    student,
    missionKey: "stand-explorer-combo",
    sourceId: "three-stands",
    reason: "Pontos por visitar três stands diferentes.",
    metadata: { stands: Array.from(stands).sort() },
  });
}

async function awardWorkshopMasterCombo(student: StudentContext) {
  const workshopLedgers = await prisma.passportPointLedger.findMany({
    where: {
      studentNumber: student.studentNumber,
      status: "VALID",
      sourceType: "WORKSHOP",
    },
    select: { sourceId: true },
  });
  const workshops = new Set(workshopLedgers.map((ledger) => ledger.sourceId));
  if (workshops.size < 2) return 0;

  return awardComboMission({
    student,
    missionKey: "workshop-master-combo",
    sourceId: "two-workshops",
    reason: "Pontos por participar em dois workshops ou palestras.",
    metadata: { workshops: Array.from(workshops).sort() },
  });
}

async function awardNetworkingTriadCombo(student: StudentContext) {
  const networkingLedgers = await prisma.passportPointLedger.findMany({
    where: {
      studentNumber: student.studentNumber,
      status: "VALID",
      sourceType: "NETWORKING_PAIR",
    },
    select: { sourceId: true },
  });
  const pairs = new Set(networkingLedgers.map((ledger) => ledger.sourceId));
  if (pairs.size < 3) return 0;

  return awardComboMission({
    student,
    missionKey: "networking-triad-combo",
    sourceId: "three-cross-course-links",
    reason: "Pontos por validar networking com três estudantes de cursos diferentes.",
    metadata: { pairs: Array.from(pairs).sort() },
  });
}

function cooperativeThresholdForAction(action: QrActionContext) {
  const metadata = parsePassportMetadata(action.targetMeta);
  const fromMetadata = numberFromMetadata(metadata, "cooperativeThreshold");
  return Math.max(2, Math.min(20, Math.round(fromMetadata ?? 3)));
}

async function awardCooperativeMission(input: {
  student: StudentContext;
  mission: { id: number; key: string; points: number; title: string };
  action: QrActionContext;
  qrActionScan: QrActionScanContext;
}) {
  const threshold = cooperativeThresholdForAction(input.action);
  const scans = await prisma.qrActionScan.findMany({
    where: {
      qrActionId: input.action.id,
      result: "SUCCESS",
    },
    orderBy: { scannedAt: "asc" },
  });
  const participants = new Map<string, { id: number; studentNumber: string; name: string | null }>();
  for (const scan of scans) {
    if (!participants.has(scan.studentNumber)) {
      participants.set(scan.studentNumber, {
        id: scan.studentId,
        studentNumber: scan.studentNumber,
        name: scan.studentName,
      });
    }
  }

  if (!participants.has(input.student.studentNumber)) {
    participants.set(input.student.studentNumber, {
      id: input.student.id,
      studentNumber: input.student.studentNumber,
      name: input.student.name,
    });
  }

  if (participants.size < threshold) {
    const remaining = threshold - participants.size;
    const message = remaining === 1
      ? "Missão cooperativa registada. Falta 1 participante para liberar os pontos."
      : `Missão cooperativa registada. Faltam ${remaining} participantes para liberar os pontos.`;
    await recordPassportScan({
      student: input.student,
      missionId: input.mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "COOPERATIVE_PENDING",
      message,
      metadata: { threshold, participants: participants.size },
    });
    return { pointsAwarded: 0, result: "COOPERATIVE_PENDING", message };
  }

  const sourceId = `qr:${input.action.id}:threshold:${threshold}`;
  const participantNumbers = Array.from(participants.keys());
  const students = await prisma.student.findMany({
    where: { studentNumber: { in: participantNumbers } },
    select: { id: true, studentNumber: true, name: true, course: true },
  });
  const studentByNumber = new Map(students.map((student) => [student.studentNumber, student]));
  let currentStudentPoints = 0;

  for (const participant of participants.values()) {
    const student = studentByNumber.get(participant.studentNumber) ?? {
      id: participant.id,
      studentNumber: participant.studentNumber,
      name: participant.name,
      course: null,
    };
    const awarded = await awardMissionPoints({
      student,
      mission: input.mission,
      sourceType: "COOPERATIVE_MISSION",
      sourceId,
      reason: `Missão cooperativa concluída: ${input.mission.title}.`,
      metadata: {
        qrActionId: input.action.id,
        qrActionLabel: input.action.label,
        threshold,
        participants: participantNumbers,
      },
    });
    if (student.studentNumber === input.student.studentNumber) {
      currentStudentPoints = awarded.pointsAwarded;
    }
  }

  const message = currentStudentPoints > 0
    ? "Missão cooperativa concluída. Pontos liberados para o grupo."
    : "O grupo já tinha liberado esta missão cooperativa.";
  await recordPassportScan({
    student: input.student,
    missionId: input.mission.id,
    action: input.action,
    qrActionScan: input.qrActionScan,
    pointsAwarded: currentStudentPoints,
    result: currentStudentPoints > 0 ? "SUCCESS" : "ALREADY_AWARDED",
    message,
    metadata: { threshold, participants: participantNumbers },
  });

  return {
    pointsAwarded: currentStudentPoints,
    result: currentStudentPoints > 0 ? "SUCCESS" : "ALREADY_AWARDED",
    message,
  };
}

async function awardSmartRecoveryMission(input: {
  student: StudentContext;
  mission: { id: number; key: string; points: number; title: string };
  action: QrActionContext;
  qrActionScan: QrActionScanContext;
}) {
  const [lostPoints, recovered] = await Promise.all([
    negativeSurpriseTotal(input.student.studentNumber),
    prisma.passportPointLedger.aggregate({
      where: {
        studentNumber: input.student.studentNumber,
        sourceType: "SMART_RECOVERY",
        status: "VALID",
      },
      _sum: { points: true },
    }),
  ]);
  const recoveredPoints = recovered._sum.points ?? 0;
  const remainingRecovery = Math.max(0, lostPoints - recoveredPoints);
  if (remainingRecovery <= 0) {
    const message = "Recuperação registada, mas não há pontos perdidos para recuperar agora.";
    await recordPassportScan({
      student: input.student,
      missionId: input.mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "NO_RECOVERY_NEEDED",
      message,
      metadata: { lostPoints, recoveredPoints },
    });
    return { pointsAwarded: 0, result: "NO_RECOVERY_NEEDED", message };
  }

  const points = Math.min(input.mission.points, remainingRecovery);
  const awarded = await awardMissionPoints({
    student: input.student,
    mission: input.mission,
    sourceType: "SMART_RECOVERY",
    sourceId: `qr:${input.action.id}`,
    reason: "Recuperação inteligente depois de perda em QR surpresa.",
    points,
    metadata: {
      qrActionId: input.action.id,
      qrActionLabel: input.action.label,
      lostPoints,
      recoveredBefore: recoveredPoints,
    },
  });
  const message = awarded.pointsAwarded > 0
    ? `Recuperação inteligente aplicada: +${awarded.pointsAwarded} pontos.`
    : "Este QR de recuperação já foi usado no teu passaporte.";
  await recordPassportScan({
    student: input.student,
    missionId: input.mission.id,
    action: input.action,
    qrActionScan: input.qrActionScan,
    pointsAwarded: awarded.pointsAwarded,
    result: awarded.pointsAwarded > 0 ? "SUCCESS" : "ALREADY_AWARDED",
    message,
    metadata: { lostPoints, recoveredPoints, points },
  });

  return {
    pointsAwarded: awarded.pointsAwarded,
    result: awarded.pointsAwarded > 0 ? "SUCCESS" : "ALREADY_AWARDED",
    message,
  };
}

async function missionCountsByKey(studentNumber: string) {
  const ledgers = await prisma.passportPointLedger.findMany({
    where: {
      studentNumber,
      status: "VALID",
      mission: { key: { in: defaultPassportMissions.map((mission) => mission.key) } },
    },
    include: { mission: { select: { key: true, type: true } } },
  });

  return ledgers.reduce<Record<string, number>>((acc, item) => {
    const key = item.mission?.key;
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

async function awardJourneyCompletionIfReady(student: StudentContext) {
  const catalog = await ensurePassportCatalog();
  const missionByKey = new Map(catalog.missions.map((mission) => [mission.key, mission]));
  const counts = await missionCountsByKey(student.studentNumber);
  const joined = (counts["accept-challenge"] ?? 0) > 0;
  const ready = joined && coreJourneyMissionKeys.every((key) => (counts[key] ?? 0) > 0);
  const journeyMission = missionByKey.get("journey-complete");

  if (!ready || !journeyMission) return 0;

  const result = await awardMissionPoints({
    student,
    mission: journeyMission,
    sourceType: "JOURNEY",
    sourceId: "core",
    reason: "Pontos por conclusão das missões principais.",
  });

  return result.pointsAwarded;
}

export async function recordPassportParticipation(input: {
  studentId: number;
  visitorId?: string | null;
}) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, studentNumber: true, name: true, course: true },
  });
  if (!student) return null;

  await ensurePassportCatalog();
  const mission = await prisma.passportMission.findUnique({
    where: { key: "accept-challenge" },
  });
  const now = new Date();
  const businessKey = `passport-participation:${student.studentNumber}`;
  const points = mission?.active ? mission.points : 0;
  const metadata = {
    origin: "minha-area-desafio",
    visitorId: input.visitorId?.trim() || null,
    lastSeenAt: now.toISOString(),
  };

  return prisma.passportPointLedger.upsert({
    where: { businessKey },
    update: {
      studentId: student.id,
      studentNumber: student.studentNumber,
      studentName: student.name,
      studentCourse: student.course,
      missionId: mission?.id ?? null,
      sourceType: mission?.active ? "PASSPORT_JOIN" : "PASSPORT_PARTICIPATION",
      points,
      metadataJson: JSON.stringify(metadata),
    },
    create: {
      businessKey,
      studentId: student.id,
      studentNumber: student.studentNumber,
      studentName: student.name,
      studentCourse: student.course,
      missionId: mission?.id ?? null,
      sourceType: mission?.active ? "PASSPORT_JOIN" : "PASSPORT_PARTICIPATION",
      sourceId: "minha-area-desafio",
      points,
      reason: "Estudante entrou oficialmente no desafio do Passaporte Digital.",
      metadataJson: JSON.stringify(metadata),
    },
  });
}

export type PassportConstructiveFeedbackFocus =
  | "clareza"
  | "impacto"
  | "viabilidade"
  | "apresentacao"
  | "experiencia";

export type PassportConstructiveFeedbackStatus =
  | "AWARDED"
  | "ALREADY_AWARDED"
  | "INVALID_CONTENT"
  | "MISSION_UNAVAILABLE"
  | "OWN_PROJECT"
  | "PASSPORT_NOT_JOINED"
  | "STUDENT_NOT_FOUND"
  | "SUBMISSION_NOT_FOUND";

export type PassportConstructiveFeedbackResult = {
  status: PassportConstructiveFeedbackStatus;
  message: string;
  pointsAwarded: number;
  completedCount: number;
  requiredCount: number;
  missionCompleted: boolean;
  comment: {
    id: number;
    content: string;
    createdAt: string;
  } | null;
  submission: {
    id: number;
    name: string;
  } | null;
};

function normalizeConstructiveFeedbackContent(content: string) {
  return content.trim().replace(/\s+/g, " ");
}

function validateConstructiveFeedbackContent(content: string) {
  const normalized = normalizeConstructiveFeedbackContent(content);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (
    normalized.length < CONSTRUCTIVE_FEEDBACK_MIN_LENGTH ||
    wordCount < CONSTRUCTIVE_FEEDBACK_MIN_WORDS
  ) {
    return {
      ok: false as const,
      content: normalized,
      message:
        "A crítica precisa ser mais construtiva: escreve pelo menos 60 caracteres e inclui uma sugestão clara de melhoria.",
    };
  }
  return { ok: true as const, content: normalized };
}

async function countConstructiveFeedbackCompletions(studentNumber: string) {
  return prisma.passportPointLedger.count({
    where: {
      studentNumber,
      status: "VALID",
      sourceType: "CONSTRUCTIVE_FEEDBACK",
      mission: { key: CONSTRUCTIVE_FEEDBACK_MISSION_KEY },
    },
  });
}

export async function recordPassportConstructiveFeedback(input: {
  studentId: number;
  submissionId: number;
  content: string;
  focus?: PassportConstructiveFeedbackFocus | null;
}): Promise<PassportConstructiveFeedbackResult> {
  const content = validateConstructiveFeedbackContent(input.content);
  if (!content.ok) {
    return {
      status: "INVALID_CONTENT",
      message: content.message,
      pointsAwarded: 0,
      completedCount: 0,
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: false,
      comment: null,
      submission: null,
    };
  }

  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, studentNumber: true, name: true, course: true },
  });
  if (!student) {
    return {
      status: "STUDENT_NOT_FOUND",
      message: "Estudante não encontrado.",
      pointsAwarded: 0,
      completedCount: 0,
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: false,
      comment: null,
      submission: null,
    };
  }

  const participation = await prisma.passportPointLedger.findUnique({
    where: { businessKey: `passport-participation:${student.studentNumber}` },
    select: { id: true, status: true },
  });
  if (!participation || participation.status !== "VALID") {
    return {
      status: "PASSPORT_NOT_JOINED",
      message: "Ativa primeiro o Passaporte Digital para pontuar críticas construtivas.",
      pointsAwarded: 0,
      completedCount: 0,
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: false,
      comment: null,
      submission: null,
    };
  }

  const submission = await prisma.submission.findFirst({
    where: {
      id: input.submissionId,
      status: "APPROVED",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      studentId: true,
      studentNumberSnapshot: true,
      student: { select: { studentNumber: true } },
      memberConfirmations: {
        where: {
          OR: [
            { studentId: student.id },
            { studentNumber: student.studentNumber },
            { expectedStudentNumber: student.studentNumber },
          ],
        },
        select: { id: true },
      },
    },
  });

  if (!submission) {
    return {
      status: "SUBMISSION_NOT_FOUND",
      message: "Projeto aprovado não encontrado para receber a crítica.",
      pointsAwarded: 0,
      completedCount: 0,
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: false,
      comment: null,
      submission: null,
    };
  }

  const isOwnProject =
    submission.studentId === student.id ||
    submission.studentNumberSnapshot === student.studentNumber ||
    submission.student?.studentNumber === student.studentNumber ||
    submission.memberConfirmations.length > 0;
  if (isOwnProject) {
    return {
      status: "OWN_PROJECT",
      message: "Críticas no próprio projeto não contam pontos no Passaporte Digital.",
      pointsAwarded: 0,
      completedCount: await countConstructiveFeedbackCompletions(student.studentNumber),
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: false,
      comment: null,
      submission: { id: submission.id, name: submission.name },
    };
  }

  await ensurePassportCatalog();
  const mission = await prisma.passportMission.findUnique({
    where: { key: CONSTRUCTIVE_FEEDBACK_MISSION_KEY },
  });
  if (!mission?.active) {
    return {
      status: "MISSION_UNAVAILABLE",
      message: "A missão de crítica construtiva ainda não está disponível.",
      pointsAwarded: 0,
      completedCount: await countConstructiveFeedbackCompletions(student.studentNumber),
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: false,
      comment: null,
      submission: { id: submission.id, name: submission.name },
    };
  }

  const sourceId = `submission:${submission.id}`;
  const businessKey = buildPassportPointBusinessKey({
    studentNumber: student.studentNumber,
    missionKey: mission.key,
    sourceType: "CONSTRUCTIVE_FEEDBACK",
    sourceId,
  });
  const existingAward = await prisma.passportPointLedger.findUnique({
    where: { businessKey },
    select: { id: true },
  });
  if (existingAward) {
    const completedCount = await countConstructiveFeedbackCompletions(student.studentNumber);
    return {
      status: "ALREADY_AWARDED",
      message: "Já recebeste pontos por crítica construtiva neste projeto. Procura outro projeto para continuar.",
      pointsAwarded: 0,
      completedCount,
      requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      missionCompleted: completedCount >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      comment: null,
      submission: { id: submission.id, name: submission.name },
    };
  }

  const comment = await prisma.studentComment.create({
    data: {
      studentId: student.id,
      submissionId: submission.id,
      content: content.content,
    },
    include: {
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
        },
      },
    },
  });

  const awarded = await awardMissionPoints({
    student,
    mission,
    sourceType: "CONSTRUCTIVE_FEEDBACK",
    sourceId,
    reason: `Crítica construtiva enviada ao projeto ${submission.name}.`,
    points: CONSTRUCTIVE_FEEDBACK_POINTS_PER_PROJECT,
    metadata: {
      submissionId: submission.id,
      submissionName: submission.name,
      commentId: comment.id,
      focus: input.focus ?? null,
      requiredProjects: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
      pointsPerProject: CONSTRUCTIVE_FEEDBACK_POINTS_PER_PROJECT,
      exhibitorScore: "Pendente de validação da organização como feedback qualificado.",
    },
  });
  const completedCount = await countConstructiveFeedbackCompletions(student.studentNumber);

  await syncPassportBadges(student);

  return {
    status: awarded.created ? "AWARDED" : "ALREADY_AWARDED",
    message: awarded.created
      ? completedCount >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS
        ? "Crítica registada. Missão Crítica construtiva concluída no Passaporte Digital."
        : `Crítica registada. Faltam ${Math.max(0, CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS - completedCount)} projeto(s) diferentes para fechar a missão.`
      : "Já recebeste pontos por crítica construtiva neste projeto.",
    pointsAwarded: awarded.pointsAwarded,
    completedCount,
    requiredCount: CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
    missionCompleted: completedCount >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS,
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    },
    submission: { id: submission.id, name: submission.name },
  };
}

async function syncPassportBadges(student: StudentContext) {
  const catalog = await ensurePassportCatalog();
  const [counts, secretSurpriseCount] = await Promise.all([
    missionCountsByKey(student.studentNumber),
    prisma.passportSurpriseEffectLedger.count({
      where: {
        studentNumber: student.studentNumber,
        status: "VALID",
        surpriseQr: {
          is: {
            OR: [
              { rarity: "SECRET" },
              { visibility: "SECRET" },
            ],
          },
        },
      },
    }),
  ]);
  const earnedRules = new Set<string>();

  if ((counts["event-checkin"] ?? 0) >= 1) earnedRules.add("MISSION_EVENT_CHECKIN");
  if ((counts["stand-visit"] ?? 0) >= 3) earnedRules.add("MISSION_STAND_VISIT_COUNT");
  if ((counts["workshop-checkin"] ?? 0) >= 2) earnedRules.add("MISSION_WORKSHOP_CHECKIN_COUNT");
  if ((counts["cross-course-networking"] ?? 0) >= 1) earnedRules.add("MISSION_NETWORKING_CROSS_COURSE_COUNT");
  if (((counts["exhibitor-challenge"] ?? 0) + (counts["special-quiz"] ?? 0)) >= 1) earnedRules.add("MISSION_CHALLENGE_COUNT");
  if ((counts[CONSTRUCTIVE_FEEDBACK_MISSION_KEY] ?? 0) >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS)
    earnedRules.add("MISSION_CONSTRUCTIVE_FEEDBACK_COUNT");
  if ((counts["fair-surprise"] ?? 0) >= 1) earnedRules.add("MISSION_FAIR_SURPRISE_COUNT");
  if (secretSurpriseCount >= 1) earnedRules.add("MISSION_SECRET_SURPRISE_COUNT");
  if ((counts["journey-complete"] ?? 0) >= 1) earnedRules.add("MISSION_JOURNEY_COMPLETION");

  await Promise.all(catalog.badges
    .filter((badge) => earnedRules.has(badge.ruleType))
    .map((badge) => prisma.passportStudentBadge.upsert({
      where: {
        studentNumber_badgeId: {
          studentNumber: student.studentNumber,
          badgeId: badge.id,
        },
      },
      update: {
        studentId: student.id,
        metadataJson: JSON.stringify({ ruleType: badge.ruleType, ruleValue: badge.ruleValue }),
      },
      create: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        badgeId: badge.id,
        metadataJson: JSON.stringify({ ruleType: badge.ruleType, ruleValue: badge.ruleValue }),
      },
    })));
}

export async function ensureNetworkingQrForStudent(studentId: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentNumber: true, name: true, course: true },
  });
  if (!student) return null;

  const mission = await prisma.passportMission.findUnique({ where: { key: "cross-course-networking" } })
    ?? (await ensurePassportCatalog()).missions.find((item) => item.key === "cross-course-networking")
    ?? null;

  const existing = await prisma.qrAction.findFirst({
    where: {
      type: "NETWORKING_CROSS_COURSE",
      targetId: student.id,
      eventKey: "passport-networking",
      active: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return { student, qrAction: existing };

  const qrAction = await prisma.qrAction.create({
    data: {
      token: createQrActionToken(),
      type: "NETWORKING_CROSS_COURSE",
      label: "Networking intercurso",
      description: "QR pessoal para validar networking entre estudantes de cursos diferentes.",
      targetId: student.id,
      targetMeta: JSON.stringify({
        ownerStudentNumber: student.studentNumber,
        ownerName: student.name,
        ownerCourse: student.course,
      }),
      eventKey: "passport-networking",
      eventLabel: "Passaporte Digital",
      passportMissionId: mission?.id ?? null,
      active: true,
    },
  });

  return { student, qrAction };
}

export async function findActivePassportChallengeForQrAction(qrActionId: number) {
  const challenge = await prisma.passportChallenge.findFirst({
    where: {
      qrActionId,
      active: true,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return null;

  const now = new Date();
  if ((challenge.startsAt && challenge.startsAt > now) || (challenge.endsAt && challenge.endsAt < now)) {
    return null;
  }

  return serializePassportChallenge(challenge);
}

export async function listPassportChallenges() {
  return prisma.passportChallenge.findMany({
    include: {
      mission: { select: { id: true, key: true, title: true, points: true } },
      qrAction: { select: { id: true, token: true, type: true, label: true } },
      _count: { select: { answers: true } },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
}

export async function createPassportChallenge(input: {
  missionId?: number | null;
  qrActionId?: number | null;
  type: string;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  explanation?: string | null;
  maxAttempts?: number | null;
  active?: boolean;
  status?: string | null;
  reviewNote?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdByStudentNumber?: string | null;
  approvedByStudentNumber?: string | null;
}) {
  const type = input.type.trim() || "EXHIBITOR_CHALLENGE";
  if (!isPassportChallengeQrActionType(type)) {
    throw new Error("Tipo de desafio inválido para o Passaporte Digital.");
  }

  let qrAction = null as Awaited<ReturnType<typeof prisma.qrAction.findUnique>> | null;
  if (input.qrActionId) {
    qrAction = await prisma.qrAction.findUnique({ where: { id: input.qrActionId } });
    if (!qrAction) throw new Error("QR de ação não encontrado.");
    if (!isPassportChallengeQrActionType(qrAction.type)) {
      throw new Error("O QR escolhido não é do tipo desafio/quiz.");
    }
  }

  const missionId = input.missionId ?? qrAction?.passportMissionId ?? null;
  if (missionId) {
    const mission = await prisma.passportMission.findUnique({ where: { id: missionId } });
    if (!mission) throw new Error("Missão do Passaporte não encontrada.");
  }

  const options = input.options
    ?.map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 8);

  const status = input.status ?? (input.active === false ? "PAUSED" : "APPROVED");
  const active = status === "APPROVED" ? (input.active ?? true) : false;

  return prisma.passportChallenge.create({
    data: {
      missionId,
      qrActionId: input.qrActionId ?? null,
      type,
      question: input.question.trim(),
      optionsJson: options && options.length > 0 ? JSON.stringify(options) : null,
      correctAnswerHash: hashPassportAnswer(input.correctAnswer),
      explanation: input.explanation?.trim() || null,
      maxAttempts: Math.max(1, Math.min(5, input.maxAttempts ?? 1)),
      active,
      status,
      reviewNote: input.reviewNote?.trim() || null,
      version: 1,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      createdByStudentNumber: input.createdByStudentNumber ?? null,
      approvedAt: input.approvedByStudentNumber ? new Date() : null,
      approvedByStudentNumber: input.approvedByStudentNumber ?? null,
    },
  });
}

export async function updatePassportChallenge(id: number, input: {
  missionId?: number | null;
  qrActionId?: number | null;
  type?: string;
  question?: string;
  options?: string[] | null;
  correctAnswer?: string;
  explanation?: string | null;
  maxAttempts?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  approvedByStudentNumber?: string | null;
  status?: string | null;
  reviewNote?: string | null;
}) {
  const existing = await prisma.passportChallenge.findUnique({ where: { id } });
  if (!existing) return null;

  const type = input.type?.trim();
  if (type && !isPassportChallengeQrActionType(type)) {
    throw new Error("Tipo de desafio inválido para o Passaporte Digital.");
  }

  const options = input.options
    ?.map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 8);

  const challenge = await prisma.passportChallenge.update({
    where: { id },
    data: {
      ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
      ...(input.qrActionId !== undefined ? { qrActionId: input.qrActionId } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(input.question !== undefined ? { question: input.question.trim() } : {}),
      ...(input.options !== undefined ? { optionsJson: options && options.length > 0 ? JSON.stringify(options) : null } : {}),
      ...(input.correctAnswer !== undefined ? { correctAnswerHash: hashPassportAnswer(input.correctAnswer) } : {}),
      ...(input.explanation !== undefined ? { explanation: input.explanation?.trim() || null } : {}),
      ...(input.maxAttempts !== undefined ? { maxAttempts: Math.max(1, Math.min(5, input.maxAttempts ?? 1)) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.status !== undefined ? { status: input.status ?? "PENDING_APPROVAL" } : {}),
      ...(input.reviewNote !== undefined ? { reviewNote: input.reviewNote?.trim() || null } : {}),
      ...(
        input.question !== undefined
        || input.options !== undefined
        || input.correctAnswer !== undefined
          ? { version: { increment: 1 } }
          : {}
      ),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
      ...(input.approvedByStudentNumber !== undefined ? {
        approvedAt: input.approvedByStudentNumber ? new Date() : null,
        approvedByStudentNumber: input.approvedByStudentNumber,
        ...(input.status === undefined ? { status: input.active === false ? "PAUSED" : "APPROVED" } : {}),
      } : {}),
    },
  });

  if (input.active !== undefined && challenge.qrActionId) {
    await prisma.qrAction.update({
      where: { id: challenge.qrActionId },
      data: { active: input.active },
    });
  }

  return challenge;
}

export async function createOrUpdateOwnedProjectChallenge(input: {
  submissionId: number;
  ownerStudentId: number;
  ownerStudentNumber: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
  maxAttempts?: number | null;
}) {
  const submission = await prisma.submission.findFirst({
    where: {
      id: input.submissionId,
      studentId: input.ownerStudentId,
      status: "APPROVED",
      deletedAt: null,
    },
    select: { id: true, name: true, type: true, status: true, studentId: true },
  });

  if (!submission) {
    throw new Error("Projeto aprovado não encontrado para este expositor.");
  }

  const question = input.question.trim();
  if (question.length < 8) {
    throw new Error("A pergunta do desafio deve ter pelo menos 8 caracteres.");
  }

  const options = input.options
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (options.length < 2) {
    throw new Error("O desafio precisa de pelo menos duas opções de resposta.");
  }

  const correctAnswer = input.correctAnswer.trim();
  const correctInOptions = options.some((option) => normalizePassportText(option) === normalizePassportText(correctAnswer));
  if (!correctAnswer || !correctInOptions) {
    throw new Error("A resposta correta deve ser uma das opções do desafio.");
  }

  const catalog = await ensurePassportCatalog();
  const mission = catalog.missions.find((item) => item.key === "exhibitor-challenge")
    ?? await prisma.passportMission.findUnique({ where: { key: "exhibitor-challenge" } });

  const qrActionPayload = {
    type: "EXHIBITOR_CHALLENGE",
    label: `Desafio: ${submission.name}`,
    description: "QR do expositor para liberar pergunta do Passaporte Digital.",
    targetId: submission.id,
    targetMeta: JSON.stringify({
      submissionId: submission.id,
      submissionName: submission.name,
      submissionType: submission.type,
      source: "EXHIBITOR_PROJECT_CHALLENGE",
    }),
    eventKey: `submission:${submission.id}:challenge`,
    eventLabel: submission.name,
    active: false,
    passportMissionId: mission?.id ?? null,
  };

  const existingQrAction = await prisma.qrAction.findFirst({
    where: { type: "EXHIBITOR_CHALLENGE", targetId: submission.id },
    orderBy: [{ createdAt: "asc" }],
  });

  const qrAction = existingQrAction
    ? await prisma.qrAction.update({
      where: { id: existingQrAction.id },
      data: qrActionPayload,
    })
    : await prisma.qrAction.create({
      data: {
        token: createQrActionToken(),
        ...qrActionPayload,
      },
    });

  const existingChallenge = await prisma.passportChallenge.findFirst({
    where: { qrActionId: qrAction.id },
    orderBy: { createdAt: "desc" },
  });

  const challengePayload = {
    missionId: mission?.id ?? null,
    qrActionId: qrAction.id,
    type: "EXHIBITOR_CHALLENGE",
    question,
    optionsJson: JSON.stringify(options),
    correctAnswerHash: hashPassportAnswer(correctAnswer),
    explanation: input.explanation?.trim() || null,
    maxAttempts: Math.max(1, Math.min(5, input.maxAttempts ?? 1)),
    active: false,
    status: "PENDING_APPROVAL",
    reviewNote: null,
    approvedAt: null,
    approvedByStudentNumber: null,
    createdByStudentNumber: input.ownerStudentNumber,
  };

  const challenge = existingChallenge
    ? await prisma.passportChallenge.update({
      where: { id: existingChallenge.id },
      data: {
        ...challengePayload,
        version: { increment: 1 },
      },
    })
    : await prisma.passportChallenge.create({
      data: {
        ...challengePayload,
        version: 1,
      },
    });

  return {
    status: "PENDING_APPROVAL" as const,
    submission,
    qrAction,
    challenge,
  };
}

export async function listOwnedProjectChallenges(ownerStudentId: number) {
  const submissions = await prisma.submission.findMany({
    where: { studentId: ownerStudentId, status: "APPROVED", deletedAt: null },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  if (submissions.length === 0) return [];

  const submissionIds = submissions.map((submission) => submission.id);
  const qrActions = await prisma.qrAction.findMany({
    where: {
      type: "EXHIBITOR_CHALLENGE",
      targetId: { in: submissionIds },
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
  const qrActionBySubmission = new Map(qrActions.map((action) => [action.targetId, action]));

  return submissions.map((submission) => {
    const qrAction = qrActionBySubmission.get(submission.id) ?? null;
    const challenge = qrAction?.passportChallenge ?? null;
    const status = !challenge
      ? "MISSING"
      : challengeLifecycleStatus(challenge) === "APPROVED" && challenge.active
        ? "APPROVED"
        : challengeLifecycleStatus(challenge) === "REJECTED"
          ? "REJECTED"
          : challenge.approvedAt
          ? "PAUSED"
          : "PENDING_APPROVAL";

    return {
      submission,
      qrAction,
      challenge,
      status,
      answersCount: challenge?._count?.answers ?? 0,
    };
  });
}

async function resolveMissionForChallenge(challenge: { missionId: number | null; type: string }) {
  await ensurePassportCatalog();
  if (challenge.missionId) {
    const mission = await prisma.passportMission.findUnique({ where: { id: challenge.missionId } });
    if (mission?.active) return mission;
  }

  const missionKey = defaultPassportMissionKeyForQrAction(challenge.type);
  return missionKey ? prisma.passportMission.findUnique({ where: { key: missionKey } }) : null;
}

export async function answerPassportChallenge(input: {
  challengeId: number;
  student: StudentContext;
  answer: string;
}) {
  const challenge = await prisma.passportChallenge.findUnique({
    where: { id: input.challengeId },
  });
  if (!challenge) {
    return { ok: false, status: "NOT_FOUND", message: "Desafio não encontrado.", pointsAwarded: 0 };
  }

  const now = new Date();
  if (!challenge.active || (challenge.startsAt && challenge.startsAt > now) || (challenge.endsAt && challenge.endsAt < now)) {
    return { ok: false, status: "INACTIVE", message: "Este desafio não está disponível neste momento.", pointsAwarded: 0 };
  }

  const scannedChallengeQr = await requireChallengeQrScan(challenge, input.student);
  if (!scannedChallengeQr) {
    return {
      ok: false,
      status: "CHALLENGE_SCAN_REQUIRED",
      correct: false,
      pointsAwarded: 0,
      attemptsUsed: 0,
      attemptsRemaining: challenge.maxAttempts,
      message: "Este desafio só abre depois de escaneares o QR pessoal do expositor.",
      challenge: serializePassportChallenge(challenge),
    };
  }

  const challengeSubmissionContext = await getScoredChallengeSubmissionContext(challenge);
  if (challengeSubmissionContext.unavailable) {
    return {
      ok: false,
      status: "PROJECT_UNAVAILABLE",
      correct: false,
      pointsAwarded: 0,
      attemptsUsed: 0,
      attemptsRemaining: challenge.maxAttempts,
      message: "Este desafio já não está disponível porque o projeto foi removido ou deixou de estar aprovado.",
      challenge: serializePassportChallenge(challenge),
    };
  }

  const challengeSubmission = challengeSubmissionContext.submission;
  const ownerNumbers = submissionOwnerNumbers(challengeSubmission);
  if (ownerNumbers.has(input.student.studentNumber)) {
    return {
      ok: false,
      status: "SELF_CHALLENGE",
      correct: false,
      pointsAwarded: 0,
      attemptsUsed: 0,
      attemptsRemaining: challenge.maxAttempts,
      message: "O autor da pergunta não pode ganhar o prémio por saber a resposta.",
      challenge: serializePassportChallenge(challenge),
    };
  }

  const previousAnswers = await prisma.passportChallengeAnswer.findMany({
    where: {
      challengeId: challenge.id,
      studentNumber: input.student.studentNumber,
      challengeVersion: challenge.version ?? 1,
    },
    orderBy: { attemptNumber: "asc" },
  });
  const attemptsUsed = previousAnswers.length;
  const alreadyCorrect = previousAnswers.find((answer) => answer.correct);
  if (alreadyCorrect) {
    return {
      ok: true,
      status: "ALREADY_DONE",
      correct: true,
      pointsAwarded: 0,
      attemptsUsed,
      attemptsRemaining: 0,
      message: "Já tinhas acertado este desafio. A pontuação não é duplicada.",
      challenge: serializePassportChallenge(challenge),
    };
  }

  if (attemptsUsed >= challenge.maxAttempts) {
    return {
      ok: false,
      status: "MAX_ATTEMPTS",
      correct: false,
      pointsAwarded: 0,
      attemptsUsed,
      attemptsRemaining: 0,
      message: "Limite de tentativas atingido para este desafio.",
      challenge: serializePassportChallenge(challenge),
    };
  }

  const answerHash = hashPassportAnswer(input.answer);
  const correct = answerHash === challenge.correctAnswerHash;
  const attemptNumber = attemptsUsed + 1;
  let pointsAwarded = 0;
  let message = correct ? "Resposta correta. Pontos atribuídos no Passaporte." : "Resposta registada, mas ainda não está correta.";

  if (correct) {
    const mission = await resolveMissionForChallenge(challenge);
    if (mission?.active) {
      const awarded = await awardMissionPoints({
        student: input.student,
        mission,
        sourceType: "PASSPORT_CHALLENGE",
        sourceId: `challenge:${challenge.id}:v${challenge.version ?? 1}`,
        reason: `Desafio concluído: ${mission.title}.`,
        metadata: {
          challengeId: challenge.id,
          qrActionId: challenge.qrActionId,
          challengeType: challenge.type,
          challengeVersion: challenge.version ?? 1,
          submissionId: challengeSubmission?.id ?? null,
          submissionArea: challengeSubmission?.area ?? null,
        },
      });
      pointsAwarded = awarded.pointsAwarded;
      pointsAwarded += await awardPerfectSequenceCombo(input.student);
      const journeyPoints = await awardJourneyCompletionIfReady(input.student);
      pointsAwarded += journeyPoints;
      await syncPassportBadges(input.student);
      if (!awarded.created) message = "Resposta correta, mas esta pontuação já tinha sido atribuída.";
    } else {
      message = "Resposta correta, mas a missão de pontuação não está ativa.";
    }
  }

  await prisma.passportChallengeAnswer.create({
    data: {
      challengeId: challenge.id,
      studentId: input.student.id,
      studentNumber: input.student.studentNumber,
      studentName: input.student.name,
      studentCourse: input.student.course,
      answerHash,
      challengeVersion: challenge.version ?? 1,
      correct,
      attemptNumber,
      pointsAwarded,
      message,
    },
  });

  return {
    ok: true,
    status: correct ? "CORRECT" : "WRONG",
    correct,
    pointsAwarded,
    attemptsUsed: attemptNumber,
    attemptsRemaining: Math.max(0, challenge.maxAttempts - attemptNumber),
    message,
    challenge: serializePassportChallenge(challenge),
  };
}

export async function listPassportSurpriseQrs() {
  return prisma.passportSurpriseQr.findMany({
    include: {
      qrAction: { select: { id: true, token: true, type: true, label: true, active: true, maxScans: true, expiresAt: true } },
      _count: { select: { effects: true } },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
}

export async function createPassportSurpriseQr(input: {
  name: string;
  description?: string | null;
  displayCode?: string | null;
  batchCode?: string | null;
  effectType: string;
  effectValue: number;
  dynamicRules?: PassportSurpriseDynamicRules | null;
  targetScope?: string | null;
  rarity?: string | null;
  visibility?: string | null;
  maxUsesTotal?: number | null;
  maxUsesPerStudent?: number | null;
  negativeCapPerStudent?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdByStudentNumber?: string | null;
}) {
  const catalog = await ensurePassportCatalog();
  const mission = catalog.missions.find((item) => item.key === "fair-surprise")
    ?? await prisma.passportMission.findUnique({ where: { key: "fair-surprise" } });
  const effectType = normalizeSurpriseEffectType(input.effectType);
  const effectValue = clampSurpriseEffectValue(effectType, input.effectValue);
  const type = qrActionTypeForSurpriseEffect(effectType);
  const active = input.active ?? true;
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  return prisma.$transaction(async (tx) => {
    const qrAction = await tx.qrAction.create({
      data: {
        token: createQrActionToken(),
        type,
        label: input.name.trim(),
        description: input.description?.trim() || null,
        targetMeta: JSON.stringify({
          surpriseEffectType: effectType,
          rarity: normalizeSurpriseRarity(input.rarity),
          visibility: normalizeSurpriseVisibility(input.visibility),
          displayCode: input.displayCode?.trim() || null,
        }),
        eventKey: "passport-surprise",
        eventLabel: "Caça aos QR",
        active,
        maxScans: input.maxUsesTotal ?? null,
        expiresAt: endsAt,
        passportMissionId: mission?.id ?? null,
      },
    });

    return tx.passportSurpriseQr.create({
      data: {
        qrActionId: qrAction.id,
        displayCode: input.displayCode?.trim() || null,
        batchCode: input.batchCode?.trim() || null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        effectType,
        effectValue,
        dynamicRulesJson: normalizeSurpriseDynamicRules(input.dynamicRules),
        targetScope: input.targetScope?.trim().toUpperCase() || "SURPRISE_BONUS",
        rarity: normalizeSurpriseRarity(input.rarity),
        visibility: normalizeSurpriseVisibility(input.visibility),
        maxUsesTotal: input.maxUsesTotal ?? null,
        maxUsesPerStudent: Math.max(1, Math.min(5, input.maxUsesPerStudent ?? 1)),
        negativeCapPerStudent: input.negativeCapPerStudent ?? null,
        active,
        startsAt,
        endsAt,
        createdByStudentNumber: input.createdByStudentNumber ?? null,
      },
      include: {
        qrAction: { select: { id: true, token: true, type: true, label: true, active: true, maxScans: true, expiresAt: true } },
        _count: { select: { effects: true } },
      },
    });
  });
}

export async function updatePassportSurpriseQr(id: number, input: {
  name?: string;
  description?: string | null;
  displayCode?: string | null;
  batchCode?: string | null;
  effectType?: string;
  effectValue?: number;
  dynamicRules?: PassportSurpriseDynamicRules | null;
  targetScope?: string | null;
  rarity?: string | null;
  visibility?: string | null;
  maxUsesTotal?: number | null;
  maxUsesPerStudent?: number | null;
  negativeCapPerStudent?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const existing = await prisma.passportSurpriseQr.findUnique({ where: { id } });
  if (!existing) return null;

  const effectType = input.effectType ? normalizeSurpriseEffectType(input.effectType) : existing.effectType as PassportSurpriseEffectType;
  const effectValue = input.effectValue !== undefined
    ? clampSurpriseEffectValue(effectType, input.effectValue)
    : existing.effectValue;
  const type = qrActionTypeForSurpriseEffect(effectType);
  const startsAt = input.startsAt !== undefined ? (input.startsAt ? new Date(input.startsAt) : null) : undefined;
  const endsAt = input.endsAt !== undefined ? (input.endsAt ? new Date(input.endsAt) : null) : undefined;

  return prisma.$transaction(async (tx) => {
    await tx.qrAction.update({
      where: { id: existing.qrActionId },
      data: {
        ...(input.name !== undefined ? { label: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.displayCode !== undefined ? {
          targetMeta: JSON.stringify({
            surpriseEffectType: effectType,
            rarity: input.rarity !== undefined ? normalizeSurpriseRarity(input.rarity) : existing.rarity,
            visibility: input.visibility !== undefined ? normalizeSurpriseVisibility(input.visibility) : existing.visibility,
            displayCode: input.displayCode?.trim() || null,
          }),
        } : {}),
        type,
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.maxUsesTotal !== undefined ? { maxScans: input.maxUsesTotal ?? null } : {}),
        ...(endsAt !== undefined ? { expiresAt: endsAt } : {}),
      },
    });

    return tx.passportSurpriseQr.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.displayCode !== undefined ? { displayCode: input.displayCode?.trim() || null } : {}),
        ...(input.batchCode !== undefined ? { batchCode: input.batchCode?.trim() || null } : {}),
        ...(input.effectType !== undefined ? { effectType } : {}),
        ...(input.effectValue !== undefined ? { effectValue } : {}),
        ...(input.dynamicRules !== undefined ? { dynamicRulesJson: normalizeSurpriseDynamicRules(input.dynamicRules) } : {}),
        ...(input.targetScope !== undefined ? { targetScope: input.targetScope?.trim().toUpperCase() || "SURPRISE_BONUS" } : {}),
        ...(input.rarity !== undefined ? { rarity: normalizeSurpriseRarity(input.rarity) } : {}),
        ...(input.visibility !== undefined ? { visibility: normalizeSurpriseVisibility(input.visibility) } : {}),
        ...(input.maxUsesTotal !== undefined ? { maxUsesTotal: input.maxUsesTotal ?? null } : {}),
        ...(input.maxUsesPerStudent !== undefined ? { maxUsesPerStudent: Math.max(1, Math.min(5, input.maxUsesPerStudent ?? 1)) } : {}),
        ...(input.negativeCapPerStudent !== undefined ? { negativeCapPerStudent: input.negativeCapPerStudent ?? null } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(startsAt !== undefined ? { startsAt } : {}),
        ...(endsAt !== undefined ? { endsAt } : {}),
      },
      include: {
        qrAction: { select: { id: true, token: true, type: true, label: true, active: true, maxScans: true, expiresAt: true } },
        _count: { select: { effects: true } },
      },
    });
  });
}

export async function createPassportSurpriseQrBatch(input: {
  name: string;
  description?: string | null;
  quantity: number;
  codePrefix?: string | null;
  startNumber?: number | null;
  effectType: string;
  effectValue: number;
  dynamicRules?: PassportSurpriseDynamicRules | null;
  targetScope?: string | null;
  rarity?: string | null;
  visibility?: string | null;
  maxUsesTotal?: number | null;
  maxUsesPerStudent?: number | null;
  negativeCapPerStudent?: number | null;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdByStudentNumber?: string | null;
}) {
  const quantity = Math.max(1, Math.min(120, Math.floor(input.quantity)));
  const prefix = input.codePrefix?.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "") || "QR";
  const startNumber = Math.max(1, Math.floor(input.startNumber ?? 1));
  const batchCode = `surprise-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const items = [];

  for (let index = 0; index < quantity; index += 1) {
    const displayNumber = startNumber + index;
    const displayCode = `${prefix}-${String(displayNumber).padStart(3, "0")}`;
    const surprise = await createPassportSurpriseQr({
      ...input,
      batchCode,
      displayCode,
      name: `${input.name.trim()} #${String(displayNumber).padStart(3, "0")}`,
      description: input.description ?? `QR surpresa numerado ${displayCode}.`,
    });
    items.push(surprise);
  }

  return {
    batchCode,
    quantity: items.length,
    items,
  };
}

async function applyPassportSurpriseQrEffect(input: {
  student: StudentContext;
  action: QrActionContext;
  qrActionScan: QrActionScanContext;
  mission: { id: number; key: string; title: string };
}) {
  const surprise = await prisma.passportSurpriseQr.findUnique({
    where: { qrActionId: input.action.id },
  });

  if (!surprise) {
    const message = "QR surpresa ainda nao configurado.";
    await recordPassportScan({
      student: input.student,
      missionId: input.mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "SURPRISE_NOT_CONFIGURED",
      message,
    });
    return { pointsAwarded: 0, missionKey: input.mission.key, result: "SURPRISE_NOT_CONFIGURED", message };
  }

  const now = new Date();
  if (!surprise.active || (surprise.startsAt && surprise.startsAt > now) || (surprise.endsAt && surprise.endsAt < now)) {
    const message = "Este QR surpresa nao esta disponivel neste momento.";
    await recordPassportScan({
      student: input.student,
      missionId: input.mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "SURPRISE_INACTIVE",
      message,
    });
    return { pointsAwarded: 0, missionKey: input.mission.key, result: "SURPRISE_INACTIVE", message };
  }

  const businessKey = `surprise-effect:${input.student.studentNumber}:${surprise.id}`;
  const existingEffect = await prisma.passportSurpriseEffectLedger.findUnique({ where: { businessKey } });
  if (existingEffect) {
    const reveal = serializeSurpriseReveal({
      surprise,
      beforePoints: existingEffect.beforePoints,
      afterPoints: existingEffect.afterPoints,
      deltaPoints: 0,
      message: "Este QR surpresa ja tinha sido descoberto por ti.",
    });
    await recordPassportScan({
      student: input.student,
      missionId: input.mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "ALREADY_AWARDED",
      message: reveal.message,
      metadata: { surpriseQrId: surprise.id },
    });
    return { pointsAwarded: 0, missionKey: input.mission.key, result: "ALREADY_AWARDED", message: reveal.message, surprise: reveal };
  }

  if (surprise.maxUsesTotal) {
    const totalUses = await prisma.passportSurpriseEffectLedger.count({
      where: { surpriseQrId: surprise.id, status: "VALID" },
    });
    if (totalUses >= surprise.maxUsesTotal) {
      const message = "Este QR surpresa ja atingiu o limite total de descobertas.";
      await recordPassportScan({
        student: input.student,
        missionId: input.mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "MAX_REACHED",
        message,
        metadata: { surpriseQrId: surprise.id },
      });
      return { pointsAwarded: 0, missionKey: input.mission.key, result: "MAX_REACHED", message };
    }
  }

  const studentUses = await prisma.passportSurpriseEffectLedger.count({
    where: { surpriseQrId: surprise.id, studentNumber: input.student.studentNumber, status: "VALID" },
  });
  if (studentUses >= surprise.maxUsesPerStudent) {
    const message = "Ja descobriste este QR surpresa.";
    await recordPassportScan({
      student: input.student,
      missionId: input.mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "ALREADY_AWARDED",
      message,
      metadata: { surpriseQrId: surprise.id },
    });
    return { pointsAwarded: 0, missionKey: input.mission.key, result: "ALREADY_AWARDED", message };
  }

  const [beforePoints, previousNegativeTotal, qrLossCount, qrGainCount, qrNeutralCount, studentLossCount] = await Promise.all([
    passportPointBalance(input.student.studentNumber),
    negativeSurpriseTotal(input.student.studentNumber),
    prisma.passportSurpriseEffectLedger.count({
      where: { surpriseQrId: surprise.id, status: "VALID", deltaPoints: { lt: 0 } },
    }),
    prisma.passportSurpriseEffectLedger.count({
      where: { surpriseQrId: surprise.id, status: "VALID", deltaPoints: { gt: 0 } },
    }),
    prisma.passportSurpriseEffectLedger.count({
      where: { surpriseQrId: surprise.id, status: "VALID", deltaPoints: 0 },
    }),
    prisma.passportSurpriseEffectLedger.count({
      where: { studentNumber: input.student.studentNumber, status: "VALID", deltaPoints: { lt: 0 } },
    }),
  ]);
  const dynamic = resolveDynamicSurpriseEffect(surprise, {
    lossCount: qrLossCount,
    gainCount: qrGainCount,
    neutralCount: qrNeutralCount,
    studentLossCount,
    qrActionScanId: input.qrActionScan.id,
    studentNumber: input.student.studentNumber,
    scannedAt: input.qrActionScan.scannedAt,
  });
  const computed = computeSurpriseEffect({ surprise: dynamic.surprise, beforePoints, previousNegativeTotal });
  const message = surpriseMessage({
    name: dynamic.surprise.name,
    effectType: computed.effectType,
    effectValue: computed.effectValue,
    beforePoints: computed.beforePoints,
    afterPoints: computed.afterPoints,
    deltaPoints: computed.deltaPoints,
  });

  const metadata = {
    surpriseQrId: surprise.id,
    qrActionId: input.action.id,
    qrActionLabel: input.action.label,
    qrActionType: input.action.type,
    qrActionScanId: input.qrActionScan.id,
    displayCode: surprise.displayCode,
    batchCode: surprise.batchCode,
    dynamicActivated: dynamic.dynamicActivated,
    dynamicRules: dynamic.rules,
    ...(dynamic.resolver ?? {}),
    rarity: surprise.rarity,
    visibility: surprise.visibility,
    beforePoints: computed.beforePoints,
    afterPoints: computed.afterPoints,
  };

  await prisma.$transaction(async (tx) => {
    await tx.passportSurpriseEffectLedger.create({
      data: {
        businessKey,
        surpriseQrId: surprise.id,
        qrActionId: input.action.id,
        qrActionScanId: input.qrActionScan.id,
        studentId: input.student.id,
        studentNumber: input.student.studentNumber,
        studentName: input.student.name,
        studentCourse: input.student.course,
        effectType: computed.effectType,
        effectValue: computed.effectValue,
        targetScope: surprise.targetScope,
        beforePoints: computed.beforePoints,
        afterPoints: computed.afterPoints,
        deltaPoints: computed.deltaPoints,
        status: "VALID",
        message,
        metadataJson: JSON.stringify(metadata),
      },
    });

    await tx.passportPointLedger.upsert({
      where: {
        businessKey: `passport-point:${input.student.studentNumber}:fair-surprise:SURPRISE_QR:surprise:${surprise.id}`,
      },
      update: {},
      create: {
        businessKey: `passport-point:${input.student.studentNumber}:fair-surprise:SURPRISE_QR:surprise:${surprise.id}`,
        studentId: input.student.id,
        studentNumber: input.student.studentNumber,
        studentName: input.student.name,
        studentCourse: input.student.course,
        missionId: input.mission.id,
        sourceType: "SURPRISE_QR",
        sourceId: `surprise:${surprise.id}`,
        points: computed.deltaPoints,
        status: "VALID",
        reason: message,
        metadataJson: JSON.stringify(metadata),
      },
    });
  });

  await recordPassportScan({
    student: input.student,
    missionId: input.mission.id,
    action: input.action,
    qrActionScan: input.qrActionScan,
    pointsAwarded: computed.deltaPoints,
    result: "SURPRISE_APPLIED",
    message,
    metadata,
  });

  await syncPassportBadges(input.student);

  return {
    pointsAwarded: computed.deltaPoints,
    missionKey: input.mission.key,
    result: "SURPRISE_APPLIED",
    message,
    surprise: serializeSurpriseReveal({
      surprise: dynamic.surprise,
      beforePoints: computed.beforePoints,
      afterPoints: computed.afterPoints,
      deltaPoints: computed.deltaPoints,
      message,
    }),
  };
}

export async function awardPassportForQrActionScan(input: {
  student: StudentContext;
  action: QrActionContext;
  qrActionScan: QrActionScanContext;
}) {
  const mission = await resolveMissionForQrAction(input.action);
  if (!mission || !mission.active || input.qrActionScan.result !== "SUCCESS") {
    await recordPassportScan({
      student: input.student,
      missionId: mission?.id ?? null,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: input.qrActionScan.result,
      message: input.qrActionScan.message,
    });
    return { pointsAwarded: 0, missionKey: mission?.key ?? null };
  }

  if (isPassportChallengeQrActionType(input.action.type)) {
    const message = "Desafio liberado. A pontuação depende da resposta correta.";
    await recordPassportScan({
      student: input.student,
      missionId: mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "CHALLENGE_READY",
      message,
    });
    return { pointsAwarded: 0, missionKey: mission.key, result: "CHALLENGE_READY", message };
  }

  if (isPassportSurpriseQrActionType(input.action.type)) {
    return applyPassportSurpriseQrEffect({
      student: input.student,
      action: input.action,
      qrActionScan: input.qrActionScan,
      mission,
    });
  }

  const now = new Date();
  if ((mission.startsAt && mission.startsAt > now) || (mission.endsAt && mission.endsAt < now)) {
    await recordPassportScan({
      student: input.student,
      missionId: mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded: 0,
      result: "OUT_OF_WINDOW",
      message: "Scan registado fora da janela de pontuação.",
    });
    return { pointsAwarded: 0, missionKey: mission.key };
  }

  if (input.action.type === "COOPERATIVE_MISSION_QR") {
    const cooperative = await awardCooperativeMission({
      student: input.student,
      mission,
      action: input.action,
      qrActionScan: input.qrActionScan,
    });
    await syncPassportBadges(input.student);
    return { ...cooperative, missionKey: mission.key };
  }

  if (input.action.type === "RECOVERY_SMART_QR") {
    const recovery = await awardSmartRecoveryMission({
      student: input.student,
      mission,
      action: input.action,
      qrActionScan: input.qrActionScan,
    });
    await syncPassportBadges(input.student);
    return { ...recovery, missionKey: mission.key };
  }

  let source = sourceForQrAction(input.action);
  let metadata: Record<string, unknown> = {
    qrActionId: input.action.id,
    qrActionLabel: input.action.label,
    qrActionType: input.action.type,
    qrActionScanId: input.qrActionScan.id,
    targetId: input.action.targetId,
    eventKey: input.action.eventKey,
    eventLabel: input.action.eventLabel,
  };

  if (input.action.type === "NUCLEUS_MEMBER_BONUS") {
    const actionMetadata = parsePassportMetadata(input.action.targetMeta);
    const credentialId = numberFromMetadata(actionMetadata, "credentialId") ?? input.action.targetId ?? input.action.id;
    const memberStudentNumber = textFromMetadata(actionMetadata, "memberStudentNumber");
    const memberName = textFromMetadata(actionMetadata, "memberName");
    const memberRole = textFromMetadata(actionMetadata, "memberRole");

    if (memberStudentNumber && memberStudentNumber === input.student.studentNumber) {
      const message = "Apanhado no espelho. Esse QR é teu, campeão.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "SELF_SCAN",
        message,
        metadata: { credentialId, memberStudentNumber, memberName, memberRole },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "SELF_SCAN", message };
    }

    const awarded = await awardMissionPoints({
      student: input.student,
      mission,
      sourceType: "NUCLEUS_MEMBER",
      sourceId: `credential:${credentialId}`,
      reason: "Pontos por validar passe oficial de membro do núcleo.",
      metadata: {
        ...metadata,
        credentialId,
        memberStudentNumber,
        memberName,
        memberRole,
        memberTeam: textFromMetadata(actionMetadata, "memberTeam"),
        memberAccessLevel: textFromMetadata(actionMetadata, "memberAccessLevel"),
      },
    });

    let pointsAwarded = awarded.pointsAwarded;
    if (awarded.created && isStrategicNucleusRole(actionMetadata)) {
      pointsAwarded += await awardComboMission({
        student: input.student,
        missionKey: "mentor-found-bonus",
        sourceId: `credential:${credentialId}`,
        reason: "Pontos por encontrar membro estratégico do núcleo.",
        metadata: { credentialId, memberStudentNumber, memberName, memberRole },
      });
    }

    const message = awarded.created
      ? input.qrActionScan.message || "Passe de membro do núcleo validado."
      : "Esse crachá já assinou o teu passaporte. Vai conhecer outro.";
    await recordPassportScan({
      student: input.student,
      missionId: mission.id,
      action: input.action,
      qrActionScan: input.qrActionScan,
      pointsAwarded,
      result: awarded.created ? "SUCCESS" : "ALREADY_AWARDED",
      message,
      metadata: { credentialId, memberStudentNumber, memberName, memberRole },
    });

    const comboPoints = await awardPerfectSequenceCombo(input.student);
    await syncPassportBadges(input.student);

    return {
      pointsAwarded: pointsAwarded + comboPoints,
      missionKey: mission.key,
      result: awarded.created ? "SUCCESS" : "ALREADY_AWARDED",
      message,
    };
  }

  if (input.action.type === "NETWORKING_CROSS_COURSE") {
    if (!input.action.targetId) {
      const message = "QR de networking sem estudante associado.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "INVALID_TARGET",
        message,
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "INVALID_TARGET", message };
    }

    const peer = await prisma.student.findUnique({
      where: { id: input.action.targetId },
      select: { id: true, studentNumber: true, name: true, course: true },
    });

    if (!peer) {
      const message = "Estudante do QR de networking não encontrado.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "INVALID_TARGET",
        message,
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "INVALID_TARGET", message };
    }

    if (peer.id === input.student.id || peer.studentNumber === input.student.studentNumber) {
      const message = "Apanhado no espelho. Esse QR é teu, campeão.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "SELF_SCAN",
        message,
        metadata: { peerStudentNumber: peer.studentNumber, peerCourse: peer.course },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "SELF_SCAN", message };
    }

    const scannerCourse = normalizeCourseKey(input.student.course);
    const peerCourse = normalizeCourseKey(peer.course);
    if (!scannerCourse || !peerCourse) {
      const message = "Networking registado, mas sem pontos porque falta curso em um dos perfis.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "COURSE_REQUIRED",
        message,
        metadata: { peerStudentNumber: peer.studentNumber, peerCourse: peer.course },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "COURSE_REQUIRED", message };
    }

    if (scannerCourse === peerCourse) {
      const message = "Boa conversa, mas os pontos são para misturar cursos.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "SAME_COURSE",
        message,
        metadata: { peerStudentNumber: peer.studentNumber, peerCourse: peer.course },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "SAME_COURSE", message };
    }

    const pair = [input.student.studentNumber, peer.studentNumber].sort();
    source = {
      sourceType: "NETWORKING_PAIR",
      sourceId: `pair:${pair[0]}:${pair[1]}`,
    };

    const existingPair = await prisma.passportPointLedger.findFirst({
      where: {
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        status: "VALID",
      },
    });

    if (existingPair) {
      const message = "Este par de networking já foi validado no Passaporte.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "ALREADY_AWARDED",
        message,
        metadata: { peerStudentNumber: peer.studentNumber, peerCourse: peer.course, sourceId: source.sourceId },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "ALREADY_AWARDED", message };
    }

    metadata = {
      ...metadata,
      peerStudentNumber: peer.studentNumber,
      peerName: peer.name,
      peerCourse: peer.course,
      sourceId: source.sourceId,
    };
  }

  if (input.action.type === "STAND_VISIT" && input.action.targetId) {
    const submission = await prisma.submission.findFirst({
      where: { id: input.action.targetId, status: "APPROVED", deletedAt: null },
      select: {
        id: true,
        name: true,
        area: true,
        studentNumberSnapshot: true,
        student: { select: { studentNumber: true } },
        memberConfirmations: {
          where: { confirmedAt: { not: null } },
          select: { studentNumber: true },
        },
      },
    });

    if (!submission) {
      const message = "Este QR de projeto já não está disponível.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "PROJECT_UNAVAILABLE",
        message,
        metadata: { submissionId: input.action.targetId },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "PROJECT_UNAVAILABLE", message };
    }

    const ownerNumbers = new Set([
      submission?.studentNumberSnapshot,
      submission?.student?.studentNumber,
      ...(submission?.memberConfirmations.map((member) => member.studentNumber) ?? []),
    ].filter((value): value is string => Boolean(value)));

    if (ownerNumbers.has(input.student.studentNumber)) {
      const message = "Boa tentativa, mas a casa não joga contra si mesma.";
      await recordPassportScan({
        student: input.student,
        missionId: mission.id,
        action: input.action,
        qrActionScan: input.qrActionScan,
        pointsAwarded: 0,
        result: "SELF_STAND",
        message,
        metadata: { submissionId: submission?.id ?? input.action.targetId, submissionName: submission?.name ?? null },
      });
      return { pointsAwarded: 0, missionKey: mission.key, result: "SELF_STAND", message };
    }

    metadata = {
      ...metadata,
      submissionId: submission?.id ?? input.action.targetId,
      submissionName: submission?.name ?? null,
      submissionArea: submission?.area ?? null,
    };
  }

  const awarded = await awardMissionPoints({
    student: input.student,
    mission,
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    reason: `Missão concluída: ${mission.title}.`,
    metadata,
  });

  await recordPassportScan({
    student: input.student,
    missionId: mission.id,
    action: input.action,
    qrActionScan: input.qrActionScan,
    pointsAwarded: awarded.pointsAwarded,
    result: awarded.created ? "SUCCESS" : "ALREADY_AWARDED",
    message: awarded.created ? input.qrActionScan.message : "Pontuação já atribuída para esta missão.",
    metadata,
  });

  let comboPoints = 0;
  if (awarded.created) {
    if (input.action.type === "WORKSHOP_CHECKIN") {
      comboPoints += await awardWorkshopMasterCombo(input.student);
    }
    if (input.action.type === "STAND_VISIT") {
      comboPoints += await awardStandExplorerCombo(input.student);
      comboPoints += await awardBalancedExplorerCombo(input.student);
    }
    if (input.action.type === "NETWORKING_CROSS_COURSE") {
      comboPoints += await awardNetworkingTriadCombo(input.student);
    }
    if (input.action.type === "STAND_VISIT" || input.action.type === "NETWORKING_CROSS_COURSE") {
      comboPoints += await awardPerfectSequenceCombo(input.student);
    }
  }

  const journeyPoints = await awardJourneyCompletionIfReady(input.student);
  await syncPassportBadges(input.student);

  return {
    pointsAwarded: awarded.pointsAwarded + comboPoints + journeyPoints,
    missionKey: mission.key,
    result: awarded.created ? "SUCCESS" : "ALREADY_AWARDED",
    message: awarded.created ? input.qrActionScan.message : "Pontuação já atribuída para esta missão.",
  };
}

export async function syncPassportFromExistingActivity(studentId: number) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, studentNumber: true, name: true, course: true },
  });
  if (!student) return null;

  await ensurePassportCatalog();
  const participationMission = await prisma.passportMission.findUnique({
    where: { key: "accept-challenge" },
  });
  const participationBusinessKey = `passport-participation:${student.studentNumber}`;
  const existingParticipation = await prisma.passportPointLedger.findUnique({
    where: { businessKey: participationBusinessKey },
  });
  if (!existingParticipation) return student;

  if (existingParticipation && participationMission?.active) {
    await prisma.passportPointLedger.upsert({
      where: { businessKey: participationBusinessKey },
      update: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        studentName: student.name,
        studentCourse: student.course,
        missionId: participationMission.id,
        sourceType: "PASSPORT_JOIN",
        points: participationMission.points,
      },
      create: {
        businessKey: participationBusinessKey,
        studentId: student.id,
        studentNumber: student.studentNumber,
        studentName: student.name,
        studentCourse: student.course,
        missionId: participationMission.id,
        sourceType: "PASSPORT_JOIN",
        sourceId: "minha-area-desafio",
        points: participationMission.points,
        reason: "Estudante entrou oficialmente no desafio do Passaporte Digital.",
      },
    });
  }

  const joinedAt = existingParticipation.awardedAt;
  const eventMission = await prisma.passportMission.findUnique({ where: { key: "event-checkin" } });
  const checkIns = await prisma.attendanceCheckIn.findMany({
    where: {
      studentId,
      checkedInAt: { gte: joinedAt },
    },
    orderBy: { checkedInAt: "asc" },
  });

  if (eventMission) {
    for (const checkIn of checkIns) {
      await awardMissionPoints({
        student,
        mission: eventMission,
        sourceType: "EVENT",
        sourceId: checkIn.eventKey || DEFAULT_EVENT_KEY,
        reason: `Presença registada em ${checkIn.eventLabel}.`,
        metadata: {
          attendanceCheckInId: checkIn.id,
          checkedInByStudentNumber: checkIn.checkedInByStudentNumber,
        },
      });
    }
  }

  const scans = await prisma.qrActionScan.findMany({
    where: {
      studentId,
      scannedAt: { gte: joinedAt },
    },
    include: { qrAction: true },
    orderBy: { scannedAt: "asc" },
  });

  for (const scan of scans) {
    await awardPassportForQrActionScan({
      student,
      action: scan.qrAction,
      qrActionScan: {
        id: scan.id,
        result: scan.result,
        message: scan.message,
        scannedAt: scan.scannedAt,
      },
    });
  }

  await awardJourneyCompletionIfReady(student);
  await syncPassportBadges(student);

  return student;
}

export async function resetPassportChallengeProgress() {
  return prisma.$transaction(async (tx) => {
    const passportActions = await tx.qrAction.findMany({
      where: {
        OR: [
          { passportMissionId: { not: null } },
          { type: { in: [...PASSPORT_QR_ACTION_TYPES] } },
        ],
      },
      select: { id: true },
    });
    const passportActionIds = passportActions.map((action) => action.id);

    const challengeAnswers = await tx.passportChallengeAnswer.deleteMany({});
    const surpriseEffects = await tx.passportSurpriseEffectLedger.deleteMany({});
    const scans = await tx.passportScan.deleteMany({});
    const studentBadges = await tx.passportStudentBadge.deleteMany({});
    const rankingFreezes = await tx.passportRankingFreeze.deleteMany({});
    const pointLedger = await tx.passportPointLedger.deleteMany({});
    const qrActionScans = passportActionIds.length > 0
      ? await tx.qrActionScan.deleteMany({ where: { qrActionId: { in: passportActionIds } } })
      : { count: 0 };

    return {
      challengeAnswersDeleted: challengeAnswers.count,
      surpriseEffectsDeleted: surpriseEffects.count,
      scansDeleted: scans.count,
      studentBadgesDeleted: studentBadges.count,
      rankingFreezesDeleted: rankingFreezes.count,
      pointLedgerDeleted: pointLedger.count,
      qrActionScansDeleted: qrActionScans.count,
    };
  });
}

function isPassportMissionComplete(key: string, counts: Record<string, number>) {
  if (key === CONSTRUCTIVE_FEEDBACK_MISSION_KEY) {
    return (counts[key] ?? 0) >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS;
  }
  return (counts[key] ?? 0) > 0;
}

function statusForMission(key: string, counts: Record<string, number>): PassportMissionStatus {
  if (isPassportMissionComplete(key, counts)) return "done";
  if (key === "accept-challenge") return "available";
  if (key === "affiliate-invite") {
    return (counts["accept-challenge"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "event-checkin") return "available";
  if (key === "workshop-checkin" || key === "stand-visit" || key === "cross-course-networking" || key === "special-quiz" || key === "fair-surprise") {
    return (counts["event-checkin"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "workshop-master-combo") {
    return (counts["workshop-checkin"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "stand-explorer-combo" || key === "balanced-explorer-combo") {
    return (counts["stand-visit"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "exhibitor-challenge") {
    return (counts["stand-visit"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === CONSTRUCTIVE_FEEDBACK_MISSION_KEY) {
    return (counts["stand-visit"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "networking-triad-combo") {
    return (counts["cross-course-networking"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "nucleus-member-bonus") {
    return (counts["event-checkin"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "point-battle") {
    return (counts["accept-challenge"] ?? 0) > 0 ? "available" : "locked";
  }
  if (key === "clue-chain" || key === "cooperative-mission" || key === "smart-recovery") {
    return (counts["event-checkin"] ?? 0) > 0 ? "available" : "locked";
  }
  return "locked";
}

export async function getPassportSummary(
  studentId: number,
  options: { referralSecret?: string; publicAppUrl?: string | null } = {},
) {
  const student = await syncPassportFromExistingActivity(studentId);
  if (!student) return null;

  const [missions, ledgers, badges, scans, rankingRows, surpriseEffects, participationLedger, participantCount] = await Promise.all([
    prisma.passportMission.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.passportPointLedger.findMany({
      where: { studentNumber: student.studentNumber, status: "VALID" },
      include: { mission: { select: { key: true } } },
      orderBy: { awardedAt: "desc" },
    }),
    prisma.passportBadge.findMany({
      where: { active: true },
      include: {
        studentBadges: {
          where: { studentNumber: student.studentNumber },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.passportScan.findMany({
      where: { studentNumber: student.studentNumber },
      include: { mission: { select: { key: true, title: true, type: true } } },
      orderBy: { scannedAt: "desc" },
      take: 20,
    }),
    prisma.passportPointLedger.groupBy({
      by: ["studentNumber"],
      where: { status: "VALID", sourceType: { not: "PASSPORT_PARTICIPATION" } },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 100,
    }),
    prisma.passportSurpriseEffectLedger.findMany({
      where: { studentNumber: student.studentNumber },
      include: { surpriseQr: { select: { displayCode: true, name: true, description: true, rarity: true, visibility: true } } },
      orderBy: { appliedAt: "desc" },
      take: 8,
    }),
    prisma.passportPointLedger.findUnique({
      where: { businessKey: `passport-participation:${student.studentNumber}` },
      select: { awardedAt: true, points: true, status: true },
    }),
    prisma.passportPointLedger.count({
      where: {
        status: "VALID",
        businessKey: { startsWith: "passport-participation:" },
      },
    }),
  ]);

  const counts = ledgers.reduce<Record<string, number>>((acc, item) => {
    const key = item.mission?.key;
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const pointsByMission = ledgers.reduce<Record<string, number>>((acc, item) => {
    const key = item.mission?.key;
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + item.points;
    return acc;
  }, {});
  const firstLedgerByMission = new Map<string, string>();
  for (const item of [...ledgers].reverse()) {
    if (item.mission?.key) firstLedgerByMission.set(item.mission.key, item.awardedAt.toISOString());
  }
  const validParticipationLedger = participationLedger?.status === "VALID" ? participationLedger : null;
  if (validParticipationLedger) {
    counts["accept-challenge"] = Math.max(counts["accept-challenge"] ?? 0, 1);
    pointsByMission["accept-challenge"] = Math.max(
      pointsByMission["accept-challenge"] ?? 0,
      validParticipationLedger.points,
    );
    if (!firstLedgerByMission.has("accept-challenge")) {
      firstLedgerByMission.set(
        "accept-challenge",
        validParticipationLedger.awardedAt.toISOString(),
      );
    }
  }

  const totalPoints = ledgers.reduce((sum, item) => sum + item.points, 0) +
    (validParticipationLedger &&
    !ledgers.some((item) => item.businessKey === `passport-participation:${student.studentNumber}`)
      ? validParticipationLedger.points
      : 0);
  const surpriseBonusPoints = Math.max(0, ledgers
    .filter((item) => item.sourceType === "SURPRISE_QR")
    .reduce((sum, item) => sum + item.points, 0));
  const referralLedgers = ledgers.filter((item) => item.sourceType === "PASSPORT_REFERRAL");
  const referralInviteCount = referralLedgers.length;
  const referralPoints = referralLedgers.reduce((sum, item) => sum + item.points, 0);
  const referralCode = options.referralSecret
    ? createPassportReferralCode(student.studentNumber, options.referralSecret)
    : null;
  const publicAppUrl = options.publicAppUrl?.replace(/\/$/, "") ?? null;
  const referralUrl = referralCode && publicAppUrl
    ? `${publicAppUrl}/desafio/convite/${encodeURIComponent(referralCode)}`
    : null;
  const visibleMissions = missions.filter((mission) => mission.key !== "special-quiz" || (counts["special-quiz"] ?? 0) > 0);
  const missionAvailablePoints = visibleMissions.reduce((sum, mission) => sum + mission.points, 0);
  const completedMissions = visibleMissions.filter((mission) =>
    isPassportMissionComplete(mission.key, counts),
  ).length;
  const progressPercent = visibleMissions.length > 0
    ? Math.round((completedMissions / visibleMissions.length) * 100)
    : 0;
  const rankingIndex = rankingRows.findIndex((row) => row.studentNumber === student.studentNumber);

  return {
    studentNumber: student.studentNumber,
    joinedAt: validParticipationLedger?.awardedAt.toISOString() ?? null,
    participantCount,
    points: totalPoints,
    surpriseBonusPoints,
    totalAvailablePoints: missionAvailablePoints + PASSPORT_SURPRISE_POINTS_CAP + PASSPORT_RECOVERY_POINTS,
    pointCaps: {
      missionPoints: missionAvailablePoints,
      surprisePointsCap: PASSPORT_SURPRISE_POINTS_CAP,
      recoveryPointsCap: PASSPORT_RECOVERY_POINTS,
      totalAvailablePoints: missionAvailablePoints + PASSPORT_SURPRISE_POINTS_CAP + PASSPORT_RECOVERY_POINTS,
    },
    completedMissions,
    totalMissions: visibleMissions.length,
    progressPercent,
    ranking: rankingIndex >= 0
      ? {
        position: rankingIndex + 1,
        points: rankingRows[rankingIndex]._sum.points ?? 0,
      }
      : null,
    missions: visibleMissions.map((mission) => ({
      id: mission.id,
      key: mission.key,
      type: mission.type,
      title: mission.title,
      description: mission.description,
      points: mission.points,
      pointsEarned: pointsByMission[mission.key] ?? 0,
      completions: counts[mission.key] ?? 0,
      status: statusForMission(mission.key, counts),
      completedAt: firstLedgerByMission.get(mission.key) ?? null,
    })),
    badges: badges.map((badge) => {
      const earned = badge.studentBadges[0] ?? null;
      return {
        id: badge.id,
        key: badge.key,
        label: badge.label,
        description: badge.description,
        icon: badge.icon,
        earned: Boolean(earned),
        awardedAt: earned?.awardedAt.toISOString() ?? null,
      };
    }),
    recentScans: scans.map((scan) => ({
      id: scan.id,
      missionKey: scan.mission?.key ?? null,
      missionTitle: scan.mission?.title ?? null,
      missionType: scan.mission?.type ?? null,
      result: scan.result,
      pointsAwarded: scan.pointsAwarded,
      message: scan.message,
      scannedAt: scan.scannedAt.toISOString(),
    })),
    recentSurprises: surpriseEffects.map((effect) => ({
      id: effect.id,
      displayCode: effect.surpriseQr?.displayCode ?? null,
      name: effect.surpriseQr?.name ?? "QR surpresa",
      description: effect.surpriseQr?.description ?? null,
      effectType: effect.effectType,
      effectValue: effect.effectValue,
      rarity: effect.surpriseQr?.rarity ?? "COMMON",
      beforePoints: effect.beforePoints,
      afterPoints: effect.afterPoints,
      deltaPoints: effect.deltaPoints,
      message: effect.message,
      appliedAt: effect.appliedAt.toISOString(),
    })),
    referral: {
      code: referralCode,
      url: referralUrl,
      inviteCount: referralInviteCount,
      pointsEarned: referralPoints,
      nextMilestone: Math.floor(referralInviteCount / 10) * 10 + 10,
    },
  };
}

export async function getPassportAdminOverview() {
  await ensurePassportCatalog();

  const [participants, activePlayers, totalScans, totalPoints, missions, leaderboard] = await Promise.all([
    prisma.passportPointLedger.groupBy({
      by: ["studentNumber"],
      where: { status: "VALID" },
      _sum: { points: true },
    }),
    prisma.passportPointLedger.groupBy({
      by: ["studentNumber"],
      where: { status: "VALID", sourceType: { not: "PASSPORT_PARTICIPATION" } },
      _sum: { points: true },
    }),
    prisma.passportScan.count(),
    prisma.passportPointLedger.aggregate({
      where: { status: "VALID" },
      _sum: { points: true },
    }),
    prisma.passportMission.findMany({
      where: { active: true },
      include: { _count: { select: { scans: true, pointLedger: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.passportPointLedger.groupBy({
      by: ["studentNumber"],
      where: { status: "VALID", sourceType: { not: "PASSPORT_PARTICIPATION" } },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 20,
    }),
  ]);

  const students = await prisma.student.findMany({
    where: { studentNumber: { in: leaderboard.map((row) => row.studentNumber) } },
    select: { studentNumber: true, name: true, course: true },
  });
  const studentByNumber = new Map(students.map((student) => [student.studentNumber, student]));

  return {
    participants: participants.length,
    activePlayers: activePlayers.length,
    totalScans,
    totalPoints: totalPoints._sum.points ?? 0,
    missions: missions.map((mission) => ({
      id: mission.id,
      key: mission.key,
      type: mission.type,
      title: mission.title,
      points: mission.points,
      active: mission.active,
      scansCount: mission._count.scans,
      ledgerCount: mission._count.pointLedger,
    })),
    leaderboard: leaderboard.map((row, index) => {
      const student = studentByNumber.get(row.studentNumber);
      return {
        position: index + 1,
        studentNumber: row.studentNumber,
        studentName: student?.name ?? null,
        studentCourse: student?.course ?? null,
        points: row._sum.points ?? 0,
      };
    }),
  };
}

export async function listPassportMissions() {
  await ensurePassportCatalog();
  return prisma.passportMission.findMany({ orderBy: [{ active: "desc" }, { id: "asc" }] });
}

async function buildPassportRankingRows(limit = 100) {
  const ledgers = await prisma.passportPointLedger.findMany({
    where: { status: "VALID", sourceType: { not: "PASSPORT_PARTICIPATION" } },
    include: { mission: { select: { key: true, type: true } } },
    orderBy: { awardedAt: "asc" },
  });

  const grouped = new Map<string, {
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    points: number;
    diversity: Set<string>;
    workshops: number;
    completedAt: Date | null;
  }>();

  for (const ledger of ledgers) {
    const item = grouped.get(ledger.studentNumber) ?? {
      studentNumber: ledger.studentNumber,
      studentName: ledger.studentName,
      studentCourse: ledger.studentCourse,
      points: 0,
      diversity: new Set<string>(),
      workshops: 0,
      completedAt: null,
    };
    item.points += ledger.points;
    if (ledger.mission?.type) item.diversity.add(ledger.mission.type);
    if (ledger.mission?.key === "workshop-checkin" || ledger.mission?.type === "WORKSHOP_CHECKIN") item.workshops += 1;
    item.completedAt = ledger.awardedAt;
    grouped.set(ledger.studentNumber, item);
  }

  const students = await prisma.student.findMany({
    where: { studentNumber: { in: Array.from(grouped.keys()) } },
    select: { studentNumber: true, name: true, course: true },
  });
  const studentByNumber = new Map(students.map((student) => [student.studentNumber, student]));

  return Array.from(grouped.values())
    .map((item) => {
      const student = studentByNumber.get(item.studentNumber);
      return {
        studentNumber: item.studentNumber,
        studentName: student?.name ?? item.studentName,
        studentCourse: student?.course ?? item.studentCourse,
        points: item.points,
        diversityScore: item.diversity.size,
        workshops: item.workshops,
        completedAt: item.completedAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => (
      b.points - a.points
      || b.diversityScore - a.diversityScore
      || b.workshops - a.workshops
      || String(a.completedAt ?? "9999").localeCompare(String(b.completedAt ?? "9999"))
      || a.studentNumber.localeCompare(b.studentNumber)
    ))
    .slice(0, limit)
    .map((item, index) => ({ position: index + 1, ...item }));
}

export async function getPassportLeaderboard(limit = 10) {
  return buildPassportRankingRows(limit);
}

export async function getPassportAdminReports() {
  await ensurePassportCatalog();
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60_000);

  const [ranking, ledgers, scans, recentScanCount, suspiciousScans, activeFreeze] = await Promise.all([
    buildPassportRankingRows(200),
    prisma.passportPointLedger.findMany({
      where: { status: "VALID", awardedAt: { gte: fourteenDaysAgo } },
      include: { mission: { select: { type: true, title: true } } },
      orderBy: { awardedAt: "asc" },
    }),
    prisma.passportScan.findMany({
      where: { scannedAt: { gte: fourteenDaysAgo } },
      include: {
        mission: { select: { key: true, type: true, title: true } },
        qrAction: { select: { id: true, type: true, label: true, targetId: true, targetMeta: true, eventKey: true, eventLabel: true } },
      },
      orderBy: { scannedAt: "desc" },
      take: 2000,
    }),
    prisma.passportScan.count({ where: { scannedAt: { gte: fifteenMinutesAgo } } }),
    prisma.passportScan.count({ where: { reviewStatus: "SUSPECT" } }),
    prisma.passportRankingFreeze.findFirst({ where: { active: true }, orderBy: { frozenAt: "desc" } }),
  ]);

  const byCourse = new Map<string, { course: string; participants: number; points: number }>();
  for (const row of ranking) {
    const course = row.studentCourse?.trim() || "Sem curso";
    const item = byCourse.get(course) ?? { course, participants: 0, points: 0 };
    item.participants += 1;
    item.points += row.points;
    byCourse.set(course, item);
  }

  const byMissionType = new Map<string, { type: string; title: string; points: number; entries: number }>();
  const byPeriod = new Map<string, { date: string; points: number; scans: number }>();
  for (const ledger of ledgers) {
    const type = ledger.mission?.type ?? ledger.sourceType;
    const item = byMissionType.get(type) ?? { type, title: ledger.mission?.title ?? type, points: 0, entries: 0 };
    item.points += ledger.points;
    item.entries += 1;
    byMissionType.set(type, item);

    const date = ledger.awardedAt.toISOString().slice(0, 10);
    const period = byPeriod.get(date) ?? { date, points: 0, scans: 0 };
    period.points += ledger.points;
    byPeriod.set(date, period);
  }

  const attendanceByActivity = new Map<string, { key: string; label: string; scans: number; uniqueStudents: Set<string> }>();
  const visitorsByExhibitor = new Map<string, { key: string; label: string; scans: number; uniqueStudents: Set<string> }>();
  for (const scan of scans) {
    const date = scan.scannedAt.toISOString().slice(0, 10);
    const period = byPeriod.get(date) ?? { date, points: 0, scans: 0 };
    period.scans += 1;
    byPeriod.set(date, period);

    if (scan.mission?.type === "WORKSHOP_CHECKIN" || scan.qrAction?.type === "WORKSHOP_CHECKIN") {
      const key = scan.qrAction?.eventKey ?? scan.qrAction?.targetMeta ?? scan.qrAction?.label ?? scan.mission?.key ?? "workshop";
      const item = attendanceByActivity.get(key) ?? { key, label: scan.qrAction?.eventLabel ?? scan.qrAction?.label ?? scan.mission?.title ?? key, scans: 0, uniqueStudents: new Set<string>() };
      item.scans += 1;
      item.uniqueStudents.add(scan.studentNumber);
      attendanceByActivity.set(key, item);
    }

    if (scan.mission?.type === "STAND_VISIT" || scan.qrAction?.type === "STAND_VISIT") {
      const key = scan.qrAction?.targetId ? `submission:${scan.qrAction.targetId}` : scan.qrAction?.label ?? scan.mission?.key ?? "stand";
      const item = visitorsByExhibitor.get(key) ?? { key, label: scan.qrAction?.targetMeta ?? scan.qrAction?.label ?? scan.mission?.title ?? key, scans: 0, uniqueStudents: new Set<string>() };
      item.scans += 1;
      item.uniqueStudents.add(scan.studentNumber);
      visitorsByExhibitor.set(key, item);
    }
  }

  const scanCountsByStudent = new Map<string, number>();
  for (const scan of scans.filter((item) => item.scannedAt >= fifteenMinutesAgo)) {
    scanCountsByStudent.set(scan.studentNumber, (scanCountsByStudent.get(scan.studentNumber) ?? 0) + 1);
  }

  return {
    ranking,
    rankingFrozen: activeFreeze
      ? {
        id: activeFreeze.id,
        frozenAt: activeFreeze.frozenAt.toISOString(),
        frozenByStudentNumber: activeFreeze.frozenByStudentNumber,
        note: activeFreeze.note,
      }
      : null,
    byCourse: Array.from(byCourse.values()).sort((a, b) => b.points - a.points),
    byMissionType: Array.from(byMissionType.values()).sort((a, b) => b.points - a.points),
    byPeriod: Array.from(byPeriod.values()).sort((a, b) => a.date.localeCompare(b.date)),
    attendanceByActivity: Array.from(attendanceByActivity.values()).map((item) => ({
      key: item.key,
      label: item.label,
      scans: item.scans,
      uniqueStudents: item.uniqueStudents.size,
    })).sort((a, b) => b.uniqueStudents - a.uniqueStudents),
    visitorsByExhibitor: Array.from(visitorsByExhibitor.values()).map((item) => ({
      key: item.key,
      label: item.label,
      scans: item.scans,
      uniqueStudents: item.uniqueStudents.size,
    })).sort((a, b) => b.uniqueStudents - a.uniqueStudents),
    operational: {
      scansPerMinuteLast15m: Number((recentScanCount / 15).toFixed(2)),
      suspiciousScans,
      burstStudents: Array.from(scanCountsByStudent.entries())
        .filter(([, count]) => count >= 10)
        .map(([studentNumber, count]) => ({ studentNumber, scansLast15m: count })),
    },
  };
}

export async function listPassportAdminLogs(input: {
  page?: number;
  limit?: number;
  search?: string;
  result?: string;
  reviewStatus?: string;
}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.max(10, Math.min(100, input.limit ?? 30));
  const search = input.search?.trim();
  const where = {
    ...(input.result ? { result: input.result } : {}),
    ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
    ...(search
      ? {
        OR: [
          { studentNumber: { contains: search } },
          { studentName: { contains: search } },
          { studentCourse: { contains: search } },
          { message: { contains: search } },
          { mission: { title: { contains: search } } },
          { qrAction: { label: { contains: search } } },
        ],
      }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.passportScan.count({ where }),
    prisma.passportScan.findMany({
      where,
      include: {
        mission: { select: { key: true, type: true, title: true } },
        qrAction: { select: { id: true, type: true, label: true, eventLabel: true, targetId: true } },
      },
      orderBy: [{ scannedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      studentNumber: item.studentNumber,
      studentName: item.studentName,
      studentCourse: item.studentCourse,
      missionKey: item.mission?.key ?? null,
      missionType: item.mission?.type ?? null,
      missionTitle: item.mission?.title ?? null,
      qrActionId: item.qrAction?.id ?? null,
      qrActionType: item.qrAction?.type ?? null,
      qrActionLabel: item.qrAction?.label ?? null,
      result: item.result,
      reviewStatus: item.reviewStatus,
      pointsAwarded: item.pointsAwarded,
      message: item.message,
      metadata: parsePassportMetadata(item.metadataJson),
      scannedAt: item.scannedAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      reviewedByStudentNumber: item.reviewedByStudentNumber,
      reviewNote: item.reviewNote,
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function requestPassportPointRecovery(input: {
  studentId: number;
  phone?: string | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  note?: string | null;
}) {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, studentNumber: true, name: true, phone: true },
  });
  if (!student) throw new Error("Estudante não encontrado.");

  const balance = await passportPointBalance(student.studentNumber);
  if (balance >= 0) {
    throw new Error("A recuperação paga fica disponível apenas para saldos negativos.");
  }

  return prisma.passportPointRecovery.create({
    data: {
      businessKey: `passport-recovery:${student.studentNumber}:${randomUUID().replace(/-/g, "")}`,
      studentId: student.id,
      studentNumber: student.studentNumber,
      studentName: student.name,
      phone: input.phone?.trim() || student.phone || null,
      amountKz: PASSPORT_RECOVERY_PRICE_KZ,
      requestedPoints: PASSPORT_RECOVERY_POINTS,
      paymentReference: input.paymentReference?.trim() || null,
      paymentProofUrl: input.paymentProofUrl?.trim() || null,
      note: input.note?.trim() || null,
    },
  });
}

export async function reviewPassportPointRecovery(input: {
  id: number;
  status: "CONFIRMED" | "REJECTED";
  actorStudentNumber?: string | null;
  note?: string | null;
}) {
  const recovery = await prisma.passportPointRecovery.findUnique({ where: { id: input.id } });
  if (!recovery) return null;
  if (recovery.status !== "PENDING_REVIEW") return recovery;

  if (input.status === "REJECTED") {
    return prisma.passportPointRecovery.update({
      where: { id: input.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByStudentNumber: input.actorStudentNumber ?? null,
        note: input.note?.trim() || recovery.note,
      },
    });
  }

  const balance = await passportPointBalance(recovery.studentNumber);
  const awardedPoints = balance < 0
    ? Math.min(PASSPORT_RECOVERY_POINTS, Math.abs(balance))
    : 0;

  return prisma.$transaction(async (tx) => {
    let ledgerId = recovery.ledgerId;
    if (awardedPoints > 0) {
      const ledger = await tx.passportPointLedger.create({
        data: {
          businessKey: `passport-point:${recovery.studentNumber}:recovery:${recovery.id}`,
          studentId: recovery.studentId,
          studentNumber: recovery.studentNumber,
          studentName: recovery.studentName,
          studentCourse: null,
          missionId: null,
          sourceType: "PASSPORT_RECOVERY_PAYMENT",
          sourceId: `recovery:${recovery.id}`,
          points: awardedPoints,
          status: "VALID",
          reason: `Recuperação validada pela organização (${PASSPORT_RECOVERY_PRICE_KZ} Kz).`,
          metadataJson: JSON.stringify({
            recoveryId: recovery.id,
            amountKz: recovery.amountKz,
            requestedPoints: recovery.requestedPoints,
            balanceBefore: balance,
          }),
        },
      });
      ledgerId = ledger.id;
    }

    return tx.passportPointRecovery.update({
      where: { id: input.id },
      data: {
        status: "CONFIRMED",
        awardedPoints,
        ledgerId,
        reviewedAt: new Date(),
        reviewedByStudentNumber: input.actorStudentNumber ?? null,
        note: input.note?.trim() || recovery.note,
      },
    });
  });
}

export async function reviewPassportScan(input: {
  scanId: number;
  reviewStatus: "AUTO" | "OK" | "SUSPECT" | "REJECTED";
  note?: string | null;
  actorStudentNumber?: string | null;
}) {
  return prisma.passportScan.update({
    where: { id: input.scanId },
    data: {
      reviewStatus: input.reviewStatus,
      reviewedAt: new Date(),
      reviewedByStudentNumber: input.actorStudentNumber ?? null,
      reviewNote: input.note?.trim() || null,
    },
  });
}

export async function revokePassportLedgerPoints(input: {
  ledgerId: number;
  reason: string;
  actorStudentNumber?: string | null;
}) {
  return prisma.passportPointLedger.update({
    where: { id: input.ledgerId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokedByStudentNumber: input.actorStudentNumber ?? null,
      revokeReason: input.reason.trim(),
    },
  });
}

export async function freezePassportRanking(input: {
  note?: string | null;
  actorStudentNumber?: string | null;
}) {
  const snapshot = await buildPassportRankingRows(200);
  await prisma.passportRankingFreeze.updateMany({
    where: { active: true },
    data: { active: false },
  });
  return prisma.passportRankingFreeze.create({
    data: {
      active: true,
      note: input.note?.trim() || null,
      frozenByStudentNumber: input.actorStudentNumber ?? null,
      snapshotJson: JSON.stringify({ generatedAt: new Date().toISOString(), ranking: snapshot }),
    },
  });
}

export async function exportPassportWinners(limit = 10) {
  const rows = await buildPassportRankingRows(limit);
  return rows.map((row) => ({
    position: row.position,
    studentNumber: row.studentNumber,
    studentName: row.studentName,
    studentCourse: row.studentCourse,
    points: row.points,
    diversityScore: row.diversityScore,
    workshops: row.workshops,
    completedAt: row.completedAt,
    prize: row.position === 1
      ? "Pagamento de 1 recurso no 2o semestre + 1 mes Prime Video + 1 mes HBO + 1 mes Duolingo Super + Certificado Top 3"
      : "Certificado Top 3",
  }));
}
