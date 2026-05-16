import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, isAdminStudentNumber, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { renderQrDataUri } from "../../../shared/qr";
import { buildValidationQrUrl, buildValidationUrl } from "../../validation/application/validation-links";
import { sendWhatsAppAutomationEvent } from "../../whatsapp/http/whatsapp.routes";
import { isPaymentConfirmedByAdmin } from "../../payments/payment-status";

const certificateIssueBodySchema = z.object({
  studentNumber: z.string().trim().min(4).max(40),
  type: z.string().trim().min(2).max(80).default("PARTICIPATION"),
  title: z.string().trim().min(4).max(160).optional(),
  sourceType: z.string().trim().min(2).max(80).optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const certificateIssueAttendeesBodySchema = z.object({
  type: z.string().trim().min(2).max(80).default("EVENT_PARTICIPATION"),
  title: z.string().trim().min(4).max(160).optional(),
  eventKey: z.string().trim().min(2).max(80).default("main-event"),
});

const certificateIssueBulkBodySchema = z.object({
  mode: z.enum(["STUDENT_LIST", "STUDENT_COURSE", "COURSE_ENROLLMENT", "PROJECT"]),
  type: z.string().trim().min(2).max(80).default("PARTICIPATION"),
  title: z.string().trim().min(4).max(160).optional(),
  studentNumbers: z.array(z.string().trim().min(4).max(40)).max(500).optional(),
  studentCourse: z.string().trim().min(2).max(120).optional(),
  courseId: z.coerce.number().int().positive().optional(),
  submissionId: z.coerce.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.mode === "STUDENT_LIST" && !value.studentNumbers?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentNumbers"], message: "Informe pelo menos um número de estudante." });
  }
  if (value.mode === "STUDENT_COURSE" && !value.studentCourse) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studentCourse"], message: "Informe o curso académico." });
  }
  if (value.mode === "COURSE_ENROLLMENT" && !value.courseId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["courseId"], message: "Informe o curso do portal." });
  }
  if (value.mode === "PROJECT" && !value.submissionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["submissionId"], message: "Informe o projeto." });
  }
});

const certificatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(30),
  search: z.string().trim().max(120).optional(),
  type: z.string().trim().max(80).optional(),
  status: z.string().trim().max(40).optional(),
});

const certificateSchema = z.object({
  id: z.number(),
  code: z.string(),
  validationToken: z.string(),
  type: z.string(),
  title: z.string(),
  recipientName: z.string(),
  recipientNumber: z.string().nullable(),
  recipientCourse: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceId: z.number().nullable(),
  issuedAt: z.string(),
  issuedByStudentNumber: z.string(),
  status: z.string(),
  revokedAt: z.string().nullable(),
  revokedReason: z.string().nullable(),
  version: z.number(),
  reissuedFromId: z.number().nullable(),
  templateKey: z.string().nullable(),
  validationUrl: z.string(),
  qrImageUrl: z.string(),
  pdfPath: z.string(),
});

const certificateRevocationBodySchema = z.object({
  reason: z.string().trim().min(4).max(240).optional().nullable(),
});

function randomToken(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function createCertificateCode(type: string) {
  const compactType = type.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "CERT";
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  return `UOR-${new Date().getFullYear()}-${compactType}-${suffix}`;
}

const certificateTemplates = [
  {
    key: "PARTICIPATION",
    type: "PARTICIPATION",
    title: "Certificado de Participação",
    description: "Participação geral em atividades UOR Connect.",
  },
  {
    key: "EVENT_PARTICIPATION",
    type: "EVENT_PARTICIPATION",
    title: "Certificado de Participação no Evento",
    description: "Emitido a partir de presenças/check-ins confirmados.",
  },
  {
    key: "COURSE_COMPLETION",
    type: "COURSE_COMPLETION",
    title: "Certificado de Conclusão de Curso",
    description: "Emitido para inscritos ou concluintes de cursos do portal.",
  },
  {
    key: "PROJECT_EXHIBITION",
    type: "PROJECT_EXHIBITION",
    title: "Certificado de Exposição de Projeto",
    description: "Emitido para líderes e membros confirmados de projetos.",
  },
] as const;

function resolveCertificateTemplate(type: string, title?: string | null) {
  const normalizedType = type.trim().toUpperCase();
  const template = certificateTemplates.find((item) => item.type === normalizedType) ?? certificateTemplates[0];
  return {
    type: normalizedType,
    title: title?.trim() || template.title,
    templateKey: template.key,
  };
}

type CertificateRecipient = {
  studentId: number | null;
  studentNumber: string | null;
  name: string;
  course: string | null;
  sourceType: string | null;
  sourceId: number | null;
  metadata?: Record<string, unknown>;
};

function normalizeCertificateKeyPart(value: string | number | null | undefined) {
  const normalized = String(value ?? "none")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._:-]/g, "");
  return normalized || "none";
}

function buildCertificateBusinessKey(input: {
  type: string;
  sourceType: string | null;
  sourceId: number | null;
  studentId: number | null;
  recipientNumber: string | null;
  recipientName: string;
}) {
  const recipientIdentity = input.recipientNumber
    ? `number:${input.recipientNumber.replace(/\D/g, "").trim()}`
    : input.studentId
      ? `student:${input.studentId}`
      : `name:${normalizeCertificateKeyPart(input.recipientName)}`;

  return [
    "cert-v1",
    normalizeCertificateKeyPart(input.type),
    normalizeCertificateKeyPart(input.sourceType ?? "MANUAL"),
    normalizeCertificateKeyPart(input.sourceId),
    normalizeCertificateKeyPart(recipientIdentity),
  ].join(":");
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "P2002";
}

