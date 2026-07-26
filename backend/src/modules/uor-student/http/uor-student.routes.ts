import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { UorStudentError, isUorStudentError } from "../domain/errors";
import type { UorStudentApplication, UorStudentIdentity } from "../application/ports";
import { renderUorEstudanteReceiptPdf } from "../../secretaria/http/uor-estudante-finance-pdf";
import { uorStudentWorkflowRoutes } from "./uor-student-workflow.routes";
import { uorStudentAuthorizationRoutes } from "./uor-student-authorization.routes";
import { uorStudentRankingRoutes } from "./uor-student-ranking.routes";
import { uorStudentExternalWriteRoutes } from "./uor-student-external-write.routes";
import { uorStudentInsightsRoutes } from "./uor-student-insights.routes";
import { isSecretariaError } from "../../secretaria/domain/errors";
import { isMoodleError } from "../../moodle/domain/errors";
import { uorStudentLearningRoutes } from "./uor-student-learning.routes";
import { uorStudentAdminRoutes } from "./uor-student-admin.routes";
import { uorStudentDelegatedFinanceRoutes } from "./uor-student-delegated-finance.routes";
import { uorStudentStepUpRoutes } from "./uor-student-step-up.routes";
import { uorStudentChangeRoutes } from "./uor-student-change.routes";

declare module "fastify" {
  interface FastifyRequest {
    uorStudent?: UorStudentIdentity;
  }
}

