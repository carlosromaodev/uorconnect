import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { recordAdminAudit } from "../../audit/application/audit.service";
import {
  getOdinOverview,
  recordOdinStudentExclusion,
} from "../application/odin.service";

const odinOverviewQuerySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(24 * 14).optional().default(48),
});

const odinExcludeParamsSchema = z.object({
  studentId: z.coerce.number().int().positive(),
});

const odinExcludeBodySchema = z.object({
  reason: z.string().trim().min(8).max(500),
  deleteProfile: z.boolean().optional().default(true),
  removeVotes: z.boolean().optional().default(true),
  removeLikes: z.boolean().optional().default(true),
  removeComments: z.boolean().optional().default(true),
  removePassport: z.boolean().optional().default(false),
});

const odinRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

const odinProjectLiteSchema = z.object({
  submissionId: z.number(),
  submissionName: z.string(),
  votes: z.number(),
  students: z.number().optional(),
});

const odinOverviewResponseSchema = z.object({
  generatedAt: z.string(),
  stats: z.object({
    totalEvents: z.number(),
    deviceCount: z.number(),
    suspiciousDevices: z.number(),
    suspectStudents: z.number(),
    suspectVotes: z.number(),
    multiAccountDevices: z.number(),
    projectPressureCount: z.number(),
  }),
  devices: z.array(z.object({
    deviceId: z.string(),
    riskScore: z.number(),
    riskLevel: odinRiskLevelSchema,
    reasons: z.array(z.string()),
    loginCount: z.number(),
    voteCount: z.number(),
    eventCount: z.number(),
    distinctStudents: z.number(),
    distinctProjectsVoted: z.number(),
    lastSeenAt: z.string(),
    lastIp: z.string().nullable(),
    lastUserAgent: z.string().nullable(),
    students: z.array(z.object({
      studentId: z.number().nullable(),
      studentNumber: z.string(),
      studentName: z.string().nullable(),
      studentCourse: z.string().nullable(),
      eventCount: z.number(),
      voteCount: z.number(),
      lastSeenAt: z.string(),
    })),
    projects: z.array(odinProjectLiteSchema),
  })),
  students: z.array(z.object({
    studentId: z.number().nullable(),
    studentNumber: z.string(),
    studentName: z.string().nullable(),
    studentCourse: z.string().nullable(),
    riskScore: z.number(),
    riskLevel: odinRiskLevelSchema,
    reasons: z.array(z.string()),
    devices: z.array(z.string()),
    voteCount: z.number(),
    loginCount: z.number(),
    lastSeenAt: z.string(),
    projectsVoted: z.array(odinProjectLiteSchema.omit({ students: true })),
  })),
  projects: z.array(z.object({
    submissionId: z.number(),
    submissionName: z.string(),
    suspiciousVotes: z.number(),
    suspiciousDevices: z.number(),
    suspiciousStudents: z.number(),
  })),
  suggestions: z.array(z.string()),
});

const odinExcludeResponseSchema = z.object({
  success: z.literal(true),
  studentId: z.number(),
  studentNumber: z.string(),
  deletedProfile: z.boolean(),
  removed: z.object({
    studentVotes: z.number(),
    studentLikes: z.number(),
    studentComments: z.number(),
    qrActionScans: z.number(),
    passportScans: z.number(),
    passportChallengeAnswers: z.number(),
    passportBadges: z.number(),
    passportSurpriseEffectsRevoked: z.number(),
    passportPointLedgerRevoked: z.number(),
    exhibitorScoreEventsRevoked: z.number(),
  }),
});

export async function odinRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["SECURITY"]);

    adminApp.get("/odin/overview",
      {
        schema: {
          description: "Visão ODIN para análise anti-bot e multi-conta.",
          tags: ["Security"],
          querystring: odinOverviewQuerySchema,
          response: {
            200: odinOverviewResponseSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (request: FastifyRequest<{ Querystring: z.infer<typeof odinOverviewQuerySchema> }>, reply) => {
        const query = odinOverviewQuerySchema.parse(request.query);
        return reply.send(await getOdinOverview(query.windowHours));
      },
    );

    adminApp.post("/odin/students/:studentId/exclude",
      {
        schema: {
          description: "Exclui um estudante suspeito e remove ações escolhidas pelo administrador.",
          tags: ["Security"],
          params: odinExcludeParamsSchema,
          body: odinExcludeBodySchema,
          response: {
            200: odinExcludeResponseSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (
        request: FastifyRequest<{
          Params: z.infer<typeof odinExcludeParamsSchema>;
          Body: z.infer<typeof odinExcludeBodySchema>;
        }>,
        reply,
      ) => {
        const params = odinExcludeParamsSchema.parse(request.params);
        const body = odinExcludeBodySchema.parse(request.body);
        const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? "unknown";

        try {
          const result = await recordOdinStudentExclusion({
            studentId: params.studentId,
            actorStudentNumber,
            reason: body.reason,
            deleteProfile: body.deleteProfile,
            removeVotes: body.removeVotes,
            removeLikes: body.removeLikes,
            removeComments: body.removeComments,
            removePassport: body.removePassport,
          });

          await recordAdminAudit({
            actorStudentNumber,
            actorRole: request.jury ? "jury_admin" : "admin",
            action: "odin.student_exclusion",
            entityType: "Student",
            entityId: String(params.studentId),
            summary: `ODIN excluiu estudante ${result.studentNumber} e limpou ações selecionadas.`,
            metadata: {
              reason: body.reason,
              options: body,
              removed: result.removed,
            },
          });

          return reply.send(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível executar a ação ODIN.";
          if (/não encontrado/i.test(message)) return reply.status(404).send({ message });
          return reply.status(400).send({ message });
        }
      },
    );
  });
}
