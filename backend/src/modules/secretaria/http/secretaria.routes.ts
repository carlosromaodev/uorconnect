import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { SecretariaError, isSecretariaError } from "../domain/errors";
import type { SecretariaApplication } from "../application/secretaria.application";

const metaSchema = z.object({
  traceId: z.string(),
  source: z.literal("secretaria_uor"),
  coverage: z.string().optional(),
  stale: z.boolean().optional(),
  snapshotVersion: z.number().int().nullable().optional(),
  observedAt: z.string().nullable().optional(),
});
const envelopeSchema = z.object({ data: z.unknown(), meta: metaSchema });
const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    actionRequired: z.string(),
  }),
  meta: z.object({ traceId: z.string() }),
});
const errorResponses = { 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 409: errorSchema, 422: errorSchema, 429: errorSchema, 500: errorSchema, 502: errorSchema, 503: errorSchema };
const sessionBodySchema = z.object({
  username: z.string().trim().min(4).max(32),
  password: z.string().min(1).max(256),
  rememberCredentials: z.literal(true),
});
const syncBodySchema = z.object({ domains: z.array(z.string().min(1).max(80)).max(30).optional() }).default({});
const dataDeletionBodySchema = z.object({ confirmation: z.literal("DELETE_IMPORTED_SECRETARIA_DATA") });
const runParamsSchema = z.object({ runId: z.string().uuid() });
const academicParamsSchema = z.object({ resource: z.enum(["overview", "history", "enrollments", "grades", "credits", "progression", "classes", "exams", "absences", "attendance"]) });

export type SecretariaRoutesOptions = {
  env: Env;
  application: SecretariaApplication;
  findEligibleStudent?: (studentId: number) => Promise<{ id: number; studentNumber: string } | null>;
};

function errorPayload(request: FastifyRequest, error: SecretariaError) {
  return {
    error: { code: error.code, message: error.message, retryable: error.retryable, actionRequired: error.actionRequired },
    meta: { traceId: request.id },
  };
}

async function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (isSecretariaError(error)) {
    if (error.statusCode >= 500) request.log.error({ secretariaCode: error.code }, error.message);
    else request.log.warn({ secretariaCode: error.code }, error.message);
    if (error.statusCode === 503 && error.retryable) reply.header("Retry-After", "5");
    return reply.status(error.statusCode).send(errorPayload(request, error));
  }
  request.log.error({ err: error }, "Falha interna na integração Secretaria");
  const safe = new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível concluir o pedido da Secretaria.", 500, true);
  return reply.status(500).send(errorPayload(request, safe));
}

function meta(request: FastifyRequest, options: { coverage?: string; stale?: boolean; snapshotVersion?: number | null; observedAt?: string | null } = {}) {
  return { traceId: request.id, source: "secretaria_uor" as const, ...options };
}

async function defaultFindEligibleStudent(studentId: number) {
  const { prisma } = await import("../../../shared/prisma.js");
  return prisma.student.findFirst({
    where: { id: studentId, deletedAt: null, institutionCode: "UOR", isUorStudent: true },
    select: { id: true, studentNumber: true },
  });
}

