import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import sharp from "sharp";
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
const paymentReferenceBodySchema = z.object({
  chargeRefs: z.array(z.string().regex(/^scr_[A-Za-z0-9_-]{43}$/)).min(1).max(20),
});
const contactDetailsBodySchema = z.object({
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().max(40).regex(/^[+0-9() .-]*$/).nullable().optional(),
  mobile: z.string().trim().max(40).regex(/^[+0-9() .-]*$/).nullable().optional(),
  primaryAddressLine: z.string().trim().min(1).max(300).optional(),
  secondaryAddressLine: z.string().trim().max(300).nullable().optional(),
  mailingAddress: z.enum(["PRIMARY", "SECONDARY"]).optional(),
}).strict().refine((body) => Object.keys(body).length > 0, { message: "Indica pelo menos um campo para alterar." });
const photoBodySchema = z.object({
  dataUrl: z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).max(1_500_000),
}).strict();
const examRegistrationParamsSchema = z.object({ registrationRef: z.string().regex(/^ser_[A-Za-z0-9_-]{43}$/) });
const gradeReviewBodySchema = z.object({
  reviewRef: z.string().regex(/^sgr_[A-Za-z0-9_-]{43}$/),
  justification: z.string().trim().min(1).max(16_000),
}).strict();
const gradeReviewParamsSchema = z.object({ reviewRef: z.string().regex(/^sgr_[A-Za-z0-9_-]{43}$/) });
const idempotencyHeadersSchema = z.object({ "idempotency-key": z.string().trim().min(8).max(128) });
const commandParamsSchema = z.object({ commandId: z.string().uuid() });
const commandConfirmationBodySchema = z.object({ confirmation: z.enum(["GENERATE_PAYMENT_REFERENCE", "UPDATE_CONTACT_DETAILS", "UPDATE_PHOTO", "CANCEL_EXAM_REGISTRATION", "SUBMIT_GRADE_REVIEW"]) });

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

