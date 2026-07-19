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
  actorName: z.string().nullable(),
  actorRole: z.string(),
  action: z.string(),
  actionLabel: z.string(),
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

const auditActionLabels: Record<string, string> = {
  "attendance.check_in": "Check-in registado",
  "certificate.issue": "Certificado individual emitido",
  "certificate.issue_attendees": "Certificados emitidos por presença",
  "certificate.issue_bulk": "Certificados emitidos em lote",
  "certificate.bulk_missing_students": "Estudantes não encontrados para certificados",
  "certificate.reissue": "Certificado reemitido",
  "certificate.revoke": "Certificado revogado",
  "data_export.analytics_events_csv": "Eventos de analytics exportados em CSV",
  "data_export.audit_logs_csv": "Auditoria exportada em CSV",
  "data_retention.cleanup_run": "Política de retenção executada",
  "odin.ai_analysis": "Análise ODIN IA executada",
  "odin.ai_feedback": "Feedback ODIN IA registado",
  "odin.security_report_pdf_job": "Relatório de segurança ODIN gerado",
  "odin.student_exclusion": "Estudante excluído pelo ODIN",
  "passport.challenge_create": "Desafio do passaporte criado",
  "passport.challenge_reset": "Desafio do passaporte reiniciado",
  "passport.challenge_update": "Desafio do passaporte atualizado",
  "passport.ledger_revoke": "Pontos do passaporte revogados",
  "passport.mission_create": "Missão do passaporte criada",
  "passport.mission_qr_create": "QR de missão do passaporte criado",
  "passport.mission_update": "Missão do passaporte atualizada",
  "passport.ranking_freeze": "Ranking do passaporte congelado",
  "passport.ranking_recalculate": "Ranking do passaporte recalculado",
  "passport.reset_confirmation_requested": "Confirmação de reset do passaporte solicitada",
  "passport.scan_review": "Scan do passaporte revisto",
  "passport.surprise_qr_batch_create": "Lote de QR surpresa criado",
  "passport.surprise_qr_create": "QR surpresa criado",
  "passport.surprise_qr_update": "QR surpresa atualizado",
  "passport.winners_export": "Vencedores do passaporte exportados",
  "projects.automatic_missions_awarded": "Missões automáticas dos projetos atribuídas",
  "projects.empty_stand_penalty_checked": "Penalização por stand vazio verificada",
  "projects.member_duty_recorded": "Presença de membro no stand registada",
  "projects.member_levels_awarded": "Níveis dos membros atribuídos",
  "projects.qualified_feedback_reviewed": "Feedback qualificado revisto",
  "projects.score_config_updated": "Configuração da pontuação dos projetos atualizada",
  "projects.score_event_created": "Evento de pontuação criado",
  "projects.score_events_recalculated": "Eventos de pontuação recalculados",
  "projects.score_ranking_csv_exported": "Ranking de pontuação exportado em CSV",
  "projects.score_ranking_exported": "Ranking de pontuação exportado em JSON",
  "projects.score_ranking_frozen": "Ranking de pontuação congelado",
  "projects.score_ranking_pdf_exported": "Ranking de pontuação exportado em PDF",
  "projects.team_bonuses_awarded": "Bónus de equipa atribuídos",
  "projects.votes_control_updated": "Controlo de votação atualizado",
  "projects.votes_reset": "Votos dos projetos reiniciados",
  "security.admin_permission_conflict": "Conflito de permissões administrativas detetado",
  "security.admin_permission_denied": "Permissão administrativa recusada",
  "security.authorize_admin": "Administrador autorizado",
  "security.revoke_admin": "Administrador revogado",
  "student.delete": "Estudante removido",
  "student_profile.consent_update": "Consentimentos do perfil atualizados",
  "student_profile.update": "Perfil do estudante atualizado",
  "submission.clear_winner": "Vencedor da candidatura removido",
  "submission.delete": "Candidatura removida",
  "submission.payment_review": "Pagamento da candidatura revisto",
  "submission.regenerate_exhibitor_pdf": "PDF do expositor regenerado",
  "submission.select_winner": "Vencedor da candidatura definido",
  "submission.team_member_confirm_admin": "Membro da equipa confirmado pela admin",
  "submission.team_member_confirm_external": "Membro externo confirmado",
  "submission.team_member_external_exception": "Exceção para membro externo aprovada",
  "submission.team_member_remove_responsible": "Responsável removido da equipa",
  "submission.team_members_update": "Equipa da candidatura atualizada",
  "submission.update_presentation": "Apresentação da candidatura atualizada",
  "submission.update_status": "Estado da candidatura atualizado",
  "submission.update_type": "Tipo da candidatura atualizado",
  "team_credential.auto_create": "Credencial criada automaticamente",
  "team_credential.bulk_invitation": "Convite coletivo de credenciais gerado",
  "team_credential.claim_rejected": "Pedido de credencial recusado",
  "team_credential.create": "Credencial criada",
  "team_credential.disable": "Credencial desativada",
  "team_credential.expositor_claim": "Credencial de expositor reivindicada",
  "team_credential.import_expositors": "Expositores importados para credenciais",
  "team_credential.pass_batch_calibration_pdf": "PDF de calibração dos passes gerado",
  "team_credential.pass_batch_pdf": "PDF de passes em lote gerado",
  "team_credential.pass_template_update": "Template de passe atualizado",
  "team_credential.print_batch_create": "Lote de impressão de credenciais criado",
  "team_credential.print_batch_pdf": "PDF do lote de credenciais gerado",
  "team_credential.reissue": "Credencial reemitida",
  "team_credential.revoke": "Credencial revogada",
  "team_credential.sync_site_guests": "Convidados do site sincronizados",
  "team_credential.update": "Credencial atualizada",
  "team_membership.import_nucleus.deprecated": "Importação antiga do núcleo recusada",
  "team_membership.link_credential": "Credencial ligada a membro da equipa",
  "team_membership.remove": "Membro da equipa removido",
  "team_membership.update": "Membro da equipa atualizado",
  "team_membership_claim.approve": "Solicitação de tomada de posse aprovada",
  "team_membership_claim.reject": "Solicitação de tomada de posse recusada",
  "team_membership_claim.submit": "Solicitação de tomada de posse enviada",
  "team_membership_claim.update": "Solicitação de tomada de posse atualizada",
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function humanizeAuditAction(action: string) {
  const mapped = auditActionLabels[action];
  if (mapped) return mapped;
  const readable = action.replace(/[._-]+/g, " ").trim();
  return readable
    ? readable.charAt(0).toUpperCase() + readable.slice(1)
    : "Ação registada";
}

function auditActionsMatchingSearch(search?: string) {
  if (!search) return [];
  const query = normalizeSearch(search);
  if (!query) return [];
  return Object.keys(auditActionLabels).filter((action) => {
    const label = auditActionLabels[action];
    return normalizeSearch(action).includes(query) || normalizeSearch(label).includes(query);
  });
}

function uniqueTruthy(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

async function resolveAuditActorSearchIdentifiers(search?: string) {
  if (!search?.trim()) return [];
  const [students, juries] = await Promise.all([
    prisma.student.findMany({
      where: { name: { contains: search.trim() } },
      select: { studentNumber: true },
      take: 50,
    }),
    prisma.juryMember.findMany({
      where: { name: { contains: search.trim() } },
      select: { phone: true },
      take: 50,
    }),
  ]);
  return uniqueTruthy([
    ...students.map((student) => student.studentNumber),
    ...juries.map((jury) => jury.phone),
  ]);
}

function buildAuditWhere(
  query: z.infer<typeof auditFilterSchema>,
  actorSearchIdentifiers: string[] = [],
): Prisma.AdminAuditLogWhereInput {
  const searchActions = auditActionsMatchingSearch(query.search);
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
          ...(actorSearchIdentifiers.length > 0 ? [{ actorStudentNumber: { in: actorSearchIdentifiers } }] : []),
          { action: { contains: query.search } },
          ...(searchActions.length > 0 ? [{ action: { in: searchActions } }] : []),
          { entityType: { contains: query.search } },
          { entityId: { contains: query.search } },
          { summary: { contains: query.search } },
        ],
      }
      : {}),
  };
}

