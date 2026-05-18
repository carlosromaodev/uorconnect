import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { recordAdminAudit } from "../../audit/application/audit.service";
import {
  enqueuePdfJob,
  getPdfJob,
  getPdfJobResult,
  pdfJobInputHash,
  registerPdfJobHandler,
} from "../../../shared/pdf-job-queue";
import {
  getOdinOverview,
  recordOdinStudentExclusion,
} from "../application/odin.service";
import {
  listOdinAiAnalyses,
  recordOdinAiFeedback,
  runOdinAiCaseAnalysis,
} from "../application/odin-ai.service";
import {
  buildOdinSecurityReportSnapshot,
  generateOdinSecurityReportPdf,
  ODIN_SECURITY_REPORT_KIND,
} from "./odin-report-pdf";

const odinOverviewQuerySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(24 * 14).optional().default(48),
});

const odinReportPdfJobBodySchema = z.object({
  windowHours: z.coerce.number().int().min(1).max(24 * 14).optional().default(48),
});

const odinReportPdfJobParamsSchema = z.object({
  id: z.string().trim().min(8).max(120),
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
const odinAiCaseTypeSchema = z.enum(["DEVICE", "STUDENT", "PROJECT"]);
const odinAiActionTypeSchema = z.enum([
  "MONITOR",
  "REVIEW",
  "INVALIDATE_VOTES",
  "NOTIFY_FOR_APPEAL",
  "ESCALATE_TO_ORGANIZATION",
]);

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

const odinAiAnalysisSchema = z.object({
  id: z.number(),
  caseType: odinAiCaseTypeSchema,
  caseId: z.string(),
  riskScore: z.number(),
  riskLevel: odinRiskLevelSchema,
  ruleRiskScore: z.number(),
  unifiedRiskScore: z.number(),
  consistencyCheck: z.string(),
  consistencyReason: z.string(),
  operationalState: z.string(),
  narrative: z.string(),
  fraudProbability: z.number(),
  legitimateProbability: z.number(),
  mostLikelyScenario: z.string(),
  alternativeScenario: z.string(),
  recommendation: z.string(),
  confidenceLevel: z.string(),
  actionType: odinAiActionTypeSchema,
  patternType: z.string().nullable(),
  evidenceSummary: z.string().nullable(),
  commentAnalysis: z.string().nullable(),
  alternativePlausibility: z.string().nullable(),
  recommendedAction: z.string().nullable(),
  actionUrgency: z.string().nullable(),
  votesToReview: z.number().nullable(),
  accountsToReview: z.number().nullable(),
  notifyExpositor: z.boolean().nullable(),
  cannotBeFalsePositiveIf: z.string().nullable(),
  modelVersion: z.string(),
  promptVersion: z.string(),
  tokensUsed: z.number().nullable(),
  createdByStudentNumber: z.string().nullable(),
  createdAt: z.string(),
  feedbackCount: z.number(),
});

const odinAiAnalyzeBodySchema = z.object({
  caseType: odinAiCaseTypeSchema,
  caseId: z.string().trim().min(1).max(160),
  windowHours: z.coerce.number().int().min(1).max(24 * 14).optional().default(48),
});

const odinAiAnalysesQuerySchema = z.object({
  caseType: odinAiCaseTypeSchema.optional(),
  caseId: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

const odinAiFeedbackParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const odinAiFeedbackBodySchema = z.object({
  useful: z.boolean(),
  recommendationCorrect: z.boolean().nullable().optional(),
  realityMatched: z.boolean().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export async function odinRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["SECURITY"]);

    registerPdfJobHandler(ODIN_SECURITY_REPORT_KIND, async (job) => {
      const windowHours = typeof job.snapshot?.windowHours === "number"
        ? job.snapshot.windowHours
        : 48;
      const result = await generateOdinSecurityReportPdf(opts.env, { windowHours });
      return {
        buffer: result.pdfBuffer,
        fileName: result.fileName,
        contentType: "application/pdf",
      };
    });

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

    adminApp.post("/odin/report/pdf-jobs",
      {
        schema: {
          description: "Cria um job para gerar o relatório PDF de segurança ODIN.",
          tags: ["Security"],
          body: odinReportPdfJobBodySchema,
          response: {
            202: z.object({
              id: z.string(),
              kind: z.string(),
              status: z.string(),
              error: z.string().nullable().optional(),
              createdAt: z.string(),
              updatedAt: z.string(),
              expiresAt: z.string().nullable().optional(),
              hasFile: z.boolean().optional(),
              fileName: z.string().optional(),
              sizeBytes: z.number().nullable().optional(),
              statusPath: z.string(),
              filePath: z.string(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (
        request: FastifyRequest<{ Body: z.infer<typeof odinReportPdfJobBodySchema> }>,
        reply,
      ) => {
        const body = odinReportPdfJobBodySchema.parse(request.body ?? {});
        const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
        const snapshot = await buildOdinSecurityReportSnapshot(body.windowHours);
        const version = pdfJobInputHash(snapshot);
        const generatedDay = new Date().toISOString().slice(0, 10);
        const job = await enqueuePdfJob(opts.env, {
          kind: ODIN_SECURITY_REPORT_KIND,
          businessKey: `${ODIN_SECURITY_REPORT_KIND}:${version}`,
          fileName: `uor-connect-relatorio-seguranca-odin-${generatedDay}.pdf`,
          snapshot,
          createdByStudentNumber: actorStudentNumber,
          execute: async () => {
            const result = await generateOdinSecurityReportPdf(opts.env, {
              windowHours: body.windowHours,
            });
            return {
              buffer: result.pdfBuffer,
              fileName: result.fileName,
              contentType: "application/pdf",
            };
          },
        });

        await recordAdminAudit({
          actorStudentNumber: actorStudentNumber ?? "unknown",
          actorRole: request.jury ? "jury_admin" : "admin",
          action: "odin.security_report_pdf_job",
          entityType: "PdfDocumentJob",
          entityId: job.id,
          summary: `Relatório de segurança ODIN solicitado para ${body.windowHours}h.`,
          metadata: {
            windowHours: body.windowHours,
            jobId: job.id,
            kind: ODIN_SECURITY_REPORT_KIND,
          },
        });

        return reply.code(202).send({
          ...job,
          statusPath: `/security/odin/report/pdf-jobs/${job.id}`,
          filePath: `/security/odin/report/pdf-jobs/${job.id}/file`,
        });
      },
    );

    adminApp.get("/odin/report/pdf-jobs/:id",
      {
        schema: {
          description: "Consulta o estado do relatório PDF de segurança ODIN.",
          tags: ["Security"],
          params: odinReportPdfJobParamsSchema,
          response: {
            200: z.object({
              id: z.string(),
              kind: z.string(),
              status: z.string(),
              error: z.string().nullable().optional(),
              createdAt: z.string(),
              updatedAt: z.string(),
              expiresAt: z.string().nullable().optional(),
              hasFile: z.boolean().optional(),
              fileName: z.string().optional(),
              sizeBytes: z.number().nullable().optional(),
              statusPath: z.string(),
              filePath: z.string(),
            }),
            404: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (
        request: FastifyRequest<{ Params: z.infer<typeof odinReportPdfJobParamsSchema> }>,
        reply,
      ) => {
        const params = odinReportPdfJobParamsSchema.parse(request.params);
        const job = await getPdfJob(opts.env, params.id);
        if (!job) return reply.code(404).send({ message: "Job de PDF ODIN não encontrado." });

        return reply.send({
          ...job,
          statusPath: `/security/odin/report/pdf-jobs/${job.id}`,
          filePath: `/security/odin/report/pdf-jobs/${job.id}/file`,
        });
      },
    );

    adminApp.get("/odin/report/pdf-jobs/:id/file",
      {
        schema: {
          description: "Baixa o ficheiro do relatório PDF de segurança ODIN.",
          tags: ["Security"],
          params: odinReportPdfJobParamsSchema,
          response: {
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (
        request: FastifyRequest<{ Params: z.infer<typeof odinReportPdfJobParamsSchema> }>,
        reply,
      ) => {
        const params = odinReportPdfJobParamsSchema.parse(request.params);
        const job = await getPdfJob(opts.env, params.id);
        if (!job) return reply.code(404).send({ message: "Job de PDF ODIN não encontrado." });
        if (job.status !== "completed") {
          return reply.code(409).send({ message: "O relatório ODIN ainda não está pronto." });
        }

        const result = await getPdfJobResult(opts.env, params.id);
        if (!result) {
          return reply.code(404).send({ message: "Ficheiro do relatório ODIN não encontrado." });
        }

        reply.header("Content-Type", result.contentType ?? "application/pdf");
        reply.header("Content-Disposition", `attachment; filename=\"${result.fileName}\"`);
        return reply.send(result.buffer);
      },
    );

    adminApp.post("/odin/ai/analyze",
      {
        schema: {
          description: "Gera uma análise ODIN 2.0 assistida por Gemini para um caso suspeito.",
          tags: ["Security"],
          body: odinAiAnalyzeBodySchema,
          response: {
            200: odinAiAnalysisSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            503: z.object({ message: z.string() }),
          },
        },
      },
      async (
        request: FastifyRequest<{ Body: z.infer<typeof odinAiAnalyzeBodySchema> }>,
        reply,
      ) => {
        const body = odinAiAnalyzeBodySchema.parse(request.body);
        const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? "unknown";

        try {
          const analysis = await runOdinAiCaseAnalysis(opts.env, {
            caseType: body.caseType,
            caseId: body.caseId,
            windowHours: body.windowHours,
            actorStudentNumber,
          });

          await recordAdminAudit({
            actorStudentNumber,
            actorRole: request.jury ? "jury_admin" : "admin",
            action: "odin.ai_analysis",
            entityType: "OdinAiAnalysis",
            entityId: String(analysis.id),
            summary: `ODIN 2.0 analisou ${body.caseType}:${body.caseId}.`,
            metadata: {
              caseType: body.caseType,
              caseId: body.caseId,
              riskScore: analysis.riskScore,
              fraudProbability: analysis.fraudProbability,
              actionType: analysis.actionType,
            },
          });

          return reply.send(analysis);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível gerar a análise ODIN 2.0.";
          if (/Gemini|ODIN AI|configurad|quota|modelo/i.test(message)) {
            return reply.status(503).send({ message });
          }
          return reply.status(400).send({ message });
        }
      },
    );

    adminApp.get("/odin/ai/analyses",
      {
        schema: {
          description: "Lista análises ODIN 2.0 já guardadas para auditoria.",
          tags: ["Security"],
          querystring: odinAiAnalysesQuerySchema,
          response: {
            200: z.array(odinAiAnalysisSchema),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (request: FastifyRequest<{ Querystring: z.infer<typeof odinAiAnalysesQuerySchema> }>, reply) => {
        const query = odinAiAnalysesQuerySchema.parse(request.query);
        return reply.send(await listOdinAiAnalyses(query));
      },
    );

    adminApp.post("/odin/ai/analyses/:id/feedback",
      {
        schema: {
          description: "Regista feedback humano sobre uma análise ODIN 2.0.",
          tags: ["Security"],
          params: odinAiFeedbackParamsSchema,
          body: odinAiFeedbackBodySchema,
          response: {
            200: z.object({ success: z.literal(true), message: z.string() }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (
        request: FastifyRequest<{
          Params: z.infer<typeof odinAiFeedbackParamsSchema>;
          Body: z.infer<typeof odinAiFeedbackBodySchema>;
        }>,
        reply,
      ) => {
        const params = odinAiFeedbackParamsSchema.parse(request.params);
        const body = odinAiFeedbackBodySchema.parse(request.body);
        const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? "unknown";

        try {
          await recordOdinAiFeedback({
            analysisId: params.id,
            actorStudentNumber,
            useful: body.useful,
            recommendationCorrect: body.recommendationCorrect,
            realityMatched: body.realityMatched,
            note: body.note,
          });

          await recordAdminAudit({
            actorStudentNumber,
            actorRole: request.jury ? "jury_admin" : "admin",
            action: "odin.ai_feedback",
            entityType: "OdinAiAnalysis",
            entityId: String(params.id),
            summary: `Feedback ODIN 2.0 marcado como ${body.useful ? "útil" : "a rever"}.`,
            metadata: body,
          });

          return reply.send({ success: true as const, message: "Feedback registado com sucesso." });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível guardar o feedback ODIN 2.0.";
          if (/não encontrada/i.test(message)) return reply.status(404).send({ message });
          return reply.status(400).send({ message });
        }
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