const coverageSchema = z.enum(["exact", "partial", "not_synced", "unsupported", "stale", "failed"]);
const dataBlockSchema = z.object({
  source: z.enum(["secretaria_uor", "moodle", "uor_student"]),
  observedAt: z.string().nullable(),
  coverage: coverageSchema,
  stale: z.boolean(),
});
const providerSchema = z.object({
  provider: z.enum(["secretaria", "moodle"]),
  status: z.enum(["connected", "connecting", "credentials_required", "unavailable", "not_connected", "degraded"]),
  connected: z.boolean(),
  credentialStored: z.boolean(),
  actionRequired: z.enum(["none", "provide_credentials", "contact_support"]),
  retryable: z.boolean(),
  lastAuthenticatedAt: z.string().nullable(),
  lastSuccessfulSyncAt: z.string().nullable(),
});
const syncRunSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(["secretaria", "moodle"]),
  status: z.enum(["queued", "running", "partial", "completed", "failed", "cancelled"]),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  errorCode: z.string().nullable(),
});
const metaSchema = z.object({
  traceId: z.string(),
  product: z.literal("uor_student"),
  source: z.literal("uor_student"),
  coverage: coverageSchema.optional(),
  stale: z.boolean().optional(),
});
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    actionRequired: z.enum(["none", "provide_credentials", "contact_support"]),
  }),
  meta: z.object({ traceId: z.string(), product: z.literal("uor_student") }),
});
const errorResponses = { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema, 422: errorSchema, 429: errorSchema, 500: errorSchema, 503: errorSchema };
const todaySchema = z.object({
  identity: z.object({
    institutionCode: z.string(),
    studentNumber: z.string(),
    displayName: z.string().nullable(),
    course: z.string().nullable(),
    classCode: z.string().nullable(),
    academicYear: z.string().nullable(),
    academicPeriod: z.string().nullable(),
    provenance: dataBlockSchema,
  }),
  priorities: z.array(z.object({
    id: z.string(),
    kind: z.enum(["provider_action", "stale_data"]),
    severity: z.enum(["info", "warning"]),
    title: z.string(),
    reason: z.string(),
    source: z.literal("uor_student"),
  })),
  academic: z.object({ enrollments: z.number().int().nullable(), grades: z.number().int().nullable(), exams: z.number().int().nullable(), attendance: z.number().int().nullable(), provenance: dataBlockSchema }),
  learning: z.object({ courses: z.number().int().nullable(), materials: z.number().int().nullable(), provenance: dataBlockSchema }),
  finance: z.object({ charges: z.number().int().nullable(), references: z.number().int().nullable(), payments: z.number().int().nullable(), receipts: z.number().int().nullable(), provenance: dataBlockSchema }),
  agenda: z.object({ officialExams: z.number().int().nullable(), moodleDeadlines: z.null(), provenance: dataBlockSchema }),
  providers: z.array(providerSchema),
});
const syncParamsSchema = z.object({ runId: z.string().uuid() });
const providerParamsSchema = z.object({ provider: z.enum(["secretaria", "moodle"]) });
const receiptRefParamsSchema = z.object({ receiptRef: z.string().regex(/^srr_[A-Za-z0-9_-]{43}$/) });
const chargeRefParamsSchema = z.object({ chargeRef: z.string().regex(/^scr_[A-Za-z0-9_-]{43}$/) });
const moodleCredentialsSchema = z.object({ password: z.string().min(1).max(256) }).strict();
const profileFieldSchema = z.object({
  value: z.string().nullable(),
  source: z.enum(["secretaria_uor", "student", "system", "unknown"]),
  observedAt: z.string().nullable(),
});
const profileSchema = z.object({
  id: z.string().uuid(),
  institutionCode: z.string(),
  studentNumber: z.string(),
  fields: z.object({
    displayName: profileFieldSchema,
    course: profileFieldSchema,
    classCode: profileFieldSchema,
    academicYear: profileFieldSchema,
    academicPeriod: profileFieldSchema,
    email: profileFieldSchema,
    phone: profileFieldSchema,
    alternatePhone: profileFieldSchema,
    bio: profileFieldSchema,
    address: profileFieldSchema,
  }),
});
const profilePatchSchema = z.object({
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().min(8).max(30).nullable().optional(),
  alternatePhone: z.string().trim().min(8).max(30).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Envia pelo menos um campo editável.");
const privacyPurposeSchema = z.enum([
  "public_profile",
  "learning_recommendations",
  "ranking_participation",
  "notifications_sms",
  "notifications_whatsapp",
  "finance_reference_sharing",
  "tutoring_data_access",
]);
const privacySchema = z.object({
  id: z.string().uuid(),
  purpose: privacyPurposeSchema,
  enabled: z.boolean(),
  policyVersion: z.string(),
  fields: z.array(z.string()),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  updatedAt: z.string(),
});
const privacyBodySchema = z.object({
  purpose: privacyPurposeSchema,
  enabled: z.boolean(),
  fields: z.array(z.enum(["displayName", "course", "classCode", "academicYear", "email", "phone", "publicContact"])).max(7).default([]),
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
}).strict();
const dataScopeSchema = z.enum(["profile", "privacy", "provider_snapshots", "sync_history"]);
const dataRequestBodySchema = z.object({ scope: z.array(dataScopeSchema).min(1).max(4) }).strict();
const dataRequestSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["export", "delete"]),
  status: z.enum(["pending", "processing", "completed", "partial", "failed", "cancelled"]),
  scope: z.array(z.string()),
  retentions: z.array(z.object({ category: z.string(), retained: z.boolean(), reason: z.string().nullable() })),
  resultAvailable: z.boolean(),
  errorCode: z.string().nullable(),
  requestedAt: z.string(),
  completedAt: z.string().nullable(),
});
const opaqueIdParamsSchema = z.object({ id: z.string().uuid() });
const officialListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(20).max(2_000).optional(),
});
const officialDatasetSchema = z.object({
  domain: z.string(),
  items: z.array(z.object({ id: z.string().regex(/^usi_[A-Za-z0-9_-]{43}$/), attributes: z.record(z.string(), z.unknown()) })),
  pagination: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
    total: z.number().int().nullable(),
  }),
  provenance: dataBlockSchema,
  snapshotVersion: z.number().int().nullable(),
});

