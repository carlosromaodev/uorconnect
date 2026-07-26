import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import type { UorStudentAdminApplication } from "../admin/admin-service";
import { UorStudentError } from "../domain/errors";

const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
function meta(request: FastifyRequest) { return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const }; }

export async function uorStudentAdminRoutes(app: FastifyInstance, options: { application: UorStudentAdminApplication }) {
  app.register(adminGuard);
  setDefaultAdminPermission(app, ["UOR_STUDENT"]);
  app.addHook("preHandler", async (request) => {
    const route = request.routeOptions.url ?? request.url;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !route.endsWith("/mfa") && !route.endsWith("/mfa/verify")) {
      const token = String(request.headers["x-uor-student-mfa"] ?? "");
      if (!options.application.verifyMfaToken(request.uorStudent!, token)) throw new UorStudentError("UOR_STUDENT_ADMIN_MFA_REQUIRED", "Confirma uma sessão MFA recente para esta operação administrativa.", 403);
    }
  });
  app.post("/admin/mfa", { schema: { tags: ["UOR Estudante - Administração"], response: { 202: z.object({ data: z.object({ accepted: z.literal(true), expiresAt: z.string() }), meta: metaSchema }) } } }, async (request, reply) => reply.status(202).send({ data: await options.application.requestMfa(request.uorStudent!), meta: meta(request) }));
  app.post("/admin/mfa/verify", { schema: { tags: ["UOR Estudante - Administração"], body: z.object({ code: z.string().regex(/^\d{6}$/) }).strict(), response: { 200: z.object({ data: z.object({ token: z.string(), expiresAt: z.string() }), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.verifyMfa(request.uorStudent!, (request.body as { code: string }).code), meta: meta(request) }));
  const configSchema = z.object({ id: z.string().uuid(), key: z.string(), version: z.number().int(), value: z.record(z.string(), z.unknown()), status: z.string(), effectiveFrom: z.string(), effectiveUntil: z.string().nullable(), createdAt: z.string() });
  app.get("/admin/configurations", { schema: { tags: ["UOR Estudante - Administração"], response: { 200: z.object({ data: z.array(configSchema), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.listConfigurations(request.uorStudent!), meta: meta(request) }));
  app.get("/admin/read-models/direction/academic-context", {
    preHandler: async (request) => {
      const token = String(request.headers["x-uor-student-mfa"] ?? "");
      if (!options.application.verifyMfaToken(request.uorStudent!, token)) throw new UorStudentError("UOR_STUDENT_ADMIN_MFA_REQUIRED", "Confirma uma sessão MFA recente para publicar o read model.", 403);
    },
    schema: {
      tags: ["UOR Estudante - Administração"],
      querystring: z.object({ period: z.string().trim().min(1).max(80).optional() }),
      response: {
        200: z.object({
          data: z.object({
            id: z.literal("uor_student.direction.academic_context.v1"),
            version: z.literal(1),
            producer: z.literal("uor_student"),
            authorizedConsumer: z.literal("uor_direction"),
            purpose: z.literal("institutional_academic_planning"),
            institutionCode: z.string(),
            period: z.string().nullable(),
            minimumSample: z.number().int(),
            buckets: z.array(z.object({ course: z.string(), academicYear: z.string().nullable(), academicPeriod: z.string().nullable(), students: z.number().int() })),
            suppressedBuckets: z.number().int(),
            generatedAt: z.string(),
          }),
          meta: metaSchema,
        }),
      },
    },
  }, async (request) => ({
    data: await options.application.directionAcademicContextReadModel(request.uorStudent!, (request.query as { period?: string }).period),
    meta: meta(request),
  }));
  app.put("/admin/configurations/:key", { schema: { tags: ["UOR Estudante - Administração"], params: z.object({ key: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/) }), body: z.object({ value: z.record(z.string(), z.unknown()), effectiveFrom: z.string().datetime({ offset: true }) }).strict(), response: { 201: z.object({ data: configSchema, meta: metaSchema }) } } }, async (request, reply) => {
    const body = request.body as { value: Record<string, unknown>; effectiveFrom: string };
    const data = await options.application.setConfiguration({ student: request.uorStudent!, key: (request.params as { key: string }).key, value: body.value, effectiveFrom: new Date(body.effectiveFrom), traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.patch("/admin/student-identities/:profileId/student-number", {
    schema: {
      tags: ["UOR Estudante - Administração"],
      params: z.object({ profileId: z.string().uuid() }),
      body: z.object({
        studentNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{3,39}$/),
        reason: z.string().trim().min(10).max(1_000),
      }).strict(),
      response: {
        200: z.object({
          data: z.object({
            profileId: z.string().uuid(),
            previousStudentNumber: z.string(),
            studentNumber: z.string(),
            relationshipsPreserved: z.literal(true),
          }),
          meta: metaSchema,
        }),
      },
    },
  }, async (request) => {
    const body = request.body as { studentNumber: string; reason: string };
    return {
      data: await options.application.correctStudentNumber({
        student: request.uorStudent!,
        profileId: (request.params as { profileId: string }).profileId,
        newStudentNumber: body.studentNumber,
        reason: body.reason,
        traceId: request.id,
      }),
      meta: meta(request),
    };
  });
  app.get("/admin/moderation", { schema: { tags: ["UOR Estudante - Administração"], querystring: z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }), response: { 200: z.object({ data: z.array(z.object({ id: z.string().uuid(), category: z.string(), targetId: z.string(), reason: z.string().nullable(), details: z.string().nullable(), createdAt: z.string() })), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.moderationQueue(request.uorStudent!, (request.query as { limit: number }).limit), meta: meta(request) }));
  app.post("/admin/moderation/:id/decision", { schema: { tags: ["UOR Estudante - Administração"], params: z.object({ id: z.string().uuid() }), body: z.object({ decision: z.enum(["dismiss", "remove_content"]), rationale: z.string().trim().min(5).max(2_000) }).strict(), response: { 200: z.object({ data: z.object({ reportId: z.string().uuid(), targetId: z.string().uuid().nullable(), decision: z.enum(["dismiss", "remove_content"]), targetStatus: z.string().nullable(), resolvedAt: z.string() }), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.moderate({ student: request.uorStudent!, reportId: (request.params as { id: string }).id, ...(request.body as { decision: "dismiss" | "remove_content"; rationale: string }), traceId: request.id }), meta: meta(request) }));
  const alertSchema = z.object({ id: z.string().uuid(), provider: z.string(), domain: z.string(), code: z.string(), severity: z.string(), status: z.string(), occurrences: z.number().int(), firstDetectedAt: z.string(), lastDetectedAt: z.string(), resolvedAt: z.string().nullable(), resolution: z.string().nullable() });
  app.get("/admin/operational-alerts", { schema: { tags: ["UOR Estudante - Administração"], querystring: z.object({ status: z.enum(["open", "resolved"]).optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }), response: { 200: z.object({ data: z.array(alertSchema), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.listOperationalAlerts(request.uorStudent!, request.query as { status?: "open" | "resolved"; limit: number }), meta: meta(request) }));
  app.post("/admin/operational-alerts/:id/resolve", { schema: { tags: ["UOR Estudante - Administração"], params: z.object({ id: z.string().uuid() }), body: z.object({ resolution: z.string().trim().min(10).max(2_000) }).strict(), response: { 200: z.object({ data: z.object({ id: z.string().uuid(), status: z.literal("resolved"), resolvedAt: z.string(), resolution: z.string() }), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.resolveOperationalAlert({ student: request.uorStudent!, id: (request.params as { id: string }).id, resolution: (request.body as { resolution: string }).resolution, traceId: request.id }), meta: meta(request) }));
}
