import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, isAdminStudentNumber, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { escapeHtml, formatDateLabel, loadLogoDataUri, loadCertificateTemplateDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
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
      ? await prisma.student.findFirst({
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

export function buildCertificateHtml(params: {
  logoDataUri: string | null;
  templateBackgroundDataUri: string | null;
  type: string;
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
  validationUrl: string;
}) {
  const formattedDate = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(params.issuedAt);

  // Determine correct grammatical article for the organizer in Portuguese (O vs A)
  const organizer = params.organizerName.trim();
  const article = /^(departamento|gabinete|centro|instituto|conselho|reitorado|núcleo)/i.test(organizer) ? "O" : "A";

  // Smart signature logic: if organizer is the Social Sciences and Humanities faculty
  // and the authority is the default Vice-Reitora, show the specific Decana from the photo
  let rightTitle = params.authorityTitle;
  let rightName = params.authorityName;

  if (
    (params.organizerName.includes("Ciências Sociais") || params.title.includes("Psicologia") || params.title.includes("Mulher")) &&
    params.authorityName.includes("Maria de Fátima")
  ) {
    rightTitle = "A Decana";
    rightName = "Prof. Doutora Cristina de Oliveira";
  }

  // Phrasing based on certificate type
  let bodyTextHtml = "";
  const titleHtml = `<span class="highlight">“${escapeHtml(params.title)}”</span>`;
  const courseHtml = params.recipientCourse ? `, do curso de ${escapeHtml(params.recipientCourse)}` : "";
  const numberHtml = params.recipientNumber ? ` (N.º ${escapeHtml(params.recipientNumber)})` : "";

  if (params.type === "COURSE_COMPLETION") {
    bodyTextHtml = `concluiu com aproveitamento a formação de ${titleHtml}${courseHtml}, que decorreu nas instalações da ${escapeHtml(params.institutionName)}${numberHtml}.`;
  } else if (params.type === "PROJECT_EXHIBITION") {
    bodyTextHtml = `participou como expositor com o projeto ${titleHtml}${courseHtml}, no evento ${escapeHtml(params.organizerName)}, realizado nas instalações da ${escapeHtml(params.institutionName)}${numberHtml}.`;
  } else {
    // Default / PARTICIPATION / EVENT_PARTICIPATION
    bodyTextHtml = `participou na atividade ${titleHtml}${courseHtml}, organizada por ${escapeHtml(params.organizerName)}, nas instalações da ${escapeHtml(params.institutionName)}${numberHtml}.`;
  }

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.title)} &middot; ${escapeHtml(params.code)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');

  :root {
    --text-primary: #1A1A1A;
    --text-muted: #555555;
  }

  @page {
    size: A4 landscape;
    margin: 0;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Playfair Display', "Times New Roman", Georgia, serif;
    color: var(--text-primary);
    background-color: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .certificate {
    width: 297mm;
    height: 210mm;
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at center, #FCF8DF 0%, #FAF3D1 100%);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: 0 35mm;
  }

  /* Subtle paper texture overlay */
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

  /* Transparent template background (contains borders, logo, CERTIFICADO word) */
  .certificate-bg {
    position: absolute;
    inset: 0;
    ${params.templateBackgroundDataUri ? `background-image: url(${params.templateBackgroundDataUri});` : ""}
    background-size: 100% 100%;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 1;
  }

  /* Fallback border in case template background fails */
  .fallback-border {
    position: absolute;
    inset: 18px;
    border: 2px solid #a0361a;
    pointer-events: none;
    z-index: 1;
    display: ${params.templateBackgroundDataUri ? "none" : "block"};
  }

  .certificate-content {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* Pushed down below the CERTIFICADO header in the background image */
  .certificate-body {
    margin-top: 66mm;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .cert-intro {
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 7mm;
    max-width: 200mm;
  }

  .recipient-name {
    font-family: 'Outfit', sans-serif;
    font-weight: 800;
    font-size: 34px;
    color: var(--text-primary);
    margin-bottom: 7mm;
    letter-spacing: -0.015em;
    line-height: 1.2;
  }

  .cert-text {
    font-size: 15px;
    line-height: 1.8;
    color: var(--text-primary);
    max-width: 210mm;
    margin-bottom: 8mm;
  }

  .cert-text .highlight {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-style: normal;
    color: #000000;
  }

  .cert-date {
    font-size: 15.5px;
    font-style: italic;
    color: var(--text-muted);
  }

  /* Signatures section */
  .signatures-container {
    position: absolute;
    bottom: 32mm;
    left: 35mm;
    right: 35mm;
    display: flex;
    justify-content: space-between;
    z-index: 2;
  }

  .signature-block {
    width: 65mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .sig-title {
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 12mm; /* Blank space for physical signature */
    line-height: 1.2;
  }

  .sig-line {
    width: 100%;
    border-top: 1.2px solid #8c8c8c;
    margin-bottom: 2mm;
  }

  .sig-name {
    font-family: 'Playfair Display', serif;
    font-size: 12.5px;
    color: var(--text-primary);
    line-height: 1.3;
  }

  /* Footer reference number and validation url */
  .certificate-footer {
    position: absolute;
    bottom: 11mm;
    left: 35mm;
    right: 35mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 2;
    font-family: monospace;
    font-size: 8.5px;
    color: #8c8c8c;
  }

  .footer-validation-url {
    font-size: 8.5px;
    color: #777777;
  }
</style>
</head>
<body>
  <main class="certificate">
    <div class="certificate-bg"></div>
    <div class="fallback-border"></div>
    <div class="certificate-content">
      <div class="certificate-body">
        <p class="cert-intro">
          ${article} ${escapeHtml(params.organizerName)} da ${escapeHtml(params.institutionName)} certifica que,
        </p>
        
        <h2 class="recipient-name">${escapeHtml(params.recipientName)}</h2>
        
        <p class="cert-text">
          ${bodyTextHtml}
        </p>
        
        <p class="cert-date">Luanda, ${escapeHtml(formattedDate)}.</p>
      </div>

      <div class="signatures-container">
        <div class="signature-block">
          <div class="sig-title">O Reitor</div>
          <div class="sig-line"></div>
          <div class="sig-name">Prof. Doutor André Pedro Neto</div>
        </div>
        <div class="signature-block">
          <div class="sig-title">${escapeHtml(rightTitle)}</div>
          <div class="sig-line"></div>
          <div class="sig-name">${escapeHtml(rightName)}</div>
        </div>
      </div>

      <footer class="certificate-footer">
        <span>${escapeHtml(params.code)}</span>
        <span class="footer-validation-url">Validação em: ${escapeHtml(params.validationUrl)}</span>
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
    templateBackgroundDataUri: await loadCertificateTemplateDataUri(),
    type: certificate.type,
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
    validationUrl: buildValidationUrl(env, certificate.validationToken),
  });
  const pdf = await renderPdfFromHtml(html, {
    landscape: true,
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    },
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
        const student = await prisma.student.findFirst({
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
