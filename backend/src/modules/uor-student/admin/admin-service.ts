import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import type { UorStudentIdentity } from "../application/ports";
import type { UorStudentOtpDelivery } from "../authorizations/authorization-service";
import { UorStudentError } from "../domain/errors";
import { uorStudentOtpMessage } from "../notifications/sms-policy";

type Database = typeof prisma;

function parseObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

export class UorStudentAdminApplication {
  readonly #secret: Buffer;
  constructor(
    secret: string,
    private readonly delivery: UorStudentOtpDelivery,
    private readonly db: Database = prisma,
    private readonly now: () => Date = () => new Date(),
    private readonly generateCode: () => string = () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
    private readonly directionMinimumSample = 5,
  ) {
    this.#secret = createHmac("sha256", secret).update("uor-student-admin-mfa-v1").digest();
  }

  #codeHash(studentId: number, code: string) {
    return createHmac("sha256", this.#secret).update(`code:${studentId}:${code}`).digest("hex");
  }

  async requestMfa(student: UorStudentIdentity) {
    const now = this.now();
    const recent = await this.db.studentAccessCode.findFirst({ where: { studentId: student.id, purpose: "UOR_STUDENT_ADMIN_MFA", usedAt: null, expiresAt: { gt: now } }, orderBy: { sentAt: "desc" } });
    if (recent && recent.sentAt > new Date(now.getTime() - 60_000)) throw new UorStudentError("UOR_STUDENT_ADMIN_MFA_RATE_LIMIT", "Aguarda antes de pedir um novo código MFA.", 429, true);
    const profile = await this.db.student.findFirst({ where: { id: student.id, institutionCode: student.institutionCode, studentNumber: student.studentNumber }, select: { phone: true } });
    if (!profile?.phone) throw new UorStudentError("UOR_STUDENT_ADMIN_MFA_UNAVAILABLE", "O perfil administrativo não possui telefone confirmado.", 409);
    const code = this.generateCode();
    await this.delivery.send({ studentId: student.id, message: uorStudentOtpMessage("admin", code) });
    await this.db.$transaction(async (tx) => {
      await tx.studentAccessCode.updateMany({ where: { studentId: student.id, purpose: "UOR_STUDENT_ADMIN_MFA", usedAt: null }, data: { usedAt: now, deliveryStatus: "SUPERSEDED" } });
      await tx.studentAccessCode.create({ data: { studentId: student.id, phone: profile.phone!, codeHash: this.#codeHash(student.id, code), codeLast4: code.slice(-4), expiresAt: new Date(now.getTime() + 10 * 60_000), sentAt: now, purpose: "UOR_STUDENT_ADMIN_MFA", deliveryStatus: "SENT" } });
      await tx.uorStudentAuditEvent.create({ data: { studentId: student.id, institutionCode: student.institutionCode, domain: "admin", action: "admin.mfa_requested", resourceType: "admin_session", purpose: "privileged_operation", result: "accepted" } });
    });
    return { accepted: true as const, expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString() };
  }

  async verifyMfa(student: UorStudentIdentity, code: string) {
    const now = this.now();
    const challenge = await this.db.studentAccessCode.findFirst({ where: { studentId: student.id, purpose: "UOR_STUDENT_ADMIN_MFA", usedAt: null, expiresAt: { gt: now }, deliveryStatus: "SENT" }, orderBy: { sentAt: "desc" } });
    const incoming = Buffer.from(this.#codeHash(student.id, code));
    const expected = Buffer.from(challenge?.codeHash ?? "");
    if (!challenge || incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) throw new UorStudentError("UOR_STUDENT_ADMIN_MFA_INVALID", "O código MFA é inválido ou expirou.", 403);
    const used = await this.db.studentAccessCode.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: now, deliveryStatus: "USED" } });
    if (used.count !== 1) throw new UorStudentError("UOR_STUDENT_ADMIN_MFA_INVALID", "O código MFA já foi utilizado.", 409);
    const payload = Buffer.from(JSON.stringify({ v: 1, studentId: student.id, institutionCode: student.institutionCode, expiresAt: now.getTime() + 5 * 60_000 })).toString("base64url");
    const signature = createHmac("sha256", this.#secret).update(`token:${payload}`).digest("base64url");
    return { token: `${payload}.${signature}`, expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString() };
  }

  verifyMfaToken(student: UorStudentIdentity, token?: string) {
    const [payload, signature, extra] = token?.split(".") ?? [];
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", this.#secret).update(`token:${payload}`).digest();
    const incoming = Buffer.from(signature, "base64url");
    if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v: number; studentId: number; institutionCode: string; expiresAt: number };
      return parsed.v === 1 && parsed.studentId === student.id && parsed.institutionCode === student.institutionCode && parsed.expiresAt > this.now().getTime();
    } catch { return false; }
  }

