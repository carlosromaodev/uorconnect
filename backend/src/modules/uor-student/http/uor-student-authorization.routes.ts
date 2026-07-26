import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { LiveUorStudentAuthorizationApplication } from "../authorizations/authorization-service";

const idParams = z.object({ id: z.string().uuid() });
const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
const authorizationSchema = z.object({
  id: z.string().uuid(), ownerProfileId: z.string().uuid(), representativeProfileId: z.string().uuid(),
  purpose: z.string(), action: z.string(), resourceType: z.string(), resourceId: z.string(), fields: z.array(z.string()),
  status: z.enum(["pending", "active", "rejected", "revoked", "expired", "used"]),
  startsAt: z.string(), expiresAt: z.string(), maxUses: z.number().int(), usedCount: z.number().int(),
  decidedAt: z.string().nullable(), revokedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
});
const singleResponse = z.object({ data: authorizationSchema, meta: metaSchema });
const pageQuery = z.object({
  box: z.enum(["sent", "received"]).default("received"),
  status: authorizationSchema.shape.status.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid().optional(),
});
const createBody = z.object({
  representativeProfileId: z.string().uuid(),
  purpose: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/i),
  action: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/i),
  resourceType: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/i),
  resourceId: z.string().min(8).max(200),
  fields: z.array(z.string().min(2).max(80)).min(1).max(20),
  startsAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }),
  maxUses: z.number().int().min(1).max(100).default(1),
}).strict();

function meta(request: FastifyRequest) {
  return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const };
}

