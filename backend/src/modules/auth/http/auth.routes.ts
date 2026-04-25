import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { LoginUseCase, isInvalidCredentialsErrorMessage } from "../use-cases/login";
import { StudentRepository } from "../infra/student.repository";
import { signJuryToken, signStudentToken } from "../utils/jwt";
import { type Env } from "../../../config/env";
import {
  normalizeAngolaPhone,
  normalizeCourse,
  normalizeStudentName,
  normalizeStudentProfile,
} from "../domain/student-format";
import { DeleteStudentUseCase, ListStudentsWithStatsUseCase } from "../use-cases/manage-students";
import {
  AuthorizeAdminStudentUseCase,
  ListAdminSecurityOverviewUseCase,
  RevokeAdminStudentUseCase,
} from "../use-cases/manage-admin-security";
import { authGuard } from "./auth.middleware";
import { adminGuard } from "./admin.middleware";
import {
  appendCookie,
  clearCookie,
  getCookie,
  resolveSharedCookieDomain,
  serializeCookie,
  shouldUseSecureCookies,
} from "../../../shared/cookies";
import { PrismaSubmissionRepository } from "../../submission/infra/prisma/prisma.submission.repository";
import { type StudentLoginOrigin } from "../domain/student";
import { recordAdminAudit } from "../../audit/application/audit.service";

const AUTH_COOKIE = "uor_auth";
const CSRF_COOKIE = "uor_csrf";
const SESSION_HINT_COOKIE = "uor_session_hint";
const DEVICE_COOKIE = "uor_device";
const LAST_CONNECTION_COOKIE = "uor_last_connection";
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;
const DEVICE_MAX_AGE = 60 * 60 * 24 * 180;

const loginSchema = z.object({
  studentNumber: z.string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "Student number must have exactly 8 digits"),
  password: z.string().min(1, "Password is required"),
  origin: z.enum(["uorconnect", "laboratorio"]).optional(),
});

const authErrorSchema = z.object({
  success: z.literal(false),
  error: z.string()
});

const fastifyErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  error: z.string().optional()
});

const studentResponseSchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  course: z.string().nullable(),
  birthDate: z.coerce.date().nullable(),
  nationality: z.string().nullable(),
  phone: z.string().nullable(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const adminAuthorizedStudentSchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const securityOverviewSchema = z.object({
  authorizedStudents: z.array(adminAuthorizedStudentSchema),
  recentLogins: z.array(studentResponseSchema),
});

const securityStudentNumberSchema = z.object({
  studentNumber: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 8, "Student number must have exactly 8 digits"),
});

const studentsPagedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50),
  search: z.string().trim().max(120).optional(),
  course: z.string().trim().max(120).optional(),
  sort: z.enum([
    "created_desc",
    "created_asc",
    "name_asc",
    "name_desc",
    "number_asc",
    "number_desc",
    "course_asc",
    "course_desc",
    "interactions_desc",
  ]).default("created_desc"),
});

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  course: z.string().trim().min(2).max(120).optional(),
  phone: z.union([z.string().trim().min(8).max(20), z.literal("")]).optional(),
});

const juryMemberResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  isActive: z.boolean(),
  lastCodeSentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const juryMemberCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
});

const juryMemberIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const jurySendCodeSchema = z.object({
  expiresInMinutes: z.coerce.number().int().min(3).max(60).optional(),
});

const juryLoginSchema = z.object({
  phone: z.string().trim().min(8).max(30),
  code: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 6, "Código deve ter exatamente 6 dígitos"),
});

const studentRepository = new StudentRepository(prisma);
const submissionRepository = new PrismaSubmissionRepository();
let envCache: Env;
const loginUseCase = new LoginUseCase(studentRepository);
const listStudentsWithStatsUseCase = new ListStudentsWithStatsUseCase(studentRepository);
const deleteStudentUseCase = new DeleteStudentUseCase(studentRepository);
const listAdminSecurityOverviewUseCase = new ListAdminSecurityOverviewUseCase(studentRepository);
const authorizeAdminStudentUseCase = new AuthorizeAdminStudentUseCase(studentRepository);
const revokeAdminStudentUseCase = new RevokeAdminStudentUseCase(studentRepository);

