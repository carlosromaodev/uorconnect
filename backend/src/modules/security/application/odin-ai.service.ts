import { createHash } from "node:crypto";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import {
  buildOdinRiskSnapshot,
  type OdinOverview,
  type OdinRawEvent,
  type OdinRiskLevel,
} from "./odin.service";

export type OdinAiCaseType = "DEVICE" | "STUDENT" | "PROJECT";
export type OdinAiActionType =
  | "MONITOR"
  | "REVIEW"
  | "INVALIDATE_VOTES"
  | "NOTIFY_FOR_APPEAL"
  | "ESCALATE_TO_ORGANIZATION";

export interface OdinAiSafeEvent {
  eventType: string;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  createdAt: string;
}

export type OdinAiStudentAccessType = "OFFICIAL" | "TEMPORARY";

export interface OdinAiStudentProfile {
  id: number;
  studentNumber: string;
  name: string | null;
  course: string | null;
  university: string | null;
  registrationSource: string | null;
  accessType: OdinAiStudentAccessType;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
  deletedReasonPresent: boolean;
  profileSignals: {
    hasEmail: boolean;
    emailDomain: string | null;
    hasPhone: boolean;
    hasAvatar: boolean;
    profileCompleted: boolean;
    academicSynced: boolean;
  };
  integrityFlags: string[];
  behaviorSummary: {
    loginAuditCount: number;
    voteCount: number;
    likeCount: number;
    commentCount: number;
    passportScanCount: number;
    passportPointLedgerCount: number;
    projectMembershipCount: number;
    ownedProjectCount: number;
  };
}

export interface OdinAiStudentDatabaseContext {
  coverage: {
    relatedStudents: number;
    officialAccounts: number;
    temporaryAccounts: number;
    deletedAccounts: number;
    invalidDataAccounts: number;
    missingCourseAccounts: number;
    projectMembers: number;
    unconfirmedProjectMembers: number;
  };
  students: OdinAiStudentProfile[];
  projectMembers: Array<{
    memberId: number;
    name: string;
    studentNumber: string | null;
    expectedStudentNumber: string | null;
    isExternal: boolean;
    externalOrganization: string | null;
    confirmed: boolean;
    linkedStudentId: number | null;
  }>;
  projectActivity?: {
    submissionId: number;
    name: string;
    type: string;
    status: string;
    area: string;
    course: string | null;
    descriptionSnippet: string;
    totalVotes: number;
    totalComments: number;
    totalMembers: number;
    confirmedMembers: number;
    totalScoreEvents: number;
    recentComments: Array<{
      author: string;
      course: string | null;
      accessType: OdinAiStudentAccessType;
      moderationStatus: string;
      contentSnippet: string;
      createdAt: string;
    }>;
  } | null;
  patterns: {
    courseDistribution: Array<{ course: string; students: number }>;
    sharedPhoneGroups: Array<{ studentCount: number; studentNumbers: string[] }>;
    temporaryOrDeletedVoters: number;
    profilesWithInvalidData: number;
    highActivityProfiles: Array<{
      studentNumber: string;
      voteCount: number;
      passportScanCount: number;
      projectMembershipCount: number;
    }>;
  };
  privacy: {
    rawPasswordsIncluded: false;
    rawTokensIncluded: false;
    rawPhonesIncluded: false;
    rawEmailsIncluded: false;
    note: string;
  };
}

export interface OdinAiCaseContext {
  caseType: OdinAiCaseType;
  caseId: string;
  generatedAt: string;
  windowHours: number;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  reasons: string[];
  summary: {
    totalEvents: number;
    loginCount: number;
    voteCount: number;
    distinctStudents: number;
    distinctProjects: number;
  };
  subject: {
    label: string;
    studentNumber: string | null;
    projectName: string | null;
  };
  relatedEvents: OdinAiSafeEvent[];
  studentDatabaseContext?: OdinAiStudentDatabaseContext;
  platformContext: {
    eventName: string;
    eventDate: string;
    currentPhase: string;
  };
}

export interface OdinAiVerdict {
  narrative: string;
  fraudProbability: number;
  legitimateProbability: number;
  mostLikelyScenario: string;
  alternativeScenario: string;
  recommendation: string;
  confidenceLevel: string;
  actionType: OdinAiActionType;
}

export interface OdinAiAnalysisDto extends OdinAiVerdict {
  id: number;
  caseType: OdinAiCaseType;
  caseId: string;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  modelVersion: string;
  promptVersion: string;
  tokensUsed: number | null;
  createdByStudentNumber: string | null;
  createdAt: string;
  feedbackCount: number;
}

export const ODIN_AI_PROMPT_VERSION = "odin-ai-v1";
const GEMINI_REQUEST_TIMEOUT_MS = 18_000;
const GEMINI_MAX_OUTPUT_TOKENS = 1_400;

