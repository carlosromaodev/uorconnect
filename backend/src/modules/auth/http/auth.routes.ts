import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { LoginUseCase } from "../use-cases/login";
import { StudentRepository } from "../infra/student.repository";
import { signStudentToken } from "../utils/jwt";
import { type Env } from "../../../config/env";
import { normalizeStudentProfile } from "../domain/student-format";
import { DeleteStudentUseCase, ListStudentsWithStatsUseCase } from "../use-cases/manage-students";
import {
  AuthorizeAdminStudentUseCase,
  ListAdminSecurityOverviewUseCase,
  RevokeAdminStudentUseCase,
} from "../use-cases/manage-admin-security";
import { authGuard } from "./auth.middleware";
import { adminGuard } from "./admin.middleware";

const loginSchema = z.object({
  studentNumber: z.string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, "Student number must have exactly 8 digits"),
  password: z.string().min(1, "Password is required")
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

const studentRepository = new StudentRepository(prisma);
let envCache: Env;
const loginUseCase = new LoginUseCase(studentRepository);
const listStudentsWithStatsUseCase = new ListStudentsWithStatsUseCase(studentRepository);
const deleteStudentUseCase = new DeleteStudentUseCase(studentRepository);
const listAdminSecurityOverviewUseCase = new ListAdminSecurityOverviewUseCase(studentRepository);
const authorizeAdminStudentUseCase = new AuthorizeAdminStudentUseCase(studentRepository);
const revokeAdminStudentUseCase = new RevokeAdminStudentUseCase(studentRepository);

export async function authRoutes(app: FastifyInstance, opts: { env?: Env } = {}) {
  envCache = opts.env ?? (app as any).config?.env ?? { JWT_SECRET: "dev-secret-change-me" } as Env;

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
          400: z.object({
            success: z.literal(false),
            error: z.string()
          }),
          401: z.object({
            success: z.literal(false),
            error: z.string()
          }),
          500: z.object({
            success: z.literal(false),
            error: z.string()
          })
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
          return reply.status(200).send({
            ...result,
            student: normalizeStudentProfile(result.student!),
            token
          });
        }
        return reply.status(401).send({
          success: false,
          error: result.error || "Invalid credentials"
        });
      } catch (err) {
        request.log.error({ err }, "login failed unexpectedly");
        return reply.status(500).send({
          success: false,
          error: "Internal error while validating login"
        });
      }
    }
  );

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
