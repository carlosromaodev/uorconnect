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

  return `<!DOCTYPE html>
    <html lang="pt">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(params.title)} · ${escapeHtml(params.code)}</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Segoe UI", Arial, sans-serif;
            color: #102132;
            background: #f4f6f8;
          }
          .certificate {
            min-height: calc(210mm - 28mm);
            border: 1px solid #d8e0e8;
            border-radius: 14px;
            background: #fff;
            padding: 18mm;
            position: relative;
          }
          .certificate::before {
            content: "";
            position: absolute;
            inset: 8mm;
            border: 2px solid #fd8305;
            border-radius: 10px;
            pointer-events: none;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 18mm;
            align-items: flex-start;
            position: relative;
            z-index: 1;
          }
          .brand img {
            width: 46mm;
            height: auto;
            display: block;
          }
          .meta {
            text-align: right;
            font-size: 10px;
            line-height: 1.7;
            color: #61707f;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }
          .content {
            position: relative;
            z-index: 1;
            max-width: 210mm;
            margin: 16mm auto 0;
            text-align: center;
          }
          .kicker {
            margin: 0;
            color: #fd8305;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.22em;
            text-transform: uppercase;
          }
          h1 {
            margin: 7mm 0 0;
            font-size: 34px;
            line-height: 1.1;
            color: #14212f;
          }
          .body-copy {
            margin: 10mm auto 0;
            max-width: 175mm;
            color: #4b5b6c;
            font-size: 15px;
            line-height: 1.8;
          }
          .recipient {
            margin: 8mm 0 0;
            font-size: 30px;
            font-weight: 800;
            color: #14212f;
          }
          .details {
            margin-top: 6mm;
            color: #61707f;
            font-size: 12px;
            line-height: 1.8;
          }
          .footer {
            position: absolute;
            z-index: 1;
            left: 18mm;
            right: 18mm;
            bottom: 16mm;
            display: flex;
            align-items: end;
            justify-content: space-between;
            gap: 14mm;
          }
          .code {
            font-family: "Courier New", monospace;
            font-size: 12px;
            color: #14212f;
          }
          .qr {
            width: 30mm;
            border: 1px solid #d8e0e8;
            border-radius: 8px;
            padding: 2mm;
          }
          .validation {
            max-width: 140mm;
            color: #61707f;
            font-size: 10px;
            line-height: 1.6;
            word-break: break-word;
          }
        </style>
      </head>
      <body>
        <main class="certificate">
          <header class="header">
            <div class="brand">${logoMarkup}</div>
            <div class="meta">
              <div>Emitido em ${escapeHtml(formatDateLabel(params.issuedAt))}</div>
              <div>${escapeHtml(params.code)}</div>
            </div>
          </header>

          <section class="content">
            <p class="kicker">Universidade Óscar Ribas · UOR Connect</p>
            <h1>${escapeHtml(params.title)}</h1>
            <p class="body-copy">Certificamos, para os devidos efeitos, que o(a) estudante abaixo identificado(a) participou nas atividades registadas pelo sistema UOR Connect.</p>
            <div class="recipient">${escapeHtml(params.recipientName)}</div>
            <div class="details">
              ${params.recipientNumber ? `Número: ${escapeHtml(params.recipientNumber)}<br />` : ""}
              ${params.recipientCourse ? `Curso: ${escapeHtml(params.recipientCourse)}` : ""}
            </div>
          </section>

          <footer class="footer">
            <div>
              <div class="code">${escapeHtml(params.code)}</div>
              <div class="validation">${escapeHtml(params.validationUrl)}</div>
            </div>
            <img class="qr" src="${params.qrImageUrl}" alt="QR de validação" />
          </footer>
        </main>
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