const ALLOWED_ACTION_TYPES: OdinAiActionType[] = [
  "MONITOR",
  "REVIEW",
  "INVALIDATE_VOTES",
  "NOTIFY_FOR_APPEAL",
  "ESCALATE_TO_ORGANIZATION",
];

const ODIN_AI_SYSTEM_PROMPT = `És o motor de análise do sistema ODIN da UOR Connect.
O teu papel é analisar comportamentos de utilizadores num sistema de votação académica e determinar se são fraudulentos, suspeitos ou legítimos.

Contexto do sistema:
- Estudantes votam em projetos de inovação.
- Cada estudante tem 1 voto por projeto.
- O evento acontece presencialmente.
- Dispositivos podem ser partilhados em laboratórios.
- Grupos do mesmo curso podem votar juntos de forma legítima.
- Tens acesso seguro a um resumo da base de estudantes: tipo de conta, dados incompletos, contas eliminadas, projetos, votos e passaporte.
- Não recebes senhas, tokens, códigos de acesso, emails completos nem telefones completos.
- A origem oficial de confiança é Secretaria UOR ou ISPTEC. Login sem origem oficial não prova fraude sozinho, mas aumenta a necessidade de revisão.
- Compara o tempo login→voto: conversão humana tende a levar mais tempo; várias contas a votar em segundos no mesmo dispositivo sugerem posse prévia de credenciais.
- Considera comentários do projeto, dados do projeto, membros, presença confirmada, atividades na plataforma, votos e passaporte em conjunto antes de recomendar uma ação.

Ao analisar um caso, considera sempre:
1. Pode haver explicação legítima para este padrão?
2. A intenção é clara ou ambígua?
3. A ação recomendada é proporcional ao risco?

Nunca recomendas suspensão definitiva.
Nunca afirmas certeza absoluta.
Sempre apresentas o cenário alternativo legítimo.
Inclui sempre que a decisão final é da organização.

Responde APENAS em JSON com os campos:
narrative, fraud_probability, legitimate_probability,
most_likely_scenario, alternative_scenario,
recommendation, confidence_level, action_type.

action_type deve ser um destes valores:
MONITOR, REVIEW, INVALIDATE_VOTES, NOTIFY_FOR_APPEAL, ESCALATE_TO_ORGANIZATION.`;

function clampProbability(value: unknown, fallback: number) {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value.replace("%", "").trim())
      : Number.NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function safeText(value: unknown, fallback: string, maxLength = 1400) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function readField(source: Record<string, unknown>, snake: string, camel: string) {
  return source[snake] ?? source[camel];
}

type OdinAiStudentProfileRow = {
  id: number;
  studentNumber: string;
  name: string | null;
  email: string | null;
  course: string | null;
  phone: string | null;
  avatarUrl: string | null;
  university: string | null;
  registrationSource: string | null;
  academicSyncedAt: Date | null;
  profileCompletedAt: Date | null;
  deletedAt: Date | null;
  deletionReason?: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count: {
    loginAudits: number;
    votes: number;
    likes: number;
    comments: number;
    passportScans: number;
    passportPointLedger: number;
    submissionMemberships: number;
    submissions: number;
  };
};

function isOfficialRegistrationSource(value?: string | null) {
  const source = value?.trim().toUpperCase() ?? "";
  return source === "SECRETARIA" || source === "ISPTEC_OFFICIAL";
}

function resolveStudentAccessType(student: Pick<OdinAiStudentProfileRow, "academicSyncedAt" | "registrationSource">): OdinAiStudentAccessType {
  return student.academicSyncedAt || isOfficialRegistrationSource(student.registrationSource)
    ? "OFFICIAL"
    : "TEMPORARY";
}

function emailDomain(value?: string | null) {
  const match = value?.trim().toLowerCase().match(/@([^@\s]+)$/);
  return match?.[1] ?? null;
}

function validStudentNumber(value?: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized === "sem-numero") return false;
  return normalized.length <= 40 && /^[\p{L}\p{N}._-]+$/u.test(normalized);
}

