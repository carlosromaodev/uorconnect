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

const DEFAULT_EVENT_KEY = "main-event";
const DEFAULT_EVENT_LABEL = "Evento principal UOR Connect";

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

function createToken() {
  return `att_${randomUUID().replace(/-/g, "")}`;
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

export async function attendanceRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

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

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);

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

        const credential = token
          ? await prisma.attendanceCredential.findUnique({ where: { token } })
          : body.studentNumber
            ? await ensureCredentialByStudentNumber(body.studentNumber.replace(/\D/g, "").trim())
            : null;

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

        return {
          checkIn: serializeCheckIn(checkIn),
          credential: serializeCredential(opts.env, credential),
          alreadyCheckedIn: false,
        };
      });
    });
  });
}
