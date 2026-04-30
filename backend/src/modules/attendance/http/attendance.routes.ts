import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { buildValidationQrUrl, buildValidationUrl, extractValidationToken } from "../../validation/application/validation-links";
import { sendWhatsAppAutomationEvent } from "../../whatsapp/http/whatsapp.routes";

/* eslint-disable @typescript-eslint/no-explicit-any */
// The prisma client types for QrAction/QrActionScan are generated at build time.
// Locally the Prisma client may not include these models yet.
const db = prisma as any;

const DEFAULT_EVENT_KEY = "main-event";
const DEFAULT_EVENT_LABEL = "Evento principal UOR Connect";

const QR_ACTION_TYPES = ["CHECKIN", "COURSE_ENROLL", "EXHIBITOR_VOTE"] as const;
type QrActionType = (typeof QR_ACTION_TYPES)[number];

const credentialSchema = z.object({
  id: z.number(),
  token: z.string(),
  studentNumber: z.string(),
  studentName: z.string().nullable(),
  studentCourse: z.string().nullable(),
  label: z.string(),
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
});

function createToken() {
  return `att_${randomUUID().replace(/-/g, "")}`;
}

function createQrActionToken() {
  return `qra_${randomUUID().replace(/-/g, "")}`;
}

function serializeCredential(env: Env, credential: {
  id: number;
  token: string;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const validationUrl = buildValidationUrl(env, credential.token);
  return {
    id: credential.id,
    token: credential.token,
    studentNumber: credential.studentNumber,
    studentName: credential.studentName,
    studentCourse: credential.studentCourse,
    label: credential.label,
    validationUrl,
    qrImageUrl: buildValidationQrUrl(env, credential.token),
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
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
}, student: { id: number; studentNumber: string; name: string | null; course: string | null; phone: string | null }) {
  // Check expiry
  if (qrAction.expiresAt && new Date() > qrAction.expiresAt) {
    await db.qrActionScan.upsert({
      where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
      create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "EXPIRED", message: "Este QR expirou." },
      update: { result: "EXPIRED", message: "Este QR expirou." },
    });
    return { success: false, result: "EXPIRED", message: "Este código QR já expirou.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  if (!qrAction.active) {
    return { success: false, result: "INACTIVE", message: "Este código QR está desativado.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  // Check max scans
  if (qrAction.maxScans) {
    const totalScans = await db.qrActionScan.count({ where: { qrActionId: qrAction.id, result: "SUCCESS" } });
    if (totalScans >= qrAction.maxScans) {
      return { success: false, result: "MAX_REACHED", message: "Limite de utilizações deste QR atingido.", actionType: qrAction.type, actionLabel: qrAction.label };
    }
  }

  // Check duplicate
  const existingScan = await db.qrActionScan.findUnique({
    where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
  });
  if (existingScan && existingScan.result === "SUCCESS") {
    return { success: false, result: "ALREADY_DONE", message: "Já utilizaste este código QR.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  let message = "";

  // Process by type
  if (qrAction.type === "CHECKIN") {
    const eventKey = qrAction.eventKey || DEFAULT_EVENT_KEY;
    const eventLabel = qrAction.eventLabel || DEFAULT_EVENT_LABEL;
    const credential = await ensureCredentialByStudentNumber(student.studentNumber);

    if (credential) {
      const existingCheckIn = await prisma.attendanceCheckIn.findUnique({
        where: { credentialId_eventKey: { credentialId: credential.id, eventKey } },
      });

      if (existingCheckIn) {
        await db.qrActionScan.upsert({
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
      await db.qrActionScan.upsert({
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
    if (existingLike) {
      await db.qrActionScan.upsert({
        where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
        create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "ALREADY_DONE", message: "Já votaste neste expositor." },
        update: { result: "ALREADY_DONE", message: "Já votaste neste expositor." },
      });
      return { success: false, result: "ALREADY_DONE", message: `Já votaste no projeto "${submission.name}".`, actionType: qrAction.type, actionLabel: qrAction.label };
    }

    await prisma.studentLike.create({
      data: { studentId: student.id, submissionId: submission.id },
    });

    message = `Voto registado para "${submission.name}".`;
  } else {
    return { success: false, result: "ERROR", message: "Tipo de ação desconhecido.", actionType: qrAction.type, actionLabel: qrAction.label };
  }

  // Record successful scan
  await db.qrActionScan.upsert({
    where: { qrActionId_studentId: { qrActionId: qrAction.id, studentId: student.id } },
    create: { qrActionId: qrAction.id, studentId: student.id, studentNumber: student.studentNumber, studentName: student.name, result: "SUCCESS", message },
    update: { result: "SUCCESS", message },
  });

  // Send SMS notification
  try {
    await sendScanSms(env, qrAction, student);
  } catch { /* best-effort */ }

  return { success: true, result: "SUCCESS", message, actionType: qrAction.type, actionLabel: qrAction.label };
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

      const [lastCheckIn, certificatesCount] = await Promise.all([
        prisma.attendanceCheckIn.findFirst({
          where: { credentialId: credential.id },
          orderBy: { checkedInAt: "desc" },
        }),
        prisma.certificate.count({
          where: { studentId: student.id, status: "ISSUED" },
        }),
      ]);

      return {
        credential: serializeCredential(opts.env, credential),
        checkedIn: Boolean(lastCheckIn),
        lastCheckIn: lastCheckIn ? serializeCheckIn(lastCheckIn) : null,
        certificatesCount,
      };
    });

    /* ---- Student: scan a QR action code ---- */
    protectedApp.post("/scan", {
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
      let qrAction = await db.qrAction.findUnique({ where: { token: extracted } });

      // If not found, try stripping prefix or searching by partial match
      if (!qrAction && extracted.startsWith("qra_")) {
        qrAction = await db.qrAction.findUnique({ where: { token: extracted } });
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

      const scans = await db.qrActionScan.findMany({
        where: { studentId: student.id },
        include: { qrAction: { select: { type: true, label: true } } },
        orderBy: { scannedAt: "desc" },
        take: 50,
      });

      return scans.map((scan: any) => ({
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
        };

        // Validate target exists
        let targetMeta: string | null = null;
        if (body.type === "COURSE_ENROLL" && body.targetId) {
          const courseTarget = await prisma.course.findUnique({ where: { id: body.targetId }, select: { id: true, name: true, companyName: true } });
          if (!courseTarget) return reply.code(400).send({ message: "Curso não encontrado." });
          targetMeta = JSON.stringify({ title: courseTarget.name, company: courseTarget.companyName });
        } else if (body.type === "EXHIBITOR_VOTE" && body.targetId) {
          const submission = await prisma.submission.findUnique({ where: { id: body.targetId }, select: { id: true, name: true, type: true } });
          if (!submission) return reply.code(400).send({ message: "Expositor/projeto não encontrado." });
          targetMeta = JSON.stringify({ name: submission.name, type: submission.type });
        }

        const token = createQrActionToken();
        const qrAction = await db.qrAction.create({
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
          db.qrAction.count({ where }),
          db.qrAction.findMany({
            where,
            include: { _count: { select: { scans: true } } },
            orderBy: [{ createdAt: "desc" }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
        ]);

        return {
          items: items.map((item: any) => ({
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
        const action = await db.qrAction.findUnique({
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
            scansCount: action._count.scans,
            qrImageUrl: buildValidationQrUrl(opts.env, action.token),
            createdAt: action.createdAt.toISOString(),
          },
          scans: action.scans.map((scan: any) => ({
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
          }),
          response: {
            200: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const body = request.body as Record<string, unknown>;

        const existing = await db.qrAction.findUnique({ where: { id } });
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

        await db.qrAction.update({ where: { id }, data });

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
        const existing = await db.qrAction.findUnique({ where: { id } });
        if (!existing) return reply.code(404).send({ message: "QR não encontrado." });

        await db.qrAction.delete({ where: { id } });

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
          db.qrAction.count(),
          db.qrAction.count({ where: { active: true } }),
          db.qrActionScan.count({ where: { result: "SUCCESS" } }),
          db.qrActionScan.count({ where: { result: "SUCCESS", scannedAt: { gte: dayStart } } }),
        ]);

        const typeStats = await Promise.all(
          QR_ACTION_TYPES.map(async (type) => {
            const [count, scans] = await Promise.all([
              db.qrAction.count({ where: { type } }),
              db.qrActionScan.count({ where: { qrAction: { type }, result: "SUCCESS" } }),
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