async function createCertificateForRecipient(input: {
  recipient: CertificateRecipient;
  type: string;
  title: string;
  templateKey: string;
  actor: string;
}) {
  const businessKey = buildCertificateBusinessKey({
    type: input.type,
    sourceType: input.recipient.sourceType,
    sourceId: input.recipient.sourceId,
    studentId: input.recipient.studentId,
    recipientNumber: input.recipient.studentNumber,
    recipientName: input.recipient.name,
  });
  const sourceType = input.recipient.sourceType ?? "MANUAL";
  const existing = await prisma.certificate.findFirst({
    where: {
      OR: [
        { businessKey },
        {
          type: input.type,
          sourceType,
          sourceId: input.recipient.sourceId,
          ...(input.recipient.studentNumber
            ? { recipientNumber: input.recipient.studentNumber }
            : input.recipient.studentId
              ? { studentId: input.recipient.studentId }
              : { recipientName: input.recipient.name }),
        },
      ],
    },
    orderBy: [{ version: "desc" }, { issuedAt: "desc" }, { id: "desc" }],
  });

  if (existing) return { certificate: existing, skipped: true, reason: "DUPLICATE" as const, businessKey };

  try {
    const certificate = await prisma.certificate.create({
      data: {
        code: createCertificateCode(input.type),
        validationToken: randomToken("cert"),
        businessKey,
        type: input.type,
        title: input.title,
        recipientName: input.recipient.name,
        recipientNumber: input.recipient.studentNumber,
        recipientCourse: input.recipient.course,
        studentId: input.recipient.studentId,
        sourceType,
        sourceId: input.recipient.sourceId,
        issuedByStudentNumber: input.actor,
        templateKey: input.templateKey,
        metadataJson: input.recipient.metadata ? JSON.stringify(input.recipient.metadata) : null,
      },
    });

    return { certificate, skipped: false, businessKey };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const duplicate = await prisma.certificate.findFirst({ where: { businessKey } });
    if (!duplicate) throw error;
    return { certificate: duplicate, skipped: true, reason: "DUPLICATE" as const, businessKey };
  }
}

function serializeCertificate(env: Env, certificate: {
  id: number;
  code: string;
  validationToken: string;
  type: string;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  sourceType: string | null;
  sourceId: number | null;
  issuedAt: Date;
  issuedByStudentNumber: string;
  status: string;
  revokedAt: Date | null;
  revokedReason: string | null;
  version: number;
  reissuedFromId: number | null;
  templateKey: string | null;
}) {
  const validationUrl = buildValidationUrl(env, certificate.validationToken);

  return {
    id: certificate.id,
    code: certificate.code,
    validationToken: certificate.validationToken,
    type: certificate.type,
    title: certificate.title,
    recipientName: certificate.recipientName,
    recipientNumber: certificate.recipientNumber,
    recipientCourse: certificate.recipientCourse,
    sourceType: certificate.sourceType,
    sourceId: certificate.sourceId,
    issuedAt: certificate.issuedAt.toISOString(),
    issuedByStudentNumber: certificate.issuedByStudentNumber,
    status: certificate.status,
    revokedAt: certificate.revokedAt?.toISOString() ?? null,
    revokedReason: certificate.revokedReason,
    version: certificate.version,
    reissuedFromId: certificate.reissuedFromId,
    templateKey: certificate.templateKey,
    validationUrl,
    qrImageUrl: buildValidationQrUrl(env, certificate.validationToken),
    pdfPath: `/certificates/${certificate.id}/pdf`,
  };
}

async function notifyCertificateIssued(env: Env, certificate: {
  id: number;
  validationToken: string;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  studentId: number | null;
}) {
  const student = certificate.studentId
    ? await prisma.student.findUnique({
      where: { id: certificate.studentId },
      select: { phone: true },
    })
    : certificate.recipientNumber
      ? await prisma.student.findUnique({
        where: { studentNumber: certificate.recipientNumber },
        select: { phone: true },
      })
      : null;

  if (!student?.phone || !certificate.recipientNumber) return;

  const validationUrl = buildValidationUrl(env, certificate.validationToken);
  const pdfUrl = `${env.PUBLIC_API_URL?.replace(/\/$/, "") ?? ""}/certificates/${certificate.id}/pdf`;

  await sendWhatsAppAutomationEvent(env, "CERTIFICATE_ISSUED", {
    phone: student.phone,
    studentId: certificate.studentId,
    studentNumber: certificate.recipientNumber,
    recipientName: certificate.recipientName,
    recipientCourse: certificate.recipientCourse,
    values: {
      certificado: certificate.title,
      validacao_url: validationUrl,
      pdf_url: pdfUrl,
    },
  });
}

async function canReadCertificate(request: FastifyRequest, studentId: number | null, env: Env) {
  if (request.jury) return true;
  if (request.student?.id === studentId) return true;
  if (request.student?.studentNumber && await isAdminStudentNumber(request.student.studentNumber)) return true;
  return false;
}