export async function uorStudentAuthorizationRoutes(app: FastifyInstance, options: { application: LiveUorStudentAuthorizationApplication }) {
  const service = options.application;
  app.post("/authorizations", { config: { rateLimit: { max: 15, timeWindow: 60_000 } }, schema: { tags: ["UOR Estudante - Autorizações"], body: createBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof createBody>;
    const data = await service.create({ owner: request.uorStudent!, ...body, startsAt: body.startsAt ? new Date(body.startsAt) : undefined, expiresAt: new Date(body.expiresAt), traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.get("/authorizations", { schema: { tags: ["UOR Estudante - Autorizações"], querystring: pageQuery, response: { 200: z.object({ data: z.object({ items: z.array(authorizationSchema), nextCursor: z.string().nullable() }), meta: metaSchema }) } } }, async (request) => ({
    data: await service.list({ student: request.uorStudent!, ...(request.query as z.infer<typeof pageQuery>) }), meta: meta(request),
  }));
  app.get("/authorizations/:id", { schema: { tags: ["UOR Estudante - Autorizações"], params: idParams, response: { 200: singleResponse } } }, async (request) => ({ data: await service.get(request.uorStudent!, (request.params as z.infer<typeof idParams>).id), meta: meta(request) }));
  app.post("/authorizations/:id/otp", { config: { rateLimit: { max: 5, timeWindow: 15 * 60_000 } }, schema: { tags: ["UOR Estudante - Autorizações"], params: idParams, response: { 202: z.object({ data: z.object({ challengeId: z.string().uuid(), expiresAt: z.string(), attemptsRemaining: z.number().int(), resendsRemaining: z.number().int() }), meta: metaSchema }) } } }, async (request, reply) => {
    const data = await service.requestOtp({ student: request.uorStudent!, authorizationId: (request.params as z.infer<typeof idParams>).id, traceId: request.id });
    return reply.status(202).send({ data, meta: meta(request) });
  });
  app.post("/authorizations/:id/decision", { config: { rateLimit: { max: 10, timeWindow: 15 * 60_000 } }, schema: { tags: ["UOR Estudante - Autorizações"], params: idParams, body: z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/), decision: z.enum(["approve", "reject"]) }).strict(), response: { 200: singleResponse } } }, async (request) => ({
    data: await service.decide({ student: request.uorStudent!, authorizationId: (request.params as z.infer<typeof idParams>).id, ...(request.body as { challengeId: string; code: string; decision: "approve" | "reject" }), traceId: request.id }), meta: meta(request),
  }));
  app.delete("/authorizations/:id", { schema: { tags: ["UOR Estudante - Autorizações"], params: idParams, response: { 200: singleResponse } } }, async (request) => ({ data: await service.revoke({ student: request.uorStudent!, authorizationId: (request.params as z.infer<typeof idParams>).id, traceId: request.id }), meta: meta(request) }));
  app.post("/authorizations/:id/use", { schema: { tags: ["UOR Estudante - Autorizações"], params: idParams, body: createBody.pick({ purpose: true, action: true, resourceType: true, resourceId: true, fields: true }), response: { 200: singleResponse } } }, async (request) => ({
    data: await service.consume({ student: request.uorStudent!, authorizationId: (request.params as z.infer<typeof idParams>).id, ...(request.body as { purpose: string; action: string; resourceType: string; resourceId: string; fields: string[] }), traceId: request.id }), meta: meta(request),
  }));

  const financeShareBody = z.object({ representativeProfileId: z.string().uuid(), referenceId: z.string().regex(/^usi_[A-Za-z0-9_-]{43}$|^scr_[A-Za-z0-9_-]{43}$/), expiresAt: z.string().datetime({ offset: true }) }).strict();
  app.post("/finance/reference-shares", { schema: { tags: ["UOR Estudante - Finanças"], body: financeShareBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof financeShareBody>;
    const data = await service.create({ owner: request.uorStudent!, representativeProfileId: body.representativeProfileId, purpose: "finance_reference_sharing", action: "finance.reference.view", resourceType: "payment_reference", resourceId: body.referenceId, fields: ["reference.entity", "reference.number", "reference.amount", "reference.currency", "reference.expires_at", "reference.status"], expiresAt: new Date(body.expiresAt), maxUses: 10, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.post("/finance/responsibles", { schema: { tags: ["UOR Estudante - Finanças"], body: z.object({ representativeProfileId: z.string().uuid(), purpose: z.enum(["tuition_reference", "appeal_reference", "exam_reference"]), expiresAt: z.string().datetime({ offset: true }) }).strict(), response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as { representativeProfileId: string; purpose: string; expiresAt: string };
    const data = await service.create({ owner: request.uorStudent!, representativeProfileId: body.representativeProfileId, purpose: `finance_responsible.${body.purpose}`, action: "finance.reference.receive", resourceType: "finance_purpose", resourceId: body.purpose, fields: ["reference.entity", "reference.number", "reference.amount", "reference.currency", "reference.expires_at", "reference.status"], expiresAt: new Date(body.expiresAt), maxUses: 100, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });

  const notificationSchema = z.object({ id: z.string().uuid(), category: z.string(), title: z.string(), body: z.string(), status: z.enum(["unread", "read"]), payload: z.record(z.string(), z.unknown()).nullable(), readAt: z.string().nullable(), createdAt: z.string() });
  app.get("/notifications", { schema: { tags: ["UOR Estudante - Notificações"], querystring: z.object({ status: z.enum(["unread", "read"]).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().uuid().optional() }), response: { 200: z.object({ data: z.object({ items: z.array(notificationSchema), nextCursor: z.string().nullable() }), meta: metaSchema }) } } }, async (request) => ({ data: await service.listNotifications({ student: request.uorStudent!, ...(request.query as { status?: "unread" | "read"; limit: number; cursor?: string }) }), meta: meta(request) }));
  app.post("/notifications/:id/read", { schema: { tags: ["UOR Estudante - Notificações"], params: idParams, response: { 200: z.object({ data: z.object({ id: z.string().uuid(), status: z.literal("read"), readAt: z.string() }), meta: metaSchema }) } } }, async (request) => ({ data: await service.markNotificationRead({ student: request.uorStudent!, id: (request.params as z.infer<typeof idParams>).id }), meta: meta(request) }));
}