export function buildOdinAiStudentProfile(student: OdinAiStudentProfileRow): OdinAiStudentProfile {
  const accessType = resolveStudentAccessType(student);
  const integrityFlags: string[] = [];

  if (student.deletedAt) integrityFlags.push("CONTA_ELIMINADA");
  if (accessType === "TEMPORARY") integrityFlags.push("CONTA_TEMPORARIA");
  if (!validStudentNumber(student.studentNumber)) integrityFlags.push("NUMERO_ESTUDANTE_INVALIDO");
  if (!student.name?.trim()) integrityFlags.push("NOME_EM_FALTA");
  if (!student.course?.trim()) integrityFlags.push("CURSO_EM_FALTA");
  if (!student.phone?.trim() && !student.email?.trim()) integrityFlags.push("CONTACTO_EM_FALTA");
  if (!student.profileCompletedAt) integrityFlags.push("PERFIL_INCOMPLETO");
  if (!student.lastLoginAt && student._count.loginAudits === 0) integrityFlags.push("SEM_LOGIN_CONFIRMADO_RECENTE");

  return {
    id: student.id,
    studentNumber: student.studentNumber,
    name: student.name,
    course: student.course,
    university: student.university,
    registrationSource: student.registrationSource,
    accessType,
    createdAt: student.createdAt.toISOString(),
    lastLoginAt: student.lastLoginAt?.toISOString() ?? null,
    deletedAt: student.deletedAt?.toISOString() ?? null,
    deletedReasonPresent: Boolean(student.deletionReason?.trim()),
    profileSignals: {
      hasEmail: Boolean(student.email?.trim()),
      emailDomain: emailDomain(student.email),
      hasPhone: Boolean(student.phone?.trim()),
      hasAvatar: Boolean(student.avatarUrl?.trim()),
      profileCompleted: Boolean(student.profileCompletedAt),
      academicSynced: Boolean(student.academicSyncedAt),
    },
    integrityFlags,
    behaviorSummary: {
      loginAuditCount: student._count.loginAudits,
      voteCount: student._count.votes,
      likeCount: student._count.likes,
      commentCount: student._count.comments,
      passportScanCount: student._count.passportScans,
      passportPointLedgerCount: student._count.passportPointLedger,
      projectMembershipCount: student._count.submissionMemberships,
      ownedProjectCount: student._count.submissions,
    },
  };
}

const SECRET_FIELD_PATTERN = /(password|senha|token|secret|codeHash|providerResponseJson|authorization|cookie|jwt|apiKey)/i;

function sanitizeForGemini(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[removido: profundidade excessiva]";
  if (Array.isArray(value)) return value.map((item) => sanitizeForGemini(item, depth + 1));
  if (!value || typeof value !== "object" || value instanceof Date) return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_FIELD_PATTERN.test(key))
      .map(([key, entry]) => [key, sanitizeForGemini(entry, depth + 1)]),
  );
}

export function normalizeOdinAiVerdict(input: unknown): OdinAiVerdict {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const fraudProbability = clampProbability(readField(source, "fraud_probability", "fraudProbability"), 50);
  const legitimateProbability = clampProbability(
    readField(source, "legitimate_probability", "legitimateProbability"),
    100 - fraudProbability,
  );
  const rawAction = safeText(readField(source, "action_type", "actionType"), "REVIEW", 80).toUpperCase();
  const actionType = ALLOWED_ACTION_TYPES.includes(rawAction as OdinAiActionType)
    ? rawAction as OdinAiActionType
    : "REVIEW";

  return {
    narrative: safeText(source.narrative, "O Gemini não devolveu uma narrativa suficiente para este caso."),
    fraudProbability,
    legitimateProbability,
    mostLikelyScenario: safeText(
      readField(source, "most_likely_scenario", "mostLikelyScenario"),
      "Padrão suspeito que precisa de revisão humana.",
    ),
    alternativeScenario: safeText(
      readField(source, "alternative_scenario", "alternativeScenario"),
      "Pode existir uma explicação legítima, como dispositivo partilhado em laboratório ou apoio entre colegas.",
    ),
    recommendation: safeText(
      source.recommendation,
      "Rever manualmente o caso antes de qualquer ação. A decisão final é da organização.",
    ),
    confidenceLevel: safeText(readField(source, "confidence_level", "confidenceLevel"), "média", 80),
    actionType,
  };
}