function buildCertificateHtml(params: {
  logoDataUri: string | null;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  code: string;
  issuedAt: Date;
  institutionName: string;
  organizerName: string;
  authorityTitle: string;
  authorityName: string;
}) {
  const logoMarkup = params.logoDataUri
    ? `<img src="${params.logoDataUri}" alt="UÓR" class="logo-img" />`
    : `<div class="logo-fallback"><div class="logo-icon">&#9632;</div><div class="logo-label"><strong>UÓR</strong><span>UNIVERSIDADE ÓSCAR RIBAS</span></div></div>`;

  const formattedDate = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(params.issuedAt);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.title)} &middot; ${escapeHtml(params.code)}</title>
<style>
  :root {
    --paper-bg: #f5edd4;
    --paper-bg-light: #faf4e4;
    --border-color: #a0361a;
    --border-color-light: #b5462a;
    --text-color: #2a2a2a;
    --muted-text: #555;
    --title-color: #333;
  }

  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Times New Roman", Georgia, "Palatino Linotype", serif;
    color: var(--text-color);
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .certificate {
    width: 297mm;
    height: 210mm;
    position: relative;
    overflow: hidden;
    background: linear-gradient(170deg, var(--paper-bg-light) 0%, var(--paper-bg) 50%, #efe5c8 100%);
  }

  /* ── Subtle paper texture ── */
  .certificate::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(180,160,120,0.015) 2px, rgba(180,160,120,0.015) 4px),
      repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(180,160,120,0.012) 2px, rgba(180,160,120,0.012) 4px);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Bottom decorative band (African geometric) ── */
  .certificate::after {
    content: "";
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 18mm;
    background:
      repeating-linear-gradient(
        45deg,
        transparent, transparent 3mm,
        rgba(160,54,26,0.025) 3mm, rgba(160,54,26,0.025) 6mm
      ),
      repeating-linear-gradient(
        -45deg,
        transparent, transparent 3mm,
        rgba(160,54,26,0.02) 3mm, rgba(160,54,26,0.02) 6mm
      );
    pointer-events: none;
    z-index: 0;
  }

  /* ── Ornamental SVG border frame ── */
  .frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .frame svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* ── Content layout ── */
  .certificate-body {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16mm 30mm 13mm;
    height: 210mm;
  }

  /* ── Header / logo ── */
  .certificate-header {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .logo-img {
    width: 38mm;
    height: auto;
    display: block;
  }
  .logo-fallback {
    display: flex;
    align-items: center;
    gap: 3mm;
  }
  .logo-icon {
    width: 12mm;
    height: 14mm;
    background: var(--border-color);
    border-radius: 1.5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 18px;
  }
  .logo-label {
    display: flex;
    flex-direction: column;
  }
  .logo-label strong {
    font-family: Georgia, serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-color);
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .logo-label span {
    font-size: 7px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-text);
    margin-top: 1mm;
  }

  /* ── Title ── */
  .cert-title {
    margin-top: 6mm;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 44px;
    font-weight: 700;
    color: var(--title-color);
    letter-spacing: 0.12em;
    text-align: center;
    text-transform: uppercase;
  }

  /* ── Intro text ── */
  .cert-intro {
    margin-top: 6mm;
    font-size: 13px;
    line-height: 1.55;
    color: var(--text-color);
    text-align: center;
    max-width: 190mm;
  }

  /* ── Recipient name ── */
  .recipient-block {
    margin-top: 6mm;
    text-align: center;
    width: 100%;
    position: relative;
  }
  .name-line {
    display: inline-block;
    position: relative;
    min-width: 150mm;
    padding-bottom: 1.5mm;
    border-bottom: 1px solid #444;
  }
  .name-line::after {
    content: ",";
    position: absolute;
    right: -2mm;
    bottom: 0;
    font-size: 14px;
    color: var(--text-color);
  }
  .recipient-name {
    font-family: "Segoe Script", "Brush Script MT", "Apple Chancery", "Lucida Handwriting", cursive, Georgia, serif;
    font-size: 28px;
    font-style: italic;
    color: var(--text-color);
    display: inline-block;
    padding: 0 8mm;
  }

  /* ── Body text ── */
  .cert-body-text {
    margin-top: 5mm;
    font-size: 12.5px;
    line-height: 1.9;
    color: var(--text-color);
    text-align: center;
    max-width: 210mm;
  }
  .cert-body-text .highlight {
    font-weight: 700;
    font-style: italic;
  }

  /* ── Date line ── */
  .cert-date {
    margin-top: 7mm;
    font-size: 12.5px;
    color: var(--text-color);
    text-align: center;
  }

  /* ── Authority title ── */
  .authority-title {
    margin-top: 5mm;
    font-size: 11.5px;
    font-style: italic;
    color: var(--text-color);
    text-align: center;
  }

  /* ── Signature area ── */
  .signature-block {
    margin-top: 8mm;
    text-align: center;
    position: relative;
  }
  .sig-line {
    width: 50mm;
    border-top: 1px solid #444;
    margin: 0 auto;
  }
  .sig-authority-name {
    margin-top: 2mm;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-color);
  }
  .sig-authority-institution {
    font-size: 8px;
    color: var(--muted-text);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 0.5mm;
  }

  /* ── Footer ── */
  .certificate-footer {
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: auto;
  }
  .footer-ref {
    font-family: "Courier New", monospace;
    font-size: 7.5px;
    color: #555;
    letter-spacing: 0.02em;
  }
  .footer-brand {
    text-align: center;
  }
  .footer-brand-name {
    font-size: 10px;
    font-weight: 700;
    color: var(--border-color);
    letter-spacing: 0.06em;
  }
  .footer-brand-sub {
    font-size: 7px;
    color: #555;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-top: 0.5mm;
  }
