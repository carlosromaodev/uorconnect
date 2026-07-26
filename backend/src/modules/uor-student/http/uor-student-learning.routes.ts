import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { UorStudentLearningApplication } from "../learning/learning-service";

const idParams = z.object({ id: z.string().uuid() });
const pageQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(8).max(2_000).optional() });
const metaSchema = z.object({ traceId: z.string(), product: z.literal("uor_student"), source: z.literal("moodle"), syncedAt: z.string().nullable(), stale: z.boolean(), snapshotVersion: z.number().int().nullable().optional(), pagination: z.record(z.string(), z.unknown()).optional(), coverage: z.record(z.string(), z.unknown()).optional() });
const profileSchema = z.object({ id: z.string().uuid(), studentNumber: z.string(), displayName: z.string(), email: z.string().nullable(), timezone: z.string().nullable(), lastSyncedAt: z.string() });
const courseSchema = z.object({ id: z.string().uuid(), name: z.string(), shortName: z.string().nullable(), category: z.string().nullable(), description: z.string().nullable(), startDate: z.string().nullable(), endDate: z.string().nullable(), visible: z.boolean(), favourite: z.boolean(), progressAvailable: z.boolean(), progressPercent: z.number().nullable(), stale: z.boolean(), lastSyncedAt: z.string() });
const materialSchema = z.object({ id: z.string().uuid(), courseId: z.string().uuid(), sectionId: z.string().uuid().nullable(), type: z.string(), title: z.string(), description: z.string().nullable(), available: z.boolean(), openAvailable: z.boolean(), downloadAvailable: z.boolean(), mimeType: z.string().nullable(), fileName: z.string().nullable(), sizeBytes: z.number().int().nullable(), stale: z.boolean(), lastSyncedAt: z.string() });
const sectionSchema = z.object({ id: z.string().uuid(), courseId: z.string().uuid(), name: z.string(), position: z.number().int(), summary: z.string().nullable(), visible: z.boolean(), available: z.boolean(), modules: z.array(z.object({ id: z.string().uuid(), type: z.string(), title: z.string(), available: z.boolean(), kind: z.enum(["material", "activity", "other"]) })), stale: z.boolean(), lastSyncedAt: z.string() });

function meta(request: FastifyRequest, result: { syncedAt?: Date | null; stale?: boolean; snapshotVersion?: number | null; pagination?: unknown; coverage?: unknown } = {}) {
  return { traceId: request.id, product: "uor_student" as const, source: "moodle" as const, syncedAt: result.syncedAt?.toISOString() ?? null, stale: result.stale ?? false, ...(result.snapshotVersion !== undefined ? { snapshotVersion: result.snapshotVersion } : {}), ...(result.pagination ? { pagination: result.pagination as Record<string, unknown> } : {}), ...(result.coverage ? { coverage: result.coverage as Record<string, unknown> } : {}) };
}

function attachmentDisposition(fileName: string) {
  const fallback = fileName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/["\\\r\n]/g, "_").trim().slice(0, 120) || "material";
  const encoded = encodeURIComponent(fileName.slice(0, 240)).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function uorStudentLearningRoutes(app: FastifyInstance, options: { application: UorStudentLearningApplication }) {
  const service = options.application;
  app.get("/learning/profile", { schema: { tags: ["UOR Estudante - Moodle"], response: { 200: z.object({ data: profileSchema, meta: metaSchema }) } } }, async (request) => {
    const data = await service.getProfile(request.uorStudent!);
    return { data, meta: meta(request, { syncedAt: new Date(data.lastSyncedAt) }) };
  });
  app.get("/learning/overview", { schema: { tags: ["UOR Estudante - Moodle"], response: { 200: z.object({ data: z.record(z.string(), z.unknown()), meta: metaSchema }) } } }, async (request) => {
    const result = await service.getOverview(request.uorStudent!);
    return { data: result.data, meta: meta(request, result) };
  });
  app.get("/learning/courses", { schema: { tags: ["UOR Estudante - Moodle"], querystring: pageQuery, response: { 200: z.object({ data: z.array(courseSchema), meta: metaSchema }) } } }, async (request) => {
    const result = await service.listCourses(request.uorStudent!, request.query as z.infer<typeof pageQuery>);
    return { data: result.items, meta: meta(request, result) };
  });
  app.get("/learning/courses/:id", { schema: { tags: ["UOR Estudante - Moodle"], params: idParams, response: { 200: z.object({ data: courseSchema, meta: metaSchema }) } } }, async (request) => {
    const result = await service.getCourse(request.uorStudent!, (request.params as z.infer<typeof idParams>).id);
    return { data: result.data, meta: meta(request, result) };
  });
  app.get("/learning/courses/:id/sections", { schema: { tags: ["UOR Estudante - Moodle"], params: idParams, querystring: pageQuery, response: { 200: z.object({ data: z.array(sectionSchema), meta: metaSchema }) } } }, async (request) => {
    const result = await service.listSections(request.uorStudent!, (request.params as z.infer<typeof idParams>).id, request.query as z.infer<typeof pageQuery>);
    return { data: result.items, meta: meta(request, result) };
  });
  app.get("/learning/courses/:id/materials", { schema: { tags: ["UOR Estudante - Moodle"], params: idParams, querystring: pageQuery, response: { 200: z.object({ data: z.array(materialSchema), meta: metaSchema }) } } }, async (request) => {
    const result = await service.listMaterials(request.uorStudent!, (request.params as z.infer<typeof idParams>).id, request.query as z.infer<typeof pageQuery>);
    return { data: result.items, meta: meta(request, result) };
  });
  app.get("/learning/materials", { schema: { tags: ["UOR Estudante - Moodle"], querystring: pageQuery, response: { 200: z.object({ data: z.array(materialSchema), meta: metaSchema }) } } }, async (request) => {
    const result = await service.listMaterials(request.uorStudent!, null, request.query as z.infer<typeof pageQuery>);
    return { data: result.items, meta: meta(request, result) };
  });
  app.get("/learning/materials/:id/content", { schema: { tags: ["UOR Estudante - Moodle"], params: idParams } }, async (request, reply) => {
    const download = await service.openMaterial(request.uorStudent!, (request.params as z.infer<typeof idParams>).id, request.headers.range);
    reply.header("Content-Type", download.contentType);
    reply.header("Content-Disposition", attachmentDisposition(download.fileName));
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Content-Security-Policy", "sandbox; default-src 'none'");
    if (download.acceptRanges) reply.header("Accept-Ranges", "bytes");
    if (download.contentRange) reply.header("Content-Range", download.contentRange);
    if (download.contentLength !== null) reply.header("Content-Length", String(download.contentLength));
    return reply.status(download.status).send(download.stream);
  });
}
