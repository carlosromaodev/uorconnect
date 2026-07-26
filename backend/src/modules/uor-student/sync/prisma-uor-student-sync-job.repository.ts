import { prisma } from "../../../shared/prisma";
import type {
  EnqueueUorStudentSyncJob,
  UorStudentSyncJob,
  UorStudentSyncJobRepository,
} from "./domain";

type Database = typeof prisma;

type StoredJob = NonNullable<Awaited<ReturnType<Database["uorStudentSyncJob"]["findUnique"]>>> & {
  student?: { id: number; institutionCode: string; studentNumber: string };
};

function jobView(job: StoredJob): UorStudentSyncJob {
  if (!job.student) throw new Error("UOR_STUDENT_SYNC_IDENTITY_MISSING");
  if (job.provider !== "secretaria" && job.provider !== "moodle") {
    throw new Error("UOR_STUDENT_SYNC_PROVIDER_INVALID");
  }
  if (job.operation !== "secretaria_full" && job.operation !== "moodle_bootstrap_or_refresh") {
    throw new Error("UOR_STUDENT_SYNC_OPERATION_INVALID");
  }
  return {
    id: job.id,
    student: job.student,
    provider: job.provider,
    operation: job.operation,
    reason: job.reason,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    nextAttemptAt: job.nextAttemptAt,
    leaseOwner: job.leaseOwner,
    leaseUntil: job.leaseUntil,
    providerRunId: job.providerRunId,
    lastErrorCode: job.lastErrorCode,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

const includeStudent = {
  student: { select: { id: true, institutionCode: true, studentNumber: true } },
} as const;

export class PrismaUorStudentSyncJobRepository implements UorStudentSyncJobRepository {
  constructor(private readonly db: Database = prisma) {}

  async enqueue(input: EnqueueUorStudentSyncJob) {
    const job = await this.db.uorStudentSyncJob.upsert({
      where: {
        studentId_idempotencyKey: {
          studentId: input.student.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        studentId: input.student.id,
        institutionCode: input.student.institutionCode,
        provider: input.provider,
        operation: input.operation,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        maxAttempts: input.maxAttempts ?? 5,
      },
      update: {},
      include: includeStudent,
    });
    return jobView(job);
  }

  async claimNext(input: { owner: string; now: Date; leaseMs: number }) {
    return this.db.$transaction(async (tx) => {
      const candidates = await tx.uorStudentSyncJob.findMany({
        where: {
          nextAttemptAt: { lte: input.now },
          OR: [
            { status: "QUEUED" },
            { status: "RUNNING", leaseUntil: { lt: input.now } },
          ],
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        take: 50,
      });
      const candidate = candidates.find((job) => job.attempts < job.maxAttempts);
      if (!candidate || candidate.attempts >= candidate.maxAttempts) return null;
      const leaseUntil = new Date(input.now.getTime() + input.leaseMs);
      const claimed = await tx.uorStudentSyncJob.updateMany({
        where: {
          id: candidate.id,
          attempts: candidate.attempts,
          OR: [
            { status: "QUEUED" },
            { status: "RUNNING", leaseUntil: { lt: input.now } },
          ],
        },
        data: {
          status: "RUNNING",
          attempts: { increment: 1 },
          leaseOwner: input.owner,
          leaseUntil,
          heartbeatAt: input.now,
          startedAt: candidate.startedAt ?? input.now,
          lastErrorCode: null,
        },
      });
      if (claimed.count !== 1) return null;
      const job = await tx.uorStudentSyncJob.findUnique({ where: { id: candidate.id }, include: includeStudent });
      return job ? jobView(job) : null;
    });
  }

  async heartbeat(input: { id: string; owner: string; now: Date; leaseMs: number }) {
    const result = await this.db.uorStudentSyncJob.updateMany({
      where: { id: input.id, status: "RUNNING", leaseOwner: input.owner },
      data: {
        heartbeatAt: input.now,
        leaseUntil: new Date(input.now.getTime() + input.leaseMs),
      },
    });
    return result.count === 1;
  }

  async complete(input: { id: string; owner: string; providerRunId: string | null; now: Date }) {
    const result = await this.db.uorStudentSyncJob.updateMany({
      where: { id: input.id, status: "RUNNING", leaseOwner: input.owner },
      data: {
        status: "COMPLETED",
        providerRunId: input.providerRunId,
        finishedAt: input.now,
        leaseOwner: null,
        leaseUntil: null,
        heartbeatAt: input.now,
        lastErrorCode: null,
      },
    });
    return result.count === 1;
  }

  async fail(input: {
    id: string;
    owner: string;
    errorCode: string;
    retryable: boolean;
    retryAt: Date;
    now: Date;
  }) {
    const current = await this.db.uorStudentSyncJob.findFirst({
      where: { id: input.id, status: "RUNNING", leaseOwner: input.owner },
      select: { attempts: true, maxAttempts: true },
    });
    if (!current) return false;
    const shouldRetry = input.retryable && current.attempts < current.maxAttempts;
    const result = await this.db.uorStudentSyncJob.updateMany({
      where: { id: input.id, status: "RUNNING", leaseOwner: input.owner, attempts: current.attempts },
      data: {
        status: shouldRetry ? "QUEUED" : "FAILED",
        nextAttemptAt: shouldRetry ? input.retryAt : input.now,
        finishedAt: shouldRetry ? null : input.now,
        leaseOwner: null,
        leaseUntil: null,
        heartbeatAt: input.now,
        lastErrorCode: input.errorCode,
      },
    });
    return result.count === 1;
  }
}
