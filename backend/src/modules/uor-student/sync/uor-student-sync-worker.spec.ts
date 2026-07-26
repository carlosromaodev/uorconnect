import { describe, expect, it, vi } from "vitest";
import type { MoodleApplication } from "../../moodle/application/ports";
import type { SecretariaApplication } from "../../secretaria/application/secretaria.application";
import { DEFAULT_MOODLE_STUDENT_PASSWORD } from "../domain/constants";
import type {
  EnqueueUorStudentSyncJob,
  UorStudentSyncJob,
  UorStudentSyncJobRepository,
} from "./domain";
import { UorStudentSyncWorker } from "./uor-student-sync-worker";

const now = new Date("2026-07-22T12:00:00.000Z");
const student = { id: 42, institutionCode: "UOR", studentNumber: "20240001" };

class MemoryJobs implements UorStudentSyncJobRepository {
  jobs: UorStudentSyncJob[] = [];

  async enqueue(input: EnqueueUorStudentSyncJob) {
    const previous = this.jobs.find((job) => job.student.id === input.student.id && job.idempotencyKey === input.idempotencyKey);
    if (previous) return previous;
    const job: UorStudentSyncJob = {
      id: `job-${this.jobs.length + 1}`,
      student: input.student,
      provider: input.provider,
      operation: input.operation,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      status: "QUEUED",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      nextAttemptAt: now,
      leaseOwner: null,
      leaseUntil: null,
      providerRunId: null,
      lastErrorCode: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.push(job);
    return job;
  }

  async claimNext(input: { owner: string; now: Date; leaseMs: number }) {
    const job = this.jobs.find((item) => item.status === "QUEUED" && item.nextAttemptAt <= input.now && item.attempts < item.maxAttempts);
    if (!job) return null;
    job.status = "RUNNING";
    job.attempts += 1;
    job.leaseOwner = input.owner;
    job.leaseUntil = new Date(input.now.getTime() + input.leaseMs);
    job.startedAt ??= input.now;
    return job;
  }

  async heartbeat() { return true; }

  async complete(input: { id: string; providerRunId: string | null; now: Date }) {
    const job = this.jobs.find((item) => item.id === input.id);
    if (!job) return false;
    job.status = "COMPLETED";
    job.providerRunId = input.providerRunId;
    job.finishedAt = input.now;
    return true;
  }

  async fail(input: { id: string; errorCode: string; retryable: boolean; retryAt: Date; now: Date }) {
    const job = this.jobs.find((item) => item.id === input.id);
    if (!job) return false;
    job.status = input.retryable && job.attempts < job.maxAttempts ? "QUEUED" : "FAILED";
    job.nextAttemptAt = input.retryAt;
    job.lastErrorCode = input.errorCode;
    job.finishedAt = job.status === "FAILED" ? input.now : null;
    return true;
  }
}

function providers(connection: {
  connected: boolean;
  credentialsStored: boolean;
  actionRequired?: "none" | "connect" | "reauthenticate" | "contact_support";
}) {
  const secretaria = {
    startSync: vi.fn(async () => ({ id: "secretaria-run" })),
  } as unknown as SecretariaApplication;
  const moodle = {
    getConnection: vi.fn(async () => ({
      status: connection.connected ? "CONNECTED" : "DEGRADED",
      connected: connection.connected,
      credentialsStored: connection.credentialsStored,
      actionRequired: connection.actionRequired ?? "none",
      retryable: !connection.connected,
      lastAuthenticatedAt: null,
      lastSuccessfulSyncAt: null,
    })),
    connect: vi.fn(async () => ({ connection: {}, initialSyncRunId: "moodle-initial", created: true })),
    retryStoredConnection: vi.fn(async () => ({ connection: {}, initialSyncRunId: "moodle-retry", created: false })),
    startSync: vi.fn(async () => ({ id: "moodle-refresh" })),
  } as unknown as MoodleApplication;
  return { secretaria, moodle };
}

describe("UorStudentSyncWorker", () => {
  it("persiste tarefas idempotentes e usa a senha padrão apenas no primeiro bootstrap", async () => {
    const repository = new MemoryJobs();
    const { secretaria, moodle } = providers({ connected: false, credentialsStored: false });
    const worker = new UorStudentSyncWorker(repository, secretaria, moodle, {
      now: () => now,
      uuid: () => "worker-a",
    });

    await worker.enqueueLogin(student);
    await worker.enqueueLogin(student);
    await worker.waitForIdle();
    await worker.stop();

    expect(repository.jobs).toHaveLength(2);
    expect(repository.jobs.every((job) => job.status === "COMPLETED")).toBe(true);
    expect(secretaria.startSync).toHaveBeenCalledTimes(1);
    expect(moodle.connect).toHaveBeenCalledWith(
      { id: 42, studentNumber: "20240001" },
      { username: "20240001", password: DEFAULT_MOODLE_STUDENT_PASSWORD, rememberCredentials: true },
    );
  });

  it("reutiliza a credencial cifrada existente e não volta à senha padrão", async () => {
    const repository = new MemoryJobs();
    const { secretaria, moodle } = providers({ connected: false, credentialsStored: true });
    const worker = new UorStudentSyncWorker(repository, secretaria, moodle, {
      now: () => now,
      uuid: () => "worker-b",
    });

    await worker.enqueueLogin(student);
    await worker.waitForIdle();
    await worker.stop();

    expect(moodle.connect).not.toHaveBeenCalled();
    expect(moodle.retryStoredConnection).toHaveBeenCalledWith({ id: 42, studentNumber: "20240001" });
  });

  it("não repete automaticamente uma credencial rejeitada", async () => {
    const repository = new MemoryJobs();
    const { secretaria, moodle } = providers({
      connected: false,
      credentialsStored: true,
      actionRequired: "reauthenticate",
    });
    const worker = new UorStudentSyncWorker(repository, secretaria, moodle, {
      now: () => now,
      uuid: () => "worker-c",
    });

    await worker.enqueueLogin(student);
    await worker.waitForIdle();
    await worker.stop();

    const moodleJob = repository.jobs.find((job) => job.provider === "moodle");
    expect(moodleJob).toMatchObject({ status: "FAILED", attempts: 1, lastErrorCode: "MOODLE_REAUTH_REQUIRED" });
    expect(moodle.connect).not.toHaveBeenCalled();
    expect(moodle.retryStoredConnection).not.toHaveBeenCalled();
  });

  it("processa alterações oficiais automaticamente após sincronização concluída", async () => {
    const repository = new MemoryJobs();
    const { secretaria, moodle } = providers({ connected: true, credentialsStored: true });
    vi.mocked(secretaria.startSync).mockResolvedValue({
      id: "secretaria-run",
      status: "COMPLETED",
      snapshotVersion: 7,
      domains: ["academic.grades"],
      completedDomains: ["academic.grades"],
      failedDomains: [],
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
    });
    const changeProcessor = { record: vi.fn(async () => undefined) };
    const worker = new UorStudentSyncWorker(repository, secretaria, moodle, {
      now: () => now,
      uuid: () => "worker-d",
      changeProcessor,
    });

    await worker.enqueueLogin(student);
    await worker.waitForIdle();
    await worker.stop();

    expect(changeProcessor.record).toHaveBeenCalledWith({ student, snapshotVersion: 7 });
  });

  it("regista drift técnico para operação administrativa sem expor o erro ao utilizador", async () => {
    const repository = new MemoryJobs();
    const { secretaria, moodle } = providers({ connected: true, credentialsStored: true });
    const failure = new Error("changed") as Error & { code: string; statusCode: number };
    failure.code = "SECRETARIA_UPSTREAM_CHANGED";
    failure.statusCode = 502;
    vi.mocked(secretaria.startSync).mockRejectedValue(failure);
    const changeProcessor = { record: vi.fn(async () => undefined), recordFailure: vi.fn(async () => undefined) };
    const worker = new UorStudentSyncWorker(repository, secretaria, moodle, { now: () => now, uuid: () => "worker-e", changeProcessor });

    await worker.enqueueLogin(student);
    await worker.waitForIdle();
    await worker.stop();

    expect(changeProcessor.recordFailure).toHaveBeenCalledWith({ student, provider: "secretaria", errorCode: "SECRETARIA_UPSTREAM_CHANGED" });
  });
});