  async listConfigurations(student: UorStudentIdentity) {
    const rows = await this.db.uorStudentProductConfiguration.findMany({ where: { institutionCode: student.institutionCode }, orderBy: [{ key: "asc" }, { version: "desc" }], take: 500 });
    return rows.map((row) => ({ id: row.id, key: row.key, version: row.version, value: parseObject(row.valueJson), status: row.status.toLowerCase(), effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: row.effectiveUntil?.toISOString() ?? null, createdAt: row.createdAt.toISOString() }));
  }

  async directionAcademicContextReadModel(student: UorStudentIdentity, period?: string) {
    const groups = await this.db.student.groupBy({
      by: ["course", "academicYear", "academicPeriod"],
      where: {
        institutionCode: student.institutionCode,
        isUorStudent: true,
        deletedAt: null,
        course: { not: null },
        ...(period ? { academicPeriod: period } : {}),
      },
      _count: { _all: true },
      orderBy: [{ course: "asc" }, { academicYear: "asc" }, { academicPeriod: "asc" }],
      take: 1_000,
    });
    const buckets = groups
      .filter((group) => group._count._all >= this.directionMinimumSample)
      .map((group) => ({
        course: group.course!,
        academicYear: group.academicYear,
        academicPeriod: group.academicPeriod,
        students: group._count._all,
      }));
    const generatedAt = this.now();
    await this.db.uorStudentAuditEvent.create({
      data: {
        studentId: student.id,
        institutionCode: student.institutionCode,
        domain: "read_models",
        action: "direction.academic_context.published",
        resourceType: "direction_read_model",
        resourceId: "uor_student.direction.academic_context.v1",
        purpose: "institutional_academic_planning",
        result: "succeeded",
        metadataJson: JSON.stringify({ period: period ?? null, buckets: buckets.length, suppressedBuckets: groups.length - buckets.length }),
      },
    });
    return {
      id: "uor_student.direction.academic_context.v1" as const,
      version: 1 as const,
      producer: "uor_student" as const,
      authorizedConsumer: "uor_direction" as const,
      purpose: "institutional_academic_planning" as const,
      institutionCode: student.institutionCode,
      period: period ?? null,
      minimumSample: this.directionMinimumSample,
      buckets,
      suppressedBuckets: groups.length - buckets.length,
      generatedAt: generatedAt.toISOString(),
    };
  }

