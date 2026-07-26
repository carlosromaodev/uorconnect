import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { LiveUorStudentRankingApplication } from "../rankings/ranking-service";

const contextSchema = z.object({ course: z.string().trim().min(1).max(160), classCode: z.string().trim().min(1).max(80), period: z.string().trim().min(1).max(80), subjectKey: z.string().trim().min(1).max(120).optional() }).strict();
const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
function meta(request: FastifyRequest) { return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const }; }

export async function uorStudentRankingRoutes(app: FastifyInstance, options: { application: LiveUorStudentRankingApplication }) {
  app.put("/rankings/participation", { schema: { tags: ["UOR Estudante - Rankings"], body: contextSchema.extend({ enabled: z.boolean() }), response: { 200: z.object({ data: z.object({ context: contextSchema, enabled: z.boolean(), policyVersion: z.string(), consentedAt: z.string().nullable(), withdrawnAt: z.string().nullable(), updatedAt: z.string() }), meta: metaSchema }) } } }, async (request) => {
    const { enabled, ...context } = request.body as z.infer<typeof contextSchema> & { enabled: boolean };
    return { data: await options.application.setParticipation({ student: request.uorStudent!, context, enabled, traceId: request.id }), meta: meta(request) };
  });
  app.get("/rankings/me", { schema: { tags: ["UOR Estudante - Rankings"], querystring: contextSchema, response: { 200: z.object({ data: z.object({ status: z.enum(["available", "insufficient_sample", "not_eligible"]), position: z.number().int().nullable(), percentile: z.number().nullable(), sampleSize: z.number().int(), minimumSample: z.number().int(), coverage: z.number(), context: contextSchema, method: z.string(), updatedAt: z.string().nullable(), stale: z.boolean() }), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.getPrivatePosition({ student: request.uorStudent!, context: request.query as z.infer<typeof contextSchema> }), meta: meta(request) }));
}