async function normalizedPhoto(dataUrl: string) {
  const encoded = dataUrl.slice("data:image/jpeg;base64,".length);
  const source = Buffer.from(encoded, "base64");
  try {
    if (source.length === 0 || source.length > 1_048_576 || source[0] !== 0xff || source[1] !== 0xd8 || source[2] !== 0xff) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A fotografia deve ser um JPEG válido com no máximo 1024 KB.", 422);
    }
    const metadata = await sharp(source, { failOn: "warning", limitInputPixels: 64_000_000 }).metadata();
    if (!metadata.width || !metadata.height || metadata.format !== "jpeg" || (metadata.pages ?? 1) !== 1 || metadata.width < 64 || metadata.height < 64) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A fotografia JPEG deve ter pelo menos 64×64 píxeis.", 422);
    }
    const normalized = await sharp(source, { failOn: "warning", limitInputPixels: 64_000_000 })
      .rotate()
      .resize({ width: 2_000, height: 2_000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (normalized.data.length > 1_048_576) {
      normalized.data.fill(0);
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A fotografia continua acima de 1024 KB depois da normalização.", 422);
    }
    return {
      body: normalized.data,
      sha256: createHash("sha256").update(normalized.data).digest("hex"),
      width: normalized.info.width,
      height: normalized.info.height,
    };
  } catch (error) {
    if (isSecretariaError(error)) throw error;
    throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "Não foi possível validar a fotografia JPEG.", 422, false, "none", { cause: error });
  } finally {
    source.fill(0);
  }
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
    protectedApp.get("/me/contact-details", { schema: { tags: ["Secretaria - Perfil"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try {
        const data = await opts.application.getContactDetails(request.student!);
        return { data, meta: meta(request, { coverage: "live", observedAt: data.observedAt }) };
      } catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.get("/me/photo", { schema: { tags: ["Secretaria - Perfil"], response: { ...errorResponses } } }, async (request, reply) => {
      try {
        const photo = await opts.application.getPhoto(request.student!);
        const clearPhoto = () => photo.body.fill(0);
        reply.raw.once("finish", clearPhoto);
        reply.raw.once("close", clearPhoto);
        const etag = `"${photo.sha256}"`;
        const extension = photo.contentType === "image/jpeg" ? "jpg" : photo.contentType === "image/png" ? "png" : "gif";
        reply.header("ETag", etag);
        reply.header("Content-Type", photo.contentType);
        reply.header("Content-Length", String(photo.contentLength));
        reply.header("Content-Disposition", `inline; filename="secretaria-profile-photo.${extension}"`);
        reply.header("X-Content-Type-Options", "nosniff");
        if (request.headers["if-none-match"] === etag) return reply.status(304).send();
        return reply.send(photo.body);
      } catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.get("/consents", { schema: { tags: ["Secretaria - Privacidade"], response: { 200: envelopeSchema, ...errorResponses } } }, async (request, reply) => {
      try {
        const data = await opts.application.getConsents(request.student!);
        return { data, meta: meta(request, { coverage: data.coverage, observedAt: data.observedAt }) };
      } catch (error) { return sendError(request, reply, error); }
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
    protectedApp.get("/grade-review-requests/:reviewRef", {
      schema: { tags: ["Secretaria - Processos"], params: gradeReviewParamsSchema, response: { 200: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try {
        const { reviewRef } = request.params as z.infer<typeof gradeReviewParamsSchema>;
        const result = await opts.application.getDataset(request.student!, "process.gradeReviews");
        const item = result.data.items.find((candidate) => candidate.reviewRef === reviewRef);
        if (!item) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "O pedido de revisão não foi encontrado.", 404);
        return reply.send({ data: item, meta: meta(request, { coverage: result.data.coverage, stale: result.stale, snapshotVersion: result.snapshotVersion, observedAt: result.data.observedAt }) });
      } catch (error) { return sendError(request, reply, error); }
    });

    const disabledReads = ["/finance/receipts", "/finance/receipts/:id/content"];
    for (const url of disabledReads) {
      protectedApp.get(url, { schema: { tags: ["Secretaria - Capabilities"], response: { ...errorResponses } } }, async (request, reply) => sendError(request, reply, new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "Esta leitura aguarda confirmação do contrato upstream.", 409)));
    }

    const disabledMutations: Array<{ method: "POST" | "PUT" | "PATCH" | "DELETE"; url: string }> = [
      { method: "DELETE", url: "/me/photo" },
      { method: "PATCH", url: "/consents/:consentId" },
      { method: "POST", url: "/exam-registrations" },
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

    protectedApp.patch("/me/contact-details", {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:contact-details`,
        },
      },
      schema: {
        tags: ["Secretaria - Perfil"],
        headers: idempotencyHeadersSchema,
        body: contactDetailsBodySchema,
        response: { 202: envelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const command = await opts.application.prepareContactDetails(
          request.student!,
          request.body as z.infer<typeof contactDetailsBodySchema>,
          String(request.headers["idempotency-key"]),
        );
        return reply.status(202).send({ data: command, meta: meta(request, { coverage: "live" }) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.put("/me/photo", {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:photo`,
        },
      },
      schema: {
        tags: ["Secretaria - Perfil"],
        headers: idempotencyHeadersSchema,
        body: photoBodySchema,
        response: { 202: envelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      let photo: Awaited<ReturnType<typeof normalizedPhoto>> | null = null;
      try {
        photo = await normalizedPhoto((request.body as z.infer<typeof photoBodySchema>).dataUrl);
        const command = await opts.application.preparePhoto(
          request.student!,
          photo,
          String(request.headers["idempotency-key"]),
        );
        return reply.status(202).send({ data: command, meta: meta(request, { coverage: "live" }) });
      } catch (error) {
        return sendError(request, reply, error);
      } finally {
        photo?.body.fill(0);
      }
    });

    protectedApp.delete("/exam-registrations/:registrationRef", {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:exam-registration-cancel`,
        },
      },
      schema: {
        tags: ["Secretaria - Processos"],
        headers: idempotencyHeadersSchema,
        params: examRegistrationParamsSchema,
        response: { 202: envelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const { registrationRef } = request.params as z.infer<typeof examRegistrationParamsSchema>;
        const command = await opts.application.prepareExamRegistrationCancellation(
          request.student!,
          registrationRef,
          String(request.headers["idempotency-key"]),
        );
        return reply.status(202).send({ data: command, meta: meta(request, { coverage: "live" }) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/grade-review-requests", {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:grade-review`,
        },
      },
      schema: {
        tags: ["Secretaria - Processos"],
        headers: idempotencyHeadersSchema,
        body: gradeReviewBodySchema,
        response: { 202: envelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const body = request.body as z.infer<typeof gradeReviewBodySchema>;
        const command = await opts.application.prepareGradeReview(
          request.student!,
          body.reviewRef,
          body.justification,
          String(request.headers["idempotency-key"]),
        );
        return reply.status(202).send({ data: command, meta: meta(request, { coverage: "live" }) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.post("/finance/payment-references", {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => `${request.ip}:${request.student?.id ?? "anonymous"}:payment-reference`,
        },
      },
      schema: {
        tags: ["Secretaria - Finanças"],
        headers: idempotencyHeadersSchema,
        body: paymentReferenceBodySchema,
        response: { 202: envelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const body = request.body as z.infer<typeof paymentReferenceBodySchema>;
        const idempotencyKey = String(request.headers["idempotency-key"]);
        const command = await opts.application.preparePaymentReference(request.student!, body.chargeRefs, idempotencyKey);
        return reply.status(202).send({ data: command, meta: meta(request, { coverage: "live" }) });
      } catch (error) { return sendError(request, reply, error); }
    });

    protectedApp.get("/commands/:commandId", {
      schema: { tags: ["Secretaria - Comandos"], params: commandParamsSchema, response: { 200: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await opts.application.getCommand(request.student!, (request.params as z.infer<typeof commandParamsSchema>).commandId), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.get("/commands/:commandId/attempts", {
      schema: { tags: ["Secretaria - Comandos"], params: commandParamsSchema, response: { 200: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await opts.application.getCommandAttempts(request.student!, (request.params as z.infer<typeof commandParamsSchema>).commandId), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.post("/commands/:commandId/confirm", {
      schema: { tags: ["Secretaria - Comandos"], params: commandParamsSchema, body: commandConfirmationBodySchema, response: { 200: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try {
        return {
          data: await opts.application.confirmCommand(
            request.student!,
            (request.params as z.infer<typeof commandParamsSchema>).commandId,
            (request.body as z.infer<typeof commandConfirmationBodySchema>).confirmation,
          ),
          meta: meta(request, { coverage: "live" }),
        };
      }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.post("/commands/:commandId/reconcile", {
      schema: { tags: ["Secretaria - Comandos"], params: commandParamsSchema, response: { 200: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await opts.application.reconcileCommand(request.student!, (request.params as z.infer<typeof commandParamsSchema>).commandId), meta: meta(request, { coverage: "live" }) }; }
      catch (error) { return sendError(request, reply, error); }
    });
    protectedApp.post("/commands/:commandId/cancel", {
      schema: { tags: ["Secretaria - Comandos"], params: commandParamsSchema, response: { 200: envelopeSchema, ...errorResponses } },
    }, async (request, reply) => {
      try { return { data: await opts.application.cancelCommand(request.student!, (request.params as z.infer<typeof commandParamsSchema>).commandId), meta: meta(request) }; }
      catch (error) { return sendError(request, reply, error); }
    });

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