  async correctStudentNumber(input: { student: UorStudentIdentity; profileId: string; newStudentNumber: string; reason: string; traceId?: string }) {
    const result = await this.db.$transaction(async (tx) => {
      const target = await tx.student.findFirst({
        where: {
          uorStudentPublicId: input.profileId,
          institutionCode: input.student.institutionCode,
          isUorStudent: true,
          deletedAt: null,
        },
        select: { id: true, uorStudentPublicId: true, studentNumber: true },
      });
      if (!target?.uorStudentPublicId) return null;
      const collision = await tx.student.findFirst({
        where: {
          institutionCode: input.student.institutionCode,
          studentNumber: input.newStudentNumber,
          id: { not: target.id },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (collision) throw new UorStudentError("UOR_STUDENT_NUMBER_CONFLICT", "O novo número académico já pertence a outro perfil da instituição.", 409);
      if (target.studentNumber !== input.newStudentNumber) {
        await tx.student.update({
          where: { id: target.id },
          data: { studentNumber: input.newStudentNumber },
          select: { id: true },
        });
      }
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          domain: "identity",
          action: "student_number.corrected",
          resourceType: "student_profile",
          resourceId: target.uorStudentPublicId,
          purpose: "institutional_identity_correction",
          result: "succeeded",
          traceId: input.traceId,
          metadataJson: JSON.stringify({ previousStudentNumber: target.studentNumber, newStudentNumber: input.newStudentNumber, reason: input.reason }),
        },
      });
      return {
        profileId: target.uorStudentPublicId,
        previousStudentNumber: target.studentNumber,
        studentNumber: input.newStudentNumber,
        relationshipsPreserved: true as const,
      };
    });
    if (!result) throw new UorStudentError("UOR_STUDENT_NOT_FOUND", "O perfil institucional não foi encontrado.", 404);
    return result;
  }

