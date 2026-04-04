import { randomUUID } from "node:crypto";
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { type Env } from "../../../config/env";
import { StudentRepository } from "../../auth/infra/student.repository";
import { LoginUseCase } from "../../auth/use-cases/login";
import { authGuard } from "../../auth/http/auth.middleware";
import { signStudentToken } from "../../auth/utils/jwt";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import {
  appendCookie,
  getCookie,
  resolveSharedCookieDomain,
  serializeCookie,
  shouldUseSecureCookies,
} from "../../../shared/cookies";
import { PrismaSubmissionRepository } from "../../submission/infra/prisma/prisma.submission.repository";

const AUTH_COOKIE = "uor_auth";
const CSRF_COOKIE = "uor_csrf";
const SESSION_HINT_COOKIE = "uor_session_hint";
const DEVICE_COOKIE = "uor_device";
const LAST_CONNECTION_COOKIE = "uor_last_connection";
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;
const DEVICE_MAX_AGE = 60 * 60 * 24 * 180;

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

const loginSchema = z.object({
  studentNumber: z.string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "Student number must have exactly 8 digits"),
  password: z.string().min(1, "Password is required"),
  origin: z.literal("laboratorio").optional(),
});

const studentRepository = new StudentRepository(prisma);
const submissionRepository = new PrismaSubmissionRepository();
const loginUseCase = new LoginUseCase(studentRepository);

export async function contestAuthRoutes(app: FastifyInstance, opts: { env?: Env } = {}) {
  const env = opts.env ?? (app as any).config?.env ?? ({ JWT_SECRET: "dev-secret-change-me" } as Env);
  const secureCookies = shouldUseSecureCookies(env);
  const sharedCookieDomain = resolveSharedCookieDomain(env) ?? undefined;

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

  app.post<{ Body: z.infer<typeof loginSchema> }>(
    "/auth/login",
    {
      schema: {
        description: "Login do laboratorio com credenciais da secretaria",
        tags: ["Contest Auth"],
        body: loginSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            studentNumber: z.string(),
            student: studentResponseSchema,
            token: z.string()
          }),
          400: z.object({ message: z.string() }).or(z.object({ success: z.literal(false), error: z.string() })),
          401: z.object({ success: z.literal(false), error: z.string() }),
          500: z.object({ success: z.literal(false), error: z.string() })
        }
      }
    },
    async (request, reply) => {
      try {
        const result = await loginUseCase.execute({
          studentNumber: request.body.studentNumber,
          password: request.body.password,
        });

        if (!result.success || !result.student) {
          return reply.status(401).send({
            success: false,
            error: result.error || "Número de estudante ou palavra-passe inválidos."
          });
        }

        const normalizedStudent = normalizeStudentProfile(result.student);
        const token = signStudentToken(normalizedStudent.id, result.studentNumber ?? request.body.studentNumber, env);

        await studentRepository.recordLoginAudit(normalizedStudent, "laboratorio");
        await submissionRepository.assignOwnershipByPhone(
          normalizedStudent.id,
          normalizedStudent.studentNumber,
          normalizedStudent.phone,
        );

        appendAuthCookies(reply, token, request);

        return reply.status(200).send({
          success: true,
          studentNumber: result.studentNumber ?? request.body.studentNumber,
          student: normalizedStudent,
          token,
        });
      } catch (err) {
        request.log.error({ err }, "contest login failed unexpectedly");
        return reply.status(500).send({
          success: false,
          error: "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes."
        });
      }
    }
  );

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env });

    protectedApp.get(
      "/me",
      {
        schema: {
          description: "Obtém o perfil autenticado do estudante atual no laboratório",
          tags: ["Contest Auth"],
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
  });
}