function normalizeLoginOrigin(origin?: string | null): StudentLoginOrigin {
  return origin === "laboratorio" ? "laboratorio" : "uorconnect";
}

function normalizePhoneForOmbala(value?: string | null): { phone: string; providerTo: string } | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00244") && digits.length >= 14) {
    const local = digits.slice(5, 14);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.startsWith("244") && digits.length >= 12) {
    const local = digits.slice(3, 12);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    const local = digits.slice(1);
    return local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return { phone: `+244${digits}`, providerTo: digits };
  }

  if (digits.length === 8) {
    const local = `9${digits}`;
    return { phone: `+244${local}`, providerTo: local };
  }

  return null;
}

function normalizeSender(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringifyProviderPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const direct = pickString(record.message_id)
    ?? pickString(record.messageId)
    ?? pickString(record.id)
    ?? pickString(record.uuid);

  if (direct) return direct;

  const nestedData = record.data;
  if (nestedData && typeof nestedData === "object") {
    return extractProviderMessageId(nestedData);
  }

  return null;
}

class OmbalaClient {
  constructor(private readonly env: Env) {}

  private get baseUrl() {
    return this.env.OMBALA_API_BASE_URL.replace(/\/$/, "");
  }

  private get token() {
    return this.env.OMBALA_API_TOKEN?.trim();
  }

  get isConfigured() {
    return Boolean(this.token);
  }

  async sendMessage(payload: { message: string; from: string; to: string }) {
    if (!this.token) {
      return {
        ok: false,
        status: 0,
        payload: { message: "OMBALA_API_TOKEN não configurado." },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: payload.message,
          from: payload.from,
          to: payload.to,
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

      return {
        ok: response.ok,
        status: response.status,
        payload: providerPayload,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          message: error instanceof Error ? error.message : "Falha ao comunicar com o provedor SMS.",
        },
      };
    }
  }
}

function generateJuryAccessCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashJuryAccessCode(juryMemberId: number, code: string, env: Env) {
  return createHash("sha256")
    .update(`${env.JWT_SECRET}:${juryMemberId}:${code}`)
    .digest("hex");
}