</style>
</head>
<body>
  <main class="certificate">
    <!-- Ornamental SVG border frame with geometric corners and side decorations -->
    <div class="frame">
      <svg viewBox="0 0 842 595" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <!-- Outer border line -->
        <rect x="18" y="18" width="806" height="559" rx="0" fill="none" stroke="#a0361a" stroke-width="2.2"/>
        <!-- Inner border line -->
        <rect x="26" y="26" width="790" height="543" rx="0" fill="none" stroke="#a0361a" stroke-width="0.8"/>

        <!-- Corner ornaments: top-left -->
        <g fill="none" stroke="#a0361a" stroke-width="1.6">
          <polyline points="18,50 18,18 50,18"/>
          <polyline points="26,48 26,26 48,26"/>
          <rect x="14" y="14" width="10" height="10" rx="1" fill="#a0361a" stroke="none"/>
          <line x1="28" y1="18" x2="28" y2="30"/>
          <line x1="18" y1="28" x2="30" y2="28"/>
          <polygon points="36,14 40,18 36,22 32,18" fill="#a0361a" stroke="none"/>
          <polygon points="14,36 18,40 14,44 10,40" fill="#a0361a" stroke="none"/>
        </g>
        <!-- Corner ornaments: top-right -->
        <g fill="none" stroke="#a0361a" stroke-width="1.6">
          <polyline points="824,50 824,18 792,18"/>
          <polyline points="816,48 816,26 794,26"/>
          <rect x="818" y="14" width="10" height="10" rx="1" fill="#a0361a" stroke="none"/>
          <line x1="814" y1="18" x2="814" y2="30"/>
          <line x1="812" y1="28" x2="824" y2="28"/>
          <polygon points="806,14 810,18 806,22 802,18" fill="#a0361a" stroke="none"/>
          <polygon points="828,36 824,40 828,44 832,40" fill="#a0361a" stroke="none"/>
        </g>
        <!-- Corner ornaments: bottom-left -->
        <g fill="none" stroke="#a0361a" stroke-width="1.6">
          <polyline points="18,545 18,577 50,577"/>
          <polyline points="26,547 26,569 48,569"/>
          <rect x="14" y="573" width="10" height="10" rx="1" fill="#a0361a" stroke="none"/>
          <line x1="28" y1="565" x2="28" y2="577"/>
          <line x1="18" y1="567" x2="30" y2="567"/>
          <polygon points="36,573 40,577 36,581 32,577" fill="#a0361a" stroke="none"/>
          <polygon points="14,551 18,555 14,559 10,555" fill="#a0361a" stroke="none"/>
        </g>
        <!-- Corner ornaments: bottom-right -->
        <g fill="none" stroke="#a0361a" stroke-width="1.6">
          <polyline points="824,545 824,577 792,577"/>
          <polyline points="816,547 816,569 794,569"/>
          <rect x="818" y="573" width="10" height="10" rx="1" fill="#a0361a" stroke="none"/>
          <line x1="814" y1="565" x2="814" y2="577"/>
          <line x1="812" y1="567" x2="824" y2="567"/>
          <polygon points="806,573 810,577 806,581 802,577" fill="#a0361a" stroke="none"/>
          <polygon points="828,551 824,555 828,559 832,555" fill="#a0361a" stroke="none"/>
        </g>

        <!-- Side decorations: left -->
        <g fill="#a0361a" stroke="none">
          <rect x="15" y="180" width="3" height="12" rx="1.5"/>
          <polygon points="16.5,200 19,204 16.5,208 14,204"/>
          <rect x="15" y="216" width="3" height="12" rx="1.5"/>
          <rect x="15" y="370" width="3" height="12" rx="1.5"/>
          <polygon points="16.5,390 19,394 16.5,398 14,394"/>
          <rect x="15" y="406" width="3" height="12" rx="1.5"/>
        </g>
        <!-- Side decorations: right -->
        <g fill="#a0361a" stroke="none">
          <rect x="824" y="180" width="3" height="12" rx="1.5"/>
          <polygon points="825.5,200 828,204 825.5,208 823,204"/>
          <rect x="824" y="216" width="3" height="12" rx="1.5"/>
          <rect x="824" y="370" width="3" height="12" rx="1.5"/>
          <polygon points="825.5,390 828,394 825.5,398 823,394"/>
          <rect x="824" y="406" width="3" height="12" rx="1.5"/>
        </g>

        <!-- Top side small decorations -->
        <g fill="#a0361a" stroke="none">
          <polygon points="380,15 384,19 380,23 376,19"/>
          <polygon points="462,15 466,19 462,23 458,19"/>
        </g>
        <!-- Bottom center gap for brand -->
        <line x1="350" y1="577" x2="492" y2="577" stroke="var(--paper-bg)" stroke-width="4"/>
        <line x1="350" y1="569" x2="492" y2="569" stroke="var(--paper-bg)" stroke-width="3"/>
      </svg>
    </div>

    <div class="certificate-body">
      <header class="certificate-header">
        ${logoMarkup}
      </header>

      <h1 class="cert-title">CERTIFICADO</h1>

      <p class="cert-intro">
        A Direcção da ${escapeHtml(params.institutionName)} confere o presente certificado a
      </p>

      <div class="recipient-block">
        <div class="name-line">
          <span class="recipient-name">${escapeHtml(params.recipientName)}</span>
        </div>
      </div>

      <section class="cert-body-text">
        participou como participante da <span class="highlight">${escapeHtml(params.title)}</span>${params.recipientCourse ? `, do curso de ${escapeHtml(params.recipientCourse)}` : ""},
        organizado por ${escapeHtml(params.organizerName)}, nas instalações da
        ${escapeHtml(params.institutionName)}${params.recipientNumber ? ` (N.º ${escapeHtml(params.recipientNumber)})` : ""}.
      </section>

      <p class="cert-date">Luanda, ${escapeHtml(formattedDate)}.</p>

      <p class="authority-title">${escapeHtml(params.authorityTitle)}</p>

      <div class="signature-block">
        <div class="sig-line"></div>
        <p class="sig-authority-name">${escapeHtml(params.authorityName)}</p>
        <p class="sig-authority-institution">${escapeHtml(params.institutionName)}</p>
      </div>

      <footer class="certificate-footer">
        <span class="footer-ref">${escapeHtml(params.code)}</span>
        <div class="footer-brand">
          <div class="footer-brand-name">UÓR</div>
          <div class="footer-brand-sub">${escapeHtml(params.institutionName)}</div>
        </div>
      </footer>
    </div>
  </main>
