import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { buildValidationQrUrl, buildValidationUrl, extractValidationToken } from "../../validation/application/validation-links";
import { sendWhatsAppAutomationEvent } from "../../whatsapp/http/whatsapp.routes";
import { renderQrDataUri } from "../../../shared/qr";
import { escapeHtml, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { buildSubmissionSlug } from "../../submission/domain/submission-format";
import { notifyPassportGameEvent } from "../../game-notifications/game-notification.service";
import { extractStudentScanRouteTarget, type StudentScanRouteTarget } from "../application/student-scan-input";
import {
  PASSPORT_QR_ACTION_TYPES,
  awardPassportForQrActionScan,
  findActivePassportChallengeForQrAction,
  isPassportChallengeQrActionType,
  isPassportSurpriseQrActionType,
  type PassportSurpriseReveal,
} from "../../passport/application/passport.service";

const DEFAULT_EVENT_KEY = "main-event";
const DEFAULT_EVENT_LABEL = "Evento principal UOR Connect";

const QR_ACTION_TYPES = [...PASSPORT_QR_ACTION_TYPES, "COURSE_ENROLL"] as const;
type QrActionType = (typeof QR_ACTION_TYPES)[number];
const UOR_CONNECT_TEST_PROJECT_NAME = "uor connect";
const REPEATABLE_TEST_PROJECT_QR_TYPES = new Set(["STAND_VISIT", "EXHIBITOR_VOTE", "EXHIBITOR_CHALLENGE"]);

const credentialSchema = z.object({
  id: z.number(),
  token: z.string(),
  studentNumber: z.string(),
  studentName: z.string().nullable(),
  studentCourse: z.string().nullable(),
  label: z.string(),
  eventKey: z.string(),
  eventLabel: z.string(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  status: z.string(),
  isValid: z.boolean(),
  validationUrl: z.string(),
  qrImageUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const checkInSchema = z.object({
  id: z.number(),
  credentialId: z.number(),
  studentNumber: z.string(),
  studentName: z.string().nullable(),
  studentCourse: z.string().nullable(),
  eventKey: z.string(),
  eventLabel: z.string(),
  checkedInAt: z.string(),
  checkedInByStudentNumber: z.string(),
  notes: z.string().nullable(),
});

const checkInBodySchema = z.object({
  token: z.string().trim().max(300).optional(),
  studentNumber: z.string().trim().max(40).optional(),
  eventKey: z.string().trim().min(2).max(80).optional(),
  eventLabel: z.string().trim().min(2).max(140).optional(),
  notes: z.string().trim().max(280).optional().nullable(),
}).refine((value) => Boolean(value.token || value.studentNumber), {
  message: "Informe o QR/token ou número de estudante.",
});

const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(30),
  search: z.string().trim().max(120).optional(),
});

const qrActionSchema = z.object({
  id: z.number(),
  token: z.string(),
  type: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  targetId: z.number().nullable(),
  targetMeta: z.string().nullable(),
  eventKey: z.string().nullable(),
  eventLabel: z.string().nullable(),
  active: z.boolean(),
  maxScans: z.number().nullable(),
  expiresAt: z.string().nullable(),
  smsOnScan: z.boolean(),
  smsTemplate: z.string().nullable(),
  smsSender: z.string().nullable(),
  passportMissionId: z.number().nullable(),
  scansCount: z.number(),
  qrImageUrl: z.string(),
  createdAt: z.string(),
});

const qrScanResultSchema = z.object({
  success: z.boolean(),
  result: z.string(),
  message: z.string(),
  actionType: z.string(),
  actionLabel: z.string(),
  pointsAwarded: z.number().optional(),
  requiresAnswer: z.boolean().optional(),
  challenge: z.object({
    id: z.number(),
    type: z.string(),
    question: z.string(),
    options: z.array(z.string()).nullable(),
    maxAttempts: z.number(),
    version: z.number(),
    explanation: z.string().nullable(),
  }).nullable().optional(),
  surprise: z.object({
    id: z.number(),
    displayCode: z.string().nullable().optional(),
    name: z.string(),
    description: z.string().nullable(),
    effectType: z.string(),
    effectValue: z.number(),
    targetScope: z.string(),
    rarity: z.string(),
    visibility: z.string(),
    beforePoints: z.number(),
    afterPoints: z.number(),
    deltaPoints: z.number(),
    message: z.string(),
  }).nullable().optional(),
});

function createToken() {
  return `att_${randomUUID().replace(/-/g, "")}`;
}

function createQrActionToken() {
  return `qra_${randomUUID().replace(/-/g, "")}`;
}

function normalizeTestProjectName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function readQrActionTargetMetaName(targetMeta: string | null) {
  if (!targetMeta) return [];

  try {
    const meta = JSON.parse(targetMeta) as {
      name?: unknown;
      submissionName?: unknown;
      projectName?: unknown;
      title?: unknown;
    };
    return [meta.name, meta.submissionName, meta.projectName, meta.title]
      .filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function readLabelProjectName(label: string | null | undefined) {
  const parts = (label ?? "").split(":");
  if (parts.length < 2) return null;
  return parts.at(-1)?.trim() || null;
}

export function isRepeatableUorConnectProjectQrAction(
  qrAction: {
    type: string;
    label: string | null;
    targetMeta: string | null;
    eventLabel: string | null;
  },
  submissionName?: string | null,
) {
  if (!REPEATABLE_TEST_PROJECT_QR_TYPES.has(qrAction.type)) return false;

  const candidates = [
    submissionName,
    qrAction.eventLabel,
    readLabelProjectName(qrAction.label),
    ...readQrActionTargetMetaName(qrAction.targetMeta),
  ];

  return candidates.some((candidate) => normalizeTestProjectName(candidate) === UOR_CONNECT_TEST_PROJECT_NAME);
}

function extractSubmissionIdFromSlug(slug: string) {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;

  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

async function findApprovedSubmissionBySlug(slug: string) {
  const id = extractSubmissionIdFromSlug(slug);
  if (!id) return null;

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, status: true, area: true },
  });
  if (!submission || submission.status !== "APPROVED") return null;

  return buildSubmissionSlug(submission.name, submission.id) === slug ? submission : null;
}

async function findTeamCredentialFromSlug(slug: string) {
  return prisma.eventTeamCredential.findFirst({
    where: {
      OR: [{ publicSlug: slug }, { token: slug }],
      status: { notIn: ["DISABLED", "REVOKED"] },
    },
    select: {
      id: true,
      token: true,
      publicSlug: true,
      category: true,
      team: true,
      role: true,
      accessLevel: true,
      name: true,
      course: true,
      sourceSubmissionId: true,
      sourceSubmissionName: true,
      sourceSubmissionType: true,
      sourceSubmissionArea: true,
      teamMembership: {
        select: {
          studentNumber: true,
          fullName: true,
          team: true,
          role: true,
          accessLevel: true,
        },
      },
    },
  });
}

async function ensureStandVisitQrActionForSubmission(submission: { id: number; name: string; type: string; area?: string | null }, source: "PROJECT" | "TEAM_CREDENTIAL") {
  const existing = await prisma.qrAction.findFirst({
    where: {
      type: "STAND_VISIT",
      targetId: submission.id,
    },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  if (existing) return existing;

  return prisma.qrAction.create({
    data: {
      token: createQrActionToken(),
      type: "STAND_VISIT",
      label: source === "TEAM_CREDENTIAL" ? `Passe do expositor: ${submission.name}` : `Stand do projeto: ${submission.name}`,
      description: source === "TEAM_CREDENTIAL"
        ? "Ação criada automaticamente ao escanear um passe público de expositor."
        : "Ação criada automaticamente ao escanear o QR público do projeto.",
      targetId: submission.id,
      targetMeta: JSON.stringify({ name: submission.name, type: submission.type, area: submission.area ?? null, source }),
      eventKey: `submission:${submission.id}`,
      eventLabel: submission.name,
    },
  });
}

async function ensureExhibitorChallengeQrActionForCredential(member: Awaited<ReturnType<typeof findTeamCredentialFromSlug>>) {
  if (!member?.sourceSubmissionId) return null;

  const submission = await prisma.submission.findFirst({
    where: {
      id: member.sourceSubmissionId,
      status: "APPROVED",
    },
    select: { id: true, name: true, type: true, status: true, area: true },
  });
  if (!submission) return null;

  const existing = await prisma.qrAction.findFirst({
    where: {
      type: "EXHIBITOR_CHALLENGE",
      targetId: submission.id,
    },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  if (existing) return existing;

  return prisma.qrAction.create({
    data: {
      token: createQrActionToken(),
      type: "EXHIBITOR_CHALLENGE",
      label: `Desafio do expositor: ${submission.name}`,
      description: "Ação criada automaticamente ao escanear o QR pessoal do expositor.",
      targetId: submission.id,
      targetMeta: JSON.stringify({
        submissionId: submission.id,
        submissionName: submission.name,
        submissionType: submission.type,
        submissionArea: submission.area,
        source: "EXHIBITOR_PERSONAL_QR",
        credentialId: member.id,
        exhibitorName: member.name ?? member.teamMembership?.fullName ?? null,
        exhibitorStudentNumber: member.teamMembership?.studentNumber ?? null,
      }),
      eventKey: `submission:${submission.id}:challenge`,
      eventLabel: submission.name,
      active: true,
    },
  });
}

async function ensureNucleusMemberBonusQrActionForCredential(member: Awaited<ReturnType<typeof findTeamCredentialFromSlug>>) {
  if (!member) return null;
  const memberName = member.name ?? member.teamMembership?.fullName ?? "Membro do núcleo";
  const memberStudentNumber = member.teamMembership?.studentNumber ?? null;
  const existing = await prisma.qrAction.findFirst({
    where: {
      type: "NUCLEUS_MEMBER_BONUS",
      targetId: member.id,
    },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  if (existing) return existing;

  return prisma.qrAction.create({
    data: {
      token: createQrActionToken(),
      type: "NUCLEUS_MEMBER_BONUS",
      label: `Passe Núcleo: ${memberName}`,
      description: "Ação criada automaticamente ao escanear o passe oficial de membro do núcleo.",
      targetId: member.id,
      targetMeta: JSON.stringify({
        credentialId: member.id,
        memberStudentNumber,
        memberName,
        memberCourse: member.course ?? null,
        memberTeam: member.teamMembership?.team ?? member.team,
        memberRole: member.teamMembership?.role ?? member.role,
        memberAccessLevel: member.teamMembership?.accessLevel ?? member.accessLevel,
        source: "NUCLEUS_MEMBER_PERSONAL_QR",
      }),
      eventKey: `team-credential:${member.id}`,
      eventLabel: "Núcleo UOR Connect",
      active: true,
    },
  });
}

async function findQrActionFromRouteTarget(target: StudentScanRouteTarget | null) {
  if (!target) return null;

  if (target.kind === "PROJECT") {
    const submission = await findApprovedSubmissionBySlug(target.slug);
    if (!submission) return null;
    return ensureStandVisitQrActionForSubmission(submission, target.kind);
  }

  const member = await findTeamCredentialFromSlug(target.slug);
  if (!member) return null;

  if (member.category === "EXPOSITOR") {
    return ensureExhibitorChallengeQrActionForCredential(member);
  }

  if (member.category === "NUCLEO") {
    return ensureNucleusMemberBonusQrActionForCredential(member);
  }

  if (member.sourceSubmissionId) {
    return ensureExhibitorChallengeQrActionForCredential(member);
  }

  return null;
}

function attendanceCredentialValidity(credential: {
  eventKey: string;
  validFrom: Date | null;
  validUntil: Date | null;
  status: string;
}, eventKey = credential.eventKey, now = new Date()) {
  if (credential.status !== "ACTIVE") {
    return { valid: false, reason: "Credencial de presença desativada." };
  }
  if (credential.validFrom && credential.validFrom > now) {
    return { valid: false, reason: "Credencial de presença ainda não está válida para esta sessão." };
  }
  if (credential.validUntil && credential.validUntil < now) {
    return { valid: false, reason: "Credencial de presença expirada para esta sessão." };
  }
  if (credential.eventKey !== DEFAULT_EVENT_KEY && credential.eventKey !== eventKey) {
    return { valid: false, reason: "Credencial de presença não pertence a esta sessão." };
  }
  return { valid: true, reason: null };
}

function serializeCredential(env: Env, credential: {
  id: number;
  token: string;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  label: string;
  eventKey: string;
  eventLabel: string;
  validFrom: Date | null;
  validUntil: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const validationUrl = buildValidationUrl(env, credential.token);
  const validity = attendanceCredentialValidity(credential);
  return {
    id: credential.id,
    token: credential.token,
    studentNumber: credential.studentNumber,
    studentName: credential.studentName,
    studentCourse: credential.studentCourse,
    label: credential.label,
    eventKey: credential.eventKey,
    eventLabel: credential.eventLabel,
    validFrom: credential.validFrom?.toISOString() ?? null,
    validUntil: credential.validUntil?.toISOString() ?? null,
    status: credential.status,
    isValid: validity.valid,
    validationUrl,
    qrImageUrl: buildValidationQrUrl(env, credential.token),
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

async function renderAttendanceCredentialPdf(env: Env, credential: {
  token: string;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  label: string;
  eventKey: string;
  eventLabel: string;
  validFrom: Date | null;
  validUntil: Date | null;
  status: string;
  updatedAt: Date;
}) {
  const validationUrl = buildValidationUrl(env, credential.token);
  const [qrDataUri, logoDataUri] = await Promise.all([
    renderQrDataUri(validationUrl, 720),
    loadLogoDataUri(),
  ]);
  const studentName = credential.studentName ?? "Estudante UOR Connect";
  const course = credential.studentCourse ?? env.UORCONNECT_INSTITUTION_NAME;
  const validityLabel = credential.validUntil
    ? new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(credential.validUntil)
    : "Sem expiração";
  const updatedAt = new Intl.DateTimeFormat("pt-AO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(credential.updatedAt);

  const html = `<!doctype html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(credential.label)} · ${escapeHtml(studentName)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 210mm; min-height: 297mm; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f8fafc; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .sheet { position: relative; width: 210mm; height: 297mm; padding: 18mm; display: grid; place-items: center; background: #f8fafc; }
    .note { position: absolute; top: 17mm; left: 18mm; right: 18mm; display: flex; justify-content: space-between; color: #475569; font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .cut { position: absolute; width: 10mm; height: 10mm; border-color: #94a3b8; }
    .cut.tl { top: 77mm; left: 55mm; border-top: .3mm solid; border-left: .3mm solid; }
    .cut.tr { top: 77mm; right: 55mm; border-top: .3mm solid; border-right: .3mm solid; }
    .cut.bl { bottom: 78mm; left: 55mm; border-bottom: .3mm solid; border-left: .3mm solid; }
    .cut.br { bottom: 78mm; right: 55mm; border-bottom: .3mm solid; border-right: .3mm solid; }
    .outline { position: absolute; left: 58mm; top: 80mm; width: 94mm; height: 139mm; border: .25mm dashed rgba(100,116,139,.65); border-radius: 4mm; }
    .card { width: 94mm; height: 139mm; overflow: hidden; border: .3mm solid #d1d5db; border-radius: 4mm; background: #fff; box-shadow: 0 3mm 14mm rgba(15,23,42,.10); }
    .top { height: 34mm; padding: 6mm; color: #fff; background: #111827; }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
    .brand img { max-width: 34mm; max-height: 11mm; object-fit: contain; filter: brightness(0) invert(1); }
    .brand-name { font-size: 13px; font-weight: 900; letter-spacing: .03em; }
    .badge { border: .25mm solid rgba(255,255,255,.28); border-radius: 999px; padding: 1.8mm 3.6mm; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .body { padding: 7mm 7mm 6mm; text-align: center; }
    h1 { margin: 0; font-size: 18px; line-height: 1.12; font-weight: 800; color: #111827; }
    .course { margin: 2mm 0 0; min-height: 9mm; color: #475569; font-size: 10px; line-height: 1.3; }
    .number { display: inline-block; margin-top: 3.5mm; border-radius: 2mm; background: #111827; color: #fff; padding: 2mm 5mm; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
    .qr { width: 38mm; height: 38mm; margin: 6mm auto 0; display: grid; place-items: center; border: .25mm solid #e5e7eb; border-radius: 3mm; background: #fff; }
    .qr img { width: 33mm; height: 33mm; }
    .hint { margin: 3mm auto 0; max-width: 68mm; color: #475569; font-size: 8.5px; line-height: 1.35; overflow-wrap: anywhere; }
    .meta { margin-top: 5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; text-align: left; }
    .box { border: .25mm solid #e5e7eb; border-radius: 2.5mm; background: #f8fafc; padding: 2.5mm; }
    .box span { display: block; color: #475569; font-size: 7px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .box strong { display: block; margin-top: .8mm; color: #111827; font-size: 9px; line-height: 1.2; }
    .footer { margin-top: 5mm; display: flex; align-items: center; justify-content: space-between; color: #475569; font-size: 8px; font-weight: 800; letter-spacing: .08em; }
    .bar { width: 18mm; height: .7mm; border-radius: 1mm; background: #111827; }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="note"><span>UOR Connect · Credencial de presença</span><span>Recortar pelas linhas</span></div>
    <span class="cut tl"></span><span class="cut tr"></span><span class="cut bl"></span><span class="cut br"></span>
    <div class="outline"></div>
    <article class="card">
      <section class="top">
        <div class="brand">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : `<div class="brand-name">UOR Connect</div>`}
          <div class="badge">Presença</div>
        </div>
      </section>
      <section class="body">
        <h1>${escapeHtml(studentName)}</h1>
        <p class="course">${escapeHtml(course)}<br />${escapeHtml(credential.eventLabel)}</p>
        <div class="number">N.º ${escapeHtml(credential.studentNumber)}</div>
        <div class="qr"><img src="${qrDataUri}" alt="QR de validação" /></div>
        <p class="hint">${escapeHtml(validationUrl)}</p>
        <div class="meta">
          <div class="box"><span>Validade</span><strong>${escapeHtml(validityLabel)}</strong></div>
          <div class="box"><span>Atualizado</span><strong>${escapeHtml(updatedAt)}</strong></div>
        </div>
        <div class="footer"><span>UOR CONNECT</span><span class="bar"></span><span>${escapeHtml(credential.studentNumber)}</span></div>
      </section>
    </article>
  </main>
</body>
</html>`;

  return renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

function serializeCheckIn(checkIn: {
  id: number;
  credentialId: number;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  eventKey: string;
  eventLabel: string;
  checkedInAt: Date;
  checkedInByStudentNumber: string;
  notes: string | null;
}) {
  return {
    id: checkIn.id,
    credentialId: checkIn.credentialId,
    studentNumber: checkIn.studentNumber,
    studentName: checkIn.studentName,
    studentCourse: checkIn.studentCourse,
    eventKey: checkIn.eventKey,
    eventLabel: checkIn.eventLabel,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    checkedInByStudentNumber: checkIn.checkedInByStudentNumber,
    notes: checkIn.notes,
  };
}

async function ensureCredentialForStudent(studentId: number) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return null;

  const normalized = normalizeStudentProfile(student);
  const existing = await prisma.attendanceCredential.findUnique({ where: { studentId } });
  if (existing) {
    return prisma.attendanceCredential.update({
      where: { id: existing.id },
      data: {
        studentNumber: normalized.studentNumber,
        studentName: normalized.name ?? null,
        studentCourse: normalized.course ?? null,
      },
    });
  }

  return prisma.attendanceCredential.create({
    data: {
      token: createToken(),
      studentId: normalized.id,
      studentNumber: normalized.studentNumber,
      studentName: normalized.name ?? null,
      studentCourse: normalized.course ?? null,
      eventKey: DEFAULT_EVENT_KEY,
      eventLabel: DEFAULT_EVENT_LABEL,
      validFrom: new Date(),
      status: "ACTIVE",
    },
  });
}

async function ensureCredentialByStudentNumber(studentNumber: string) {
  const student = await prisma.student.findUnique({ where: { studentNumber } });
  if (!student) return null;
  return ensureCredentialForStudent(student.id);
}

/* ---------- SMS helper (lightweight, no dependency on sms module) ---------- */

function normalizePhoneForSms(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("244") && digits.length >= 12) {
    const local = digits.slice(3, 12);
    if (local.length === 9 && local.startsWith("9")) return local;
  }

  if (digits.length === 9 && digits.startsWith("9")) return digits;
  return null;
}

function applySmsTemplate(template: string, data: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value);
  }
  return result;
}

async function sendScanSms(env: Env, qrAction: {
  smsOnScan: boolean;
  smsTemplate: string | null;
  smsSender: string | null;
  label: string;
}, student: { phone?: string | null; name?: string | null; studentNumber: string; course?: string | null }) {
  if (!qrAction.smsOnScan || !qrAction.smsTemplate || !qrAction.smsSender) return;

  const ombalaToken = env.OMBALA_API_TOKEN?.trim();
  const ombalaBase = env.OMBALA_API_BASE_URL?.replace(/\/$/, "");
  if (!ombalaToken || !ombalaBase) return;

  const to = normalizePhoneForSms(student.phone);
  if (!to) return;

  const message = applySmsTemplate(qrAction.smsTemplate, {
    nome: student.name ?? "estudante",
    numero: student.studentNumber,
    curso: student.course ?? "",
    acao: qrAction.label,
  });

  try {
    await fetch(`${ombalaBase}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ombalaToken}`,
      },
      body: JSON.stringify({ message, from: qrAction.smsSender, to }),
    });
  } catch {
    // Best-effort: don't fail the scan if SMS fails
  }
}

async function passportPointBalanceForNotification(studentNumber: string) {
  const aggregate = await prisma.passportPointLedger.aggregate({
    where: { studentNumber, status: "VALID" },
    _sum: { points: true },
  });
  return aggregate._sum.points ?? 0;
}

async function resolveRepeatableUorConnectProjectScan(qrAction: {
  type: string;
  label: string | null;
  targetId: number | null;
  targetMeta: string | null;
  eventLabel: string | null;
}) {
  if (isRepeatableUorConnectProjectQrAction(qrAction)) return true;
  if (!qrAction.targetId || !["STAND_VISIT", "EXHIBITOR_VOTE"].includes(qrAction.type)) return false;

  const submission = await prisma.submission.findUnique({
    where: { id: qrAction.targetId },
    select: { name: true },
  });

  return isRepeatableUorConnectProjectQrAction(qrAction, submission?.name ?? null);
}

/* ---------- QR Action processing ---------- */

async function processQrActionScan(env: Env, qrAction: {
  id: number;
  type: string;
  label: string;
  targetId: number | null;
  targetMeta: string | null;
  eventKey: string | null;
  eventLabel: string | null;
  active: boolean;
  maxScans: number | null;
  expiresAt: Date | null;
  smsOnScan: boolean;
  smsTemplate: string | null;
  smsSender: string | null;
  passportMissionId?: number | null;
}, student: { id: number; studentNumber: string; name: string | null; course: string | null; phone: string | null }) {
  const repeatableTestProjectScan = await resolveRepeatableUorConnectProjectScan(qrAction);

  // Check expiry
  if (qrAction.expiresAt && new Date() > qrAction.expiresAt) {
    await prisma.qrActionScan.upsert({
      where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
      create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "EXPIRED", message: "Este QR expirou." },
      update: { result: "EXPIRED", message: "Este QR expirou." },
    });
    return { success: false, result: "EXPIRED", message: "Chegaste depois dos créditos finais. Este QR já saiu de cena.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  if (!qrAction.active) {
    return { success: false, result: "INACTIVE", message: "Este código QR está desativado.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  // Check max scans
  if (qrAction.maxScans && !repeatableTestProjectScan) {
    const totalScans = await prisma.qrActionScan.count({ where: { qrActionId: qrAction.id, result: "SUCCESS" } });
    if (totalScans >= qrAction.maxScans) {
      return { success: false, result: "MAX_REACHED", message: "Limite de utilizações deste QR atingido.", actionType: qrAction.type, actionLabel: qrAction.label };
    }
  }

  // Check duplicate
  const existingScan = await prisma.qrActionScan.findUnique({
    where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
  });
  if (existingScan && existingScan.result === "SUCCESS" && !repeatableTestProjectScan) {
    if (isPassportChallengeQrActionType(qrAction.type)) {
      const challenge = await findActivePassportChallengeForQrAction(qrAction.id);
      const message = challenge
        ? `Desafio já liberado em "${qrAction.label}". Responde para validar a pontuação.`
        : `Desafio já liberado em "${qrAction.label}", mas ainda não foi configurado.`;
      return {
        success: true,
        result: challenge ? "CHALLENGE_READY" : "CHALLENGE_NOT_CONFIGURED",
        message,
        actionType: qrAction.type,
        actionLabel: qrAction.label,
        pointsAwarded: 0,
        requiresAnswer: Boolean(challenge),
        challenge,
      };
    }
    if (isPassportSurpriseQrActionType(qrAction.type)) {
      return {
        success: false,
        result: "ALREADY_DONE",
        message: "Já descobriste este QR surpresa.",
        actionType: qrAction.type,
        actionLabel: qrAction.label,
        pointsAwarded: 0,
      };
    }
    if (qrAction.type === "NUCLEUS_MEMBER_BONUS") {
      return {
        success: false,
        result: "ALREADY_AWARDED",
        message: "Esse crachá já assinou o teu passaporte. Vai conhecer outro.",
        actionType: qrAction.type,
        actionLabel: qrAction.label,
        pointsAwarded: 0,
      };
    }
    return { success: false, result: "ALREADY_DONE", message: "Já utilizaste este código QR.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  let message = "";

  // Process by type
  if (qrAction.type === "CHECKIN") {
    const eventKey = qrAction.eventKey || DEFAULT_EVENT_KEY;
    const eventLabel = qrAction.eventLabel || DEFAULT_EVENT_LABEL;
    const credential = await ensureCredentialByStudentNumber(student.studentNumber);

    if (credential) {
      const validity = attendanceCredentialValidity(credential, eventKey);
      if (!validity.valid) {
        await prisma.qrActionScan.upsert({
          where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
          create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "EXPIRED", message: validity.reason },
          update: { result: "EXPIRED", message: validity.reason },
        });
        return { success: false, result: "EXPIRED", message: validity.reason ?? "Credencial de presença inválida.", actionType: qrAction.type, actionLabel: qrAction.label };
      }

      const existingCheckIn = await prisma.attendanceCheckIn.findUnique({
        where: { credentialId_eventKey: { credentialId: credential.id, eventKey } },
      });

      if (existingCheckIn) {
        await prisma.qrActionScan.upsert({
          where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
          create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "ALREADY_DONE", message: "Presença já registada." },
          update: { result: "ALREADY_DONE", message: "Presença já registada." },
        });
        return { success: false, result: "ALREADY_DONE", message: `A tua presença em "${eventLabel}" já estava registada.`, actionType: qrAction.type, actionLabel: qrAction.label };
      }

      await prisma.attendanceCheckIn.create({
        data: {
          credentialId: credential.id,
          studentId: student.id,
          studentNumber: student.studentNumber,
          studentName: student.name,
          studentCourse: student.course,
          eventKey,
          eventLabel,
          checkedInByStudentNumber: student.studentNumber,
          notes: `Auto check-in via QR: ${qrAction.label}`,
        },
      });

      message = `Presença registada em "${eventLabel}".`;

      try {
        await sendWhatsAppAutomationEvent(env, "ATTENDANCE_CHECKED_IN", {
          phone: student.phone,
          studentId: student.id,
          studentNumber: student.studentNumber,
          recipientName: student.name,
          recipientCourse: student.course,
          values: {
            evento: eventLabel,
            detalhe: "Check-in registado com sucesso via leitura de QR.",
            link: buildValidationUrl(env, credential.token),
          },
        });
      } catch { /* best-effort */ }
    } else {
      message = "Presença registada.";
    }
  } else if (qrAction.type === "COURSE_ENROLL") {
    if (!qrAction.targetId) {
      return { success: false, result: "ERROR", message: "Este QR não está ligado a nenhum curso.", actionType: qrAction.type, actionLabel: qrAction.label };
    }

    const course = await prisma.course.findUnique({ where: { id: qrAction.targetId } });
    if (!course) {
      return { success: false, result: "ERROR", message: "Curso não encontrado.", actionType: qrAction.type, actionLabel: qrAction.label };
    }

    const existingEnrollment = await prisma.courseEnrollment.findFirst({
      where: { studentId: student.id, courseId: course.id },
    });
    if (existingEnrollment) {
      await prisma.qrActionScan.upsert({
        where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
        create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "ALREADY_DONE", message: "Já inscrito neste curso." },
        update: { result: "ALREADY_DONE", message: "Já inscrito neste curso." },
      });
      return { success: false, result: "ALREADY_DONE", message: `Já tens inscrição no curso "${course.name}".`, actionType: qrAction.type, actionLabel: qrAction.label };
    }

    await prisma.courseEnrollment.create({
      data: {
        courseId: course.id,
        studentId: student.id,
        studentNumber: student.studentNumber,
        studentName: student.name,
        studentCourse: student.course,
        paymentStatus: "PENDING",
      },
    });

    message = `Inscrição registada no curso "${course.name}".`;
  } else if (qrAction.type === "EXHIBITOR_VOTE") {
    if (!qrAction.targetId) {
      return { success: false, result: "ERROR", message: "Este QR não está ligado a nenhum expositor.", actionType: qrAction.type, actionLabel: qrAction.label };
    }

    const submission = await prisma.submission.findUnique({ where: { id: qrAction.targetId } });
    if (!submission) {
      return { success: false, result: "ERROR", message: "Expositor não encontrado.", actionType: qrAction.type, actionLabel: qrAction.label };
    }

    const existingLike = await prisma.studentLike.findFirst({
      where: { studentId: student.id, submissionId: submission.id },
    });
    if (existingLike && !repeatableTestProjectScan) {
      await prisma.qrActionScan.upsert({
        where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
        create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "ALREADY_DONE", message: "Já votaste neste expositor." },
        update: { result: "ALREADY_DONE", message: "Já votaste neste expositor." },
      });
      return { success: false, result: "ALREADY_DONE", message: `Já votaste no projeto "${submission.name}".`, actionType: qrAction.type, actionLabel: qrAction.label };
    }

    if (!existingLike) {
      await prisma.studentLike.create({
        data: { studentId: student.id, submissionId: submission.id },
      });
    }

    message = existingLike && repeatableTestProjectScan
      ? `Voto de teste validado novamente para "${submission.name}".`
      : `Voto registado para "${submission.name}".`;
  } else if (qrAction.type === "WORKSHOP_CHECKIN") {
    message = `Entrada validada em "${qrAction.eventLabel || qrAction.label}".`;
  } else if (qrAction.type === "STAND_VISIT") {
    if (qrAction.targetId) {
      const submission = await prisma.submission.findUnique({ where: { id: qrAction.targetId }, select: { name: true } });
      message = submission ? `Visita registada no stand "${submission.name}".` : `Visita registada em "${qrAction.label}".`;
    } else {
      message = `Visita registada em "${qrAction.label}".`;
    }
  } else if (qrAction.type === "EXHIBITOR_CHALLENGE") {
    message = `Desafio do expositor liberado em "${qrAction.label}".`;
  } else if (qrAction.type === "NETWORKING_CROSS_COURSE") {
    message = `Networking validado em "${qrAction.label}".`;
  } else if (qrAction.type === "NUCLEUS_MEMBER_BONUS") {
    message = `Passe de membro do núcleo validado em "${qrAction.label}".`;
  } else if (qrAction.type === "SPECIAL_QUIZ") {
    message = `Quiz especial validado em "${qrAction.label}".`;
  } else if (qrAction.type === "POINT_BATTLE_QR") {
    message = `Checkpoint da batalha de pontos validado em "${qrAction.label}".`;
  } else if (qrAction.type === "CLUE_CHAIN_QR") {
    message = `Pista liberada em "${qrAction.label}".`;
  } else if (qrAction.type === "COOPERATIVE_MISSION_QR") {
    message = `Missão cooperativa registada em "${qrAction.label}".`;
  } else if (qrAction.type === "RECOVERY_SMART_QR") {
    message = `Recuperação inteligente validada em "${qrAction.label}".`;
  } else if (isPassportSurpriseQrActionType(qrAction.type)) {
    message = `Sinal UOR encontrado em "${qrAction.label}".`;
  } else {
    return { success: false, result: "ERROR", message: "Tipo de ação desconhecido.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  if (repeatableTestProjectScan) {
    message = `${message} Modo teste UOR Connect: este QR pode ser usado várias vezes.`;
  }

  // Record successful scan
  const qrActionScanUpdate = repeatableTestProjectScan
    ? { result: "SUCCESS", message, scannedAt: new Date() }
    : { result: "SUCCESS", message };
  const qrActionScan = await prisma.qrActionScan.upsert({
    where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
    create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "SUCCESS", message },
    update: qrActionScanUpdate,
  });

  if (isPassportChallengeQrActionType(qrAction.type)) {
    const challenge = await findActivePassportChallengeForQrAction(qrAction.id);
    const challengeMessage = challenge
      ? `Desafio liberado em "${qrAction.label}". Responde para validar a pontuação.`
      : `Desafio liberado em "${qrAction.label}", mas ainda não foi configurado.`;

    try {
      await awardPassportForQrActionScan({
        student,
        action: qrAction,
        qrActionScan: {
          ...qrActionScan,
          message: challengeMessage,
        },
      });
    } catch {
      // Passport failures must not block the original QR action.
    }

    return {
      success: true,
      result: challenge ? "CHALLENGE_READY" : "CHALLENGE_NOT_CONFIGURED",
      message: challengeMessage,
      actionType: qrAction.type,
      actionLabel: qrAction.label,
      pointsAwarded: 0,
      requiresAnswer: Boolean(challenge),
      challenge,
    };
  }

  let pointsAwarded = 0;
  let surprise: PassportSurpriseReveal | null = null;
  try {
    const passportResult = await awardPassportForQrActionScan({
      student,
      action: qrAction,
      qrActionScan,
    });
    pointsAwarded = passportResult.pointsAwarded;
    surprise = "surprise" in passportResult ? passportResult.surprise ?? null : null;
    if (passportResult.message) message = passportResult.message;
    if (pointsAwarded !== 0) {
      const currentPoints = await passportPointBalanceForNotification(student.studentNumber);
      const kind = currentPoints < 0
        ? "PASSPORT_NEGATIVE_BALANCE"
        : pointsAwarded > 0
          ? "PASSPORT_POINTS_GAINED"
          : "PASSPORT_POINTS_LOST";
      await notifyPassportGameEvent(env, {
        student,
        kind,
        deltaPoints: pointsAwarded,
        currentPoints,
        qrDisplayCode: surprise?.displayCode ?? null,
        hint: pointsAwarded < 0
          ? "um QR que tirou pontos pode virar recuperacao depois de algumas perdas. Mantem os codigos numerados por perto."
          : "procura o proximo QR numerado ou uma missao de feedback construtivo.",
      });
    }
  } catch {
    // Passport failures must not block the original QR action.
  }

  // Send SMS notification
  try {
    await sendScanSms(env, qrAction, student);
  } catch { /* best-effort */ }

  return { success: true, result: surprise ? "SURPRISE_APPLIED" : "SUCCESS", message, actionType: qrAction.type, actionLabel: qrAction.label, pointsAwarded, surprise };
}

/* ==================== Routes ==================== */

export async function attendanceRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    /* ---- Student: get own credential & attendance ---- */
    protectedApp.get("/me", {
      schema: {
        response: {
          200: z.object({
            credential: credentialSchema,
            checkedIn: z.boolean(),
            lastCheckIn: checkInSchema.nullable(),
            checkIns: z.array(checkInSchema),
            certificatesCount: z.number(),
          }),
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const credential = await ensureCredentialForStudent(student.id);
      if (!credential) return reply.code(404).send({ message: "Student not found" });

      const [checkIns, certificatesCount] = await Promise.all([
        prisma.attendanceCheckIn.findMany({
          where: { credentialId: credential.id },
          orderBy: { checkedInAt: "desc" },
          take: 8,
        }),
        prisma.certificate.count({
          where: { studentId: student.id, status: "ISSUED" },
        }),
      ]);
      const lastCheckIn = checkIns[0] ?? null;

      return {
        credential: serializeCredential(opts.env, credential),
        checkedIn: Boolean(lastCheckIn),
        lastCheckIn: lastCheckIn ? serializeCheckIn(lastCheckIn) : null,
        checkIns: checkIns.map(serializeCheckIn),
        certificatesCount,
      };
    });

    protectedApp.get("/me/card.pdf", {
      schema: {
        response: {
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const credential = await ensureCredentialForStudent(student.id);
      if (!credential) return reply.code(404).send({ message: "Student not found" });

      const buffer = await renderAttendanceCredentialPdf(opts.env, credential);
      const issuedAt = new Date();
      await prisma.attendanceCredential.update({
        where: { id: credential.id },
        data: {
          lastCardIssuedAt: issuedAt,
          lastCardSnapshotJson: JSON.stringify({
            documentType: "ATTENDANCE_CARD",
            credentialId: credential.id,
            tokenHashPurpose: "validation-url-only",
            studentNumber: credential.studentNumber,
            studentName: credential.studentName,
            studentCourse: credential.studentCourse,
            label: credential.label,
            eventKey: credential.eventKey,
            eventLabel: credential.eventLabel,
            validFrom: credential.validFrom?.toISOString() ?? null,
            validUntil: credential.validUntil?.toISOString() ?? null,
            status: credential.status,
            generatedAt: issuedAt.toISOString(),
            validationUrl: buildValidationUrl(opts.env, credential.token),
          }),
        },
      });
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="Credencial_Presenca_${credential.studentNumber}.pdf"`)
        .send(buffer);
    });

    /* ---- Student: scan a QR action code ---- */
    protectedApp.post("/scan", {
      config: {
        rateLimit: {
          max: 40,
          timeWindow: 60_000,
        },
      },
      schema: {
        body: z.object({
          token: z.string().trim().min(1).max(300),
        }),
        response: {
          200: qrScanResultSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const rawToken = (request.body as { token: string }).token;

      // Extract token: could be a full URL or just the token string
      const extracted = extractValidationToken(rawToken) ?? rawToken.trim();

      // Try QR action first
      let qrAction = await prisma.qrAction.findUnique({ where: { token: extracted } });

      // If not found, try stripping prefix or searching by partial match
      if (!qrAction && extracted.startsWith("qra_")) {
        qrAction = await prisma.qrAction.findUnique({ where: { token: extracted } });
      }

      if (!qrAction) {
        qrAction = await findQrActionFromRouteTarget(extractStudentScanRouteTarget(rawToken));
      }

      if (!qrAction) {
        // Maybe it's a traditional attendance credential token - do self check-in
        const credential = await prisma.attendanceCredential.findUnique({ where: { token: extracted } });
        if (credential) {
          // This is an attendance credential QR - not meant for student self-scan
          return reply.code(400).send({ message: "Este é um QR de credencial de estudante, não um QR de ação. Usa os QR da organização para fazer check-in." });
        }

        return reply.code(404).send({ message: "Código QR não reconhecido. Verifica se é um QR válido da organização." });
      }

      const fullStudent = await prisma.student.findUnique({ where: { id: student.id } });
      if (!fullStudent) return reply.code(401).send({ message: "Estudante não encontrado." });

      const normalized = normalizeStudentProfile(fullStudent);
      const result = await processQrActionScan(opts.env, qrAction, {
        id: normalized.id,
        studentNumber: normalized.studentNumber,
        name: normalized.name ?? null,
        course: normalized.course ?? null,
        phone: fullStudent.phone ?? null,
      });

      return result;
    });

    /* ---- Student: list own scan history ---- */
    protectedApp.get("/my-scans", {
      schema: {
        response: {
          200: z.array(z.object({
            id: z.number(),
            actionType: z.string(),
            actionLabel: z.string(),
            result: z.string(),
            message: z.string().nullable(),
            scannedAt: z.string(),
          })),
          401: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const scans = await prisma.qrActionScan.findMany({
        where: { studentId: student.id },
        include: { qrAction: { select: { type: true, label: true } } },
        orderBy: { scannedAt: "desc" },
        take: 50,
      });

      return scans.map((scan) => ({
        id: scan.id,
        actionType: scan.qrAction.type,
        actionLabel: scan.qrAction.label,
        result: scan.result,
        message: scan.message,
        scannedAt: scan.scannedAt.toISOString(),
      }));
    });

    /* ==================== Admin routes ==================== */
    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);
      setDefaultAdminPermission(adminApp, ["ATTENDANCE"]);

      /* ---- Admin: attendance overview ---- */
      adminApp.get("/admin/overview", {
        schema: {
          response: {
            200: z.object({
              totalCredentials: z.number(),
              totalCheckIns: z.number(),
              todayCheckIns: z.number(),
              recentCheckIns: z.array(checkInSchema),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        const [totalCredentials, totalCheckIns, todayCheckIns, recentCheckIns] = await Promise.all([
          prisma.attendanceCredential.count(),
          prisma.attendanceCheckIn.count(),
          prisma.attendanceCheckIn.count({ where: { checkedInAt: { gte: dayStart } } }),
          prisma.attendanceCheckIn.findMany({
            orderBy: { checkedInAt: "desc" },
            take: 12,
          }),
        ]);

        return {
          totalCredentials,
          totalCheckIns,
          todayCheckIns,
          recentCheckIns: recentCheckIns.map(serializeCheckIn),
        };
      });

      /* ---- Admin: list check-ins ---- */
      adminApp.get("/admin/check-ins", {
        schema: {
          querystring: attendanceQuerySchema,
          response: {
            200: z.object({
              items: z.array(checkInSchema),
              total: z.number(),
              page: z.number(),
              totalPages: z.number(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const query = attendanceQuerySchema.parse(request.query);
        const where = query.search
          ? {
            OR: [
              { studentNumber: { contains: query.search } },
              { studentName: { contains: query.search } },
              { studentCourse: { contains: query.search } },
              { eventLabel: { contains: query.search } },
            ],
          }
          : {};

        const [total, checkIns] = await Promise.all([
          prisma.attendanceCheckIn.count({ where }),
          prisma.attendanceCheckIn.findMany({
            where,
            orderBy: [{ checkedInAt: "desc" }, { id: "desc" }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
        ]);

        return {
          items: checkIns.map(serializeCheckIn),
          total,
          page: query.page,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        };
      });

      /* ---- Admin: manual check-in (existing flow) ---- */
      adminApp.post("/admin/check-in", {
        schema: {
          body: checkInBodySchema,
          response: {
            200: z.object({
              checkIn: checkInSchema,
              credential: credentialSchema,
              alreadyCheckedIn: z.boolean(),
            }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = checkInBodySchema.parse(request.body);
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const eventKey = body.eventKey || DEFAULT_EVENT_KEY;
        const eventLabel = body.eventLabel || DEFAULT_EVENT_LABEL;
        const token = extractValidationToken(body.token);

        let credential = token
          ? await prisma.attendanceCredential.findUnique({ where: { token } })
          : null;

        if (!credential && body.studentNumber) {
          credential = await ensureCredentialByStudentNumber(body.studentNumber.replace(/\D/g, "").trim());
        }

        if (!credential && body.token && !token) {
          // Token might be a student number pasted into the token field
          const sanitizedInput = body.token.replace(/\D/g, "").trim();
          if (sanitizedInput.length >= 5 && sanitizedInput.length <= 20) {
            credential = await ensureCredentialByStudentNumber(sanitizedInput);
          }
        }

        if (!credential) {
          return reply.code(404).send({ message: "Credencial ou estudante não encontrado." });
        }

        const validity = attendanceCredentialValidity(credential, eventKey);
        if (!validity.valid) {
          return reply.code(400).send({ message: validity.reason ?? "Credencial de presença inválida." });
        }

        const existing = await prisma.attendanceCheckIn.findUnique({
          where: {
            credentialId_eventKey: {
              credentialId: credential.id,
              eventKey,
            },
          },
        });

        if (existing) {
          return {
            checkIn: serializeCheckIn(existing),
            credential: serializeCredential(opts.env, credential),
            alreadyCheckedIn: true,
          };
        }

        const checkIn = await prisma.attendanceCheckIn.create({
          data: {
            credentialId: credential.id,
            studentId: credential.studentId,
            studentNumber: credential.studentNumber,
            studentName: credential.studentName,
            studentCourse: credential.studentCourse,
            eventKey,
            eventLabel,
            checkedInByStudentNumber: actor,
            notes: body.notes?.trim() || null,
          },
        });

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "attendance.check_in",
          entityType: "AttendanceCheckIn",
          entityId: checkIn.id,
          summary: `Check-in registado para ${credential.studentName ?? credential.studentNumber}.`,
          metadata: {
            studentNumber: credential.studentNumber,
            eventKey,
            eventLabel,
          },
        });

        try {
          const student = await prisma.student.findUnique({
            where: { id: credential.studentId ?? 0 },
            select: { phone: true },
          });

          await sendWhatsAppAutomationEvent(opts.env, "ATTENDANCE_CHECKED_IN", {
            phone: student?.phone ?? null,
            studentId: credential.studentId,
            studentNumber: credential.studentNumber,
            recipientName: credential.studentName,
            recipientCourse: credential.studentCourse,
            values: {
              evento: eventLabel,
              detalhe: body.notes?.trim() || "O teu check-in ficou registado com sucesso.",
              link: buildValidationUrl(opts.env, credential.token),
            },
          });
        } catch (error) {
          request.log.warn({ err: error, checkInId: checkIn.id }, "automatic attendance WhatsApp notification failed");
        }

        return {
          checkIn: serializeCheckIn(checkIn),
          credential: serializeCredential(opts.env, credential),
          alreadyCheckedIn: false,
        };
      });

      /* ==================== QR Actions CRUD ==================== */

      /* ---- Admin: create QR action ---- */
      adminApp.post("/admin/qr-actions", {
        schema: {
          body: z.object({
            type: z.enum(QR_ACTION_TYPES),
            label: z.string().trim().min(2).max(140),
            description: z.string().trim().max(500).optional().nullable(),
            targetId: z.number().int().optional().nullable(),
            eventKey: z.string().trim().min(2).max(80).optional().nullable(),
            eventLabel: z.string().trim().min(2).max(140).optional().nullable(),
            maxScans: z.number().int().min(1).optional().nullable(),
            expiresAt: z.string().optional().nullable(),
            smsOnScan: z.boolean().optional(),
            smsTemplate: z.string().trim().max(300).optional().nullable(),
            smsSender: z.string().trim().max(20).optional().nullable(),
            passportMissionId: z.number().int().optional().nullable(),
          }),
          response: {
            200: qrActionSchema,
            400: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = request.body as {
          type: QrActionType;
          label: string;
          description?: string | null;
          targetId?: number | null;
          eventKey?: string | null;
          eventLabel?: string | null;
          maxScans?: number | null;
          expiresAt?: string | null;
          smsOnScan?: boolean;
          smsTemplate?: string | null;
          smsSender?: string | null;
          passportMissionId?: number | null;
        };

        // Validate target exists
        let targetMeta: string | null = null;
        if (body.type === "COURSE_ENROLL" && body.targetId) {
          const courseTarget = await prisma.course.findUnique({ where: { id: body.targetId }, select: { id: true, name: true, companyName: true } });
          if (!courseTarget) return reply.code(400).send({ message: "Curso não encontrado." });
          targetMeta = JSON.stringify({ title: courseTarget.name, company: courseTarget.companyName });
        } else if (["EXHIBITOR_VOTE", "STAND_VISIT", "EXHIBITOR_CHALLENGE"].includes(body.type) && body.targetId) {
          const submission = await prisma.submission.findUnique({ where: { id: body.targetId }, select: { id: true, name: true, type: true } });
          if (!submission) return reply.code(400).send({ message: "Expositor/projeto não encontrado." });
          targetMeta = JSON.stringify({ name: submission.name, type: submission.type });
        } else if (body.type === "WORKSHOP_CHECKIN" && body.targetId) {
          const agendaItem = await prisma.agendaItem.findUnique({ where: { id: body.targetId }, select: { id: true, title: true, local: true } });
          if (!agendaItem) return reply.code(400).send({ message: "Atividade da agenda não encontrada." });
          targetMeta = JSON.stringify({ title: agendaItem.title, local: agendaItem.local });
        }

        if (body.passportMissionId) {
          const mission = await prisma.passportMission.findUnique({ where: { id: body.passportMissionId } });
          if (!mission) return reply.code(400).send({ message: "Missão do Passaporte não encontrada." });
        }

        const token = createQrActionToken();
        const qrAction = await prisma.qrAction.create({
          data: {
            token,
            type: body.type,
            label: body.label,
            description: body.description ?? null,
            targetId: body.targetId ?? null,
            targetMeta,
            eventKey: body.eventKey ?? null,
            eventLabel: body.eventLabel ?? null,
            maxScans: body.maxScans ?? null,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
            smsOnScan: body.smsOnScan ?? false,
            smsTemplate: body.smsTemplate ?? null,
            smsSender: body.smsSender ?? null,
            passportMissionId: body.passportMissionId ?? null,
          },
        });

        const scansCount = 0;
        const qrImageUrl = buildValidationQrUrl(opts.env, qrAction.token);

        return {
          id: qrAction.id,
          token: qrAction.token,
          type: qrAction.type,
          label: qrAction.label,
          description: qrAction.description,
          targetId: qrAction.targetId,
          targetMeta: qrAction.targetMeta,
          eventKey: qrAction.eventKey,
          eventLabel: qrAction.eventLabel,
          active: qrAction.active,
          maxScans: qrAction.maxScans,
          expiresAt: qrAction.expiresAt?.toISOString() ?? null,
          smsOnScan: qrAction.smsOnScan,
          smsTemplate: qrAction.smsTemplate,
          smsSender: qrAction.smsSender,
          passportMissionId: qrAction.passportMissionId,
          scansCount,
          qrImageUrl,
          createdAt: qrAction.createdAt.toISOString(),
        };
      });

      /* ---- Admin: list QR actions ---- */
      adminApp.get("/admin/qr-actions", {
        schema: {
          querystring: z.object({
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(5).max(100).default(20),
            type: z.string().optional(),
            search: z.string().trim().max(120).optional(),
          }),
          response: {
            200: z.object({
              items: z.array(qrActionSchema),
              total: z.number(),
              page: z.number(),
              totalPages: z.number(),
            }),
          },
        },
      }, async (request) => {
        const query = request.query as { page: number; limit: number; type?: string; search?: string };
        const where: Record<string, unknown> = {};

        if (query.type) where.type = query.type;
        if (query.search) {
          where.OR = [
            { label: { contains: query.search } },
            { description: { contains: query.search } },
            { token: { contains: query.search } },
          ];
        }

        const [total, items] = await Promise.all([
          prisma.qrAction.count({ where }),
          prisma.qrAction.findMany({
            where,
            include: { _count: { select: { scans: true } } },
            orderBy: [{ createdAt: "desc" }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
        ]);

        return {
          items: items.map((item) => ({
            id: item.id,
            token: item.token,
            type: item.type,
            label: item.label,
            description: item.description,
            targetId: item.targetId,
            targetMeta: item.targetMeta,
            eventKey: item.eventKey,
            eventLabel: item.eventLabel,
            active: item.active,
            maxScans: item.maxScans,
            expiresAt: item.expiresAt?.toISOString() ?? null,
            smsOnScan: item.smsOnScan,
            smsTemplate: item.smsTemplate,
            smsSender: item.smsSender,
            passportMissionId: item.passportMissionId,
            scansCount: item._count.scans,
            qrImageUrl: buildValidationQrUrl(opts.env, item.token),
            createdAt: item.createdAt.toISOString(),
          })),
          total,
          page: query.page,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        };
      });

      /* ---- Admin: get QR action detail with scans ---- */
      adminApp.get("/admin/qr-actions/:id", {
        schema: {
          params: z.object({ id: z.coerce.number().int() }),
          response: {
            200: z.object({
              action: qrActionSchema,
              scans: z.array(z.object({
                id: z.number(),
                studentNumber: z.string(),
                studentName: z.string().nullable(),
                result: z.string(),
                message: z.string().nullable(),
                scannedAt: z.string(),
              })),
            }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const action = await prisma.qrAction.findUnique({
          where: { id },
          include: {
            _count: { select: { scans: true } },
            scans: {
              orderBy: { scannedAt: "desc" },
              take: 100,
            },
          },
        });

        if (!action) return reply.code(404).send({ message: "QR não encontrado." });

        return {
          action: {
            id: action.id,
            token: action.token,
            type: action.type,
            label: action.label,
            description: action.description,
            targetId: action.targetId,
            targetMeta: action.targetMeta,
            eventKey: action.eventKey,
            eventLabel: action.eventLabel,
            active: action.active,
            maxScans: action.maxScans,
            expiresAt: action.expiresAt?.toISOString() ?? null,
            smsOnScan: action.smsOnScan,
            smsTemplate: action.smsTemplate,
            smsSender: action.smsSender,
            passportMissionId: action.passportMissionId,
            scansCount: action._count.scans,
            qrImageUrl: buildValidationQrUrl(opts.env, action.token),
            createdAt: action.createdAt.toISOString(),
          },
          scans: action.scans.map((scan) => ({
            id: scan.id,
            studentNumber: scan.studentNumber,
            studentName: scan.studentName,
            result: scan.result,
            message: scan.message,
            scannedAt: scan.scannedAt.toISOString(),
          })),
        };
      });

      /* ---- Admin: toggle QR action active status ---- */
      adminApp.patch("/admin/qr-actions/:id", {
        schema: {
          params: z.object({ id: z.coerce.number().int() }),
          body: z.object({
            active: z.boolean().optional(),
            label: z.string().trim().min(2).max(140).optional(),
            description: z.string().trim().max(500).optional().nullable(),
            maxScans: z.number().int().min(1).optional().nullable(),
            expiresAt: z.string().optional().nullable(),
            smsOnScan: z.boolean().optional(),
            smsTemplate: z.string().trim().max(300).optional().nullable(),
            smsSender: z.string().trim().max(20).optional().nullable(),
            passportMissionId: z.number().int().optional().nullable(),
          }),
          response: {
            200: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const body = request.body as Record<string, unknown>;

        const existing = await prisma.qrAction.findUnique({ where: { id } });
        if (!existing) return reply.code(404).send({ message: "QR não encontrado." });

        const data: Record<string, unknown> = {};
        if (body.active !== undefined) data.active = body.active;
        if (body.label !== undefined) data.label = body.label;
        if (body.description !== undefined) data.description = body.description;
        if (body.maxScans !== undefined) data.maxScans = body.maxScans;
        if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt as string) : null;
        if (body.smsOnScan !== undefined) data.smsOnScan = body.smsOnScan;
        if (body.smsTemplate !== undefined) data.smsTemplate = body.smsTemplate;
        if (body.smsSender !== undefined) data.smsSender = body.smsSender;
        if (body.passportMissionId !== undefined) {
          if (body.passportMissionId) {
            const mission = await prisma.passportMission.findUnique({ where: { id: body.passportMissionId as number } });
            if (!mission) return reply.code(404).send({ message: "Missão do Passaporte não encontrada." });
          }
          data.passportMissionId = body.passportMissionId;
        }

        await prisma.qrAction.update({ where: { id }, data });

        return { message: "QR atualizado com sucesso." };
      });

      /* ---- Admin: delete QR action ---- */
      adminApp.delete("/admin/qr-actions/:id", {
        schema: {
          params: z.object({ id: z.coerce.number().int() }),
          response: {
            200: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const existing = await prisma.qrAction.findUnique({ where: { id } });
        if (!existing) return reply.code(404).send({ message: "QR não encontrado." });

        await prisma.qrAction.delete({ where: { id } });

        return { message: "QR eliminado." };
      });

      /* ---- Admin: QR actions overview stats ---- */
      adminApp.get("/admin/qr-actions-overview", {
        schema: {
          response: {
            200: z.object({
              totalActions: z.number(),
              activeActions: z.number(),
              totalScans: z.number(),
              todayScans: z.number(),
              byType: z.array(z.object({
                type: z.string(),
                count: z.number(),
                scans: z.number(),
              })),
            }),
          },
        },
      }, async () => {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        const [totalActions, activeActions, totalScans, todayScans] = await Promise.all([
          prisma.qrAction.count(),
          prisma.qrAction.count({ where: { active: true } }),
          prisma.qrActionScan.count({ where: { result: "SUCCESS" } }),
          prisma.qrActionScan.count({ where: { result: "SUCCESS", scannedAt: { gte: dayStart } } }),
        ]);

        const typeStats = await Promise.all(
          QR_ACTION_TYPES.map(async (type) => {
            const [count, scans] = await Promise.all([
              prisma.qrAction.count({ where: { type } }),
              prisma.qrActionScan.count({ where: { qrAction: { type }, result: "SUCCESS" } }),
            ]);
            return { type, count, scans };
          })
        );

        return {
          totalActions,
          activeActions,
          totalScans,
          todayScans,
          byType: typeStats,
        };
      });
    });
  });
}