const officialDatasetRoutes = [
  { path: "/academic/periods", domain: "academic.enrollments", tag: "Académico" },
  { path: "/academic/subjects", domain: "academic.enrollments", tag: "Académico" },
  { path: "/academic/enrollments", domain: "academic.enrollments", tag: "Académico" },
  { path: "/academic/grades", domain: "academic.grades", tag: "Académico" },
  { path: "/academic/summaries", domain: "academic.overview", tag: "Académico" },
  { path: "/curriculum", domain: "academic.history", tag: "Currículo" },
  { path: "/curriculum/credits", domain: "academic.credits", tag: "Currículo" },
  { path: "/curriculum/prerequisites", domain: "academic.progression", tag: "Currículo" },
  { path: "/changes", domain: "academic.history", tag: "Histórico" },
  { path: "/agenda", domain: "academic.classes", tag: "Agenda" },
  { path: "/schedule", domain: "academic.classes", tag: "Agenda" },
  { path: "/exams", domain: "academic.exams", tag: "Agenda" },
  { path: "/attendance", domain: "academic.attendance", tag: "Assiduidade" },
  { path: "/absences", domain: "academic.absences", tag: "Assiduidade" },
  { path: "/finance/overview", domain: "finance.overview", tag: "Finanças" },
  { path: "/finance/tuition", domain: "finance.tuition", tag: "Finanças" },
  { path: "/finance/debts", domain: "finance.debts", tag: "Finanças" },
  { path: "/finance/charges", domain: "finance.charges", tag: "Finanças" },
  { path: "/finance/references", domain: "finance.references", tag: "Finanças" },
  { path: "/finance/payments", domain: "finance.payments", tag: "Finanças" },
  { path: "/finance/receipts", domain: "finance.receipts", tag: "Finanças" },
  { path: "/directory/courses", domain: "directory.courses", tag: "Diretório" },
  { path: "/teaching/associations", domain: "academic.classes", tag: "Docentes" },
  { path: "/processes/exam-registrations", domain: "process.examRegistrations", tag: "Processos" },
  { path: "/processes/grade-reviews", domain: "process.gradeReviews", tag: "Processos" },
  { path: "/processes/applications", domain: "process.applications", tag: "Processos" },
  { path: "/processes/advanced-training", domain: "process.advancedTraining", tag: "Processos" },
  { path: "/processes/internships", domain: "process.internships", tag: "Processos" },
  { path: "/processes/activities", domain: "process.activities", tag: "Processos" },
  { path: "/processes/languages", domain: "process.languages", tag: "Processos" },
] as const;
const academicRuleSchema = z.object({
  id: z.string(),
  code: z.string(),
  version: z.number().int(),
  name: z.string(),
  kind: z.string(),
  formula: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  status: z.enum(["draft", "approved", "retired", "derived_method", "hypothesis"]),
  effectiveFrom: z.string().nullable(),
  effectiveUntil: z.string().nullable(),
  decisionSource: z.string().nullable(),
});
const academicAveragesSchema = z.object({
  subjects: z.array(z.object({
    subjectKey: z.string(), subjectName: z.string(), period: z.string().nullable(), average: z.string().nullable(), considered: z.number().int(), missing: z.number().int(),
  })),
  overall: z.object({ average: z.string().nullable(), consideredSubjects: z.number().int(), missingSubjects: z.number().int() }),
  rule: z.object({ code: z.string(), version: z.number().int(), status: z.literal("derived_method"), formula: z.string() }),
  inputs: z.array(z.object({ id: z.string(), subjectKey: z.string(), label: z.string(), score: z.string().nullable(), weight: z.string(), official: z.literal(true) })),
  provenance: dataBlockSchema,
});
const academicEntryBodySchema = z.object({
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(160),
  score: z.union([z.number(), z.string().trim().min(1).max(20), z.null()]),
  weight: z.union([z.number(), z.string().trim().min(1).max(20)]),
}).strict();
const simulationBodySchema = z.object({
  subjectKey: z.string().trim().min(1).max(160),
  period: z.string().trim().min(1).max(80).nullable().default(null),
  entries: z.array(academicEntryBodySchema).min(1).max(30),
}).strict();
const simulationSchema = z.object({
  id: z.string().uuid(),
  subjectKey: z.string(),
  period: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  rule: z.object({ code: z.string(), version: z.number().int(), status: z.literal("hypothesis") }),
  scenario: z.array(z.object({ key: z.string(), label: z.string(), score: z.string().nullable(), weight: z.string() })),
  result: z.object({ average: z.string().nullable(), considered: z.number().int(), missing: z.number().int() }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const cursorListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().uuid().optional() });
const requiredGradeBodySchema = z.object({
  completed: z.array(academicEntryBodySchema.extend({ official: z.boolean().default(false) })).max(30),
  remainingWeight: z.union([z.number(), z.string().trim().min(1).max(20)]),
  target: z.union([z.number(), z.string().trim().min(1).max(20)]),
  scaleMin: z.union([z.number(), z.string().trim().min(1).max(20)]).optional(),
  scaleMax: z.union([z.number(), z.string().trim().min(1).max(20)]).optional(),
}).strict();
const scholarshipBodySchema = requiredGradeBodySchema.omit({ target: true });
const requiredGradeResultSchema = z.object({
  status: z.enum(["required", "already_met", "impossible", "insufficient_information"]),
  requiredScore: z.string().nullable(),
  target: z.string(),
  remainingWeight: z.string(),
  completedWeight: z.string(),
  totalWeight: z.string(),
  rule: z.object({ code: z.string(), version: z.number().int(), status: z.literal("calculation_method"), formula: z.string() }),
  gaps: z.array(z.string()),
});

export type UorStudentRoutesOptions = {
  env: Env;
  application: UorStudentApplication;
  findEligibleStudent?: (studentId: number) => Promise<UorStudentIdentity | null>;
};

function meta(request: FastifyRequest, options: { coverage?: z.infer<typeof coverageSchema>; stale?: boolean } = {}) {
  return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const, ...options };
}

