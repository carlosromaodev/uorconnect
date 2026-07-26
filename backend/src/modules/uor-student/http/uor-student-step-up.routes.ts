import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { UorStudentStepUpApplication } from "../security/step-up-service";

const context = z.object({ action: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/), resourceId: z.string().min(8).max(200) });
const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
function meta(request: FastifyRequest) { return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const }; }

export async function uorStudentStepUpRoutes(app: FastifyInstance, options: { application: UorStudentStepUpApplication }) {
  app.post("/step-up-challenges", { config: { rateLimit: { max: 5, timeWindow: 15 * 60_000 } }, schema: { tags: ["UOR Estudante - Segurança"], body: context.strict(), response: { 202: z.object({ data: z.object({ challengeId: z.string().uuid(), expiresAt: z.string(), attemptsRemaining: z.number().int(), resendsRemaining: z.number().int() }), meta: metaSchema }) } } }, async (request, reply) => reply.status(202).send({ data: await options.application.request({ student: request.uorStudent!, ...(request.body as z.infer<typeof context>), traceId: request.id }), meta: meta(request) }));
  app.post("/step-up-challenges/:id/verify", { config: { rateLimit: { max: 10, timeWindow: 15 * 60_000 } }, schema: { tags: ["UOR Estudante - Segurança"], params: z.object({ id: z.string().uuid() }), body: context.extend({ code: z.string().regex(/^\d{6}$/) }).strict(), response: { 200: z.object({ data: z.object({ token: z.string(), expiresAt: z.string() }), meta: metaSchema }) } } }, async (request) => ({ data: await options.application.verify({ student: request.uorStudent!, challengeId: (request.params as { id: string }).id, ...(request.body as z.infer<typeof context> & { code: string }), traceId: request.id }), meta: meta(request) }));
}
