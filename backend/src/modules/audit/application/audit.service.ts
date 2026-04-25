import { prisma } from "../../../shared/prisma";

type AuditInput = {
  actorStudentNumber?: string | null;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export async function recordAdminAudit(input: AuditInput) {
  await prisma.adminAuditLog.create({
    data: {
      actorStudentNumber: input.actorStudentNumber?.trim() || "unknown",
      actorRole: input.actorRole?.trim() || "admin",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
      summary: input.summary,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export function parseAuditMetadata(value?: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