</body>
</html>`;
}

function parseCertificateMetadata(metadataJson?: string | null) {
  if (!metadataJson) return {};
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function certificatePdfSnapshot(env: Env, certificate: {
  id: number;
  code: string;
  validationToken: string;
  type: string;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  issuedAt: Date;
  issuedByStudentNumber: string;
  version: number;
  templateKey: string | null;
}, generatedAt: Date) {
  return {
    documentType: "CERTIFICATE_PDF",
    certificateId: certificate.id,
    code: certificate.code,
    validationTokenHashPurpose: "validation-url-only",
    validationUrl: buildValidationUrl(env, certificate.validationToken),
    type: certificate.type,
    title: certificate.title,
    recipientName: certificate.recipientName,
    recipientNumber: certificate.recipientNumber,
    recipientCourse: certificate.recipientCourse,
    issuedAt: certificate.issuedAt.toISOString(),
    issuedByStudentNumber: certificate.issuedByStudentNumber,
    version: certificate.version,
    templateKey: certificate.templateKey,
    generatedAt: generatedAt.toISOString(),
  };
}

async function sendCertificatePdf(reply: FastifyReply, env: Env, certificate: {
  id: number;
  code: string;
  validationToken: string;
  type: string;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  issuedAt: Date;
  issuedByStudentNumber: string;
  version: number;
  templateKey: string | null;
  metadataJson: string | null;
} | null) {
  if (!certificate) {
    return reply.code(404).send({ message: "Certificate not found" });
  }

  const html = buildCertificateHtml({
    logoDataUri: await loadLogoDataUri(),
    title: certificate.title,
    recipientName: certificate.recipientName,
    recipientNumber: certificate.recipientNumber,
    recipientCourse: certificate.recipientCourse,
    code: certificate.code,
    issuedAt: certificate.issuedAt,
    institutionName: env.UORCONNECT_INSTITUTION_NAME,
    organizerName: env.UORCONNECT_CERTIFICATE_ORGANIZER_NAME,
    authorityTitle: env.UORCONNECT_CERTIFICATE_AUTHORITY_TITLE,
    authorityName: env.UORCONNECT_CERTIFICATE_AUTHORITY_NAME,
  });
  const pdf = await renderPdfFromHtml(html, {
    landscape: true,
    footerLabel: certificate.code,
    preferCssPageSize: true,
  });
  const generatedAt = new Date();
  const metadata = parseCertificateMetadata(certificate.metadataJson);
  await prisma.certificate.update({
    where: { id: certificate.id },
    data: {
      metadataJson: JSON.stringify({
        ...metadata,
        pdfSnapshot: certificatePdfSnapshot(env, certificate, generatedAt),
      }),
    },
  });

  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", `attachment; filename="${certificate.code.toLowerCase()}.pdf"`);
  return reply.send(pdf);
}

export async function certificatesRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.get("/mine", {
      schema: {
        response: {
          200: z.array(certificateSchema),
          401: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const certificates = await prisma.certificate.findMany({
        where: { studentId: student.id },
        orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      });

      return certificates.map((certificate) => serializeCertificate(opts.env, certificate));
    });

    protectedApp.get("/:id/pdf", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const certificate = await prisma.certificate.findUnique({
        where: { id: (request.params as { id: number }).id },
      });

      if (!certificate) return reply.code(404).send({ message: "Certificate not found" });
      if (!await canReadCertificate(request, certificate.studentId, opts.env)) {
        return reply.status(403).send({ message: "Access denied" });
      }

      return sendCertificatePdf(reply, opts.env, certificate);
    });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);
      setDefaultAdminPermission(adminApp, ["CERTIFICATES"]);

      adminApp.get("/admin/list", {
        schema: {
          querystring: certificatesQuerySchema,
          response: {
            200: z.object({
              items: z.array(certificateSchema),
              total: z.number(),
              page: z.number(),
              totalPages: z.number(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const query = certificatesQuerySchema.parse(request.query);
        const where = {
          ...(query.type ? { type: query.type } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(query.search
            ? {
              OR: [
                { code: { contains: query.search } },
                { recipientName: { contains: query.search } },
                { recipientNumber: { contains: query.search } },
                { recipientCourse: { contains: query.search } },
              ],
            }
            : {}),
        };

        const [total, certificates] = await Promise.all([
          prisma.certificate.count({ where }),
          prisma.certificate.findMany({
            where,
            orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
        ]);

        return {
          items: certificates.map((certificate) => serializeCertificate(opts.env, certificate)),
          total,
          page: query.page,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        };
      });

      adminApp.get("/admin/templates", {
        schema: {
          response: {
            200: z.object({
              templates: z.array(z.object({
                key: z.string(),
                type: z.string(),
                title: z.string(),
                description: z.string(),
              })),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => ({ templates: certificateTemplates }));

      adminApp.post("/admin/issue", {
        config: requireAdminPermission(["CERTIFICATES"]),
        schema: {
          body: certificateIssueBodySchema,
          response: {
            200: certificateSchema,
            201: certificateSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = certificateIssueBodySchema.parse(request.body);
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const template = resolveCertificateTemplate(body.type, body.title);
        const student = await prisma.student.findUnique({
          where: { studentNumber: body.studentNumber.replace(/\D/g, "").trim() },
        });

        if (!student) return reply.code(404).send({ message: "Student not found" });

        const normalized = normalizeStudentProfile(student);
        const result = await createCertificateForRecipient({
          recipient: {
            studentId: normalized.id,
            studentNumber: normalized.studentNumber,
            name: normalized.name ?? `Estudante ${normalized.studentNumber}`,
            course: normalized.course ?? null,
            sourceType: body.sourceType ?? null,
            sourceId: body.sourceId ?? null,
            metadata: body.metadata,
          },
          type: template.type,
          title: template.title,
          templateKey: template.templateKey,
          actor,
        });
        const certificate = result.certificate;

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: result.skipped ? "certificate.issue_duplicate" : "certificate.issue",
          entityType: "Certificate",
          entityId: certificate.id,
          summary: result.skipped
            ? `Tentativa duplicada de emissão para ${certificate.recipientName}.`
            : `Certificado emitido para ${certificate.recipientName}.`,
          metadata: {
            code: certificate.code,
            type: certificate.type,
            templateKey: certificate.templateKey,
            skipped: result.skipped,
            reason: result.reason ?? null,
            businessKey: result.businessKey,
            recipient: {
              studentId: certificate.studentId,
              number: certificate.recipientNumber,
              name: certificate.recipientName,
              course: certificate.recipientCourse,
            },
            source: { type: certificate.sourceType, id: certificate.sourceId },
          },
        });

        if (!result.skipped) {
          try {
            await notifyCertificateIssued(opts.env, certificate);
          } catch (error) {
            request.log.warn({ err: error, certificateId: certificate.id }, "automatic certificate WhatsApp notification failed");
          }
        }

        return reply.code(result.skipped ? 200 : 201).send(serializeCertificate(opts.env, certificate));
      });

      adminApp.post("/admin/issue-attendees", {
        config: requireAdminPermission(["ATTENDANCE", "CERTIFICATES"], "ALL"),
        schema: {
          body: certificateIssueAttendeesBodySchema,
          response: {
            200: z.object({
              issued: z.number(),
              skipped: z.number(),
              certificates: z.array(certificateSchema),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const body = certificateIssueAttendeesBodySchema.parse(request.body);
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const template = resolveCertificateTemplate(body.type, body.title);
        const checkIns = await prisma.attendanceCheckIn.findMany({
          where: { eventKey: body.eventKey },
          orderBy: [{ checkedInAt: "asc" }, { id: "asc" }],
        });
        const certificates = [];
        const duplicateAttempts = [];
        let skipped = 0;

        for (const checkIn of checkIns) {
          const result = await createCertificateForRecipient({
            recipient: {
              studentId: checkIn.studentId,
              studentNumber: checkIn.studentNumber,
              name: checkIn.studentName ?? `Estudante ${checkIn.studentNumber}`,
              course: checkIn.studentCourse,
              sourceType: "ATTENDANCE",
              sourceId: checkIn.id,
              metadata: {
                eventKey: checkIn.eventKey,
                eventLabel: checkIn.eventLabel,
                checkedInAt: checkIn.checkedInAt.toISOString(),
              },
            },
            type: template.type,
            title: template.title,
            templateKey: template.templateKey,
            actor,
          });

          if (result.skipped) {
            skipped += 1;
            duplicateAttempts.push({
              certificateId: result.certificate.id,
              code: result.certificate.code,
              recipientNumber: result.certificate.recipientNumber,
              sourceId: checkIn.id,
              businessKey: result.businessKey,
            });
            continue;
          }

          certificates.push(result.certificate);
        }

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.issue_attendees",
          entityType: "Certificate",
          summary: `${certificates.length} certificado(s) emitido(s) para presenças.`,
          metadata: {
            eventKey: body.eventKey,
            issued: certificates.length,
            skipped,
            duplicateAttempts: duplicateAttempts.slice(0, 50),
            type: template.type,
            templateKey: template.templateKey,
            certificates: certificates.map((certificate) => ({
              id: certificate.id,
              code: certificate.code,
              recipientNumber: certificate.recipientNumber,
            })),
          },
        });

        for (const certificate of certificates) {
          try {
            await notifyCertificateIssued(opts.env, certificate);
          } catch (error) {
            request.log.warn({ err: error, certificateId: certificate.id }, "automatic attendees certificate WhatsApp notification failed");
          }
        }

        return {
          issued: certificates.length,
          skipped,
          certificates: certificates.map((certificate) => serializeCertificate(opts.env, certificate)),
        };
      });

      adminApp.post("/admin/issue-bulk", {
        config: requireAdminPermission(["CERTIFICATES"]),
        schema: {
          body: certificateIssueBulkBodySchema,
          response: {
            200: z.object({
              issued: z.number(),
              skipped: z.number(),
              certificates: z.array(certificateSchema),
            }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = certificateIssueBulkBodySchema.parse(request.body);
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const template = resolveCertificateTemplate(body.type, body.title);
        const recipients: CertificateRecipient[] = [];

        if (body.mode === "STUDENT_LIST") {
          const studentNumbers = Array.from(new Set((body.studentNumbers ?? []).map((item) => item.replace(/\D/g, "").trim()).filter(Boolean)));
          const students = await prisma.student.findMany({ where: { studentNumber: { in: studentNumbers } } });
          const foundNumbers = new Set(students.map((student) => student.studentNumber));
          const missingCount = studentNumbers.filter((studentNumber) => !foundNumbers.has(studentNumber)).length;

          for (const student of students) {
            const normalized = normalizeStudentProfile(student);
            recipients.push({
              studentId: normalized.id,
              studentNumber: normalized.studentNumber,
              name: normalized.name ?? `Estudante ${normalized.studentNumber}`,
              course: normalized.course ?? null,
              sourceType: "STUDENT_LIST",
              sourceId: null,
              metadata: { mode: body.mode },
            });
          }

          if (!recipients.length) {
            return reply.code(404).send({ message: "Nenhum estudante encontrado para a lista informada." });
          }

          if (missingCount > 0) {
            await recordAdminAudit({
              actorStudentNumber: actor,
              action: "certificate.bulk_missing_students",
              entityType: "Certificate",
              summary: `${missingCount} estudante(s) da lista não foram encontrados.`,
              metadata: { missingCount },
            });
          }
        }

        if (body.mode === "STUDENT_COURSE") {
          const students = await prisma.student.findMany({
            where: { course: { contains: body.studentCourse } },
            orderBy: [{ name: "asc" }, { studentNumber: "asc" }],
          });

          if (!students.length) {
            return reply.code(404).send({ message: "Nenhum estudante encontrado para este curso académico." });
          }

          for (const student of students) {
            const normalized = normalizeStudentProfile(student);
            recipients.push({
              studentId: normalized.id,
              studentNumber: normalized.studentNumber,
              name: normalized.name ?? `Estudante ${normalized.studentNumber}`,
              course: normalized.course ?? null,
              sourceType: "STUDENT_COURSE",
              sourceId: null,
              metadata: { studentCourse: body.studentCourse },
            });
          }
        }

        if (body.mode === "COURSE_ENROLLMENT") {
          const course = await prisma.course.findUnique({ where: { id: body.courseId! } });
          if (!course) return reply.code(404).send({ message: "Curso do portal não encontrado." });

          const enrollments = await prisma.courseEnrollment.findMany({
            where: { courseId: course.id, paymentStatus: "CONFIRMED_BY_ADMIN" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });

          if (!enrollments.length) {
            return reply.code(404).send({ message: "Este curso ainda não tem inscritos com pagamento confirmado." });
          }

          for (const enrollment of enrollments) {
            recipients.push({
              studentId: enrollment.studentId,
              studentNumber: enrollment.studentNumber,
              name: enrollment.studentName ?? `Estudante ${enrollment.studentNumber}`,
              course: enrollment.studentCourse,
              sourceType: "COURSE_ENROLLMENT",
              sourceId: enrollment.id,
              metadata: { courseId: course.id, courseName: course.name },
            });
          }
        }

        if (body.mode === "PROJECT") {
          const submission = await prisma.submission.findUnique({
            where: { id: body.submissionId! },
            include: {
              student: true,
              memberConfirmations: {
                where: { confirmedAt: { not: null } },
                include: { student: true },
                orderBy: [{ confirmedAt: "asc" }, { name: "asc" }],
              },
            },
          });

          if (!submission) return reply.code(404).send({ message: "Projeto não encontrado." });
          if (!isPaymentConfirmedByAdmin(submission.paymentStatus)) {
            return reply.code(400).send({ message: "Confirma o pagamento do projeto antes de emitir certificados." });
          }

          const studentNumber = submission.student?.studentNumber ?? submission.studentNumberSnapshot ?? null;
          if (!studentNumber) {
            return reply.code(400).send({ message: "Este projeto não tem estudante associado para emissão automática." });
          }

          recipients.push({
            studentId: submission.studentId,
            studentNumber,
            name: submission.leaderName ?? submission.student?.name ?? `Estudante ${studentNumber}`,
            course: submission.course ?? submission.student?.course ?? null,
            sourceType: "PROJECT",
            sourceId: submission.id,
            metadata: { submissionName: submission.name, referenceCode: submission.referenceCode },
          });

          const includedNumbers = new Set<string>([studentNumber]);
          for (const member of submission.memberConfirmations) {
            const memberNumber = member.student?.studentNumber ?? member.studentNumber ?? null;
            if (!memberNumber || includedNumbers.has(memberNumber)) continue;
            includedNumbers.add(memberNumber);

            recipients.push({
              studentId: member.studentId,
              studentNumber: memberNumber,
              name: member.student?.name ?? member.studentName ?? member.name,
              course: member.student?.course ?? member.studentCourse ?? submission.course ?? null,
              sourceType: "PROJECT",
              sourceId: submission.id,
              metadata: {
                submissionName: submission.name,
                referenceCode: submission.referenceCode,
                memberName: member.name,
                role: "member",
              },
            });
          }
        }

        const certificates = [];
        const duplicateAttempts = [];
        let skipped = 0;

        for (const recipient of recipients) {
          const result = await createCertificateForRecipient({
            recipient,
            type: template.type,
            title: template.title,
            templateKey: template.templateKey,
            actor,
          });

          if (result.skipped) {
            skipped += 1;
            duplicateAttempts.push({
              certificateId: result.certificate.id,
              code: result.certificate.code,
              recipientNumber: result.certificate.recipientNumber,
              sourceType: result.certificate.sourceType,
              sourceId: result.certificate.sourceId,
              businessKey: result.businessKey,
            });
            continue;
          }

          certificates.push(result.certificate);
        }

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.issue_bulk",
          entityType: "Certificate",
          summary: `${certificates.length} certificado(s) emitido(s) em lote.`,
          metadata: {
            mode: body.mode,
            issued: certificates.length,
            skipped,
            duplicateAttempts: duplicateAttempts.slice(0, 50),
            type: template.type,
            templateKey: template.templateKey,
            recipients: recipients.length,
            certificates: certificates.slice(0, 50).map((certificate) => ({
              id: certificate.id,
              code: certificate.code,
              recipientNumber: certificate.recipientNumber,
            })),
          },
        });

        for (const certificate of certificates) {
          try {
            await notifyCertificateIssued(opts.env, certificate);
          } catch (error) {
            request.log.warn({ err: error, certificateId: certificate.id }, "automatic bulk certificate WhatsApp notification failed");
          }
        }

        return {
          issued: certificates.length,
          skipped,
          certificates: certificates.map((certificate) => serializeCertificate(opts.env, certificate)),
        };
      });

      adminApp.patch("/admin/:id/revoke", {
        config: requireAdminPermission(["CERTIFICATES"]),
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          body: certificateRevocationBodySchema.optional(),
          response: {
            200: certificateSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const body = certificateRevocationBodySchema.optional().parse(request.body ?? {});
        const certificate = await prisma.certificate.findUnique({
          where: { id: (request.params as { id: number }).id },
        });

        if (!certificate) return reply.code(404).send({ message: "Certificate not found" });

        const updated = await prisma.certificate.update({
          where: { id: certificate.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedReason: body?.reason?.trim() || "Revogado administrativamente.",
          },
        });

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.revoke",
          entityType: "Certificate",
          entityId: updated.id,
          summary: `Certificado ${updated.code} revogado.`,
          metadata: {
            code: updated.code,
            reason: updated.revokedReason,
            previousStatus: certificate.status,
            recipient: {
              number: certificate.recipientNumber,
              name: certificate.recipientName,
              course: certificate.recipientCourse,
            },
          },
        });

        return serializeCertificate(opts.env, updated);
      });

      adminApp.post("/admin/:id/reissue", {
        config: requireAdminPermission(["CERTIFICATES"]),
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            201: z.object({
              previous: certificateSchema,
              next: certificateSchema,
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const certificate = await prisma.certificate.findUnique({
          where: { id: (request.params as { id: number }).id },
        });

        if (!certificate) return reply.code(404).send({ message: "Certificate not found" });

        const reissueBusinessKey = certificate.businessKey;
        const [previous, next] = await prisma.$transaction([
          prisma.certificate.update({
            where: { id: certificate.id },
            data: {
              status: certificate.status === "ISSUED" ? "REISSUED" : certificate.status,
              ...(reissueBusinessKey ? { businessKey: null } : {}),
            },
          }),
          prisma.certificate.create({
            data: {
              code: createCertificateCode(certificate.type),
              validationToken: randomToken("cert"),
              ...(reissueBusinessKey ? { businessKey: reissueBusinessKey } : {}),
              type: certificate.type,
              title: certificate.title,
              recipientName: certificate.recipientName,
              recipientNumber: certificate.recipientNumber,
              recipientCourse: certificate.recipientCourse,
              studentId: certificate.studentId,
              sourceType: certificate.sourceType,
              sourceId: certificate.sourceId,
              issuedByStudentNumber: actor,
              version: certificate.version + 1,
              reissuedFromId: certificate.id,
              templateKey: certificate.templateKey,
              metadataJson: certificate.metadataJson,
            },
          }),
        ]);

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.reissue",
          entityType: "Certificate",
          entityId: next.id,
          summary: `Certificado ${certificate.code} reemitido como ${next.code}.`,
          metadata: {
            previous: { id: previous.id, code: previous.code, status: previous.status, version: previous.version },
            next: { id: next.id, code: next.code, status: next.status, version: next.version },
            recipient: {
              number: next.recipientNumber,
              name: next.recipientName,
              course: next.recipientCourse,
            },
          },
        });

        try {
          await notifyCertificateIssued(opts.env, next);
        } catch (error) {
          request.log.warn({ err: error, certificateId: next.id }, "automatic reissued certificate WhatsApp notification failed");
        }

        return reply.code(201).send({
          previous: serializeCertificate(opts.env, previous),
          next: serializeCertificate(opts.env, next),
        });
      });
    });
  });
}