type AuditLogRecord = {
  id: number;
  actorStudentNumber: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadataJson: string | null;
  createdAt: Date;
};

async function resolveAuditActorNames(logs: Array<Pick<AuditLogRecord, "actorStudentNumber">>) {
  const identifiers = uniqueTruthy(
    logs
      .map((log) => log.actorStudentNumber)
      .filter((value) => value !== "unknown"),
  );
  if (identifiers.length === 0) return new Map<string, string>();

  const [students, juries] = await Promise.all([
    prisma.student.findMany({
      where: { studentNumber: { in: identifiers } },
      select: { studentNumber: true, name: true },
    }),
    prisma.juryMember.findMany({
      where: { phone: { in: identifiers } },
      select: { phone: true, name: true },
    }),
  ]);

  const names = new Map<string, string>();
  for (const student of students) {
    if (student.name?.trim() && !names.has(student.studentNumber)) {
      names.set(student.studentNumber, student.name.trim());
    }
  }
  for (const jury of juries) {
    if (jury.name?.trim() && !names.has(jury.phone)) {
      names.set(jury.phone, jury.name.trim());
    }
  }
  return names;
}

function serializeAuditLog(log: AuditLogRecord, actorNames = new Map<string, string>()) {
  return {
    id: log.id,
    actorStudentNumber: log.actorStudentNumber,
    actorName: actorNames.get(log.actorStudentNumber) ?? null,
    actorRole: log.actorRole,
    action: log.action,
    actionLabel: humanizeAuditAction(log.action),
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
      const actorSearchIdentifiers = await resolveAuditActorSearchIdentifiers(query.search);
      const logs = await prisma.adminAuditLog.findMany({
        where: buildAuditWhere(query, actorSearchIdentifiers),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit,
      });
      const actorNames = await resolveAuditActorNames(logs);
      const rows = logs.map((log) => serializeAuditLog(log, actorNames));
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
        ["Data", "Nome do ator", "Ator", "Perfil", "Ação", "Identificador técnico", "Entidade", "ID", "Resumo", "Metadados"].map(csvCell).join(","),
        ...rows.map((row) => [
          row.createdAt,
          row.actorName,
          row.actorStudentNumber,
          row.actorRole,
          row.actionLabel,
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
      const actorSearchIdentifiers = await resolveAuditActorSearchIdentifiers(query.search);
      const where = buildAuditWhere(query, actorSearchIdentifiers);

      const [total, logs] = await Promise.all([
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ]);
      const actorNames = await resolveAuditActorNames(logs);

      return {
        items: logs.map((log) => serializeAuditLog(log, actorNames)),
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
