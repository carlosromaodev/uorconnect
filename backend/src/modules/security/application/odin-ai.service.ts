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
    caseContext,
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
    return {
      caseType: input.caseType,
      caseId: input.caseId,
      generatedAt: snapshot.generatedAt,
      windowHours: hours,
      riskScore: device.riskScore,
      riskLevel: device.riskLevel,
      reasons: device.reasons,
      summary: buildSummary(relatedEvents),
      subject: {
        label: `Dispositivo ${input.caseId}`,
        studentNumber: null,
        projectName: device.projects[0]?.submissionName ?? null,
      },
      relatedEvents: sortedSafeEvents(relatedEvents),
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
    return {
      caseType: input.caseType,
      caseId: input.caseId,
      generatedAt: snapshot.generatedAt,
      windowHours: hours,
      riskScore: student.riskScore,
      riskLevel: student.riskLevel,
      reasons: student.reasons,
      summary: buildSummary(relatedEvents),
      subject: {
        label: student.studentName ?? `Estudante ${student.studentNumber}`,
        studentNumber: student.studentNumber,
        projectName: student.projectsVoted[0]?.submissionName ?? null,
      },
      relatedEvents: sortedSafeEvents(relatedEvents),
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
    ],
    summary: buildSummary(relatedEvents),
    subject: {
      label: project.submissionName,
      studentNumber: null,
      projectName: project.submissionName,
    },
    relatedEvents: sortedSafeEvents(relatedEvents),
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

async function requestGeminiVerdict(env: Env, payload: ReturnType<typeof buildOdinAiCasePayload>) {
  if (!env.ODIN_AI_ENABLED) {
    throw new Error("ODIN AI está desativado por configuração.");
  }
  if (!env.GEMINI_API_KEY) {
    throw new Error("Gemini não configurado. Define GEMINI_API_KEY no ambiente da VPS.");
  }

  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `${env.GEMINI_API_BASE_URL.replace(/\/$/, "")}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini recusou a análise (${response.status}). Verifica a chave, quota e modelo configurado.`);
  }

  const parsed = JSON.parse(raw) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { totalTokenCount?: number };
  };
  const text = parsed.candidates?.[0]?.content?.parts
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