export function uorStudentDomainFromRoute(route: string) {
  const segments = route.split("?")[0]!.split("/").filter(Boolean);
  const productIndex = segments.lastIndexOf("student");
  if (productIndex < 0 || productIndex === segments.length - 1) return "root";
  const domain = segments[productIndex + 1]!;
  return /^[a-z][a-z0-9-]*$/i.test(domain) ? domain : "root";
}

function errorPayload(request: FastifyRequest, error: UorStudentError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      actionRequired: error.actionRequired,
    },
    meta: { traceId: request.id, product: "uor_student" as const },
  };
}

async function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (isSecretariaError(error)) {
    const actionRequired = error.actionRequired === "connect" || error.actionRequired === "reauthenticate"
      ? "provide_credentials"
      : error.actionRequired === "contact_support" ? "contact_support" : "none";
    return sendError(request, reply, new UorStudentError(error.code, error.message, error.statusCode, error.retryable, actionRequired));
  }
  if (isMoodleError(error)) {
    const actionRequired = error.actionRequired === "connect" || error.actionRequired === "reauthenticate"
      ? "provide_credentials"
      : error.actionRequired === "contact_support" ? "contact_support" : "none";
    return sendError(request, reply, new UorStudentError(error.code, error.message, error.statusCode, error.retryable, actionRequired));
  }
  if (isUorStudentError(error)) {
    if (error.statusCode >= 500) request.log.error({ code: error.code, product: "uor_student" }, error.message);
    else request.log.warn({ code: error.code, product: "uor_student" }, error.message);
    return reply.status(error.statusCode).send(errorPayload(request, error));
  }
  request.log.error({ err: error, product: "uor_student" }, "Falha no backend UOR Estudante");
  return reply.status(503).send(errorPayload(request, new UorStudentError(
    "UOR_STUDENT_UNAVAILABLE",
    "Não foi possível concluir o pedido da UOR Estudante.",
    503,
    true,
    "contact_support",
  )));
}

async function defaultFindEligibleStudent(studentId: number): Promise<UorStudentIdentity | null> {
  const { prisma } = await import("../../../shared/prisma.js");
  return prisma.student.findFirst({
    where: { id: studentId, institutionCode: "UOR", isUorStudent: true, deletedAt: null },
    select: { id: true, institutionCode: true, studentNumber: true },
  });
}

