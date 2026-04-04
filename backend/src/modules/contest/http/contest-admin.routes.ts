import { type FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";
import { StudentRepository } from "../../auth/infra/student.repository";
import {
  AuthorizeAdminStudentUseCase,
  ListAdminSecurityOverviewUseCase,
  RevokeAdminStudentUseCase,
} from "../../auth/use-cases/manage-admin-security";
import { normalizeStudentProfile } from "../../auth/domain/student-format";

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
  updatedAt: z.coerce.date(),
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
const listAdminSecurityOverviewUseCase = new ListAdminSecurityOverviewUseCase(studentRepository);
const authorizeAdminStudentUseCase = new AuthorizeAdminStudentUseCase(studentRepository);
const revokeAdminStudentUseCase = new RevokeAdminStudentUseCase(studentRepository);

export async function contestAdminRoutes(app: FastifyInstance, opts: { env?: Env } = {}) {
  const env = opts.env ?? (app as any).config?.env ?? ({ JWT_SECRET: "dev-secret-change-me" } as Env);

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env });
    adminApp.register(adminGuard, { env });

    adminApp.get(
      "/security",
      {
        schema: {
          description: "Visão geral da segurança do laboratório",
          tags: ["Contest Admin"],
          response: {
            200: securityOverviewSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
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
          description: "Autoriza um estudante para aceder ao painel do laboratório",
          tags: ["Contest Admin"],
          body: securityStudentNumberSchema,
          response: {
            201: adminAuthorizedStudentSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const result = await authorizeAdminStudentUseCase.execute(request.body.studentNumber);

        if (!result.success) {
          return reply.status(400).send({ message: result.error });
        }

        return reply.status(201).send(result.authorizedStudent);
      }
    );

    adminApp.delete<{ Params: z.infer<typeof securityStudentNumberSchema> }>(
      "/security/authorized-students/:studentNumber",
      {
        schema: {
          description: "Remove a autorização de acesso ao painel do laboratório",
          tags: ["Contest Admin"],
          params: securityStudentNumberSchema,
          response: {
            200: z.object({ success: z.literal(true) }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const result = await revokeAdminStudentUseCase.execute(request.params.studentNumber);

        if (!result.success) {
          return reply.status(400).send({ message: result.error });
        }

        return reply.send({ success: true as const });
      }
    );
  });
}