  async setConfiguration(input: { student: UorStudentIdentity; key: string; value: Record<string, unknown>; effectiveFrom: Date; traceId?: string }) {
    const now = this.now();
    if (input.effectiveFrom < new Date(now.getTime() - 60_000)) throw new UorStudentError("UOR_STUDENT_CONFIGURATION_DATE_INVALID", "A vigência não pode começar no passado.", 422);
    const row = await this.db.$transaction(async (tx) => {
      const latest = await tx.uorStudentProductConfiguration.findFirst({ where: { institutionCode: input.student.institutionCode, key: input.key }, orderBy: { version: "desc" } });
      await tx.uorStudentProductConfiguration.updateMany({ where: { institutionCode: input.student.institutionCode, key: input.key, status: "ACTIVE" }, data: { status: "RETIRED", effectiveUntil: input.effectiveFrom } });
      const created = await tx.uorStudentProductConfiguration.create({ data: { institutionCode: input.student.institutionCode, key: input.key, version: (latest?.version ?? 0) + 1, valueJson: JSON.stringify(input.value), status: "ACTIVE", effectiveFrom: input.effectiveFrom, createdByStudentId: input.student.id } });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "admin", action: "configuration.version_created", resourceType: "product_configuration", resourceId: created.id, purpose: "uor_student_configuration", result: "succeeded", traceId: input.traceId } });
      return created;
    });
    return { id: row.id, key: row.key, version: row.version, value: parseObject(row.valueJson), status: row.status.toLowerCase(), effectiveFrom: row.effectiveFrom.toISOString(), effectiveUntil: null, createdAt: row.createdAt.toISOString() };
  }

  async moderationQueue(student: UorStudentIdentity, limit: number) {
    const rows = await this.db.uorStudentAggregate.findMany({ where: { institutionCode: student.institutionCode, category: { in: ["market_report", "teaching_report"] }, status: "PENDING_MODERATION" }, orderBy: { createdAt: "asc" }, take: limit });
    return rows.map((row) => ({ id: row.id, category: row.category, targetId: row.scopeKey, reason: textFromPayload(row.payloadJson, "reason"), details: textFromPayload(row.payloadJson, "details"), createdAt: row.createdAt.toISOString() }));
  }

  async moderate(input: { student: UorStudentIdentity; reportId: string; decision: "dismiss" | "remove_content"; rationale: string; traceId?: string }) {
    const result = await this.db.$transaction(async (tx) => {
      const report = await tx.uorStudentAggregate.findFirst({ where: { id: input.reportId, institutionCode: input.student.institutionCode, category: { in: ["market_report", "teaching_report"] }, status: "PENDING_MODERATION" } });
      if (!report) return null;
      const targetCategory = report.category === "market_report" ? "market_listing" : "teaching_evaluation";
      const target = await tx.uorStudentAggregate.findFirst({ where: { id: report.scopeKey, institutionCode: input.student.institutionCode, category: targetCategory } });
      if (input.decision === "remove_content" && target) await tx.uorStudentAggregate.update({ where: { id: target.id }, data: { status: targetCategory === "market_listing" ? "REMOVED" : "HIDDEN", version: { increment: 1 } } });
      await tx.uorStudentAggregate.update({ where: { id: report.id }, data: { status: input.decision === "dismiss" ? "RESOLVED_DISMISSED" : "RESOLVED_ACTIONED", version: { increment: 1 } } });
      await tx.uorStudentAggregateEvent.create({ data: { aggregateId: report.id, actorStudentId: input.student.id, institutionCode: input.student.institutionCode, type: `${report.category}.moderated`, toStatus: input.decision === "dismiss" ? "RESOLVED_DISMISSED" : "RESOLVED_ACTIONED", payloadJson: JSON.stringify({ decision: input.decision, rationale: input.rationale }), traceId: input.traceId } });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "moderation", action: `moderation.${input.decision}`, resourceType: report.category, resourceId: report.id, purpose: "community_safety", result: "succeeded", traceId: input.traceId } });
      return { reportId: report.id, targetId: target?.id ?? null, decision: input.decision, targetStatus: target ? (input.decision === "remove_content" ? (targetCategory === "market_listing" ? "removed" : "hidden") : target.status.toLowerCase()) : null, resolvedAt: this.now().toISOString() };
    });
    if (!result) throw new UorStudentError("UOR_STUDENT_MODERATION_NOT_FOUND", "A denúncia não está pendente ou não pertence à instituição.", 404);
    return result;
  }

  async listOperationalAlerts(student: UorStudentIdentity, input: { status?: "open" | "resolved"; limit: number }) {
    const rows = await this.db.uorStudentOperationalAlert.findMany({
      where: { institutionCode: student.institutionCode, ...(input.status ? { status: input.status.toUpperCase() } : {}) },
      orderBy: { lastDetectedAt: "desc" },
      take: input.limit,
    });
    return rows.map((row) => ({ id: row.id, provider: row.provider, domain: row.domain, code: row.code, severity: row.severity.toLowerCase(), status: row.status.toLowerCase(), occurrences: row.occurrences, firstDetectedAt: row.firstDetectedAt.toISOString(), lastDetectedAt: row.lastDetectedAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null, resolution: row.resolution }));
  }

  async resolveOperationalAlert(input: { student: UorStudentIdentity; id: string; resolution: string; traceId?: string }) {
    const now = this.now();
    const changed = await this.db.$transaction(async (tx) => {
      const updated = await tx.uorStudentOperationalAlert.updateMany({ where: { id: input.id, institutionCode: input.student.institutionCode, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: now, resolvedByStudentId: input.student.id, resolution: input.resolution } });
      if (updated.count !== 1) return null;
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "operations", action: "operational_alert.resolved", resourceType: "operational_alert", resourceId: input.id, purpose: "upstream_contract_monitoring", result: "succeeded", traceId: input.traceId } });
      return tx.uorStudentOperationalAlert.findUniqueOrThrow({ where: { id: input.id } });
    });
    if (!changed) throw new UorStudentError("UOR_STUDENT_OPERATIONAL_ALERT_NOT_FOUND", "O alerta operacional não está aberto nesta instituição.", 404);
    return { id: changed.id, status: changed.status.toLowerCase(), resolvedAt: changed.resolvedAt!.toISOString(), resolution: changed.resolution! };
  }
}

function textFromPayload(payloadJson: string, key: string) {
  const value = parseObject(payloadJson)[key];
  return typeof value === "string" ? value : null;
}
