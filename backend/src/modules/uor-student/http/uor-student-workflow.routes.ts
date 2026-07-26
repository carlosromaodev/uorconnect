import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { UorStudentWorkflowApplication } from "../workflows/workflow-service";
import { UorStudentError } from "../domain/errors";

const idParams = z.object({ id: z.string().uuid() });
const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().uuid().optional() });
const workflowSchema = z.object({
  id: z.string().uuid(),
  category: z.string(),
  ownerProfileId: z.string().uuid(),
  scopeKey: z.string(),
  status: z.string(),
  payload: z.record(z.string(), z.unknown()),
  version: z.number().int(),
  expiresAt: z.string().nullable(),
  actors: z.array(z.object({
    profileId: z.string().uuid(), role: z.string(), status: z.string(), payload: z.record(z.string(), z.unknown()).nullable(), decidedAt: z.string().nullable(),
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
const singleResponse = z.object({ data: workflowSchema, meta: metaSchema });
const listResponse = z.object({ data: z.object({ items: z.array(workflowSchema), nextCursor: z.string().nullable() }), meta: metaSchema });
const communityReportSchema = z.object({
  id: z.string().uuid(), scopeKey: z.string(), status: z.string(), payload: z.record(z.string(), z.unknown()), expiresAt: z.string().nullable(), confirmations: z.number().int(), contests: z.number().int(), createdAt: z.string(), updatedAt: z.string(), source: z.literal("community"), official: z.literal(false),
});

function meta(request: FastifyRequest) {
  return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const };
}

function page(request: FastifyRequest) {
  return request.query as z.infer<typeof pageQuery>;
}

function communityView(item: Awaited<ReturnType<UorStudentWorkflowApplication["get"]>>) {
  return {
    id: item.id,
    scopeKey: item.scopeKey,
    status: item.status,
    payload: item.payload,
    expiresAt: item.expiresAt,
    confirmations: item.actors.filter((actor) => actor.role === "reviewer" && actor.status === "confirmed").length,
    contests: item.actors.filter((actor) => actor.role === "reviewer" && actor.status === "contested").length,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    source: "community" as const,
    official: false as const,
  };
}

const eventBody = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  reminderMinutes: z.number().int().min(0).max(43_200).optional(),
}).strict().refine((body) => new Date(body.startsAt) < new Date(body.endsAt), { message: "O fim deve ser posterior ao início." });

const communityBody = z.object({
  subjectKey: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(80),
  kind: z.enum(["schedule_change", "class_cancelled", "room_change", "teacher_change"]),
  description: z.string().trim().min(3).max(1_000),
  startsAt: z.string().datetime({ offset: true }).optional(),
  expiresAt: z.string().datetime({ offset: true }),
}).strict().refine((body) => {
  const expiry = new Date(body.expiresAt).getTime();
  return expiry > Date.now() && expiry <= Date.now() + 7 * 24 * 60 * 60_000;
}, { message: "A validade comunitária deve estar entre agora e sete dias." });

const evaluationBody = z.object({
  teacherKey: z.string().trim().min(1).max(120),
  subjectKey: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(80),
  score: z.number().min(1).max(5),
  dimensions: z.record(z.string().min(1).max(60), z.number().min(1).max(5)).refine((value) => Object.keys(value).length <= 12),
  comment: z.string().trim().max(1_000).optional(),
}).strict();

const tutorProfileBody = z.object({
  subjectKeys: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  availability: z.array(z.object({ day: z.number().int().min(0).max(6), startsAt: z.string().regex(/^\d{2}:\d{2}$/), endsAt: z.string().regex(/^\d{2}:\d{2}$/) })).max(30),
  mode: z.enum(["online", "in_person", "hybrid"]),
  description: z.string().trim().max(1_000).optional(),
}).strict();

const tutoringRequestBody = z.object({
  tutorProfileId: z.string().uuid(),
  tutorProfileOwnerId: z.string().uuid(),
  subjectKey: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(80),
  message: z.string().trim().max(1_000).optional(),
}).strict();

const grantBody = z.object({
  relationshipId: z.string().uuid(),
  tutorProfileId: z.string().uuid(),
  tutorProfileOwnerId: z.string().uuid(),
  subjectKey: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(80),
  fields: z.array(z.enum(["academic.grades", "academic.attendance", "academic.schedule", "study_plan.tasks", "study_plan.sessions"])).min(1).max(5),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

const appealBody = z.object({
  subjectKey: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(80),
  assessmentKey: z.string().trim().min(1).max(120),
  kind: z.enum(["exam_copy", "grade_review", "reassessment"]),
  grounds: z.string().trim().min(10).max(4_000),
}).strict();

const collectiveBody = z.object({
  subjectKey: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(80),
  title: z.string().trim().min(3).max(160),
  content: z.string().trim().min(10).max(5_000),
}).strict();

const listingBody = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(3).max(2_000),
  category: z.enum(["book", "notes", "equipment", "other"]),
  course: z.string().trim().max(160).optional(),
  price: z.number().min(0).max(100_000_000),
  currency: z.literal("AOA").default("AOA"),
  contact: z.string().trim().min(5).max(160),
  expiresAt: z.string().datetime({ offset: true }),
}).strict();

export async function uorStudentWorkflowRoutes(app: FastifyInstance, options: { application: UorStudentWorkflowApplication }) {
  const service = options.application;

  app.get("/personal-events", { schema: { tags: ["UOR Estudante - Agenda"], querystring: pageQuery, response: { 200: listResponse } } }, async (request) => ({
    data: await service.list({ student: request.uorStudent!, category: "personal_event", access: "owner", statuses: ["scheduled"], ...page(request) }), meta: meta(request),
  }));
  app.post("/personal-events", { config: { rateLimit: { max: 30, timeWindow: 60_000 } }, schema: { tags: ["UOR Estudante - Agenda"], body: eventBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof eventBody>;
    const data = await service.create({ owner: request.uorStudent!, category: "personal_event", scopeKey: body.startsAt, status: "scheduled", payload: body, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.delete("/personal-events/:id", { schema: { tags: ["UOR Estudante - Agenda"], params: idParams, response: { 200: singleResponse } } }, async (request) => ({
    data: await service.transition({ student: request.uorStudent!, id: (request.params as z.infer<typeof idParams>).id, category: "personal_event", from: ["scheduled"], to: "cancelled", traceId: request.id }), meta: meta(request),
  }));
  app.get("/personal-events/conflicts", { schema: { tags: ["UOR Estudante - Agenda"], response: { 200: z.object({ data: z.object({ status: z.literal("advisory"), method: z.string(), conflicts: z.array(z.object({ leftId: z.string().uuid(), rightId: z.string().uuid(), startsAt: z.string(), endsAt: z.string() })) }), meta: metaSchema }) } } }, async (request) => ({
    data: { status: "advisory" as const, method: "interval_overlap_v1", conflicts: await service.findPersonalConflicts(request.uorStudent!) }, meta: meta(request),
  }));

  app.get("/alert-preferences", { schema: { tags: ["UOR Estudante - Notificações"], querystring: pageQuery, response: { 200: listResponse } } }, async (request) => ({ data: await service.list({ student: request.uorStudent!, category: "alert_preference", access: "owner", ...page(request) }), meta: meta(request) }));
  app.put("/alert-preferences", { schema: { tags: ["UOR Estudante - Notificações"], body: z.object({ event: z.enum(["grade_changed", "schedule_changed", "exam_changed", "payment_changed", "provider_degraded"]), enabled: z.boolean(), channels: z.array(z.enum(["in_app", "sms", "whatsapp"])).min(1).max(3) }).strict(), response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as { event: string; enabled: boolean; channels: string[] };
    const data = await service.setAlertPreference({ student: request.uorStudent!, ...body, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });

  app.get("/community/reports", { schema: { tags: ["UOR Estudante - Comunidade"], querystring: pageQuery, response: { 200: z.object({ data: z.object({ items: z.array(communityReportSchema), nextCursor: z.string().nullable() }), meta: metaSchema }) } } }, async (request) => {
    const result = await service.list({ student: request.uorStudent!, category: "community_report", access: "public_institution", statuses: ["reported", "confirmed", "contested"], ...page(request) });
    return { data: { ...result, items: result.items.map(communityView) }, meta: meta(request) };
  });
  app.post("/community/reports", { schema: { tags: ["UOR Estudante - Comunidade"], body: communityBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof communityBody>;
    const data = await service.create({ owner: request.uorStudent!, category: "community_report", scopeKey: `${body.subjectKey}:${body.period}`, status: "reported", payload: body, expiresAt: new Date(body.expiresAt), traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.post("/community/reports/:id/responses", { schema: { tags: ["UOR Estudante - Comunidade"], params: idParams, body: z.object({ decision: z.enum(["confirmed", "contested"]) }).strict(), response: { 200: z.object({ data: communityReportSchema, meta: metaSchema }) } } }, async (request) => ({
    data: communityView(await service.reactPublic({ student: request.uorStudent!, aggregateId: (request.params as z.infer<typeof idParams>).id, category: "community_report", role: "reviewer", status: (request.body as { decision: string }).decision, allowedAggregateStatuses: ["reported", "confirmed", "contested"], traceId: request.id })), meta: meta(request),
  }));

  app.post("/teaching/evaluations", { schema: { tags: ["UOR Estudante - Docentes"], body: evaluationBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const data = await service.createTeachingEvaluation({ student: request.uorStudent!, ...(request.body as z.infer<typeof evaluationBody>), traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.get("/teaching/reports", { schema: { tags: ["UOR Estudante - Docentes"], querystring: z.object({ scopeKey: z.string().min(3).max(360) }), response: { 200: z.object({ data: z.object({ status: z.enum(["available", "insufficient_sample"]), sampleSize: z.number().int(), minimumSample: z.number().int(), average: z.string().nullable(), dimensions: z.record(z.string(), z.string()), scopeKey: z.string() }), meta: metaSchema }) } } }, async (request) => ({
    data: await service.aggregateTeachingEvaluations(request.uorStudent!, (request.query as { scopeKey: string }).scopeKey), meta: meta(request),
  }));
  app.post("/teaching/evaluations/:id/reports", { schema: { tags: ["UOR Estudante - Docentes"], params: idParams, body: z.object({ reason: z.enum(["abuse", "harassment", "personal_data", "spam", "other"]), details: z.string().trim().max(1_000).optional() }).strict(), response: { 201: singleResponse } } }, async (request, reply) => {
    const evaluationId = (request.params as z.infer<typeof idParams>).id;
    await service.getPublic(request.uorStudent!, evaluationId, "teaching_evaluation", ["published"]);
    const data = await service.create({ owner: request.uorStudent!, category: "teaching_report", scopeKey: evaluationId, status: "pending_moderation", payload: { evaluationId, ...(request.body as object) }, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });

  app.post("/tutors/profiles", { schema: { tags: ["UOR Estudante - Explicadores"], body: tutorProfileBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof tutorProfileBody>;
    const data = await service.create({ owner: request.uorStudent!, category: "tutor_profile", scopeKey: body.subjectKeys.slice().sort().join(","), status: "active", payload: body, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.get("/tutors", { schema: { tags: ["UOR Estudante - Explicadores"], querystring: pageQuery.extend({ subjectKey: z.string().trim().min(1).max(120).optional() }), response: { 200: listResponse } } }, async (request) => {
    const query = request.query as z.infer<typeof pageQuery> & { subjectKey?: string };
    const result = await service.list({ student: request.uorStudent!, category: "tutor_profile", access: "public_institution", statuses: ["active"], limit: query.limit, cursor: query.cursor });
    return { data: query.subjectKey ? { ...result, items: result.items.filter((item) => Array.isArray(item.payload.subjectKeys) && item.payload.subjectKeys.includes(query.subjectKey)) } : result, meta: meta(request) };
  });
  app.post("/tutoring/requests", { schema: { tags: ["UOR Estudante - Explicadores"], body: tutoringRequestBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof tutoringRequestBody>;
    const tutorProfile = await service.getPublic(request.uorStudent!, body.tutorProfileId, "tutor_profile", ["active"]);
    if (tutorProfile.ownerProfileId !== body.tutorProfileOwnerId) throw new UorStudentError("UOR_STUDENT_TUTOR_NOT_AVAILABLE", "O perfil de explicador não está disponível.", 404);
    const created = await service.create({ owner: request.uorStudent!, category: "tutoring_request", scopeKey: `${body.subjectKey}:${body.period}`, status: "pending", payload: body, traceId: request.id });
    const data = await service.addActor({ owner: request.uorStudent!, aggregateId: created.id, category: "tutoring_request", profileId: body.tutorProfileOwnerId, role: "tutor", status: "invited", traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.post("/tutoring/requests/:id/decision", { schema: { tags: ["UOR Estudante - Explicadores"], params: idParams, body: z.object({ decision: z.enum(["accepted", "rejected"]) }).strict(), response: { 200: singleResponse } } }, async (request) => ({
    data: await service.decideActor({ student: request.uorStudent!, aggregateId: (request.params as z.infer<typeof idParams>).id, category: "tutoring_request", role: "tutor", from: ["invited"], to: (request.body as { decision: string }).decision, aggregateStatuses: ["pending"], traceId: request.id }), meta: meta(request),
  }));
  app.post("/tutoring/grants", { schema: { tags: ["UOR Estudante - Explicadores"], body: grantBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof grantBody>;
    const tutorProfile = await service.getPublic(request.uorStudent!, body.tutorProfileId, "tutor_profile", ["active"]);
    if (tutorProfile.ownerProfileId !== body.tutorProfileOwnerId) throw new UorStudentError("UOR_STUDENT_TUTOR_NOT_AVAILABLE", "O perfil de explicador não está disponível.", 404);
    const relationship = await service.getOwned(request.uorStudent!, body.relationshipId, "tutoring_request", ["active"]);
    if (!relationship.actors.some((actor) => actor.profileId === body.tutorProfileOwnerId && actor.role === "tutor" && actor.status === "accepted")) throw new UorStudentError("UOR_STUDENT_TUTOR_RELATIONSHIP_INVALID", "A relação de acompanhamento não está ativa para este explicador.", 409);
    if (String(relationship.payload.subjectKey ?? "").trim().toLowerCase() !== body.subjectKey.trim().toLowerCase() || String(relationship.payload.period ?? "").trim().toLowerCase() !== body.period.trim().toLowerCase()) throw new UorStudentError("UOR_STUDENT_GRANT_SCOPE_INVALID", "O acesso deve usar a mesma cadeira e período da relação ativa.", 422);
    const created = await service.create({ owner: request.uorStudent!, category: "tutoring_grant", scopeKey: body.relationshipId, status: "active", payload: body, expiresAt: new Date(body.expiresAt), traceId: request.id });
    const data = await service.addActor({ owner: request.uorStudent!, aggregateId: created.id, category: "tutoring_grant", profileId: body.tutorProfileOwnerId, role: "tutor", status: "active", traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.delete("/tutoring/grants/:id", { schema: { tags: ["UOR Estudante - Explicadores"], params: idParams, response: { 200: singleResponse } } }, async (request) => ({
    data: await service.transition({ student: request.uorStudent!, id: (request.params as z.infer<typeof idParams>).id, category: "tutoring_grant", from: ["active"], to: "revoked", traceId: request.id }), meta: meta(request),
  }));
  app.get("/tutoring/grants/:id/data", { schema: { tags: ["UOR Estudante - Explicadores"], params: idParams, response: { 200: z.object({ data: z.object({ grantId: z.string().uuid(), subjectKey: z.string(), period: z.string(), fields: z.record(z.string(), z.unknown()), expiresAt: z.string().nullable() }), meta: metaSchema }) } } }, async (request) => ({ data: await service.getDelegatedAcademicData(request.uorStudent!, (request.params as z.infer<typeof idParams>).id), meta: meta(request) }));
  app.delete("/tutoring/relationships/:id", { schema: { tags: ["UOR Estudante - Explicadores"], params: idParams, response: { 200: singleResponse } } }, async (request) => ({ data: await service.revokeTutoringRelationship(request.uorStudent!, (request.params as z.infer<typeof idParams>).id, request.id), meta: meta(request) }));
  app.post("/study-plans", { schema: { tags: ["UOR Estudante - Explicadores"], body: z.object({ relationshipId: z.string().uuid(), subjectKey: z.string().min(1).max(120), period: z.string().min(1).max(80), tasks: z.array(z.object({ title: z.string().min(1).max(160), dueAt: z.string().datetime({ offset: true }).optional(), status: z.enum(["todo", "done"]).default("todo") })).max(100), sessions: z.array(z.object({ startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }), notes: z.string().max(1_000).optional() })).max(100) }).strict(), response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as { relationshipId: string; subjectKey: string; period: string; tasks: unknown[]; sessions: unknown[] };
    const relationship = await service.get(request.uorStudent!, body.relationshipId, "tutoring_request");
    if (relationship.status !== "active") throw new UorStudentError("UOR_STUDENT_TUTOR_RELATIONSHIP_INVALID", "O plano exige uma relação de acompanhamento ativa.", 409);
    if (String(relationship.payload.subjectKey ?? "").trim().toLowerCase() !== body.subjectKey.trim().toLowerCase() || String(relationship.payload.period ?? "").trim().toLowerCase() !== body.period.trim().toLowerCase()) throw new UorStudentError("UOR_STUDENT_STUDY_PLAN_SCOPE_INVALID", "O plano deve usar a mesma cadeira e período da relação ativa.", 422);
    let data = await service.create({ owner: request.uorStudent!, category: "study_plan", scopeKey: body.relationshipId, status: "active", payload: body, traceId: request.id });
    const participants = new Set([relationship.ownerProfileId, ...relationship.actors.filter((actor) => actor.role === "tutor" && actor.status === "accepted").map((actor) => actor.profileId)]);
    for (const profileId of participants) data = await service.addActor({ owner: request.uorStudent!, aggregateId: data.id, category: "study_plan", profileId, role: "participant", status: "active", traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });

  app.get("/academic-appeals", { schema: { tags: ["UOR Estudante - Recursos"], querystring: pageQuery, response: { 200: listResponse } } }, async (request) => ({ data: await service.list({ student: request.uorStudent!, category: "academic_appeal", access: "owner", ...page(request) }), meta: meta(request) }));
  app.post("/academic-appeals", { schema: { tags: ["UOR Estudante - Recursos"], body: appealBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof appealBody>;
    const data = await service.create({ owner: request.uorStudent!, category: "academic_appeal", scopeKey: `${body.subjectKey}:${body.period}:${body.assessmentKey}`, status: "draft", payload: { ...body, origin: "uor_student", officialSubmission: false }, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.get("/academic-appeals/:id/history", { schema: { tags: ["UOR Estudante - Recursos"], params: idParams, response: { 200: z.object({ data: z.array(z.object({ id: z.string().uuid(), type: z.string(), fromStatus: z.string().nullable(), toStatus: z.string().nullable(), createdAt: z.string() })), meta: metaSchema }) } } }, async (request) => ({ data: await service.history(request.uorStudent!, (request.params as z.infer<typeof idParams>).id, 100), meta: meta(request) }));

  app.post("/collective-requests", { schema: { tags: ["UOR Estudante - Representação"], body: collectiveBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof collectiveBody>;
    const data = await service.create({ owner: request.uorStudent!, category: "collective_request", scopeKey: `${body.subjectKey}:${body.period}`, status: "draft", payload: body, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.post("/collective-requests/:id/invitations", { schema: { tags: ["UOR Estudante - Representação"], params: idParams, body: z.object({ profileId: z.string().uuid() }).strict(), response: { 200: singleResponse } } }, async (request) => ({
    data: await service.addActor({ owner: request.uorStudent!, aggregateId: (request.params as z.infer<typeof idParams>).id, category: "collective_request", profileId: (request.body as { profileId: string }).profileId, role: "participant", status: "invited", traceId: request.id }), meta: meta(request),
  }));
  app.post("/collective-requests/:id/participation", { schema: { tags: ["UOR Estudante - Representação"], params: idParams, body: z.object({ decision: z.enum(["accepted", "rejected", "withdrawn"]) }).strict(), response: { 200: singleResponse } } }, async (request) => {
    const decision = (request.body as { decision: string }).decision;
    return { data: await service.decideActor({ student: request.uorStudent!, aggregateId: (request.params as z.infer<typeof idParams>).id, category: "collective_request", role: "participant", from: decision === "withdrawn" ? ["accepted"] : ["invited"], to: decision, aggregateStatuses: ["draft"], traceId: request.id }), meta: meta(request) };
  });
  app.post("/collective-requests/:id/submit", { schema: { tags: ["UOR Estudante - Representação"], params: idParams, response: { 200: singleResponse } } }, async (request) => {
    const id = (request.params as z.infer<typeof idParams>).id;
    const current = await service.get(request.uorStudent!, id, "collective_request");
    if (!current.actors.some((actor) => actor.role === "participant" && actor.status === "accepted")) throw new UorStudentError("UOR_STUDENT_COLLECTIVE_EMPTY", "O pedido coletivo exige pelo menos uma participação aprovada pelo próprio participante.", 409);
    return { data: await service.transition({ student: request.uorStudent!, id, category: "collective_request", from: ["draft"], to: "submitted", traceId: request.id }), meta: meta(request) };
  });

  app.get("/market/listings", { schema: { tags: ["UOR Estudante - Mercado"], querystring: pageQuery.extend({ category: listingBody.shape.category.optional(), course: z.string().max(160).optional(), maxPrice: z.coerce.number().min(0).optional() }), response: { 200: listResponse } } }, async (request) => {
    const query = request.query as z.infer<typeof pageQuery> & { category?: string; course?: string; maxPrice?: number };
    const result = await service.list({ student: request.uorStudent!, category: "market_listing", access: "public_institution", statuses: ["published", "reserved"], limit: query.limit, cursor: query.cursor });
    const items = result.items.filter((item) => (!query.category || item.payload.category === query.category) && (!query.course || item.payload.course === query.course) && (query.maxPrice === undefined || (typeof item.payload.price === "number" && item.payload.price <= query.maxPrice)));
    return { data: { ...result, items }, meta: meta(request) };
  });
  app.post("/market/listings", { schema: { tags: ["UOR Estudante - Mercado"], body: listingBody, response: { 201: singleResponse } } }, async (request, reply) => {
    const body = request.body as z.infer<typeof listingBody>;
    const data = await service.create({ owner: request.uorStudent!, category: "market_listing", scopeKey: body.category, status: "published", payload: body, expiresAt: new Date(body.expiresAt), traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
  app.post("/market/listings/:id/reservations", { schema: { tags: ["UOR Estudante - Mercado"], params: idParams, body: z.object({ message: z.string().trim().max(500).optional() }).strict(), response: { 200: singleResponse } } }, async (request) => ({
    data: await service.reactPublic({ student: request.uorStudent!, aggregateId: (request.params as z.infer<typeof idParams>).id, category: "market_listing", role: "buyer", status: "reserved", allowedAggregateStatuses: ["published"], payload: request.body as Record<string, unknown>, traceId: request.id }), meta: meta(request),
  }));
  app.post("/market/listings/:id/sold", { schema: { tags: ["UOR Estudante - Mercado"], params: idParams, response: { 200: singleResponse } } }, async (request) => ({
    data: await service.transition({ student: request.uorStudent!, id: (request.params as z.infer<typeof idParams>).id, category: "market_listing", from: ["published", "reserved"], to: "sold", traceId: request.id }), meta: meta(request),
  }));
  app.post("/market/listings/:id/reports", { schema: { tags: ["UOR Estudante - Mercado"], params: idParams, body: z.object({ reason: z.enum(["fraud", "prohibited", "spam", "abuse", "other"]), details: z.string().max(1_000).optional() }).strict(), response: { 201: singleResponse } } }, async (request, reply) => {
    const listingId = (request.params as z.infer<typeof idParams>).id;
    await service.getPublic(request.uorStudent!, listingId, "market_listing", ["published", "reserved"]);
    const data = await service.create({ owner: request.uorStudent!, category: "market_report", scopeKey: listingId, status: "pending_moderation", payload: { listingId, ...(request.body as object) }, traceId: request.id });
    return reply.status(201).send({ data, meta: meta(request) });
  });
}
