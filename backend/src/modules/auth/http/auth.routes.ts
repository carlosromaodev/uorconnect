import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { LoginUseCase } from "../use-cases/login";
import { StudentRepository } from "../infra/student.repository";
import { signStudentToken } from "../utils/jwt";
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

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  course: z.string().trim().min(2).max(120).optional(),
  phone: z.union([z.string().trim().min(8).max(20), z.literal("")]).optional(),
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

export async function authRoutes(app: FastifyInstance, opts: { env?: Env } = {}) {
  envCache = opts.env ?? (app as any).config?.env ?? { JWT_SECRET: "dev-secret-change-me" } as Env;
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
        return reply.status(401).send({
          success: false,
          error: result.error || "Número de estudante ou palavra-passe inválidos."
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
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;

        if (!studentId) {
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
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;
        if (!studentId) {
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
          return reply.send({ success: true });
        }

        if (result.error === "Authorized student not found") {
          return reply.code(404).send({ message: result.error });
        }

        return reply.code(400).send({ message: result.error ?? "Unable to revoke student access" });
      }
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
