import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { UorStudentDelegatedFinanceApplication } from "../finance/delegated-finance-service";

const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
function meta(request: FastifyRequest) { return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const }; }

export async function uorStudentDelegatedFinanceRoutes(app: FastifyInstance, options: { application: UorStudentDelegatedFinanceApplication }) {
  app.get("/finance/shared-references/:authorizationId", { schema: { tags: ["UOR Estudante - Finanças"], params: z.object({ authorizationId: z.string().uuid() }), response: { 200: z.object({ data: z.object({ authorizationId: z.string().uuid(), referenceId: z.string(), entity: z.union([z.string(), z.number(), z.boolean(), z.null()]), reference: z.union([z.string(), z.number(), z.boolean(), z.null()]), amount: z.union([z.string(), z.number(), z.boolean(), z.null()]), currency: z.union([z.string(), z.number(), z.boolean(), z.null()]), expiresAt: z.union([z.string(), z.number(), z.boolean(), z.null()]), status: z.union([z.string(), z.number(), z.boolean(), z.null()]), provenance: z.record(z.string(), z.unknown()) }), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.getSharedReference({ student: request.uorStudent!, authorizationId: (request.params as { authorizationId: string }).authorizationId, traceId: request.id }), meta: meta(request) }));
}