export function buildOdinAiCasePayload(caseContext: OdinAiCaseContext) {
  return {
    promptVersion: ODIN_AI_PROMPT_VERSION,
    systemPrompt: ODIN_AI_SYSTEM_PROMPT,
    caseContext: sanitizeForGemini(caseContext) as OdinAiCaseContext,
  };
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function serializeAnalysis(analysis: {
  id: number;
  caseType: string;
  caseId: string;
  riskScore: number;
  riskLevel: string;
  narrative: string;
  fraudProbability: number;
  legitimateProbability: number;
  mostLikelyScenario: string;
  alternativeScenario: string;
  recommendation: string;
  confidenceLevel: string;
  actionType: string;
  modelVersion: string;
  promptVersion: string;
  tokensUsed: number | null;
  createdByStudentNumber: string | null;
  createdAt: Date;
  _count?: { feedback: number };
}): OdinAiAnalysisDto {
  return {
    id: analysis.id,
    caseType: analysis.caseType as OdinAiCaseType,
    caseId: analysis.caseId,
    riskScore: analysis.riskScore,
    riskLevel: analysis.riskLevel as OdinRiskLevel,
    narrative: analysis.narrative,
    fraudProbability: analysis.fraudProbability,
    legitimateProbability: analysis.legitimateProbability,
    mostLikelyScenario: analysis.mostLikelyScenario,
    alternativeScenario: analysis.alternativeScenario,
    recommendation: analysis.recommendation,
    confidenceLevel: analysis.confidenceLevel,
    actionType: analysis.actionType as OdinAiActionType,
    modelVersion: analysis.modelVersion,
    promptVersion: analysis.promptVersion,
    tokensUsed: analysis.tokensUsed,
    createdByStudentNumber: analysis.createdByStudentNumber,
    createdAt: analysis.createdAt.toISOString(),
    feedbackCount: analysis._count?.feedback ?? 0,
  };
}

function toRawEvent(event: {
  id: number;
  deviceId: string;
  studentId: number | null;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  eventType: string;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}): OdinRawEvent {
  return {
    id: event.id,
    deviceId: event.deviceId,
    studentId: event.studentId,
    studentNumber: event.studentNumber,
    studentName: event.studentName,
    studentCourse: event.studentCourse,
    eventType: event.eventType,
    targetType: event.targetType,
    targetId: event.targetId,
    targetLabel: event.targetLabel,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    createdAt: event.createdAt,
  };
}

function safeEvent(event: OdinRawEvent): OdinAiSafeEvent {
  return {
    eventType: event.eventType,
    studentNumber: event.studentNumber,
    studentName: event.studentName ?? null,
    studentCourse: event.studentCourse ?? null,
    targetType: event.targetType,
    targetId: event.targetId,
    targetLabel: event.targetLabel ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

function riskLevelFromScore(score: number): OdinRiskLevel {
  if (score >= 100) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

async function loadOdinEvents(windowHours: number) {
  const hours = Number.isFinite(windowHours) ? Math.min(24 * 14, Math.max(1, Math.floor(windowHours))) : 48;
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const events = await prisma.odinEvent.findMany({
    where: { createdAt: { gte: from } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return {
    hours,
    events: events.map(toRawEvent),
  };
}

function uniqueCount<T>(items: T[]) {
  return new Set(items.filter(Boolean)).size;
}

function buildSummary(events: OdinRawEvent[]) {
  return {
    totalEvents: events.length,
    loginCount: events.filter((event) => event.eventType === "LOGIN_SUCCESS").length,
    voteCount: events.filter((event) => event.eventType === "PROJECT_VOTE").length,
    distinctStudents: uniqueCount(events.map((event) => event.studentId ?? event.studentNumber)),
    distinctProjects: uniqueCount(events.filter((event) => event.targetType === "Submission").map((event) => event.targetId)),
  };
}

function findStudent(snapshot: OdinOverview, caseId: string) {
  return snapshot.students.find((student) =>
    String(student.studentId ?? "") === caseId || student.studentNumber === caseId
  );
}

function findProject(snapshot: OdinOverview, caseId: string) {
  const id = Number(caseId);
  if (!Number.isFinite(id)) return null;
  return snapshot.projects.find((project) => project.submissionId === id) ?? null;
}

function currentPhase() {
  const hour = new Date().getHours();
  if (hour < 9) return "Pré-abertura ou preparação";
  if (hour < 13) return "Início da atividade";
  if (hour < 17) return "Votação presencial ativa";
  return "Fecho ou pós-evento";
}

function emptyStudentDatabaseContext(projectMembers: OdinAiStudentDatabaseContext["projectMembers"] = []): OdinAiStudentDatabaseContext {
  return {
    coverage: {
      relatedStudents: 0,
      officialAccounts: 0,
      temporaryAccounts: 0,
      deletedAccounts: 0,
      invalidDataAccounts: 0,
      missingCourseAccounts: 0,
      projectMembers: projectMembers.length,
      unconfirmedProjectMembers: projectMembers.filter((member) => !member.confirmed).length,
    },
    students: [],
    projectMembers,
    projectActivity: null,
    patterns: {
      courseDistribution: [],
      sharedPhoneGroups: [],
      temporaryOrDeletedVoters: 0,
      profilesWithInvalidData: 0,
      highActivityProfiles: [],
    },
    privacy: {
      rawPasswordsIncluded: false,
      rawTokensIncluded: false,
      rawPhonesIncluded: false,
      rawEmailsIncluded: false,
      note: "O ODIN AI recebe apenas resumo seguro; senhas, tokens, códigos, telefones completos e emails completos ficam fora do payload.",
    },
  };
}

function normalizedPhoneKey(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 6 ? digits : null;
}

function buildCourseDistribution(students: OdinAiStudentProfile[]) {
  const byCourse = new Map<string, number>();
  for (const student of students) {
    const course = student.course?.trim() || "Curso em falta";
    byCourse.set(course, (byCourse.get(course) ?? 0) + 1);
  }
  return Array.from(byCourse.entries())
    .map(([course, count]) => ({ course, students: count }))
    .sort((left, right) => right.students - left.students || left.course.localeCompare(right.course))
    .slice(0, 12);
}

function buildSharedPhoneGroups(students: OdinAiStudentProfileRow[]) {
  const byPhone = new Map<string, string[]>();
  for (const student of students) {
    const key = normalizedPhoneKey(student.phone);
    if (!key) continue;
    byPhone.set(key, [...(byPhone.get(key) ?? []), student.studentNumber]);
  }
  return Array.from(byPhone.values())
    .filter((numbers) => numbers.length >= 2)
    .map((studentNumbers) => ({
      studentCount: studentNumbers.length,
      studentNumbers: studentNumbers.slice(0, 8),
    }))
    .slice(0, 10);
}

function buildStudentDatabaseReasons(context: OdinAiStudentDatabaseContext) {
  const reasons: string[] = [];
  if (context.coverage.invalidDataAccounts > 0) {
    reasons.push(`Base de estudantes: ${context.coverage.invalidDataAccounts} conta(s) com dados inválidos ou incompletos no contexto.`);
  }
  if (context.coverage.temporaryAccounts > 0) {
    reasons.push(`Base de estudantes: ${context.coverage.temporaryAccounts} conta(s) temporária(s), não confirmada(s) por Secretaria/ISPTEC.`);
  }
  if (context.coverage.deletedAccounts > 0) {
    reasons.push(`Base de estudantes: ${context.coverage.deletedAccounts} conta(s) eliminada(s) aparece(m) no padrão analisado.`);
  }
  if (context.patterns.sharedPhoneGroups.length > 0) {
    reasons.push(`Base de estudantes: ${context.patterns.sharedPhoneGroups.length} grupo(s) partilham o mesmo telefone normalizado.`);
  }
  if (context.coverage.unconfirmedProjectMembers > 0) {
    reasons.push(`Projeto: ${context.coverage.unconfirmedProjectMembers} membro(s) ainda sem confirmação de presença.`);
  }
  if (context.projectActivity) {
    reasons.push(`Projeto: ${context.projectActivity.totalComments} comentário(s), ${context.projectActivity.totalMembers} membro(s), ${context.projectActivity.confirmedMembers} presença(s) confirmada(s) e ${context.projectActivity.totalScoreEvents} evento(s) de pontuação do expositor.`);
  }
  return reasons;
}

async function loadProjectMembers(projectId?: number | null): Promise<OdinAiStudentDatabaseContext["projectMembers"]> {
  if (!projectId || !Number.isFinite(projectId)) return [];
  const members = await prisma.submissionMember.findMany({
    where: { submissionId: projectId },
    select: {
      id: true,
      name: true,
      studentId: true,
      expectedStudentNumber: true,
      studentNumber: true,
      isExternal: true,
      externalOrganization: true,
      confirmedAt: true,
    },
    orderBy: { id: "asc" },
  });

  return members.map((member) => ({
    memberId: member.id,
    name: member.name,
    studentNumber: member.studentNumber,
    expectedStudentNumber: member.expectedStudentNumber,
    isExternal: member.isExternal,
    externalOrganization: member.externalOrganization,
    confirmed: Boolean(member.confirmedAt),
    linkedStudentId: member.studentId,
  }));
}

async function loadProjectActivity(projectId?: number | null): Promise<OdinAiStudentDatabaseContext["projectActivity"]> {
  if (!projectId || !Number.isFinite(projectId)) return null;
  const submission = await prisma.submission.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      area: true,
      course: true,
      description: true,
      memberConfirmations: {
        select: { confirmedAt: true },
        take: 100,
      },
      studentComments: {
        select: {
          content: true,
          moderationStatus: true,
          createdAt: true,
          student: {
            select: {
              studentNumber: true,
              name: true,
              course: true,
              registrationSource: true,
              academicSyncedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      _count: {
        select: {
          studentVotes: true,
          studentComments: true,
          memberConfirmations: true,
          exhibitorScoreEvents: true,
        },
      },
    },
  });
  if (!submission) return null;

  return {
    submissionId: submission.id,
    name: submission.name,
    type: String(submission.type),
    status: String(submission.status),
    area: submission.area,
    course: submission.course,
    descriptionSnippet: submission.description.trim().slice(0, 600),
    totalVotes: submission._count.studentVotes,
    totalComments: submission._count.studentComments,
    totalMembers: submission._count.memberConfirmations,
    confirmedMembers: submission.memberConfirmations.filter((member) => member.confirmedAt).length,
    totalScoreEvents: submission._count.exhibitorScoreEvents,
    recentComments: submission.studentComments.map((comment) => {
      const accessType = comment.student?.academicSyncedAt || isOfficialRegistrationSource(comment.student?.registrationSource)
        ? "OFFICIAL" as const
        : "TEMPORARY" as const;
      return {
        author: comment.student?.name ?? comment.student?.studentNumber ?? "Conta sem nome",
        course: comment.student?.course ?? null,
        accessType,
        moderationStatus: comment.moderationStatus,
        contentSnippet: comment.content.trim().slice(0, 260),
        createdAt: comment.createdAt.toISOString(),
      };
    }),
  };
}

async function buildStudentDatabaseContext(
  relatedEvents: OdinRawEvent[],
  options: { projectId?: number | null } = {},
): Promise<OdinAiStudentDatabaseContext> {
  const [projectMembers, projectActivity] = await Promise.all([
    loadProjectMembers(options.projectId),
    loadProjectActivity(options.projectId),
  ]);
  const studentIds = new Set<number>();
  const studentNumbers = new Set<string>();

  for (const event of relatedEvents) {
    if (event.studentId) studentIds.add(event.studentId);
    if (event.studentNumber) studentNumbers.add(event.studentNumber);
  }
  for (const member of projectMembers) {
    if (member.linkedStudentId) studentIds.add(member.linkedStudentId);
    if (member.studentNumber) studentNumbers.add(member.studentNumber);
    if (member.expectedStudentNumber) studentNumbers.add(member.expectedStudentNumber);
  }

  const whereOr = [
    ...(studentIds.size ? [{ id: { in: Array.from(studentIds) } }] : []),
    ...(studentNumbers.size ? [{ studentNumber: { in: Array.from(studentNumbers) } }] : []),
  ];
  if (whereOr.length === 0) {
    return {
      ...emptyStudentDatabaseContext(projectMembers),
      projectActivity,
    };
  }

  const studentRows = await prisma.student.findMany({
    where: { OR: whereOr },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      email: true,
      course: true,
      phone: true,
      avatarUrl: true,
      university: true,
      registrationSource: true,
      academicSyncedAt: true,
      profileCompletedAt: true,
      deletedAt: true,
      deletionReason: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          loginAudits: true,
          votes: true,
          likes: true,
          comments: true,
          passportScans: true,
          passportPointLedger: true,
          submissionMemberships: true,
          submissions: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const students = studentRows.map(buildOdinAiStudentProfile);
  const temporaryOrDeletedNumbers = new Set(
    students
      .filter((student) => student.accessType === "TEMPORARY" || student.deletedAt)
      .map((student) => student.studentNumber),
  );
  const eventVoterNumbers = new Set(
    relatedEvents
      .filter((event) => event.eventType === "PROJECT_VOTE" && event.studentNumber)
      .map((event) => event.studentNumber as string),
  );

  return {
    coverage: {
      relatedStudents: students.length,
      officialAccounts: students.filter((student) => student.accessType === "OFFICIAL").length,
      temporaryAccounts: students.filter((student) => student.accessType === "TEMPORARY").length,
      deletedAccounts: students.filter((student) => Boolean(student.deletedAt)).length,
      invalidDataAccounts: students.filter((student) => student.integrityFlags.length > 0).length,
      missingCourseAccounts: students.filter((student) => student.integrityFlags.includes("CURSO_EM_FALTA")).length,
      projectMembers: projectMembers.length,
      unconfirmedProjectMembers: projectMembers.filter((member) => !member.confirmed).length,
    },
    students,
    projectMembers,
    projectActivity,
    patterns: {
      courseDistribution: buildCourseDistribution(students),
      sharedPhoneGroups: buildSharedPhoneGroups(studentRows),
      temporaryOrDeletedVoters: Array.from(eventVoterNumbers).filter((number) => temporaryOrDeletedNumbers.has(number)).length,
      profilesWithInvalidData: students.filter((student) => student.integrityFlags.length > 0).length,
      highActivityProfiles: [...students]
        .sort((left, right) =>
          (right.behaviorSummary.voteCount + right.behaviorSummary.passportScanCount + right.behaviorSummary.projectMembershipCount)
          - (left.behaviorSummary.voteCount + left.behaviorSummary.passportScanCount + left.behaviorSummary.projectMembershipCount)
        )
        .slice(0, 10)
        .map((student) => ({
          studentNumber: student.studentNumber,
          voteCount: student.behaviorSummary.voteCount,
          passportScanCount: student.behaviorSummary.passportScanCount,
          projectMembershipCount: student.behaviorSummary.projectMembershipCount,
        })),
    },
    privacy: {
      rawPasswordsIncluded: false,
      rawTokensIncluded: false,
      rawPhonesIncluded: false,
      rawEmailsIncluded: false,
      note: "O ODIN AI recebe apenas resumo seguro; senhas, tokens, códigos, telefones completos e emails completos ficam fora do payload.",
    },
  };
}

export async function resolveOdinAiCaseContext(
  env: Env,
  input: { caseType: OdinAiCaseType; caseId: string; windowHours?: number },
): Promise<OdinAiCaseContext> {
  const { hours, events } = await loadOdinEvents(input.windowHours ?? 48);
  const snapshot = buildOdinRiskSnapshot({ generatedAt: new Date(), events });
  const sortedSafeEvents = (items: OdinRawEvent[]) => items
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 120)
    .map(safeEvent);

  if (input.caseType === "DEVICE") {
    const device = snapshot.devices.find((item) => item.deviceId === input.caseId);
    if (!device) throw new Error("Caso ODIN de dispositivo não encontrado nesta janela.");
    const relatedEvents = events.filter((event) => event.deviceId === input.caseId);
    const studentDatabaseContext = await buildStudentDatabaseContext(relatedEvents);
    return {
      caseType: input.caseType,
      caseId: input.caseId,
      generatedAt: snapshot.generatedAt,
      windowHours: hours,
      riskScore: device.riskScore,
      riskLevel: device.riskLevel,
      reasons: [...device.reasons, ...buildStudentDatabaseReasons(studentDatabaseContext)],
      summary: buildSummary(relatedEvents),
      subject: {
        label: `Dispositivo ${input.caseId}`,
        studentNumber: null,
        projectName: device.projects[0]?.submissionName ?? null,
      },
      relatedEvents: sortedSafeEvents(relatedEvents),
      studentDatabaseContext,
      platformContext: {
        eventName: env.UORCONNECT_EVENT_NAME,
        eventDate: env.UORCONNECT_EVENT_DATE,
        currentPhase: currentPhase(),
      },
    };
  }

  if (input.caseType === "STUDENT") {
    const student = findStudent(snapshot, input.caseId);
    if (!student) throw new Error("Caso ODIN de estudante não encontrado nesta janela.");
    const relatedEvents = events.filter((event) =>
      String(event.studentId ?? "") === input.caseId || event.studentNumber === student.studentNumber
    );
    const studentDatabaseContext = await buildStudentDatabaseContext(relatedEvents);
    return {
      caseType: input.caseType,
      caseId: input.caseId,
      generatedAt: snapshot.generatedAt,
      windowHours: hours,
      riskScore: student.riskScore,
      riskLevel: student.riskLevel,
      reasons: [...student.reasons, ...buildStudentDatabaseReasons(studentDatabaseContext)],
      summary: buildSummary(relatedEvents),
      subject: {
        label: student.studentName ?? `Estudante ${student.studentNumber}`,
        studentNumber: student.studentNumber,
        projectName: student.projectsVoted[0]?.submissionName ?? null,
      },
      relatedEvents: sortedSafeEvents(relatedEvents),
      studentDatabaseContext,
      platformContext: {
        eventName: env.UORCONNECT_EVENT_NAME,
        eventDate: env.UORCONNECT_EVENT_DATE,
        currentPhase: currentPhase(),
      },
    };
  }

  const project = findProject(snapshot, input.caseId);
  if (!project) throw new Error("Caso ODIN de projeto não encontrado nesta janela.");
  const relatedEvents = events.filter((event) => event.targetType === "Submission" && String(event.targetId) === input.caseId);
  const studentDatabaseContext = await buildStudentDatabaseContext(relatedEvents, { projectId: project.submissionId });
  const riskScore = Math.min(100, 30 + project.suspiciousVotes * 8 + project.suspiciousDevices * 12 + project.suspiciousStudents * 4);
  return {
    caseType: input.caseType,
    caseId: input.caseId,
    generatedAt: snapshot.generatedAt,
    windowHours: hours,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    reasons: [
      `${project.suspiciousVotes} voto(s) sob análise para este projeto.`,
      `${project.suspiciousDevices} dispositivo(s) e ${project.suspiciousStudents} conta(s) associados ao padrão.`,
      ...buildStudentDatabaseReasons(studentDatabaseContext),
    ],
    summary: buildSummary(relatedEvents),
    subject: {
      label: project.submissionName,
      studentNumber: null,
      projectName: project.submissionName,
    },
    relatedEvents: sortedSafeEvents(relatedEvents),
    studentDatabaseContext,
    platformContext: {
      eventName: env.UORCONNECT_EVENT_NAME,
      eventDate: env.UORCONNECT_EVENT_DATE,
      currentPhase: currentPhase(),
    },
  };
}

function extractJsonObject(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini devolveu uma resposta sem JSON válido.");
    return JSON.parse(match[0]) as unknown;
  }
}

export function buildGeminiGenerationConfig(model: string) {
  return {
    temperature: 0.2,
    responseMimeType: "application/json",
    maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    ...(model.includes("2.5")
      ? {
          // ODIN precisa de um parecer curto e operacional. Sem este limite,
          // o Gemini 2.5 pode gastar tempo em raciocinio interno e estourar o proxy.
          thinkingConfig: { thinkingBudget: 0 },
        }
      : {}),
  };
}

function geminiErrorMessage(status: number, raw: string) {
  let providerMessage = "";
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string } };
    providerMessage = parsed.error?.message || parsed.error?.status || "";
  } catch {
    providerMessage = raw.trim().slice(0, 180);
  }

  if (status === 400) {
    return `Gemini recusou a análise por payload inválido. Verifica o formato enviado ao modelo. ${providerMessage}`.trim();
  }
  if (status === 401 || status === 403) {
    return "Gemini recusou a análise por chave sem permissão. Verifica a GEMINI_API_KEY configurada na VPS.";
  }
  if (status === 404) {
    return `Gemini recusou a análise porque o modelo configurado não está disponível. Modelo atual: ${providerMessage || "desconhecido"}.`;
  }
  if (status === 429) {
    return "Gemini recusou a análise por limite de quota ou excesso de pedidos. Aguarda alguns segundos e tenta novamente.";
  }
  if (status >= 500) {
    return "Gemini ficou indisponível temporariamente. Tenta novamente em instantes.";
  }
  return `Gemini recusou a análise (${status}). ${providerMessage || "Verifica chave, quota e modelo configurado."}`;
}

function parseGeminiResponse(raw: string) {
  try {
    return JSON.parse(raw) as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: { totalTokenCount?: number };
    };
  } catch {
    throw new Error("Gemini devolveu uma resposta inválida. Tenta gerar a análise novamente.");
  }
}

async function requestGeminiVerdict(env: Env, payload: ReturnType<typeof buildOdinAiCasePayload>) {
  if (!env.ODIN_AI_ENABLED) {
    throw new Error("ODIN AI está desativado por configuração.");
  }
  if (!env.GEMINI_API_KEY) {
    throw new Error("Gemini não configurado. Define GEMINI_API_KEY no ambiente da VPS.");
  }

  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `${env.GEMINI_API_BASE_URL.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: payload.systemPrompt }],
        },
        contents: [{
          role: "user",
          parts: [{
            text: JSON.stringify({
              instruction: "Analisa este caso ODIN e responde apenas no JSON combinado.",
              promptVersion: payload.promptVersion,
              caseContext: payload.caseContext,
            }),
          }],
        }],
        generationConfig: buildGeminiGenerationConfig(model),
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemini demorou demasiado para responder. Tenta novamente em instantes.");
    }
    throw new Error("Gemini não respondeu ao pedido. Verifica a ligação da VPS e tenta novamente.");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(geminiErrorMessage(response.status, raw));
  }

  const parsed = parseGeminiResponse(raw);
  const candidate = parsed.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini devolveu uma resposta incompleta. Tenta gerar a análise novamente.");
  }
  const text = candidate?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini não devolveu conteúdo analisável.");

  return {
    verdict: normalizeOdinAiVerdict(extractJsonObject(text)),
    rawResponseJson: raw.slice(0, 20000),
    tokensUsed: parsed.usageMetadata?.totalTokenCount ?? null,
    model,
  };
}

export async function runOdinAiCaseAnalysis(
  env: Env,
  input: {
    caseType: OdinAiCaseType;
    caseId: string;
    windowHours?: number;
    actorStudentNumber?: string | null;
  },
): Promise<OdinAiAnalysisDto> {
  const caseContext = await resolveOdinAiCaseContext(env, input);
  const payload = buildOdinAiCasePayload(caseContext);
  const gemini = await requestGeminiVerdict(env, payload);
  const payloadHash = hashPayload(payload);
  const analysis = await prisma.odinAiAnalysis.create({
    data: {
      caseType: input.caseType,
      caseId: input.caseId,
      riskScore: caseContext.riskScore,
      riskLevel: caseContext.riskLevel,
      narrative: gemini.verdict.narrative,
      fraudProbability: gemini.verdict.fraudProbability,
      legitimateProbability: gemini.verdict.legitimateProbability,
      mostLikelyScenario: gemini.verdict.mostLikelyScenario,
      alternativeScenario: gemini.verdict.alternativeScenario,
      recommendation: gemini.verdict.recommendation,
      confidenceLevel: gemini.verdict.confidenceLevel,
      actionType: gemini.verdict.actionType,
      modelVersion: gemini.model,
      promptVersion: payload.promptVersion,
      tokensUsed: gemini.tokensUsed,
      payloadHash,
      rawResponseJson: gemini.rawResponseJson,
      createdByStudentNumber: input.actorStudentNumber ?? null,
    },
    include: { _count: { select: { feedback: true } } },
  });

  return serializeAnalysis(analysis);
}

export async function listOdinAiAnalyses(input: {
  caseType?: OdinAiCaseType;
  caseId?: string;
  limit?: number;
}) {
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const analyses = await prisma.odinAiAnalysis.findMany({
    where: {
      ...(input.caseType ? { caseType: input.caseType } : {}),
      ...(input.caseId ? { caseId: input.caseId } : {}),
    },
    include: { _count: { select: { feedback: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return analyses.map(serializeAnalysis);
}

export async function recordOdinAiFeedback(input: {
  analysisId: number;
  actorStudentNumber?: string | null;
  useful: boolean;
  recommendationCorrect?: boolean | null;
  realityMatched?: boolean | null;
  note?: string | null;
}) {
  const analysis = await prisma.odinAiAnalysis.findUnique({
    where: { id: input.analysisId },
    select: { id: true },
  });
  if (!analysis) throw new Error("Análise ODIN AI não encontrada.");

  return prisma.odinAiFeedback.create({
    data: {
      analysisId: input.analysisId,
      actorStudentNumber: input.actorStudentNumber ?? null,
      useful: input.useful,
      recommendationCorrect: input.recommendationCorrect ?? null,
      realityMatched: input.realityMatched ?? null,
      note: input.note?.trim() || null,
    },
  });
}