export async function secretariaRoutes(app: FastifyInstance, opts: SecretariaRoutesOptions) {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const findEligibleStudent = opts.findEligibleStudent ?? defaultFindEligibleStudent;

  app.addHook("onClose", async () => opts.application.stop?.());

  app.get("/health", {
    schema: { tags: ["Secretaria - Operação"], response: { 200: envelopeSchema } },
  }, async (request) => ({
    data: { integration: "secretaria", enabled: opts.env.SECRETARIA_INTEGRATION_ENABLED, upstreamTls: new URL(opts.env.SECRETARIA_BASE_URL).protocol === "https:" },
    meta: meta(request),
  }));

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, {
      env: opts.env,
      formatError: ({ request, statusCode }) => errorPayload(request, new SecretariaError("UOR_AUTH_REQUIRED", "Sessão UOR Estudante inválida ou expirada.", statusCode)),
    });
    protectedApp.addHook("preHandler", async (request, reply) => {
      if (!request.student) return reply.status(403).send(errorPayload(request, new SecretariaError("SECRETARIA_STUDENT_NOT_ELIGIBLE", "A integração está disponível apenas para estudantes UOR ativos.", 403)));
      const eligible = await findEligibleStudent(request.student.id);
      if (!eligible) return reply.status(403).send(errorPayload(request, new SecretariaError("SECRETARIA_STUDENT_NOT_ELIGIBLE", "A integração está disponível apenas para estudantes UOR ativos.", 403)));
      request.student = eligible;
    });
    protectedApp.addHook("onSend", async (_request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      reply.header("Pragma", "no-cache");
    });
    protectedApp.setErrorHandler(async (error, request, reply) => {
      const fastifyError = error as { validation?: unknown; validationContext?: string; statusCode?: number };
      if (fastifyError.validation) return sendError(request, reply, new SecretariaError("SECRETARIA_REQUEST_INVALID", "Os dados enviados são inválidos.", fastifyError.validationContext === "body" ? 422 : 400));
      if (fastifyError.statusCode === 429) return sendError(request, reply, new SecretariaError("SECRETARIA_UNAVAILABLE", "Foram feitos demasiados pedidos.", 429, true));
      return sendError(request, reply, error);
    });

    protectedApp.get("/", { schema: { tags: ["Secretaria - Operação"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request) => ({
      data: { integration: "secretaria", product: "uor_estudante", apiVersion: "v1", authority: "official_academic_administrative_financial_source" },
      meta: meta(request),
    }));

    protectedApp.get("/capabilities", { schema: { tags: ["Secretaria - Operação"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request) => ({ data: opts.application.capabilities(), meta: meta(request) }));

    protectedApp.post("/session", {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}`,
        },
      },
      schema: { tags: ["Secretaria - Sessão"], body: sessionBodySchema, response: { 201: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try {
        const result = await opts.application.connect(request.student!, request.body as z.infer<typeof sessionBodySchema>);
        return reply.status(201).send({ data: result, meta: meta(request, { coverage: "live" }) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/session", { schema: { tags: ["Secretaria - Sessão"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.getConnection(request.student!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    // Compatibility with the initial placeholder route.
    protectedApp.get("/session/status", { schema: { tags: ["Secretaria - Sessão"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.getConnection(request.student!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.delete("/session", { schema: { tags: ["Secretaria - Sessão"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.terminateSession(request.student!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.delete("/connection", { schema: { tags: ["Secretaria - Sessão"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.disconnect(request.student!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.post("/data-deletion-requests", { schema: { tags: ["Secretaria - Privacidade"], body: dataDeletionBodySchema, response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.deleteImportedData(request.student!), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/me", { schema: { tags: ["Secretaria - Perfil"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.getProfile(request.student!), meta: meta(request, { coverage: "live" }) }; }
      catch (error) { return sendError(request, reply, error); }
    });

    async function dataset(request: FastifyRequest, reply: FastifyReply, domain: string) {
      try {
        const result = await opts.application.getDataset(request.student!, domain);
        return reply.send({ data: result.data, meta: meta(request, { coverage: result.data.coverage, stale: result.stale, snapshotVersion: result.snapshotVersion, observedAt: result.data.observedAt }) });
      } catch (error) { return sendError(request, reply, error); }
    }

    protectedApp.get("/academic/:resource", { schema: { tags: ["Secretaria - Académico"], params: academicParamsSchema, response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      const { resource } = request.params as z.infer<typeof academicParamsSchema>;
      return dataset(request, reply, `academic.${resource}`);
    });
    protectedApp.get("/finance/overview", { schema: { tags: ["Secretaria - Finanças"], response: { 200: envelopeSchema, ...errorResponses } } }, (request, reply) => dataset(request, reply, "finance.overview"));
    protectedApp.get("/finance/charges", { schema: { tags: ["Secretaria - Finanças"], response: { 200: envelopeSchema, ...errorResponses } } }, (request, reply) => dataset(request, reply, "finance.charges"));
    protectedApp.get("/finance/payment-references", { schema: { tags: ["Secretaria - Finanças"], response: { 200: envelopeSchema, ...errorResponses } } }, (request, reply) => dataset(request, reply, "finance.references"));
    protectedApp.get("/finance/payments", { schema: { tags: ["Secretaria - Finanças"], response: { 200: envelopeSchema, ...errorResponses } } }, (request, reply) => dataset(request, reply, "finance.payments"));

    const processRoutes: Array<[string, string]> = [
      ["/exam-registrations", "process.examRegistrations"],
      ["/grade-review-requests", "process.gradeReviews"],
      ["/applications", "process.applications"],
      ["/advanced-training", "process.advancedTraining"],
      ["/internships", "process.internships"],
      ["/extracurricular-activities", "process.activities"],
      ["/language-competencies", "process.languages"],
    ];
    for (const [path, domain] of processRoutes) {
      protectedApp.get(path, { schema: { tags: ["Secretaria - Processos"], response: { 200: envelopeSchema, ...errorResponses } } }, (request, reply) => dataset(request, reply, domain));
    }

    const disabledReads = ["/consents", "/finance/receipts", "/finance/receipts/:id/content"];
    for (const url of disabledReads) {
      protectedApp.get(url, { schema: { tags: ["Secretaria - Capabilities"], response: { ...errorResponses } } }, async (request, reply) => sendError(request, reply, new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "Esta leitura aguarda confirmação do contrato upstream.", 409)));
    }

    const disabledMutations: Array<{ method: "POST" | "PUT" | "PATCH" | "DELETE"; url: string }> = [
      { method: "PATCH", url: "/me/contact-details" },
      { method: "PUT", url: "/me/photo" },
      { method: "DELETE", url: "/me/photo" },
      { method: "PATCH", url: "/consents/:consentId" },
      { method: "POST", url: "/exam-registrations" },
      { method: "DELETE", url: "/exam-registrations/:id" },
      { method: "POST", url: "/grade-review-requests" },
      { method: "POST", url: "/applications" },
      { method: "PATCH", url: "/applications/:id" },
      { method: "POST", url: "/advanced-training" },
      { method: "PATCH", url: "/advanced-training/:id" },
      { method: "DELETE", url: "/advanced-training/:id" },
      { method: "POST", url: "/internships" },
      { method: "DELETE", url: "/internships/:id" },
      { method: "POST", url: "/extracurricular-activities" },
      { method: "PATCH", url: "/extracurricular-activities/:id" },
      { method: "DELETE", url: "/extracurricular-activities/:id" },
      { method: "POST", url: "/language-competencies" },
      { method: "PATCH", url: "/language-competencies/:id" },
      { method: "DELETE", url: "/language-competencies/:id" },
    ];
    for (const route of disabledMutations) {
      protectedApp.route({
        method: route.method,
        url: route.url,
        schema: { tags: ["Secretaria - Escritas condicionadas"], response: { ...errorResponses } },
        handler: async (request, reply) => sendError(request, reply, new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "Esta operação aguarda autorização, contrato e teste individual.", 409)),
      });
    }

    protectedApp.post("/finance/payment-references", { schema: { tags: ["Secretaria - Finanças"], response: { ...errorResponses } } }, async (request, reply) => sendError(request, reply, new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "A geração de referência aguarda validação do contrato upstream.", 409)));

    protectedApp.post("/sync", { schema: { tags: ["Secretaria - Sincronização"], body: syncBodySchema, response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.startSync(request.student!, (request.body as z.infer<typeof syncBodySchema>).domains), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.get("/sync-runs/:runId", { schema: { tags: ["Secretaria - Sincronização"], params: runParamsSchema, response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try { return { data: await opts.application.getSync(request.student!, (request.params as z.infer<typeof runParamsSchema>).runId), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
  });
}