export async function authRoutes(app: FastifyInstance, opts: { env?: Env } = {}) {
  envCache = opts.env ?? (app as any).config?.env ?? { JWT_SECRET: "dev-secret-change-me" } as Env;
  const ombala = new OmbalaClient(envCache);
  const secureCookies = shouldUseSecureCookies(envCache);
  const sharedCookieDomain = resolveSharedCookieDomain(envCache) ?? undefined;

  function appendAuthCookies(reply: FastifyReply, token: string, request: FastifyRequest) {
    const csrfToken = randomUUID();
    const deviceId = getCookie(request, DEVICE_COOKIE) ?? randomUUID();
    const nowIso = new Date().toISOString();

    appendCookie(reply, serializeCookie(AUTH_COOKIE, token, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(CSRF_COOKIE, csrfToken, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      domain: sharedCookieDomain,
      httpOnly: false,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(SESSION_HINT_COOKIE, "1", {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      domain: sharedCookieDomain,
      httpOnly: false,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(DEVICE_COOKIE, deviceId, {
      path: "/",
      maxAge: DEVICE_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(LAST_CONNECTION_COOKIE, nowIso, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    }));
  }

  function clearAuthCookies(reply: FastifyReply) {
    clearCookie(reply, AUTH_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, CSRF_COOKIE, {
      path: "/",
      domain: sharedCookieDomain,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, SESSION_HINT_COOKIE, {
      path: "/",
      domain: sharedCookieDomain,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, DEVICE_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, LAST_CONNECTION_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    });
  }

  app.post<{ Body: z.infer<typeof loginSchema> }>(
    "/login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60_000,
        }
      },
      schema: {
        description: "Login com credenciais da secretaria",
        tags: ["Auth"],
        body: loginSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            studentNumber: z.string(),
            student: studentResponseSchema,
            token: z.string()
          }),
          400: z.union([authErrorSchema, fastifyErrorSchema]),
          401: authErrorSchema,
          500: z.union([authErrorSchema, fastifyErrorSchema])
        }
      }
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof loginSchema> }>, reply: FastifyReply) => {
      try {
        const result = await loginUseCase.execute({
          studentNumber: request.body.studentNumber,
          password: request.body.password
        });

        if (result.success) {
          const token = signStudentToken(result.student!.id, result.studentNumber ?? request.body.studentNumber, envCache);
          const normalizedStudent = normalizeStudentProfile(result.student!);
          await studentRepository.recordLoginAudit(normalizedStudent, normalizeLoginOrigin(request.body.origin));
          await submissionRepository.assignOwnershipByPhone(
            normalizedStudent.id,
            normalizedStudent.studentNumber,
            normalizedStudent.phone,
          );
          appendAuthCookies(reply, token, request);
          return reply.status(200).send({
            ...result,
            student: normalizedStudent,
            token
          });
        }
        const errorMessage = result.error || "Número de estudante ou palavra-passe inválidos.";
        const statusCode = isInvalidCredentialsErrorMessage(errorMessage) ? 401 : 500;
        return reply.status(statusCode).send({
          success: false,
          error: errorMessage
        });
      } catch (err) {
        request.log.error({ err }, "login failed unexpectedly");
        return reply.status(500).send({
          success: false,
          error: "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes."
        });
      }
    }
  );

  app.post<{ Body: z.infer<typeof juryLoginSchema> }>(
    "/jury/login",
    {
      config: {
        rateLimit: {
          max: 12,
          timeWindow: 60_000,
        },
      },
      schema: {
        description: "Login de júri com código único enviado por SMS",
        tags: ["Auth"],
        body: juryLoginSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            token: z.string(),
            juryMember: juryMemberResponseSchema,
          }),
          400: z.object({ message: z.string() }),
          401: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const normalizedPhone = normalizePhoneForOmbala(request.body.phone)?.phone;
      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Número de telefone inválido." });
      }

      const juryMember = await prisma.juryMember.findFirst({
        where: {
          phone: normalizedPhone,
          isActive: true,
        },
      });

      if (!juryMember) {
        return reply.code(401).send({
          success: false,
          error: "Código inválido ou expirado.",
        });
      }

      const now = new Date();
      const activeCode = await prisma.juryAccessCode.findFirst({
        where: {
          juryMemberId: juryMember.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { sentAt: "desc" },
      });

      if (!activeCode) {
        return reply.code(401).send({
          success: false,
          error: "Código inválido ou expirado.",
        });
      }

      const incomingHash = hashJuryAccessCode(juryMember.id, request.body.code, envCache);
      if (incomingHash !== activeCode.codeHash) {
        return reply.code(401).send({
          success: false,
          error: "Código inválido ou expirado.",
        });
      }

      await prisma.juryAccessCode.update({
        where: { id: activeCode.id },
        data: { usedAt: now },
      });

      const token = signJuryToken(juryMember.id, juryMember.phone, envCache);
      appendAuthCookies(reply, token, request);

      return reply.code(200).send({
        success: true,
        token,
        juryMember,
      });
    },
  );

  app.post("/logout", {
    schema: {
      response: {
        200: z.object({ success: z.literal(true) })
      }
    }
  }, async (_, reply) => {
    clearAuthCookies(reply);
    return reply.send({ success: true });
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: envCache });

    protectedApp.get(
      "/me",
      {
        schema: {
          description: "Obtém o perfil autenticado do estudante atual",
          tags: ["Auth"],
          response: {
            200: studentResponseSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;

        if (!studentId) {
          if (request.jury) {
            return reply.code(403).send({ message: "Sessão de júri não possui perfil de estudante." });
          }
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const student = await studentRepository.findByIdWithStats(studentId);

        if (!student) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const normalizedStudent = normalizeStudentProfile(student);
        await submissionRepository.assignOwnershipByPhone(
          normalizedStudent.id,
          normalizedStudent.studentNumber,
          normalizedStudent.phone,
        );

        return reply.send(normalizedStudent);
      }
    );

    protectedApp.patch(
      "/me",
      {
        schema: {
          description: "Atualiza campos editáveis do perfil autenticado do estudante atual",
          tags: ["Auth"],
          body: profileUpdateSchema,
          response: {
            200: studentResponseSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;
        if (!studentId) {
          if (request.jury) {
            return reply.code(403).send({ message: "Sessão de júri não possui perfil de estudante." });
          }
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const existing = await studentRepository.findByIdWithStats(studentId);
        if (!existing) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const body = request.body as z.infer<typeof profileUpdateSchema>;
        if (Object.keys(body).length === 0) {
          return reply.code(400).send({ message: "Nenhum campo para atualizar foi enviado." });
        }

        const updated = await studentRepository.updateProfile(studentId, {
          name: body.name !== undefined ? normalizeStudentName(body.name) : undefined,
          email: body.email !== undefined ? (body.email.trim() || undefined) : undefined,
          course: body.course !== undefined ? normalizeCourse(body.course) : undefined,
          phone: body.phone !== undefined ? normalizeAngolaPhone(body.phone) : undefined,
        });

        if (!updated) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const normalizedStudent = normalizeStudentProfile(updated);
        await submissionRepository.assignOwnershipByPhone(
          normalizedStudent.id,
          normalizedStudent.studentNumber,
          normalizedStudent.phone,
        );

        return reply.send(normalizedStudent);
      }
    );
  });

  app.get<{ Params: { studentNumber: string } }>(
    "/students/:studentNumber",
    {
      schema: {
        description: "Obtém dados do estudante pelo número",
        tags: ["Students"],
        params: z.object({
          studentNumber: z.string().trim()
        }),
        response: {
          200: studentResponseSchema,
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const studentNumber = request.params.studentNumber.replace(/\\D/g, "");
      const student = await studentRepository.findByStudentNumber(studentNumber);
      if (!student) {
        return reply.code(404).send({ message: "Student not found" });
      }
      const normalizedStudent = normalizeStudentProfile(student);
      return reply.send(normalizedStudent);
    }
  );

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: envCache });
    adminApp.register(adminGuard);

    adminApp.get(
      "/students/paged",
      {
        schema: {
          description: "Lista paginada de estudantes com estatísticas",
          tags: ["Students"],
          querystring: studentsPagedQuerySchema,
          response: {
            200: z.object({
              items: z.array(
                studentResponseSchema.extend({
                  _count: z.object({
                    likes: z.number(),
                    votes: z.number(),
                    comments: z.number()
                  })
                })
              ),
              total: z.number(),
              page: z.number(),
              totalPages: z.number(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() })
          }
        }
      },
      async (request, reply) => {
        const query = studentsPagedQuerySchema.parse(request.query);
        const payload = await studentRepository.listAllWithStatsPaged(query);
        return reply.send({
          ...payload,
          items: payload.items.map((student) => normalizeStudentProfile(student)),
        });
      }
    );

    adminApp.get(
      "/students",
      {
        schema: {
          description: "Lista todos os estudantes",
          tags: ["Students"],
          response: {
            200: z.array(
              studentResponseSchema.extend({
                _count: z.object({
                  likes: z.number(),
                  votes: z.number(),
                  comments: z.number()
                })
              })
            ),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() })
          }
        }
      },
      async (_, reply) => {
        const students = await listStudentsWithStatsUseCase.execute();
        return reply.send(
          students.map((student) => normalizeStudentProfile(student))
        );
      }
    );

    adminApp.get(
      "/security",
      {
        schema: {
          description: "Visão geral da segurança administrativa",
          tags: ["Students"],
          response: {
            200: securityOverviewSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          }
        }
      },
      async (_, reply) => {
        const overview = await listAdminSecurityOverviewUseCase.execute();
        return reply.send({
          authorizedStudents: overview.authorizedStudents,
          recentLogins: overview.recentLogins.map((student) => normalizeStudentProfile(student)),
        });
      }
    );

    adminApp.post<{ Body: z.infer<typeof securityStudentNumberSchema> }>(
      "/security/authorized-students",
      {
        schema: {
          description: "Autoriza um número de estudante a abrir a área administrativa",
          tags: ["Students"],
          body: securityStudentNumberSchema,
          response: {
            201: adminAuthorizedStudentSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const result = await authorizeAdminStudentUseCase.execute(request.body.studentNumber);
        if (!result.success) {
          return reply.code(400).send({ message: result.error });
        }

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "security.authorize_admin",
          entityType: "AdminAuthorizedStudent",
          entityId: result.authorizedStudent?.studentNumber,
          summary: `Acesso administrativo autorizado para ${result.authorizedStudent?.studentNumber}.`,
        });

        return reply.code(201).send(result.authorizedStudent);
      }
    );

    adminApp.delete<{ Params: z.infer<typeof securityStudentNumberSchema> }>(
      "/security/authorized-students/:studentNumber",
      {
        schema: {
          description: "Revoga o acesso administrativo por número de estudante",
          tags: ["Students"],
          params: securityStudentNumberSchema,
          response: {
            200: z.object({ success: z.literal(true) }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const result = await revokeAdminStudentUseCase.execute(request.params.studentNumber);
        if (result.success) {
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "security.revoke_admin",
            entityType: "AdminAuthorizedStudent",
            entityId: request.params.studentNumber,
            summary: `Acesso administrativo revogado para ${request.params.studentNumber}.`,
          });
          return reply.send({ success: true });
        }

        if (result.error === "Authorized student not found") {
          return reply.code(404).send({ message: result.error });
        }

        return reply.code(400).send({ message: result.error ?? "Unable to revoke student access" });
      }
    );

    adminApp.get(
      "/security/jury-members",
      {
        schema: {
          description: "Lista os números autorizados para login do júri",
          tags: ["Students"],
          response: {
            200: z.object({
              juryMembers: z.array(juryMemberResponseSchema),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (_, reply) => {
        const juryMembers = await prisma.juryMember.findMany({
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        });
        return reply.send({ juryMembers });
      },
    );

    adminApp.post<{ Body: z.infer<typeof juryMemberCreateSchema> }>(
      "/security/jury-members",
      {
        schema: {
          description: "Regista um novo número para acesso de júri",
          tags: ["Students"],
          body: juryMemberCreateSchema,
          response: {
            201: juryMemberResponseSchema,
            400: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const normalizedPhone = normalizePhoneForOmbala(request.body.phone)?.phone;
        if (!normalizedPhone) {
          return reply.code(400).send({ message: "Número de telefone inválido para SMS." });
        }

        try {
          const juryMember = await prisma.juryMember.create({
            data: {
              name: request.body.name.trim(),
              phone: normalizedPhone,
              isActive: true,
            },
          });

          return reply.code(201).send(juryMember);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return reply.code(409).send({ message: "Este número já está registado como júri." });
          }
          throw error;
        }
      },
    );

    adminApp.delete<{ Params: z.infer<typeof juryMemberIdSchema> }>(
      "/security/jury-members/:id",
      {
        schema: {
          description: "Remove um número de júri",
          tags: ["Students"],
          params: juryMemberIdSchema,
          response: {
            200: z.object({ success: z.literal(true) }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const existing = await prisma.juryMember.findUnique({
          where: { id: request.params.id },
          select: { id: true },
        });

        if (!existing) {
          return reply.code(404).send({ message: "Júri não encontrado." });
        }

        await prisma.juryMember.delete({ where: { id: request.params.id } });
        return reply.send({ success: true });
      },
    );

    adminApp.post<{ Params: z.infer<typeof juryMemberIdSchema>; Body: z.infer<typeof jurySendCodeSchema> }>(
      "/security/jury-members/:id/send-code",
      {
        schema: {
          description: "Gera e envia um código único de acesso para um júri por SMS",
          tags: ["Students"],
          params: juryMemberIdSchema,
          body: jurySendCodeSchema,
          response: {
            200: z.object({
              success: z.literal(true),
              juryMemberId: z.number(),
              phone: z.string(),
              codeLast4: z.string(),
              expiresAt: z.string(),
              deliveryStatus: z.string(),
            }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            502: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        if (!ombala.isConfigured) {
          return reply.code(400).send({ message: "Integração SMS não configurada. Define OMBALA_API_TOKEN no backend." });
        }

        const juryMember = await prisma.juryMember.findUnique({
          where: { id: request.params.id },
        });

        if (!juryMember || !juryMember.isActive) {
          return reply.code(404).send({ message: "Júri não encontrado ou inativo." });
        }

        const normalizedPhone = normalizePhoneForOmbala(juryMember.phone);
        if (!normalizedPhone) {
          return reply.code(400).send({ message: "Telefone do júri inválido para envio SMS." });
        }

        const sender = normalizeSender(envCache.OMBALA_SMS_DEFAULT_SENDER ?? "");
        if (!sender || !/^[A-Z0-9 _-]{3,16}$/.test(sender)) {
          return reply.code(400).send({
            message: "Remetente SMS inválido. Ajusta OMBALA_SMS_DEFAULT_SENDER para 3-16 caracteres válidos.",
          });
        }

        const expiresInMinutes = request.body.expiresInMinutes ?? 15;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiresInMinutes * 60_000);
        const code = generateJuryAccessCode();
        const codeHash = hashJuryAccessCode(juryMember.id, code, envCache);
        const codeLast4 = code.slice(-4);

        await prisma.juryAccessCode.updateMany({
          where: {
            juryMemberId: juryMember.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            usedAt: now,
            deliveryStatus: "REVOKED",
            errorMessage: "Código substituído por um novo envio administrativo.",
          },
        });

        const smsMessage = `UOR Connect: codigo do juri ${code}. Valido por ${expiresInMinutes} minutos. Nao partilhe este codigo.`;
        const providerResponse = await ombala.sendMessage({
          from: sender,
          message: smsMessage,
          to: normalizedPhone.providerTo,
        });

        const providerError = pickString((providerResponse.payload as Record<string, unknown>)?.message)
          ?? `Falha no provedor (status ${providerResponse.status || "desconhecido"}).`;

        const createdCode = await prisma.juryAccessCode.create({
          data: {
            juryMemberId: juryMember.id,
            codeHash,
            codeLast4,
            expiresAt,
            usedAt: providerResponse.ok ? null : now,
            sentAt: now,
            createdByStudentNumber: request.student?.studentNumber ?? "unknown",
            providerMessageId: extractProviderMessageId(providerResponse.payload),
            providerResponseJson: stringifyProviderPayload(providerResponse.payload),
            deliveryStatus: providerResponse.ok ? "SENT" : "FAILED",
            errorMessage: providerResponse.ok ? null : providerError,
          },
        });

        if (!providerResponse.ok) {
          return reply.code(502).send({
            message: `Não foi possível enviar o código por SMS. ${providerError}`,
          });
        }

        await prisma.juryMember.update({
          where: { id: juryMember.id },
          data: { lastCodeSentAt: now },
        });

        return reply.send({
          success: true,
          juryMemberId: juryMember.id,
          phone: juryMember.phone,
          codeLast4: createdCode.codeLast4,
          expiresAt: createdCode.expiresAt.toISOString(),
          deliveryStatus: createdCode.deliveryStatus,
        });
      },
    );

    adminApp.delete<{ Params: { id: string } }>(
      "/students/:id",
      {
        schema: {
          description: "Remove estudante e respetivas interações",
          tags: ["Students"],
          params: z.object({
            id: z.string().trim()
          }),
          response: {
            200: z.object({ success: z.literal(true) }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request, reply) => {
        const result = await deleteStudentUseCase.execute(Number(request.params.id));
        if (result.success) {
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "student.delete",
            entityType: "Student",
            entityId: request.params.id,
            summary: `Estudante ${request.params.id} removido pelo administrador.`,
          });
          return reply.send({ success: true });
        }

        if (result.error === "Student not found") {
          return reply.code(404).send({ message: result.error });
        }

        return reply.code(400).send({ message: result.error ?? "Unable to delete student" });
      }
    );
  });
}
