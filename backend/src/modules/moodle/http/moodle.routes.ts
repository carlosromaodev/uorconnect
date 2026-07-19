import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import type { Env } from "../../../config/env";
import { getCookie } from "../../../shared/cookies";
import { authGuard } from "../../auth/http/auth.middleware";
import { verifyAuthToken } from "../../auth/utils/jwt";
import type { MoodleApplication, MoodleStudentIdentity } from "../application/ports";
import { isMoodleError, MoodleError } from "../domain/errors";
import {
  courseEnvelopeSchema,
  courseListEnvelopeSchema,
  createMoodleSessionBodySchema,
  materialListEnvelopeSchema,
  moodleErrorSchema,
  moodleListQuerySchema,
  overviewEnvelopeSchema,
  profileEnvelopeSchema,
  responseMetaSchema,
  sectionListEnvelopeSchema,
  sessionEnvelopeSchema,
  syncEnvelopeSchema,
} from "./moodle.schemas";
import { z } from "zod";

const courseIdParamsSchema = z.object({ courseId: z.string().uuid() });
const materialIdParamsSchema = z.object({ materialId: z.string().uuid() });

function privateRateLimitKey(env: Env, request: FastifyRequest): string {
  const bearer = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice("Bearer ".length)
    : null;
  const token = bearer || getCookie(request, "uor_auth");
  if (token) {
    try {
      const identity = verifyAuthToken(token, env);
      return `${request.ip}:${identity.role}:${identity.sub}`;
    } catch {
      // Invalid tokens are still grouped without retaining/logging their value.
      const digest = createHash("sha256").update(token).digest("base64url").slice(0, 16);
      return `${request.ip}:invalid:${digest}`;
    }
  }
  return `${request.ip}:anonymous`;
}

const errorResponses = {
  400: moodleErrorSchema,
  401: moodleErrorSchema,
  403: moodleErrorSchema,
  404: moodleErrorSchema,
  409: moodleErrorSchema,
  415: moodleErrorSchema,
  422: moodleErrorSchema,
  429: moodleErrorSchema,
  500: moodleErrorSchema,
  502: moodleErrorSchema,
  503: moodleErrorSchema,
};

export type MoodleRoutesOptions = {
  env: Env;
  application: MoodleApplication;
  findEligibleStudent?: (studentId: number) => Promise<MoodleStudentIdentity | null>;
};

function errorEnvelope(request: FastifyRequest, error: MoodleError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      actionRequired: error.actionRequired,
    },
    meta: { requestId: request.id },
  };
}

function authErrorEnvelope(input: { request: FastifyRequest; statusCode: 401 | 403; message: string }) {
  return errorEnvelope(input.request, new MoodleError(
    input.statusCode === 401 ? "UOR_AUTH_REQUIRED" : "UOR_CSRF_INVALID",
    input.statusCode === 401 ? "Sessão UOR Connect inválida ou expirada." : input.message,
    input.statusCode,
    false,
    "none",
  ));
}

async function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (isMoodleError(error)) {
    if (error.statusCode >= 500) request.log.error({ err: error, moodleCode: error.code }, error.message);
    else request.log.warn({ moodleCode: error.code }, error.message);
    if (error.statusCode === 429 && !reply.hasHeader("Retry-After")) reply.header("Retry-After", "60");
    if (error.statusCode === 503 && error.retryable && !reply.hasHeader("Retry-After")) {
      reply.header("Retry-After", "5");
    }
    return reply.code(error.statusCode).send(errorEnvelope(request, error));
  }

  request.log.error({ err: error }, "Falha interna na integração Moodle");
  const safe = new MoodleError(
    "MOODLE_UNAVAILABLE",
    "Não foi possível concluir o pedido Moodle agora.",
    500,
    true,
  );
  return reply.code(500).send(errorEnvelope(request, safe));
}

function setPrivateResponse(reply: FastifyReply) {
  reply.header("Cache-Control", "private, no-store");
  reply.header("Pragma", "no-cache");
}

