import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import type { UorStudentIdentity } from "../application/ports";
import type { UorStudentOtpDelivery } from "../authorizations/authorization-service";
import { UorStudentError } from "../domain/errors";
import { uorStudentOtpMessage } from "../notifications/sms-policy";

type Database = typeof prisma;

export class UorStudentStepUpApplication {
  readonly #secret: Buffer;
  constructor(
    secret: string,
    private readonly delivery: UorStudentOtpDelivery,
    private readonly db: Database = prisma,
    private readonly now: () => Date = () => new Date(),
    private readonly generateCode: () => string = () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
  ) { this.#secret = createHmac("sha256", secret).update("uor-student-step-up-v1").digest(); }

  #contextHash(student: UorStudentIdentity, action: string, resourceId: string) {
    return createHmac("sha256", this.#secret).update(`context:${student.id}:${student.institutionCode}:${action}:${resourceId}`).digest("hex");
  }
  #codeHash(id: string, contextHash: string, code: string) {
    return createHmac("sha256", this.#secret).update(`code:${id}:${contextHash}:${code}`).digest("hex");
  }

  async request(input: { student: UorStudentIdentity; action: string; resourceId: string; traceId?: string }) {
    const now = this.now();
    const contextHash = this.#contextHash(input.student, input.action, input.resourceId);
    const recent = await this.db.uorStudentStepUpChallenge.findFirst({ where: { studentId: input.student.id, contextHash }, orderBy: { createdAt: "desc" } });
    if (recent && recent.lastSentAt > new Date(now.getTime() - 60_000)) throw new UorStudentError("UOR_STUDENT_STEP_UP_RATE_LIMIT", "Aguarda antes de pedir um novo código.", 429, true);
    if (recent && recent.resendCount >= recent.maxResends) throw new UorStudentError("UOR_STUDENT_STEP_UP_RATE_LIMIT", "O limite de reenvios foi atingido.", 429);
    const id = crypto.randomUUID();
    const code = this.generateCode();
    const expiresAt = new Date(now.getTime() + 10 * 60_000);
    const challenge = await this.db.$transaction(async (tx) => {
      await tx.uorStudentStepUpChallenge.updateMany({ where: { studentId: input.student.id, contextHash, status: "PENDING" }, data: { status: "SUPERSEDED" } });
      const created = await tx.uorStudentStepUpChallenge.create({ data: { id, studentId: input.student.id, institutionCode: input.student.institutionCode, contextHash, codeHash: this.#codeHash(id, contextHash, code), expiresAt, resendCount: (recent?.resendCount ?? -1) + 1, lastSentAt: now } });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "security", action: "step_up.requested", resourceType: "sensitive_operation", resourceId: input.resourceId, purpose: input.action, result: "accepted", traceId: input.traceId } });
      return created;
    });
    try { await this.delivery.send({ studentId: input.student.id, message: uorStudentOtpMessage("step_up", code) }); }
    catch {
      await this.db.uorStudentStepUpChallenge.update({ where: { id }, data: { status: "DELIVERY_FAILED" } });
      throw new UorStudentError("UOR_STUDENT_STEP_UP_DELIVERY_FAILED", "Não foi possível entregar o código de confirmação.", 503, true);
    }
    return { challengeId: challenge.id, expiresAt: challenge.expiresAt.toISOString(), attemptsRemaining: challenge.maxAttempts, resendsRemaining: challenge.maxResends - challenge.resendCount };
  }

  async verify(input: { student: UorStudentIdentity; challengeId: string; action: string; resourceId: string; code: string; traceId?: string }) {
    const now = this.now();
    const contextHash = this.#contextHash(input.student, input.action, input.resourceId);
    const outcome = await this.db.$transaction(async (tx) => {
      const challenge = await tx.uorStudentStepUpChallenge.findFirst({ where: { id: input.challengeId, studentId: input.student.id, institutionCode: input.student.institutionCode, contextHash, status: "PENDING" } });
      if (!challenge || challenge.expiresAt <= now || challenge.attempts >= challenge.maxAttempts) return { kind: "invalid" as const };
      const incoming = Buffer.from(this.#codeHash(challenge.id, challenge.contextHash, input.code));
      const expected = Buffer.from(challenge.codeHash);
      if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
        const attempts = challenge.attempts + 1;
        await tx.uorStudentStepUpChallenge.updateMany({ where: { id: challenge.id, attempts: challenge.attempts, status: "PENDING" }, data: { attempts, ...(attempts >= challenge.maxAttempts ? { status: "LOCKED", lockedAt: now } : {}) } });
        await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "security", action: "step_up.failed", resourceType: "sensitive_operation", resourceId: input.resourceId, purpose: input.action, result: "denied", traceId: input.traceId } });
        return { kind: "incorrect" as const };
      }
      const changed = await tx.uorStudentStepUpChallenge.updateMany({ where: { id: challenge.id, attempts: challenge.attempts, status: "PENDING" }, data: { status: "VERIFIED", verifiedAt: now, attempts: { increment: 1 } } });
      if (changed.count !== 1) return { kind: "invalid" as const };
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "security", action: "step_up.verified", resourceType: "sensitive_operation", resourceId: input.resourceId, purpose: input.action, result: "succeeded", traceId: input.traceId } });
      return { kind: "verified" as const };
    });
    if (outcome.kind === "incorrect") throw new UorStudentError("UOR_STUDENT_STEP_UP_INCORRECT", "O código está incorreto.", 403);
    if (outcome.kind === "invalid") throw new UorStudentError("UOR_STUDENT_STEP_UP_INVALID", "O código expirou, foi bloqueado ou não corresponde à operação.", 409);
    const payload = Buffer.from(JSON.stringify({ v: 1, studentId: input.student.id, institutionCode: input.student.institutionCode, action: input.action, resourceId: input.resourceId, expiresAt: now.getTime() + 5 * 60_000 })).toString("base64url");
    const signature = createHmac("sha256", this.#secret).update(`token:${payload}`).digest("base64url");
    return { token: `${payload}.${signature}`, expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString() };
  }

  verifyToken(student: UorStudentIdentity, token: string | undefined, action: string, resourceId: string) {
    const [payload, signature, extra] = token?.split(".") ?? [];
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", this.#secret).update(`token:${payload}`).digest();
    const incoming = Buffer.from(signature, "base64url");
    if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { v: number; studentId: number; institutionCode: string; action: string; resourceId: string; expiresAt: number };
      return parsed.v === 1 && parsed.studentId === student.id && parsed.institutionCode === student.institutionCode && parsed.action === action && parsed.resourceId === resourceId && parsed.expiresAt > this.now().getTime();
    } catch { return false; }
  }
}
