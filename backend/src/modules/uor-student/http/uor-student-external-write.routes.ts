import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { UorStudentError } from "../domain/errors";
import type { UorStudentExternalWriteApplication } from "../external-writes/external-write-service";
import type { UorStudentStepUpApplication } from "../security/step-up-service";

const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("uor_student") });
const commandSchema = z.object({
  id: z.string().uuid(), type: z.enum(["GENERATE_PAYMENT_REFERENCE", "UPDATE_CONTACT_DETAILS", "CANCEL_CONTACT_CHANGE_REQUEST", "UPDATE_PHOTO", "CANCEL_EXAM_REGISTRATION", "SUBMIT_GRADE_REVIEW"]),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]), status: z.enum(["AWAITING_CONFIRMATION", "SUBMITTING", "VERIFYING", "SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED", "EXPIRED"]),
  requiresConfirmation: z.boolean(), confirmationExpiresAt: z.string().nullable(), result: z.object({ items: z.array(z.record(z.string(), z.unknown())), observedAt: z.string() }).nullable(), errorCode: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(), completedAt: z.string().nullable(),
});
const response = z.object({ data: commandSchema, meta: metaSchema });
const idempotencyHeaders = z.object({ "idempotency-key": z.string().trim().min(8).max(128) });
const commandParams = z.object({ id: z.string().uuid() });
function meta(request: FastifyRequest) { return { traceId: request.id, product: "uor_student" as const, source: "uor_student" as const }; }
function key(request: FastifyRequest) { return String(request.headers["idempotency-key"]); }

