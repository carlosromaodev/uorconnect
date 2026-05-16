import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { parseAuditMetadata, recordAdminAudit } from "../application/audit.service";
import { getRetentionPolicy, runDataRetentionCleanup } from "../application/data-retention.service";

const auditFilterSchema = z.object({
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(160).optional(),
});

const auditQuerySchema = auditFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(100).default(30),
});

const auditExportQuerySchema = auditFilterSchema.extend({
  limit: z.coerce.number().int().min(10).max(5000).default(2000),
});

const auditLogSchema = z.object({
  id: z.number(),
  actorStudentNumber: z.string(),
  actorRole: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  summary: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

const retentionPolicySchema = z.object({
  auditLogRetentionDays: z.number(),
  credentialValidationLogRetentionDays: z.number(),
  expiredCredentialRetentionDays: z.number(),
});

const retentionCleanupResultSchema = z.object({
  policy: retentionPolicySchema,
  cutoffs: z.object({
    auditLogsBefore: z.string(),
    credentialValidationLogsBefore: z.string(),
    expiredCredentialsBefore: z.string(),
  }),
  deletedAuditLogs: z.number(),
  deletedCredentialValidationLogs: z.number(),
  minimizedExpiredCredentials: z.number(),
});

function buildAuditWhere(query: z.infer<typeof auditFilterSchema>): Prisma.AdminAuditLogWhereInput {
  return {
    ...(query.action ? { action: query.action } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.from || query.to
      ? {
        createdAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
      }
      : {}),
    ...(query.search
      ? {
        OR: [
          { actorStudentNumber: { contains: query.search } },
          { action: { contains: query.search } },
          { entityType: { contains: query.search } },
          { entityId: { contains: query.search } },
          { summary: { contains: query.search } },
        ],
      }
      : {}),
  };
}

function serializeAuditLog(log: {
  id: number;
  actorStudentNumber: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadataJson: string | null;
  createdAt: Date;
}) {
  return {
    id: log.id,
    actorStudentNumber: log.actorStudentNumber,
    actorRole: log.actorRole,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    summary: log.summary,
    metadata: parseAuditMetadata(log.metadataJson),
    createdAt: log.createdAt.toISOString(),
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export async function auditRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });
    protectedApp.register(adminGuard);
    setDefaultAdminPermission(protectedApp, ["AUDIT"]);

    protectedApp.get("/admin/logs/export.csv", {
      config: requireAdminPermission(["DATA_EXPORT"]),
      schema: {
        querystring: auditExportQuerySchema,
        response: {
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const query = auditExportQuerySchema.parse(request.query);
      const logs = await prisma.adminAuditLog.findMany({
        where: buildAuditWhere(query),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit,
      });
      const rows = logs.map(serializeAuditLog);
      await recordAdminAudit({
        actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
        actorRole: request.jury ? "jury_admin" : "admin",
        action: "data_export.audit_logs_csv",
        entityType: "AdminAuditLog",
        summary: `Exportação CSV de auditoria com ${rows.length} registo(s).`,
        metadata: {
          count: rows.length,
          filters: query,
        },
      });
      const csv = [
        ["Data", "Ator", "Perfil", "Ação", "Entidade", "ID", "Resumo", "Metadados"].map(csvCell).join(","),
        ...rows.map((row) => [
          row.createdAt,
          row.actorStudentNumber,
          row.actorRole,
          row.action,
          row.entityType,
          row.entityId,
          row.summary,
          row.metadata,
        ].map(csvCell).join(",")),
      ].join("\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="auditoria-admin-${new Date().toISOString().slice(0, 10)}.csv"`);
      return reply.send(csv);
    });

    protectedApp.get("/admin/logs", {
      schema: {
        querystring: auditQuerySchema,
        response: {
          200: z.object({
            items: z.array(auditLogSchema),
            total: z.number(),
            page: z.number(),
            totalPages: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const query = auditQuerySchema.parse(request.query);
      const where = buildAuditWhere(query);

      const [total, logs] = await Promise.all([
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);

      return {
        items: logs.map(serializeAuditLog),
        total,
        page: query.page,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      };
    });

    protectedApp.get("/admin/retention-policy", {
      schema: {
        response: {
          200: retentionPolicySchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => getRetentionPolicy(opts.env));

    protectedApp.post("/admin/retention-run", {
      schema: {
        response: {
          200: retentionCleanupResultSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const result = await runDataRetentionCleanup(prisma, opts.env);
      await recordAdminAudit({
        actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
        actorRole: request.jury ? "jury_admin" : "admin",
        action: "data_retention.cleanup_run",
        entityType: "DataRetention",
        summary: "Política de retenção executada.",
        metadata: result,
      });
      return result;
    });
  });
}
