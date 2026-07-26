import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import type { UorStudentIdentity } from "../application/ports";
import { UorStudentError } from "../domain/errors";

type Database = typeof prisma;

export type UorStudentAuthorizationView = {
  id: string;
  ownerProfileId: string;
  representativeProfileId: string;
  purpose: string;
  action: string;
  resourceType: string;
  resourceId: string;
  fields: string[];
  status: "pending" | "active" | "rejected" | "revoked" | "expired" | "used";
  startsAt: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  decidedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface UorStudentOtpDelivery {
  send(input: { studentId: number; message: string }): Promise<void>;
}

type AuthorizationRow = {
  id: string;
  purpose: string;
  action: string;
  resourceType: string;
  resourceId: string;
  fieldsJson: string;
  status: string;
  startsAt: Date;
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  decidedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  owner: { uorStudentPublicId: string | null };
  representative: { uorStudentPublicId: string | null };
};

const relations = {
  owner: { select: { uorStudentPublicId: true } },
  representative: { select: { uorStudentPublicId: true } },
} as const;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function parseFields(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch { return []; }
}

function effectiveStatus(row: Pick<AuthorizationRow, "status" | "expiresAt" | "usedCount" | "maxUses">, now = new Date()): UorStudentAuthorizationView["status"] {
  if (row.status === "ACTIVE" && row.expiresAt <= now) return "expired";
  if (row.status === "ACTIVE" && row.usedCount >= row.maxUses) return "used";
  const statuses: Record<string, UorStudentAuthorizationView["status"]> = {
    PENDING: "pending", ACTIVE: "active", REJECTED: "rejected", REVOKED: "revoked", EXPIRED: "expired", USED: "used",
  };
  return statuses[row.status] ?? "revoked";
}

function view(row: AuthorizationRow, now = new Date()): UorStudentAuthorizationView {
  if (!row.owner.uorStudentPublicId || !row.representative.uorStudentPublicId) throw new Error("UOR_STUDENT_AUTHORIZATION_PROFILE_INVALID");
  return {
    id: row.id,
    ownerProfileId: row.owner.uorStudentPublicId,
    representativeProfileId: row.representative.uorStudentPublicId,
    purpose: row.purpose,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    fields: parseFields(row.fieldsJson),
    status: effectiveStatus(row, now),
    startsAt: row.startsAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validFields(fields: string[]) {
  return fields.length > 0
    && fields.length <= 20
    && new Set(fields).size === fields.length
    && fields.every((field) => /^[a-z][a-z0-9_.-]{1,79}$/i.test(field) && field !== "*" && !field.endsWith(".*") && field !== "all" && field !== "full_access");
}

export function authorizationContext(input: { purpose: string; action: string; resourceType: string; resourceId: string; fields: string[] }) {
  return stableJson({ ...input, fields: [...input.fields].sort() });
}

export class LiveUorStudentAuthorizationApplication {
  readonly #secret: Buffer;

  constructor(
    secret: string,
    private readonly delivery: UorStudentOtpDelivery,
    private readonly db: Database = prisma,
    private readonly now: () => Date = () => new Date(),
    private readonly generateCode: () => string = () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
  ) {
    this.#secret = createHmac("sha256", secret).update("uor-student-authorization-v1").digest();
  }

  #hashContext(context: string) {
    return createHmac("sha256", this.#secret).update(`context:${context}`).digest("hex");
  }

  #hashCode(challengeId: string, contextHash: string, code: string) {
    return createHmac("sha256", this.#secret).update(`otp:${challengeId}:${contextHash}:${code}`).digest("hex");
  }

  async create(input: {
    owner: UorStudentIdentity;
    representativeProfileId: string;
    purpose: string;
    action: string;
    resourceType: string;
    resourceId: string;
    fields: string[];
    startsAt?: Date;
    expiresAt: Date;
    maxUses: number;
    traceId?: string;
  }) {
    const now = this.now();
    const startsAt = input.startsAt ?? now;
    if (!validFields(input.fields)) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_SCOPE_INVALID", "A autorização deve conter campos explícitos e não aceita acesso genérico.", 422);
    if (startsAt < new Date(now.getTime() - 60_000) || input.expiresAt <= startsAt || input.expiresAt > new Date(now.getTime() + 31 * 24 * 60 * 60_000)) {
      throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_VALIDITY_INVALID", "A validade da autorização é inválida ou excede 31 dias.", 422);
    }
    if (!Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 100) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_USES_INVALID", "O limite de utilizações deve estar entre 1 e 100.", 422);
    const representative = await this.db.student.findFirst({
      where: { uorStudentPublicId: input.representativeProfileId, institutionCode: input.owner.institutionCode, deletedAt: null, isUorStudent: true },
      select: { id: true },
    });
    if (!representative || representative.id === input.owner.id) throw new UorStudentError("UOR_STUDENT_REPRESENTATIVE_INVALID", "O representante não foi encontrado ou não é elegível.", 422);
    const contextHash = this.#hashContext(authorizationContext({
      purpose: input.purpose,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      fields: input.fields,
    }));
    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.uorStudentAuthorization.create({
        data: {
          ownerStudentId: input.owner.id,
          representativeStudentId: representative.id,
          institutionCode: input.owner.institutionCode,
          purpose: input.purpose,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          fieldsJson: JSON.stringify([...input.fields].sort()),
          contextHash,
          startsAt,
          expiresAt: input.expiresAt,
          maxUses: input.maxUses,
        },
      });
      await tx.uorStudentNotification.upsert({
        where: { studentId_deduplicationKey: { studentId: representative.id, deduplicationKey: `authorization:${created.id}:created` } },
        create: { studentId: representative.id, institutionCode: input.owner.institutionCode, category: "authorization", deduplicationKey: `authorization:${created.id}:created`, title: "Nova autorização", body: "Existe uma autorização específica aguardando a tua decisão.", payloadJson: JSON.stringify({ authorizationId: created.id }) },
        update: {},
      });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.owner.id, institutionCode: input.owner.institutionCode, domain: "authorization", action: "authorization.created", resourceType: "authorization", resourceId: created.id, purpose: input.purpose, result: "succeeded", traceId: input.traceId } });
      return tx.uorStudentAuthorization.findUniqueOrThrow({ where: { id: created.id }, include: relations });
    });
    return view(row);
  }

  async list(input: { student: UorStudentIdentity; box: "sent" | "received"; status?: UorStudentAuthorizationView["status"]; limit: number; cursor?: string }) {
    const where = {
      institutionCode: input.student.institutionCode,
      ...(input.box === "sent" ? { ownerStudentId: input.student.id } : { representativeStudentId: input.student.id }),
      ...(input.cursor ? { id: { lt: input.cursor } } : {}),
    };
    const rows = await this.db.uorStudentAuthorization.findMany({ where, include: relations, orderBy: { id: "desc" }, take: input.limit + 1 });
    const filtered = rows.map((row) => view(row, this.now())).filter((item) => !input.status || item.status === input.status);
    const items = filtered.slice(0, input.limit);
    return { items, nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null };
  }

  async get(student: UorStudentIdentity, id: string) {
    const row = await this.db.uorStudentAuthorization.findFirst({
      where: { id, institutionCode: student.institutionCode, OR: [{ ownerStudentId: student.id }, { representativeStudentId: student.id }] },
      include: relations,
    });
    if (!row) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_NOT_FOUND", "A autorização não foi encontrada.", 404);
    return view(row, this.now());
  }

  async requestOtp(input: { student: UorStudentIdentity; authorizationId: string; traceId?: string }) {
    const now = this.now();
    const authorization = await this.db.uorStudentAuthorization.findFirst({
      where: { id: input.authorizationId, representativeStudentId: input.student.id, institutionCode: input.student.institutionCode, status: "PENDING", expiresAt: { gt: now } },
    });
    if (!authorization) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_NOT_DECIDABLE", "A autorização não está disponível para decisão.", 409);
    const recent = await this.db.uorStudentOtpChallenge.findFirst({ where: { authorizationId: authorization.id, actorStudentId: input.student.id }, orderBy: { createdAt: "desc" } });
    if (recent && recent.lastSentAt > new Date(now.getTime() - 60_000)) throw new UorStudentError("UOR_STUDENT_OTP_RESEND_LIMIT", "Aguarda antes de pedir um novo código.", 429, true);
    if (recent && recent.resendCount >= recent.maxResends) throw new UorStudentError("UOR_STUDENT_OTP_RESEND_LIMIT", "O limite de reenvios foi atingido.", 429);
    const code = this.generateCode();
    const challengeId = crypto.randomUUID();
    const codeHash = this.#hashCode(challengeId, authorization.contextHash, code);
    const challenge = await this.db.$transaction(async (tx) => {
      await tx.uorStudentOtpChallenge.updateMany({ where: { authorizationId: authorization.id, actorStudentId: input.student.id, status: "PENDING" }, data: { status: "SUPERSEDED" } });
      const created = await tx.uorStudentOtpChallenge.create({
        data: { id: challengeId, authorizationId: authorization.id, actorStudentId: input.student.id, contextHash: authorization.contextHash, codeHash, expiresAt: new Date(now.getTime() + 10 * 60_000), resendCount: (recent?.resendCount ?? -1) + 1, lastSentAt: now },
      });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "authorization", action: "otp.requested", resourceType: "authorization", resourceId: authorization.id, purpose: authorization.purpose, result: "accepted", traceId: input.traceId } });
      return created;
    });
    try {
      await this.delivery.send({ studentId: input.student.id, message: `UOR Estudante: código ${code} para confirmar uma autorização. Válido por 10 minutos. Não partilhes este código.` });
    } catch (error) {
      await this.db.uorStudentOtpChallenge.update({ where: { id: challenge.id }, data: { status: "DELIVERY_FAILED" } });
      throw new UorStudentError("UOR_STUDENT_OTP_DELIVERY_FAILED", "Não foi possível entregar o código de confirmação.", 503, true);
    }
    return { challengeId: challenge.id, expiresAt: challenge.expiresAt.toISOString(), attemptsRemaining: challenge.maxAttempts, resendsRemaining: challenge.maxResends - challenge.resendCount };
  }

  async decide(input: { student: UorStudentIdentity; authorizationId: string; challengeId: string; code: string; decision: "approve" | "reject"; traceId?: string }) {
    const now = this.now();
    const outcome = await this.db.$transaction(async (tx) => {
      const authorization = await tx.uorStudentAuthorization.findFirst({ where: { id: input.authorizationId, representativeStudentId: input.student.id, institutionCode: input.student.institutionCode, status: "PENDING", expiresAt: { gt: now } } });
      if (!authorization) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_NOT_DECIDABLE", "A autorização não está disponível para decisão.", 409);
      const challenge = await tx.uorStudentOtpChallenge.findFirst({ where: { id: input.challengeId, authorizationId: authorization.id, actorStudentId: input.student.id, contextHash: authorization.contextHash, status: "PENDING" } });
      if (!challenge || challenge.expiresAt <= now || challenge.attempts >= challenge.maxAttempts) throw new UorStudentError("UOR_STUDENT_OTP_INVALID", "O código expirou, foi bloqueado ou não corresponde à operação.", 409);
      const incoming = Buffer.from(this.#hashCode(challenge.id, challenge.contextHash, input.code));
      const expected = Buffer.from(challenge.codeHash);
      if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
        const nextAttempts = challenge.attempts + 1;
        await tx.uorStudentOtpChallenge.updateMany({ where: { id: challenge.id, status: "PENDING", attempts: challenge.attempts }, data: { attempts: nextAttempts, ...(nextAttempts >= challenge.maxAttempts ? { status: "LOCKED", lockedAt: now } : {}) } });
        await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "authorization", action: "otp.failed", resourceType: "authorization", resourceId: authorization.id, purpose: authorization.purpose, result: "denied", traceId: input.traceId } });
        return { kind: "incorrect" as const };
      }
      const otpChanged = await tx.uorStudentOtpChallenge.updateMany({ where: { id: challenge.id, status: "PENDING", attempts: challenge.attempts }, data: { status: "VERIFIED", verifiedAt: now, attempts: { increment: 1 } } });
      if (otpChanged.count !== 1) throw new UorStudentError("UOR_STUDENT_OTP_ALREADY_USED", "O código já foi utilizado.", 409);
      const to = input.decision === "approve" ? "ACTIVE" : "REJECTED";
      const changed = await tx.uorStudentAuthorization.updateMany({ where: { id: authorization.id, status: "PENDING" }, data: { status: to, decidedAt: now } });
      if (changed.count !== 1) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_CONFLICT", "A autorização já foi decidida.", 409);
      await tx.uorStudentNotification.upsert({
        where: { studentId_deduplicationKey: { studentId: authorization.ownerStudentId, deduplicationKey: `authorization:${authorization.id}:decided` } },
        create: { studentId: authorization.ownerStudentId, institutionCode: input.student.institutionCode, category: "authorization", deduplicationKey: `authorization:${authorization.id}:decided`, title: "Autorização atualizada", body: input.decision === "approve" ? "A autorização foi aprovada." : "A autorização foi rejeitada.", payloadJson: JSON.stringify({ authorizationId: authorization.id }) },
        update: {},
      });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "authorization", action: `authorization.${input.decision}d`, resourceType: "authorization", resourceId: authorization.id, purpose: authorization.purpose, result: "succeeded", traceId: input.traceId } });
      return { kind: "success" as const, data: view(await tx.uorStudentAuthorization.findUniqueOrThrow({ where: { id: authorization.id }, include: relations }), now) };
    });
    if (outcome.kind === "incorrect") throw new UorStudentError("UOR_STUDENT_OTP_INCORRECT", "O código de confirmação está incorreto.", 403);
    return outcome.data;
  }

  async revoke(input: { student: UorStudentIdentity; authorizationId: string; traceId?: string }) {
    const now = this.now();
    const changed = await this.db.$transaction(async (tx) => {
      const authorization = await tx.uorStudentAuthorization.findFirst({ where: { id: input.authorizationId, ownerStudentId: input.student.id, institutionCode: input.student.institutionCode, status: { in: ["PENDING", "ACTIVE"] } } });
      if (!authorization) return null;
      await tx.uorStudentAuthorization.update({ where: { id: authorization.id }, data: { status: "REVOKED", revokedAt: now } });
      await tx.uorStudentOtpChallenge.updateMany({ where: { authorizationId: authorization.id, status: "PENDING" }, data: { status: "REVOKED" } });
      await tx.uorStudentNotification.upsert({
        where: { studentId_deduplicationKey: { studentId: authorization.representativeStudentId, deduplicationKey: `authorization:${authorization.id}:revoked` } },
        create: { studentId: authorization.representativeStudentId, institutionCode: input.student.institutionCode, category: "authorization", deduplicationKey: `authorization:${authorization.id}:revoked`, title: "Autorização revogada", body: "Uma autorização deixou de estar utilizável.", payloadJson: JSON.stringify({ authorizationId: authorization.id }) }, update: {},
      });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "authorization", action: "authorization.revoked", resourceType: "authorization", resourceId: authorization.id, purpose: authorization.purpose, result: "succeeded", traceId: input.traceId } });
      return tx.uorStudentAuthorization.findUniqueOrThrow({ where: { id: authorization.id }, include: relations });
    });
    if (!changed) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_NOT_REVOCABLE", "A autorização não pode ser revogada.", 409);
    return view(changed, now);
  }

  async consume(input: { student: UorStudentIdentity; authorizationId: string; purpose: string; action: string; resourceType: string; resourceId: string; fields: string[]; traceId?: string }) {
    if (!validFields(input.fields)) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_SCOPE_INVALID", "O uso deve declarar campos explícitos.", 422);
    const now = this.now();
    const contextHash = this.#hashContext(authorizationContext({
      purpose: input.purpose,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      fields: input.fields,
    }));
    const row = await this.db.$transaction(async (tx) => {
      const authorization = await tx.uorStudentAuthorization.findFirst({ where: { id: input.authorizationId, representativeStudentId: input.student.id, institutionCode: input.student.institutionCode, status: "ACTIVE", startsAt: { lte: now }, expiresAt: { gt: now }, contextHash } });
      if (!authorization || authorization.usedCount >= authorization.maxUses) return null;
      const changed = await tx.uorStudentAuthorization.updateMany({ where: { id: authorization.id, status: "ACTIVE", usedCount: authorization.usedCount }, data: { usedCount: { increment: 1 }, ...(authorization.usedCount + 1 >= authorization.maxUses ? { status: "USED" } : {}) } });
      if (changed.count !== 1) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_CONFLICT", "A autorização foi consumida por outro pedido.", 409);
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "authorization", action: "authorization.used", resourceType: input.resourceType, resourceId: input.resourceId, purpose: input.purpose, result: "succeeded", traceId: input.traceId } });
      return tx.uorStudentAuthorization.findUniqueOrThrow({ where: { id: authorization.id }, include: relations });
    });
    if (!row) throw new UorStudentError("UOR_STUDENT_AUTHORIZATION_DENIED", "A autorização não existe, expirou, não corresponde ao contexto ou esgotou os usos.", 403);
    return view(row, now);
  }

  async listNotifications(input: { student: UorStudentIdentity; status?: "unread" | "read"; limit: number; cursor?: string }) {
    const rows = await this.db.uorStudentNotification.findMany({
      where: {
        studentId: input.student.id,
        institutionCode: input.student.institutionCode,
        ...(input.status ? { status: input.status.toUpperCase() } : {}),
        ...(input.cursor ? { id: { lt: input.cursor } } : {}),
      },
      orderBy: { id: "desc" },
      take: input.limit + 1,
    });
    const items = rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      status: row.status.toLowerCase() as "unread" | "read",
      payload: row.payloadJson ? JSON.parse(row.payloadJson) as Record<string, unknown> : null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > input.limit ? items.at(-1)?.id ?? null : null };
  }

  async markNotificationRead(input: { student: UorStudentIdentity; id: string }) {
    const now = this.now();
    const changed = await this.db.uorStudentNotification.updateMany({
      where: { id: input.id, studentId: input.student.id, institutionCode: input.student.institutionCode },
      data: { status: "READ", readAt: now },
    });
    if (changed.count !== 1) throw new UorStudentError("UOR_STUDENT_NOTIFICATION_NOT_FOUND", "A notificação não foi encontrada.", 404);
    return { id: input.id, status: "read" as const, readAt: now.toISOString() };
  }
}

export class OmbalaUorStudentOtpDelivery implements UorStudentOtpDelivery {
  constructor(private readonly env: Env, private readonly db: Database = prisma) {}

  async send(input: { studentId: number; message: string }) {
    const student = await this.db.student.findUnique({ where: { id: input.studentId }, select: { phone: true } });
    const phone = student?.phone?.replace(/\D/g, "");
    if (!phone || !this.env.OMBALA_API_TOKEN) throw new Error("OTP_DELIVERY_UNAVAILABLE");
    const response = await fetch(`${this.env.OMBALA_API_BASE_URL.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: { Authorization: `Token ${this.env.OMBALA_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.env.OMBALA_SMS_DEFAULT_SENDER, to: phone, message: input.message }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("OTP_DELIVERY_FAILED");
  }
}
