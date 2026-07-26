import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { UorStudentOfficialChangeApplication } from "../sync/official-change-service";

const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
const summarySchema = z.object({ itemCount: z.number().int().nonnegative(), coverage: z.string(), observedAt: z.string() });
const changeSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  event: z.string().nullable(),
  previousVersion: z.number().int().positive(),
  currentVersion: z.number().int().positive(),
  before: summarySchema,
  after: summarySchema,
  source: z.literal("secretaria_uor"),
  detectedAt: z.string(),
});

function meta(request: FastifyRequest) {
  return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const };
}

export async function uorStudentChangeRoutes(app: FastifyInstance, options: { application: UorStudentOfficialChangeApplication }) {
  app.get("/official-changes", {
    schema: {
      tags: ["UOR Estudante - Sincronização"],
      querystring: z.object({ domain: z.string().min(2).max(120).optional(), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().uuid().optional() }),
      response: { 200: z.object({ data: z.object({ items: z.array(changeSchema), nextCursor: z.string().nullable() }), meta: metaSchema }) },
    },
  }, async (request) => ({
    data: await options.application.list({ student: request.uorStudent!, ...(request.query as { domain?: string; limit: number; cursor?: string }) }),
    meta: meta(request),
  }));
}