export async function uorStudentRoutes(app: FastifyInstance, options: UorStudentRoutesOptions) {
  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? request.url;
    request.log.info({
      product: "uor_student",
      domain: uorStudentDomainFromRoute(route),
      tenant: request.uorStudent?.institutionCode ?? null,
      statusCode: reply.statusCode,
      elapsedMs: reply.elapsedTime,
      traceId: request.id,
    }, "uor_student_request_completed");
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const findEligibleStudent = options.findEligibleStudent ?? defaultFindEligibleStudent;

  app.addHook("onReady", async () => options.application.start?.());
  app.addHook("onClose", async () => options.application.stop?.());
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, {
      env: options.env,
      formatError: ({ request, statusCode }) => errorPayload(request, new UorStudentError(
        "UOR_STUDENT_AUTH_REQUIRED",
        "A sessão UOR Estudante é inválida ou expirou.",
        statusCode,
      )),
    });
    protectedApp.addHook("preHandler", async (request, reply) => {
      if (!request.student) return reply.status(403).send(errorPayload(request, new UorStudentError("UOR_STUDENT_ACCESS_DENIED", "Este recurso pertence a estudantes UOR autenticados.", 403)));
      const eligible = await findEligibleStudent(request.student.id);
      if (!eligible || eligible.studentNumber !== request.student.studentNumber) {
        return reply.status(403).send(errorPayload(request, new UorStudentError("UOR_STUDENT_ACCESS_DENIED", "O perfil institucional não corresponde à sessão.", 403)));
      }
      request.uorStudent = eligible;
    });
    protectedApp.addHook("onSend", async (_request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      reply.header("Pragma", "no-cache");
    });
    protectedApp.setErrorHandler(async (error, request, reply) => {
      const fastifyError = error as { validation?: unknown; validationContext?: string; statusCode?: number };
      if (fastifyError.validation) return sendError(request, reply, new UorStudentError("UOR_STUDENT_REQUEST_INVALID", "Os dados enviados são inválidos.", fastifyError.validationContext === "body" ? 422 : 400));
      if (fastifyError.statusCode === 429) return sendError(request, reply, new UorStudentError("UOR_STUDENT_RATE_LIMITED", "Foram feitos demasiados pedidos.", 429, true));
      return sendError(request, reply, error);
    });

    protectedApp.get("/", {
      schema: {
        tags: ["UOR Estudante"],
        response: {
          200: z.object({ data: z.object({ product: z.literal("uor_student"), status: z.literal("operational"), syncMode: z.literal("automatic_backend") }), meta: metaSchema }),
          ...errorResponses,
        },
      },
    }, async (request) => ({ data: { product: "uor_student" as const, status: "operational" as const, syncMode: "automatic_backend" as const }, meta: meta(request) }));

    protectedApp.get("/providers", {
      schema: { tags: ["UOR Estudante - Integrações"], response: { 200: z.object({ data: z.array(providerSchema), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getProviders(request.uorStudent!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.delete("/session", {
      schema: { tags: ["UOR Estudante - Sessão"], response: { 200: z.object({ data: z.object({ externalSessionsTerminated: z.literal(true), providers: z.array(providerSchema) }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const providers = await options.application.terminateExternalSessions(request.uorStudent!);
        return { data: { externalSessionsTerminated: true as const, providers }, meta: meta(request) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/session", {
      schema: { tags: ["UOR Estudante - Sessão"], response: { 200: z.object({ data: z.object({ active: z.literal(true), profileId: z.string().uuid(), institutionCode: z.string(), providers: z.array(providerSchema) }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const [profile, providers] = await Promise.all([
          options.application.getProfile(request.uorStudent!),
          options.application.getProviders(request.uorStudent!),
        ]);
        return { data: { active: true as const, profileId: profile.id, institutionCode: profile.institutionCode, providers }, meta: meta(request) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.delete("/providers/:provider", {
      schema: { tags: ["UOR Estudante - Integrações"], params: providerParamsSchema, response: { 200: z.object({ data: z.object({ disconnected: z.enum(["secretaria", "moodle"]), providers: z.array(providerSchema) }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const { provider } = request.params as z.infer<typeof providerParamsSchema>;
        const providers = await options.application.disconnectProvider(request.uorStudent!, provider);
        return { data: { disconnected: provider, providers }, meta: meta(request) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/me", {
      schema: { tags: ["UOR Estudante - Identidade"], response: { 200: z.object({ data: profileSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getProfile(request.uorStudent!), meta: meta(request, { coverage: "exact", stale: false }) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/profile", {
      schema: { tags: ["UOR Estudante - Identidade"], response: { 200: z.object({ data: profileSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getProfile(request.uorStudent!), meta: meta(request, { coverage: "exact", stale: false }) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.patch("/profile", {
      config: { rateLimit: { max: 20, timeWindow: 60_000, keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:profile` } },
      schema: { tags: ["UOR Estudante - Identidade"], body: profilePatchSchema, response: { 200: z.object({ data: profileSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.updateProfile(request.uorStudent!, request.body as z.infer<typeof profilePatchSchema>, request.id);
        return { data, meta: meta(request, { coverage: "exact", stale: false }) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/privacy", {
      schema: { tags: ["UOR Estudante - Privacidade"], response: { 200: z.object({ data: z.array(privacySchema), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.listPrivacy(request.uorStudent!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.put("/privacy", {
      config: { rateLimit: { max: 20, timeWindow: 60_000, keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:privacy` } },
      schema: { tags: ["UOR Estudante - Privacidade"], body: privacyBodySchema, response: { 200: z.object({ data: privacySchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const body = request.body as z.infer<typeof privacyBodySchema>;
        const data = await options.application.setPrivacy(request.uorStudent!, {
          purpose: body.purpose,
          enabled: body.enabled,
          fields: body.fields,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        }, request.id);
        return { data, meta: meta(request) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/data-exports", {
      config: { rateLimit: { max: 3, timeWindow: 60 * 60_000, keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:data-export` } },
      schema: { tags: ["UOR Estudante - Privacidade"], body: dataRequestBodySchema, response: { 201: z.object({ data: dataRequestSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.createDataRequest(request.uorStudent!, { type: "export", scope: (request.body as z.infer<typeof dataRequestBodySchema>).scope }, request.id);
        return reply.status(201).send({ data, meta: meta(request) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/data-exports/:id", {
      schema: { tags: ["UOR Estudante - Privacidade"], params: opaqueIdParamsSchema, response: { 200: z.object({ data: dataRequestSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getDataRequest(request.uorStudent!, (request.params as z.infer<typeof opaqueIdParamsSchema>).id), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/data-exports/:id/content", {
      schema: { tags: ["UOR Estudante - Privacidade"], params: opaqueIdParamsSchema, response: { 200: z.object({ data: z.record(z.string(), z.unknown()), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getExportPayload(request.uorStudent!, (request.params as z.infer<typeof opaqueIdParamsSchema>).id), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/data-deletion-requests", {
      config: { rateLimit: { max: 2, timeWindow: 24 * 60 * 60_000, keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:data-delete` } },
      schema: { tags: ["UOR Estudante - Privacidade"], body: dataRequestBodySchema, response: { 202: z.object({ data: dataRequestSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.createDataRequest(request.uorStudent!, { type: "delete", scope: (request.body as z.infer<typeof dataRequestBodySchema>).scope }, request.id);
        return reply.status(202).send({ data, meta: meta(request) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/data-deletion-requests/:id", {
      schema: { tags: ["UOR Estudante - Privacidade"], params: opaqueIdParamsSchema, response: { 200: z.object({ data: dataRequestSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getDataRequest(request.uorStudent!, (request.params as z.infer<typeof opaqueIdParamsSchema>).id), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/sync", {
      schema: { tags: ["UOR Estudante - Sincronização"], response: { 200: z.object({ data: z.object({ runs: z.array(syncRunSchema), automatic: z.literal(true) }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.getSyncOverview(request.uorStudent!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/sync/:runId", {
      schema: { tags: ["UOR Estudante - Sincronização"], params: syncParamsSchema, response: { 200: z.object({ data: syncRunSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const { runId } = request.params as z.infer<typeof syncParamsSchema>;
        return { data: await options.application.getSyncRun(request.uorStudent!, runId), meta: meta(request) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/today", {
      schema: { tags: ["UOR Estudante - Hoje"], response: { 200: z.object({ data: todaySchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.getToday(request.uorStudent!);
        const blocks = [data.identity.provenance, data.academic.provenance, data.learning.provenance, data.finance.provenance, data.agenda.provenance];
        const stale = blocks.some((block) => block.stale);
        const coverage = blocks.every((block) => block.coverage === "exact") ? "exact" : blocks.every((block) => block.coverage === "not_synced") ? "not_synced" : stale ? "stale" : "partial";
        return { data, meta: meta(request, { coverage, stale }) };
      } catch (error) { return sendError(request, reply, error); }
    });

    for (const route of officialDatasetRoutes) {
      protectedApp.get(route.path, {
        schema: {
          tags: [`UOR Estudante - ${route.tag}`],
          querystring: officialListQuerySchema,
          response: { 200: z.object({ data: officialDatasetSchema, meta: metaSchema }), ...errorResponses },
        },
      }, async (request, reply) => {
        try {
          const query = request.query as z.infer<typeof officialListQuerySchema>;
          const data = await options.application.getOfficialDataset(request.uorStudent!, route.domain, query);
          return {
            data,
            meta: meta(request, { coverage: data.provenance.coverage, stale: data.provenance.stale }),
          };
        } catch (error) { return sendError(request, reply, error); }
      });
    }

    protectedApp.get("/academic-rules", {
      schema: { tags: ["UOR Estudante - Inteligência Académica"], response: { 200: z.object({ data: z.array(academicRuleSchema), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await options.application.listAcademicRules(request.uorStudent!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/averages", {
      schema: { tags: ["UOR Estudante - Inteligência Académica"], response: { 200: z.object({ data: academicAveragesSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.getAcademicAverages(request.uorStudent!);
        return { data, meta: meta(request, { coverage: data.provenance.coverage, stale: data.provenance.stale }) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/simulations", {
      schema: {
        tags: ["UOR Estudante - Inteligência Académica"],
        querystring: cursorListQuerySchema,
        response: { 200: z.object({ data: z.object({ items: z.array(simulationSchema), nextCursor: z.string().nullable() }), meta: metaSchema }), ...errorResponses },
      },
    }, async (request, reply) => {
      try { return { data: await options.application.listAcademicSimulations(request.uorStudent!, request.query as z.infer<typeof cursorListQuerySchema>), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/simulations", {
      config: { rateLimit: { max: 30, timeWindow: 60_000, keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:simulation` } },
      schema: { tags: ["UOR Estudante - Inteligência Académica"], body: simulationBodySchema, response: { 201: z.object({ data: simulationSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.createAcademicSimulation(request.uorStudent!, request.body as z.infer<typeof simulationBodySchema>, request.id);
        return reply.status(201).send({ data, meta: meta(request) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.put("/simulations/:id", {
      schema: { tags: ["UOR Estudante - Inteligência Académica"], params: opaqueIdParamsSchema, body: simulationBodySchema, response: { 200: z.object({ data: simulationSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const data = await options.application.updateAcademicSimulation(
          request.uorStudent!,
          (request.params as z.infer<typeof opaqueIdParamsSchema>).id,
          request.body as z.infer<typeof simulationBodySchema>,
          request.id,
        );
        return { data, meta: meta(request) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/required-grades", {
      schema: { tags: ["UOR Estudante - Inteligência Académica"], body: requiredGradeBodySchema, response: { 200: z.object({ data: requiredGradeResultSchema, meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: options.application.calculateRequiredGrade(request.body as z.infer<typeof requiredGradeBodySchema>), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/scholarship-scenarios", {
      schema: { tags: ["UOR Estudante - Inteligência Académica"], body: scholarshipBodySchema, response: { 200: z.object({ data: requiredGradeResultSchema.extend({ hypothesis: z.object({ code: z.string(), version: z.number().int(), status: z.literal("hypothesis"), target: z.string(), formula: z.string() }) }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: options.application.calculateScholarshipScenario(request.body as z.infer<typeof scholarshipBodySchema>), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/finance/receipts/:receiptRef", {
      schema: { tags: ["UOR Estudante - Finanças"], params: receiptRefParamsSchema, response: { 200: z.object({ data: z.object({ receiptRef: z.string(), documentKind: z.literal("PAYMENT_ITEM_DETAIL"), officialFiscalReceipt: z.literal(false), fields: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])), observedAt: z.string() }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        const receipt = await options.application.getFinanceReceipt(request.uorStudent!, (request.params as z.infer<typeof receiptRefParamsSchema>).receiptRef);
        return { data: receipt, meta: meta(request, { coverage: "exact", stale: false }) };
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/finance/receipts/:receiptRef/content", {
      schema: { tags: ["UOR Estudante - Finanças"], params: receiptRefParamsSchema, response: { ...errorResponses } },
    }, async (request, reply) => {
      try {
        const { receiptRef } = request.params as z.infer<typeof receiptRefParamsSchema>;
        const receipt = await options.application.getFinanceReceipt(request.uorStudent!, receiptRef);
        const pdf = await renderUorEstudanteReceiptPdf(receipt.fields, receipt.observedAt, {
          studentNumber: request.uorStudent!.studentNumber,
          documentId: receiptRef,
        });
        const clear = () => pdf.fill(0);
        reply.raw.once("finish", clear);
        reply.raw.once("close", clear);
        const etag = `"${createHash("sha256").update(pdf).digest("hex")}"`;
        reply.header("ETag", etag);
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Length", String(pdf.length));
        reply.header("Content-Disposition", 'attachment; filename="extrato-pagamento-uor-estudante.pdf"');
        reply.header("X-Document-Status", "informational-not-fiscal-receipt");
        reply.header("X-Content-Type-Options", "nosniff");
        if (request.headers["if-none-match"] === etag) return reply.status(304).send();
        return reply.send(pdf);
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/finance/references/:chargeRef/document", {
      schema: { tags: ["UOR Estudante - Finanças"], params: chargeRefParamsSchema, response: { ...errorResponses } },
    }, async (request, reply) => {
      try {
        const document = await options.application.getFinancePaymentReferenceDocument(
          request.uorStudent!,
          (request.params as z.infer<typeof chargeRefParamsSchema>).chargeRef,
        );
        const clear = () => document.body.fill(0);
        reply.raw.once("finish", clear);
        reply.raw.once("close", clear);
        const etag = `"${document.sha256}"`;
        reply.header("ETag", etag);
        reply.header("Content-Type", document.contentType);
        reply.header("Content-Length", String(document.contentLength));
        reply.header("Content-Disposition", `attachment; filename="${document.filename}"`);
        reply.header("X-Content-Type-Options", "nosniff");
        if (request.headers["if-none-match"] === etag) return reply.status(304).send();
        return reply.send(document.body);
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.put("/providers/moodle/credentials", {
      config: { rateLimit: { max: 5, timeWindow: 15 * 60_000, keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:moodle-credentials` } },
      schema: { tags: ["UOR Estudante - Integrações"], body: moodleCredentialsSchema, response: { 202: z.object({ data: z.object({ accepted: z.literal(true), syncMode: z.literal("automatic_backend") }), meta: metaSchema }), ...errorResponses } },
    }, async (request, reply) => {
      try {
        await options.application.updateMoodleCredentials(request.uorStudent!, (request.body as z.infer<typeof moodleCredentialsSchema>).password);
        return reply.status(202).send({ data: { accepted: true, syncMode: "automatic_backend" }, meta: meta(request) });
      } catch (error) { return sendError(request, reply, error); }
    });
    if (options.application.workflows) {
      protectedApp.register(uorStudentWorkflowRoutes, { application: options.application.workflows });
    }
    if (options.application.authorizations) {
      protectedApp.register(uorStudentAuthorizationRoutes, { application: options.application.authorizations });
    }
    if (options.application.rankings) {
      protectedApp.register(uorStudentRankingRoutes, { application: options.application.rankings });
    }
    if (options.application.externalWrites) {
      protectedApp.register(uorStudentExternalWriteRoutes, { application: options.application.externalWrites, stepUp: options.application.stepUp });
    }
    if (options.application.insights) {
      protectedApp.register(uorStudentInsightsRoutes, { application: options.application.insights });
    }
    if (options.application.learning) {
      protectedApp.register(uorStudentLearningRoutes, { application: options.application.learning });
    }
    if (options.application.admin) {
      protectedApp.register(uorStudentAdminRoutes, { application: options.application.admin });
    }
    if (options.application.delegatedFinance) {
      protectedApp.register(uorStudentDelegatedFinanceRoutes, { application: options.application.delegatedFinance });
    }
    if (options.application.stepUp) {
      protectedApp.register(uorStudentStepUpRoutes, { application: options.application.stepUp });
    }
    if (options.application.changes) {
      protectedApp.register(uorStudentChangeRoutes, { application: options.application.changes });
    }
  });
}