function attachmentDisposition(fileName: string): string {
  const fallback = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/["\\\r\n]/g, "_")
    .trim()
    .slice(0, 120) || "material";
  const encoded = encodeURIComponent(fileName.slice(0, 240))
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function meta(request: FastifyRequest, input: {
  syncedAt?: Date | null;
  stale?: boolean;
  snapshotVersion?: number | null;
  pagination?: unknown;
  coverage?: unknown;
} = {}) {
  return {
    requestId: request.id,
    syncedAt: input.syncedAt?.toISOString() ?? null,
    stale: input.stale ?? false,
    ...(input.snapshotVersion !== undefined ? { snapshotVersion: input.snapshotVersion } : {}),
    ...(input.pagination ? { pagination: input.pagination } : {}),
    ...(input.coverage ? { coverage: input.coverage } : {}),
  };
}

async function defaultFindEligibleStudent(studentId: number): Promise<MoodleStudentIdentity | null> {
  const { prisma } = await import("../../../shared/prisma.js");
  return prisma.student.findFirst({
    where: {
      id: studentId,
      deletedAt: null,
      institutionCode: "UOR",
      isUorStudent: true,
    },
    select: { id: true, studentNumber: true },
  });
}

export async function moodleRoutes(app: FastifyInstance, opts: MoodleRoutesOptions) {
  const findEligibleStudent = opts.findEligibleStudent ?? defaultFindEligibleStudent;

  app.addHook("onReady", async () => {
    await opts.application.start?.();
  });
  app.addHook("onClose", async () => {
    await opts.application.stop?.();
  });

  app.register(async (protectedApp) => {
    protectedApp.setErrorHandler(async (error, request, reply) => {
      const fastifyError = error as {
        code?: string;
        statusCode?: number;
        validation?: unknown;
        validationContext?: unknown;
      };
      const validationContext = String(fastifyError.validationContext ?? "");
      if (fastifyError.validation) {
        const isBody = validationContext === "body";
        return sendError(request, reply, new MoodleError(
          "MOODLE_REQUEST_INVALID",
          isBody
            ? "Os dados enviados para a integração Moodle são inválidos."
            : "Os parâmetros do pedido Moodle são inválidos.",
          isBody ? 422 : 400,
        ));
      }
      if (fastifyError.code === "FST_ERR_CTP_INVALID_JSON_BODY") {
        return sendError(request, reply, new MoodleError(
          "MOODLE_REQUEST_INVALID",
          "O corpo JSON enviado é inválido.",
          400,
        ));
      }
      if (fastifyError.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
        return sendError(request, reply, new MoodleError(
          "MOODLE_MEDIA_TYPE_UNSUPPORTED",
          "Este endpoint aceita apenas application/json.",
          415,
        ));
      }
      if (fastifyError.statusCode === 429) {
        return sendError(request, reply, new MoodleError(
          "MOODLE_RATE_LIMITED",
          "Foram feitos demasiados pedidos Moodle. Tenta novamente mais tarde.",
          429,
          true,
        ));
      }
      return sendError(request, reply, error);
    });

    protectedApp.register(authGuard, {
      env: opts.env,
      formatError: authErrorEnvelope,
    });

    protectedApp.addHook("preHandler", async (request, reply) => {
      if (!request.student) {
        return reply.code(403).send(errorEnvelope(request, new MoodleError(
          "MOODLE_STUDENT_NOT_ELIGIBLE",
          "Esta integração está disponível apenas para estudantes UOR ativos.",
          403,
        )));
      }

      const student = await findEligibleStudent(request.student.id);
      if (!student) {
        return reply.code(403).send(errorEnvelope(request, new MoodleError(
          "MOODLE_STUDENT_NOT_ELIGIBLE",
          "Esta integração está disponível apenas para estudantes UOR ativos.",
          403,
        )));
      }

      request.student = student;
    });

    protectedApp.addHook("onSend", async (_request, reply) => {
      setPrivateResponse(reply);
    });

    protectedApp.post("/session", {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 15 * 60_000,
          keyGenerator: (request: FastifyRequest) => privateRateLimitKey(opts.env, request),
        },
      },
      schema: {
        tags: ["Moodle - Sessão"],
        body: createMoodleSessionBodySchema,
        response: { 200: sessionEnvelopeSchema, 201: sessionEnvelopeSchema, ...errorResponses },
      },
      preValidation: async (request) => {
        const mediaType = String(request.headers["content-type"] ?? "")
          .split(";", 1)[0]
          .trim()
          .toLowerCase();
        if (mediaType !== "application/json") {
          throw new MoodleError(
            "MOODLE_MEDIA_TYPE_UNSUPPORTED",
            "Este endpoint aceita apenas application/json.",
            415,
          );
        }
      },
    }, async (request, reply) => {
      try {
        const result = await opts.application.connect(request.student!, request.body as z.infer<typeof createMoodleSessionBodySchema>);
        return reply.code(result.created ? 201 : 200).send({
          data: { connection: result.connection, initialSyncRunId: result.initialSyncRunId },
          meta: meta(request),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.delete("/session", {
      config: { rateLimit: { max: 20, timeWindow: 15 * 60_000 } },
      schema: {
        tags: ["Moodle - Sessão"],
        response: { 200: sessionEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const connection = await opts.application.disconnect(request.student!);
        return reply.send({ data: { connection, initialSyncRunId: null }, meta: meta(request) });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/me", {
      schema: {
        tags: ["Moodle - Perfil"],
        response: { 200: profileEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const profile = await opts.application.getProfile(request.student!);
        return reply.send({ data: profile, meta: meta(request, { syncedAt: new Date(profile.lastSyncedAt) }) });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/overview", {
      schema: {
        tags: ["Moodle - Visão geral"],
        response: { 200: overviewEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const result = await opts.application.getOverview(request.student!);
        return reply.send({
          data: result.data,
          meta: meta(request, result),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/courses", {
      schema: {
        tags: ["Moodle - Disciplinas"],
        querystring: moodleListQuerySchema,
        response: { 200: courseListEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const result = await opts.application.listCourses(request.student!, request.query as z.infer<typeof moodleListQuerySchema>);
        return reply.send({
          data: result.items,
          meta: meta(request, { ...result, coverage: result.coverage, pagination: result.pagination }),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/courses/:courseId", {
      schema: {
        tags: ["Moodle - Disciplinas"],
        params: courseIdParamsSchema,
        response: { 200: courseEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const { courseId } = request.params as z.infer<typeof courseIdParamsSchema>;
        const result = await opts.application.getCourse(request.student!, courseId);
        return reply.send({ data: result.data, meta: meta(request, result) });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/courses/:courseId/sections", {
      schema: {
        tags: ["Moodle - Conteúdo"],
        params: courseIdParamsSchema,
        querystring: moodleListQuerySchema,
        response: { 200: sectionListEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const { courseId } = request.params as z.infer<typeof courseIdParamsSchema>;
        const result = await opts.application.listSections(request.student!, courseId, request.query as z.infer<typeof moodleListQuerySchema>);
        return reply.send({
          data: result.items,
          meta: meta(request, { ...result, coverage: result.coverage, pagination: result.pagination }),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/courses/:courseId/materials", {
      schema: {
        tags: ["Moodle - Conteúdo"],
        params: courseIdParamsSchema,
        querystring: moodleListQuerySchema,
        response: { 200: materialListEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const { courseId } = request.params as z.infer<typeof courseIdParamsSchema>;
        const result = await opts.application.listMaterials(request.student!, courseId, request.query as z.infer<typeof moodleListQuerySchema>);
        return reply.send({
          data: result.items,
          meta: meta(request, { ...result, coverage: result.coverage, pagination: result.pagination }),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/materials", {
      schema: {
        tags: ["Moodle - Materiais"],
        querystring: moodleListQuerySchema,
        response: { 200: materialListEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const result = await opts.application.listMaterials(request.student!, null, request.query as z.infer<typeof moodleListQuerySchema>);
        return reply.send({
          data: result.items,
          meta: meta(request, { ...result, coverage: result.coverage, pagination: result.pagination }),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/materials/:materialId/open", {
      schema: {
        tags: ["Moodle - Materiais"],
        params: materialIdParamsSchema,
        response: { ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const { materialId } = request.params as z.infer<typeof materialIdParamsSchema>;
        const download = await opts.application.openMaterial(request.student!, materialId, request.headers.range);
        reply.header("Content-Type", download.contentType);
        reply.header("Content-Disposition", attachmentDisposition(download.fileName));
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("Content-Security-Policy", "sandbox; default-src 'none'");
        if (download.acceptRanges) reply.header("Accept-Ranges", "bytes");
        if (download.contentRange) reply.header("Content-Range", download.contentRange);
        if (download.contentLength !== null) reply.header("Content-Length", String(download.contentLength));
        return reply.code(download.status).send(download.stream);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.post("/sync", {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: 10 * 60_000,
          keyGenerator: (request: FastifyRequest) => privateRateLimitKey(opts.env, request),
        },
      },
      schema: {
        tags: ["Moodle - Sincronização"],
        response: { 202: syncEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const run = await opts.application.startSync(request.student!, "manual");
        return reply.code(202).send({ data: run, meta: meta(request) });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    protectedApp.get("/sync/status", {
      schema: {
        tags: ["Moodle - Sincronização"],
        response: { 200: syncEnvelopeSchema, ...errorResponses },
      },
    }, async (request, reply) => {
      try {
        const run = await opts.application.getSyncStatus(request.student!);
        return reply.send({
          data: run,
          meta: meta(request, { syncedAt: run?.completedAt ? new Date(run.completedAt) : null }),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  });
}