async function normalizePhoto(dataUrl: string) {
  const prefix = "data:image/jpeg;base64,";
  if (!dataUrl.startsWith(prefix)) throw new UorStudentError("UOR_STUDENT_PHOTO_INVALID", "A fotografia deve ser JPEG em data URL.", 422);
  const source = Buffer.from(dataUrl.slice(prefix.length), "base64");
  try {
    if (!source.length || source.length > 1_048_576 || source[0] !== 0xff || source[1] !== 0xd8 || source[2] !== 0xff) throw new UorStudentError("UOR_STUDENT_PHOTO_INVALID", "A fotografia JPEG deve ter no máximo 1024 KB.", 422);
    const normalized = await sharp(source, { failOn: "warning", limitInputPixels: 64_000_000 }).rotate().resize({ width: 2_000, height: 2_000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (normalized.info.width < 64 || normalized.info.height < 64 || normalized.data.length > 1_048_576) { normalized.data.fill(0); throw new UorStudentError("UOR_STUDENT_PHOTO_INVALID", "A fotografia normalizada é inválida.", 422); }
    return { body: normalized.data, sha256: createHash("sha256").update(normalized.data).digest("hex"), width: normalized.info.width, height: normalized.info.height };
  } catch (error) {
    if (error instanceof UorStudentError) throw error;
    throw new UorStudentError("UOR_STUDENT_PHOTO_INVALID", "Não foi possível validar a fotografia JPEG.", 422);
  } finally { source.fill(0); }
}

export async function uorStudentExternalWriteRoutes(app: FastifyInstance, options: { application: UorStudentExternalWriteApplication; stepUp?: UorStudentStepUpApplication }) {
  const service = options.application;
  app.get("/external-capabilities", { schema: { tags: ["UOR Estudante - Escritas oficiais"], response: { 200: z.object({ data: z.array(z.object({ key: z.string(), mode: z.enum(["read", "write"]), status: z.enum(["available", "disabled", "unsupported"]), description: z.string() })), meta: metaSchema }) } } }, async (request) => ({ data: service.capabilities(), meta: meta(request) }));
  app.post("/external-commands/payment-references", { schema: { tags: ["UOR Estudante - Escritas oficiais"], headers: idempotencyHeaders, body: z.object({ chargeRefs: z.array(z.string().regex(/^scr_[A-Za-z0-9_-]{43}$/)).min(1).max(25) }).strict(), response: { 202: response } } }, async (request, reply) => reply.status(202).send({ data: await service.preparePaymentReference(request.uorStudent!, (request.body as { chargeRefs: string[] }).chargeRefs, key(request)), meta: meta(request) }));
  app.patch("/external-commands/contact-details", { schema: { tags: ["UOR Estudante - Escritas oficiais"], headers: idempotencyHeaders, body: z.object({ email: z.string().email().max(254).optional(), phone: z.string().max(40).nullable().optional(), mobile: z.string().max(40).nullable().optional(), primaryAddressLine: z.string().min(1).max(300).optional(), secondaryAddressLine: z.string().max(300).nullable().optional(), mailingAddress: z.enum(["PRIMARY", "SECONDARY"]).optional() }).strict().refine((value) => Object.keys(value).length > 0), response: { 202: response } } }, async (request, reply) => reply.status(202).send({ data: await service.prepareContactDetails(request.uorStudent!, request.body as Parameters<UorStudentExternalWriteApplication["prepareContactDetails"]>[1], key(request)), meta: meta(request) }));
  app.delete("/external-commands/contact-details/pending", { schema: { tags: ["UOR Estudante - Escritas oficiais"], headers: idempotencyHeaders, response: { 202: response } } }, async (request, reply) => reply.status(202).send({ data: await service.prepareContactDetailsCancellation(request.uorStudent!, key(request)), meta: meta(request) }));
  app.put("/external-commands/photo", { schema: { tags: ["UOR Estudante - Escritas oficiais"], headers: idempotencyHeaders, body: z.object({ dataUrl: z.string().max(1_500_000) }).strict(), response: { 202: response } } }, async (request, reply) => {
    const photo = await normalizePhoto((request.body as { dataUrl: string }).dataUrl);
    try { return reply.status(202).send({ data: await service.preparePhoto(request.uorStudent!, photo, key(request)), meta: meta(request) }); }
    finally { photo.body.fill(0); }
  });
  app.delete("/external-commands/exam-registrations/:registrationRef", { schema: { tags: ["UOR Estudante - Escritas oficiais"], headers: idempotencyHeaders, params: z.object({ registrationRef: z.string().regex(/^ser_[A-Za-z0-9_-]{43}$/) }), response: { 202: response } } }, async (request, reply) => reply.status(202).send({ data: await service.prepareExamRegistrationCancellation(request.uorStudent!, (request.params as { registrationRef: string }).registrationRef, key(request)), meta: meta(request) }));
  app.post("/external-commands/grade-reviews", { schema: { tags: ["UOR Estudante - Escritas oficiais"], headers: idempotencyHeaders, body: z.object({ reviewRef: z.string().regex(/^sgr_[A-Za-z0-9_-]{43}$/), operation: z.enum(["REVIEW", "PROOF_COPY", "RECONSIDERATION"]), justification: z.string().trim().max(16_000).default("") }).strict().refine((body) => body.operation === "PROOF_COPY" || body.justification.length > 0), response: { 202: response } } }, async (request, reply) => {
    const body = request.body as { reviewRef: string; operation: "REVIEW" | "PROOF_COPY" | "RECONSIDERATION"; justification: string };
    return reply.status(202).send({ data: await service.prepareGradeReview(request.uorStudent!, body.reviewRef, body.operation, body.justification, key(request)), meta: meta(request) });
  });
  app.get("/external-commands/:id", { schema: { tags: ["UOR Estudante - Escritas oficiais"], params: commandParams, response: { 200: response } } }, async (request) => ({ data: await service.getCommand(request.uorStudent!, (request.params as { id: string }).id), meta: meta(request) }));
  app.get("/external-commands/:id/attempts", { schema: { tags: ["UOR Estudante - Escritas oficiais"], params: commandParams, response: { 200: z.object({ data: z.array(z.object({ id: z.string().uuid(), attempt: z.number().int(), status: z.string(), errorCode: z.string().nullable(), startedAt: z.string(), finishedAt: z.string().nullable() })), meta: metaSchema }) } } }, async (request) => ({ data: await service.getCommandAttempts(request.uorStudent!, (request.params as { id: string }).id), meta: meta(request) }));
  app.post("/external-commands/:id/confirm", { schema: { tags: ["UOR Estudante - Escritas oficiais"], params: commandParams, body: z.object({ confirmation: commandSchema.shape.type }).strict(), response: { 200: response } } }, async (request) => {
    const commandId = (request.params as { id: string }).id;
    const command = await service.getCommand(request.uorStudent!, commandId);
    if (command.risk === "HIGH" && (!options.stepUp || !options.stepUp.verifyToken(request.uorStudent!, String(request.headers["x-uor-step-up"] ?? ""), "external_command.confirm", commandId))) {
      throw new UorStudentError("UOR_STUDENT_STEP_UP_REQUIRED", "Esta operação exige um código contextual confirmado recentemente.", 403);
    }
    return { data: await service.confirmCommand(request.uorStudent!, commandId, (request.body as { confirmation: Parameters<UorStudentExternalWriteApplication["confirmCommand"]>[2] }).confirmation), meta: meta(request) };
  });
  app.post("/external-commands/:id/reconcile", { schema: { tags: ["UOR Estudante - Escritas oficiais"], params: commandParams, response: { 200: response } } }, async (request) => ({ data: await service.reconcileCommand(request.uorStudent!, (request.params as { id: string }).id), meta: meta(request) }));
  app.post("/external-commands/:id/cancel", { schema: { tags: ["UOR Estudante - Escritas oficiais"], params: commandParams, response: { 200: response } } }, async (request) => ({ data: await service.cancelCommand(request.uorStudent!, (request.params as { id: string }).id), meta: meta(request) }));
}
