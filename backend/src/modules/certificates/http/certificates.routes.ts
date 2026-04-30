import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, isAdminStudentNumber } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { renderQrDataUri } from "../../../shared/qr";
import { buildValidationQrUrl, buildValidationUrl } from "../../validation/application/validation-links";
import { sendWhatsAppAutomationEvent } from "../../whatsapp/http/whatsapp.routes";

const certificateIssueBodySchema = z.object({
  studentNumber: z.string().trim().min(4).max(40),
  type: z.string().trim().min(2).max(80).default("PARTICIPATION"),
  title: z.string().trim().min(4).max(160).default("Certificado de Participação"),
  sourceType: z.string().trim().min(2).max(80).optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const certificateIssueAttendeesBodySchema = z.object({
  type: z.string().trim().min(2).max(80).default("EVENT_PARTICIPATION"),
  title: z.string().trim().min(4).max(160).default("Certificado de Participação"),
  eventKey: z.string().trim().min(2).max(80).default("main-event"),
});

const certificateIssueBulkBodySchema = z.object({
  mode: z.enum(["STUDENT_LIST", "STUDENT_COURSE", "COURSE_ENROLLMENT", "PROJECT"]),
  type: z.string().trim().min(2).max(80).default("PARTICIPATION"),
  title: z.string().trim().min(4).max(160).default("Certificado de Participação"),
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
  validationUrl: z.string(),
  qrImageUrl: z.string(),
  pdfPath: z.string(),
});

function randomToken(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function createCertificateCode(type: string) {
  const compactType = type.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "CERT";
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  return `UOR-${new Date().getFullYear()}-${compactType}-${suffix}`;
}

type CertificateRecipient = {
  studentId: number | null;
  studentNumber: string | null;
  name: string;
  course: string | null;
  sourceType: string;
  sourceId: number | null;
  metadata?: Record<string, unknown>;
};

async function createCertificateForRecipient(input: {
  recipient: CertificateRecipient;
  type: string;
  title: string;
  actor: string;
}) {
  const existing = await prisma.certificate.findFirst({
    where: {
      type: input.type,
      sourceType: input.recipient.sourceType,
      ...(input.recipient.sourceId ? { sourceId: input.recipient.sourceId } : {}),
      ...(input.recipient.studentNumber ? { recipientNumber: input.recipient.studentNumber } : {}),
    },
  });

  if (existing) return { certificate: existing, skipped: true };

  const certificate = await prisma.certificate.create({
    data: {
      code: createCertificateCode(input.type),
      validationToken: randomToken("cert"),
      type: input.type,
      title: input.title,
      recipientName: input.recipient.name,
      recipientNumber: input.recipient.studentNumber,
      recipientCourse: input.recipient.course,
      studentId: input.recipient.studentId,
      sourceType: input.recipient.sourceType,
      sourceId: input.recipient.sourceId,
      issuedByStudentNumber: input.actor,
      metadataJson: input.recipient.metadata ? JSON.stringify(input.recipient.metadata) : null,
    },
  });

  return { certificate, skipped: false };
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
  validationUrl: string;
  qrImageUrl: string;
}) {
  const logoMarkup = params.logoDataUri
    ? `<img src="${params.logoDataUri}" alt="UOR Connect" />`
    : `<strong>UOR Connect</strong>`;

  const formattedDate = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(params.issuedAt);

  return `<!DOCTYPE html>
    <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(params.title)} · ${escapeHtml(params.code)}</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page {
            width: 297mm;
            height: 210mm;
            position: relative;
            overflow: hidden;
            background: #ffffff;
          }

          /* Gold accent bar at top */
          .accent-bar {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 5mm;
            background: linear-gradient(90deg, #b8860b 0%, #daa520 35%, #ffd700 50%, #daa520 65%, #b8860b 100%);
          }

          /* Subtle background pattern */
          .bg-pattern {
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 15% 25%, rgba(218,165,32,0.06), transparent 40%),
              radial-gradient(circle at 85% 75%, rgba(10,61,98,0.04), transparent 40%);
            pointer-events: none;
          }

          /* Decorative border frame */
          .frame-outer {
            position: absolute;
            inset: 8mm;
            border: 1.5px solid #daa520;
            pointer-events: none;
          }
          .frame-inner {
            position: absolute;
            inset: 11mm;
            border: 0.5px solid rgba(218,165,32,0.35);
            pointer-events: none;
          }

          /* Corner ornaments */
          .ornament {
            position: absolute;
            width: 18mm;
            height: 18mm;
            pointer-events: none;
          }
          .ornament::before, .ornament::after {
            content: "";
            position: absolute;
            background: #daa520;
          }
          .ornament-tl { top: 8mm; left: 8mm; }
          .ornament-tl::before { top: 0; left: 0; width: 18mm; height: 1.5px; }
          .ornament-tl::after { top: 0; left: 0; width: 1.5px; height: 18mm; }
          .ornament-tr { top: 8mm; right: 8mm; }
          .ornament-tr::before { top: 0; right: 0; width: 18mm; height: 1.5px; }
          .ornament-tr::after { top: 0; right: 0; width: 1.5px; height: 18mm; }
          .ornament-bl { bottom: 8mm; left: 8mm; }
          .ornament-bl::before { bottom: 0; left: 0; width: 18mm; height: 1.5px; }
          .ornament-bl::after { bottom: 0; left: 0; width: 1.5px; height: 18mm; }
          .ornament-br { bottom: 8mm; right: 8mm; }
          .ornament-br::before { bottom: 0; right: 0; width: 18mm; height: 1.5px; }
          .ornament-br::after { bottom: 0; right: 0; width: 1.5px; height: 18mm; }

          /* Watermark */
          .watermark {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) rotate(-12deg);
            font-size: 78px;
            font-weight: 900;
            letter-spacing: 0.08em;
            color: rgba(218,165,32,0.04);
            text-transform: uppercase;
            white-space: nowrap;
            pointer-events: none;
          }

          /* Content layout */
          .certificate-body {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16mm 22mm 14mm;
            height: 210mm;
          }

          /* Header */
          .header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .brand img {
            width: 40mm;
            height: auto;
            display: block;
          }
          .brand strong {
            color: #0a3d62;
            font-size: 20px;
            font-weight: 800;
          }
          .doc-type {
            text-align: right;
          }
          .doc-type-label {
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: #daa520;
          }
          .doc-type-code {
            margin-top: 2mm;
            font-family: "Courier New", monospace;
            font-size: 9px;
            font-weight: 700;
            color: #64748b;
            letter-spacing: 0.04em;
          }

          /* Divider */
          .gold-divider {
            width: 60mm;
            height: 0.5px;
            background: linear-gradient(90deg, transparent, #daa520, transparent);
            margin: 7mm auto 0;
          }

          /* Main content */
          .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            max-width: 220mm;
            margin-top: -2mm;
          }

          .institution {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: #0a3d62;
          }

          .cert-title {
            margin-top: 5mm;
            font-size: 28px;
            font-weight: 800;
            line-height: 1.15;
            color: #0f172a;
            letter-spacing: -0.01em;
          }

          .body-text {
            margin-top: 5mm;
            max-width: 185mm;
            font-size: 11.5px;
            line-height: 1.75;
            color: #475569;
          }

          .awarded-to {
            margin-top: 7mm;
            font-size: 8.5px;
            font-weight: 700;
            letter-spacing: 0.25em;
            text-transform: uppercase;
            color: #94a3b8;
          }

          .recipient-name {
            margin-top: 2mm;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 32px;
            font-weight: 700;
            color: #0f172a;
            padding: 0 12mm 2.5mm;
            border-bottom: 2px solid #daa520;
            display: inline-block;
          }

          .recipient-details {
            margin-top: 4mm;
            display: flex;
            justify-content: center;
            gap: 4mm;
            flex-wrap: wrap;
          }
          .detail-chip {
            display: inline-flex;
            align-items: center;
            gap: 2mm;
            padding: 1.5mm 4mm;
            border: 1px solid rgba(218,165,32,0.25);
            border-radius: 3mm;
            background: rgba(218,165,32,0.05);
            font-size: 9px;
            color: #475569;
          }
          .detail-chip strong {
            font-weight: 700;
            color: #0a3d62;
          }

          /* Footer area */
          .footer-area {
            width: 100%;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 8mm;
            margin-top: auto;
          }

          /* Signatures */
          .signatures {
            display: flex;
            gap: 12mm;
          }
          .sig-block {
            width: 50mm;
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #334155;
            margin-bottom: 2mm;
          }
          .sig-name {
            font-size: 9px;
            font-weight: 600;
            color: #334155;
          }
          .sig-role {
            font-size: 7.5px;
            color: #94a3b8;
            letter-spacing: 0.06em;
            margin-top: 0.5mm;
          }

          /* Date */
          .issue-date {
            text-align: center;
            flex: 1;
          }
          .issue-date-label {
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #94a3b8;
          }
          .issue-date-value {
            margin-top: 1mm;
            font-size: 10px;
            color: #334155;
            font-weight: 600;
          }

          /* Verification block */
          .verification {
            display: flex;
            align-items: flex-end;
            gap: 3mm;
          }
          .qr-box {
            width: 24mm;
            height: 24mm;
            border: 1px solid #e2e8f0;
            border-radius: 2.5mm;
            padding: 1.5mm;
            background: #ffffff;
            flex-shrink: 0;
          }
          .qr-box img {
            width: 100%;
            height: 100%;
            display: block;
          }
          .verify-info {
            max-width: 60mm;
          }
          .verify-label {
            font-size: 7px;
            font-weight: 700;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #daa520;
          }
          .verify-code {
            margin-top: 1mm;
            font-family: "Courier New", monospace;
            font-size: 9.5px;
            font-weight: 700;
            color: #0f172a;
          }
          .verify-url {
            margin-top: 1mm;
            font-size: 7px;
            color: #94a3b8;
            word-break: break-all;
            line-height: 1.3;
          }

          /* Seal */
          .seal {
            position: absolute;
            z-index: 3;
            right: 32mm;
            top: 50%;
            transform: translateY(-50%);
            width: 32mm;
            height: 32mm;
            border-radius: 50%;
            border: 2px solid rgba(218,165,32,0.5);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: rgba(255,255,255,0.85);
            box-shadow: 0 0 0 1mm rgba(218,165,32,0.12);
          }
          .seal-icon {
            font-size: 16px;
            line-height: 1;
            margin-bottom: 1mm;
          }
          .seal-text {
            font-size: 6px;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #b8860b;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="accent-bar"></div>
          <div class="bg-pattern"></div>
          <div class="frame-outer"></div>
          <div class="frame-inner"></div>
          <div class="ornament ornament-tl"></div>
          <div class="ornament ornament-tr"></div>
          <div class="ornament ornament-bl"></div>
          <div class="ornament ornament-br"></div>
          <div class="watermark">UOR Connect</div>

          <div class="seal">
            <div class="seal-icon">&#9733;</div>
            <div class="seal-text">Validação<br/>Digital<br/>UOR Connect</div>
          </div>

          <div class="certificate-body">
            <header class="header">
              <div class="brand">${logoMarkup}</div>
              <div class="doc-type">
                <div class="doc-type-label">Certificado Oficial</div>
                <div class="doc-type-code">${escapeHtml(params.code)}</div>
              </div>
            </header>

            <div class="gold-divider"></div>

            <section class="main-content">
              <p class="institution">Universidade Óscar Ribas &middot; UOR Connect</p>
              <h1 class="cert-title">${escapeHtml(params.title)}</h1>
              <p class="body-text">
                Certificamos, para os devidos efeitos, que o(a) estudante abaixo identificado(a) participou
                nas atividades registadas pelo sistema UOR Connect, demonstrando presença, compromisso
                e contribuição no percurso académico e profissional promovido pela plataforma.
              </p>
              <p class="awarded-to">Concedido a</p>
              <div class="recipient-name">${escapeHtml(params.recipientName)}</div>
              <div class="recipient-details">
                ${params.recipientNumber ? `<span class="detail-chip"><strong>N.º</strong> ${escapeHtml(params.recipientNumber)}</span>` : ""}
                ${params.recipientCourse ? `<span class="detail-chip"><strong>Curso</strong> ${escapeHtml(params.recipientCourse)}</span>` : ""}
              </div>
            </section>

            <footer class="footer-area">
              <div class="signatures">
                <div class="sig-block">
                  <div class="sig-line"></div>
                  <div class="sig-name">Coordenação UOR Connect</div>
                  <div class="sig-role">Plataforma Académica</div>
                </div>
                <div class="sig-block">
                  <div class="sig-line"></div>
                  <div class="sig-name">Direção Académica</div>
                  <div class="sig-role">Universidade Óscar Ribas</div>
                </div>
              </div>

              <div class="issue-date">
                <div class="issue-date-label">Emitido em</div>
                <div class="issue-date-value">${escapeHtml(formattedDate)}</div>
              </div>

              <div class="verification">
                <div class="verify-info">
                  <div class="verify-label">Verificação Digital</div>
                  <div class="verify-code">${escapeHtml(params.code)}</div>
                  <div class="verify-url">${escapeHtml(params.validationUrl)}</div>
                </div>
                <div class="qr-box">
                  <img src="${params.qrImageUrl}" alt="QR de validação" />
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>`;
}

async function sendCertificatePdf(reply: FastifyReply, env: Env, certificate: {
  code: string;
  validationToken: string;
  title: string;
  recipientName: string;
  recipientNumber: string | null;
  recipientCourse: string | null;
  issuedAt: Date;
} | null) {
  if (!certificate) {
    return reply.code(404).send({ message: "Certificate not found" });
  }

  const validationUrl = buildValidationUrl(env, certificate.validationToken);
  const qrImageUrl = await renderQrDataUri(validationUrl, 280);
  const html = buildCertificateHtml({
    logoDataUri: await loadLogoDataUri(),
    title: certificate.title,
    recipientName: certificate.recipientName,
    recipientNumber: certificate.recipientNumber,
    recipientCourse: certificate.recipientCourse,
    code: certificate.code,
    issuedAt: certificate.issuedAt,
    validationUrl,
    qrImageUrl,
  });
  const pdf = await renderPdfFromHtml(html, {
    landscape: true,
    footerLabel: certificate.code,
    preferCssPageSize: true,
  });

  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", `inline; filename="${certificate.code.toLowerCase()}.pdf"`);
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

      adminApp.post("/admin/issue", {
        schema: {
          body: certificateIssueBodySchema,
          response: {
            201: certificateSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = certificateIssueBodySchema.parse(request.body);
        const actor = request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : "unknown");
        const student = await prisma.student.findUnique({
          where: { studentNumber: body.studentNumber.replace(/\D/g, "").trim() },
        });

        if (!student) return reply.code(404).send({ message: "Student not found" });

        const normalized = normalizeStudentProfile(student);
        const certificate = await prisma.certificate.create({
          data: {
            code: createCertificateCode(body.type),
            validationToken: randomToken("cert"),
            type: body.type,
            title: body.title,
            recipientName: normalized.name ?? `Estudante ${normalized.studentNumber}`,
            recipientNumber: normalized.studentNumber,
            recipientCourse: normalized.course ?? null,
            studentId: normalized.id,
            sourceType: body.sourceType ?? null,
            sourceId: body.sourceId ?? null,
            issuedByStudentNumber: actor,
            metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
          },
        });

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.issue",
          entityType: "Certificate",
          entityId: certificate.id,
          summary: `Certificado emitido para ${certificate.recipientName}.`,
          metadata: { code: certificate.code, type: certificate.type },
        });

        try {
          await notifyCertificateIssued(opts.env, certificate);
        } catch (error) {
          request.log.warn({ err: error, certificateId: certificate.id }, "automatic certificate WhatsApp notification failed");
        }

        return reply.code(201).send(serializeCertificate(opts.env, certificate));
      });

      adminApp.post("/admin/issue-attendees", {
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
        const checkIns = await prisma.attendanceCheckIn.findMany({
          where: { eventKey: body.eventKey },
          orderBy: [{ checkedInAt: "asc" }, { id: "asc" }],
        });
        const certificates = [];
        let skipped = 0;

        for (const checkIn of checkIns) {
          const existing = await prisma.certificate.findFirst({
            where: {
              type: body.type,
              sourceType: "ATTENDANCE",
              sourceId: checkIn.id,
            },
          });

          if (existing) {
            skipped += 1;
            continue;
          }

          const certificate = await prisma.certificate.create({
            data: {
              code: createCertificateCode(body.type),
              validationToken: randomToken("cert"),
              type: body.type,
              title: body.title,
              recipientName: checkIn.studentName ?? `Estudante ${checkIn.studentNumber}`,
              recipientNumber: checkIn.studentNumber,
              recipientCourse: checkIn.studentCourse,
              studentId: checkIn.studentId,
              sourceType: "ATTENDANCE",
              sourceId: checkIn.id,
              issuedByStudentNumber: actor,
              metadataJson: JSON.stringify({
                eventKey: checkIn.eventKey,
                eventLabel: checkIn.eventLabel,
                checkedInAt: checkIn.checkedInAt.toISOString(),
              }),
            },
          });
          certificates.push(certificate);
        }

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.issue_attendees",
          entityType: "Certificate",
          summary: `${certificates.length} certificado(s) emitido(s) para presenças.`,
          metadata: { eventKey: body.eventKey, issued: certificates.length, skipped },
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
            where: { courseId: course.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          });

          if (!enrollments.length) {
            return reply.code(404).send({ message: "Este curso ainda não tem inscritos." });
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
            include: { student: true },
          });

          if (!submission) return reply.code(404).send({ message: "Projeto não encontrado." });

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
        }

        const certificates = [];
        let skipped = 0;

        for (const recipient of recipients) {
          const result = await createCertificateForRecipient({
            recipient,
            type: body.type,
            title: body.title,
            actor,
          });

          if (result.skipped) {
            skipped += 1;
            continue;
          }

          certificates.push(result.certificate);
        }

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.issue_bulk",
          entityType: "Certificate",
          summary: `${certificates.length} certificado(s) emitido(s) em lote.`,
          metadata: { mode: body.mode, issued: certificates.length, skipped },
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
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: certificateSchema,
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

        const updated = await prisma.certificate.update({
          where: { id: certificate.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
          },
        });

        await recordAdminAudit({
          actorStudentNumber: actor,
          action: "certificate.revoke",
          entityType: "Certificate",
          entityId: updated.id,
          summary: `Certificado ${updated.code} revogado.`,
          metadata: { code: updated.code },
        });

        return serializeCertificate(opts.env, updated);
      });
    });
  });
}
