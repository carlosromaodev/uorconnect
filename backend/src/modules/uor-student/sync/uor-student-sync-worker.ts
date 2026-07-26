import { randomUUID } from "node:crypto";
import type { MoodleApplication } from "../../moodle/application/ports";
import type { SecretariaApplication } from "../../secretaria/application/secretaria.application";
import { DEFAULT_MOODLE_STUDENT_PASSWORD } from "../domain/constants";
import type { UorStudentIdentity } from "../application/ports";
import type {
  UorStudentRefreshCandidateSource,
  UorStudentOfficialChangeProcessor,
  UorStudentSyncJob,
  UorStudentSyncJobRepository,
} from "./domain";

const POLL_MS = 5_000;
const LEASE_MS = 120_000;
const HEARTBEAT_MS = 20_000;
const LOGIN_BUCKET_MS = 15 * 60_000;
const PERIODIC_SCAN_MS = 60_000;
const SECRETARIA_TTL_MS = 6 * 60 * 60_000;
const MOODLE_TTL_MS = 30 * 60_000;

type Clock = () => Date;

export type UorStudentSyncWorkerOptions = {
  enabled?: boolean;
  now?: Clock;
  uuid?: () => string;
  pollMs?: number;
  leaseMs?: number;
  refreshSource?: UorStudentRefreshCandidateSource;
  periodicScanMs?: number;
  changeProcessor?: UorStudentOfficialChangeProcessor;
};

function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: "UOR_STUDENT_SYNC_FAILED", retryable: true };
  }
  const value = error as { code?: unknown; retryable?: unknown; statusCode?: unknown };
  const code = typeof value.code === "string" && /^[A-Z0-9_]{3,80}$/.test(value.code)
    ? value.code
    : "UOR_STUDENT_SYNC_FAILED";
  const permanentCodes = new Set([
    "MOODLE_CREDENTIALS_INVALID",
    "MOODLE_IDENTITY_MISMATCH",
    "MOODLE_REAUTH_REQUIRED",
    "SECRETARIA_IDENTITY_MISMATCH",
    "SECRETARIA_AUTH_FAILED",
  ]);
  const statusCode = typeof value.statusCode === "number" ? value.statusCode : 503;
  return {
    code,
    retryable: value.retryable === true || (!permanentCodes.has(code) && statusCode >= 500),
  };
}

function retryDelayMs(attempt: number) {
  return Math.min(30 * 60_000, 5_000 * (2 ** Math.max(0, attempt - 1)));
}

export class UorStudentSyncWorker {
  readonly #owner: string;
  readonly #now: Clock;
  readonly #pollMs: number;
  readonly #leaseMs: number;
  #timer: NodeJS.Timeout | null = null;
  #periodicTimer: NodeJS.Timeout | null = null;
  #drain: Promise<void> | null = null;
  #stopping = false;

  constructor(
    private readonly repository: UorStudentSyncJobRepository,
    private readonly secretaria: SecretariaApplication,
    private readonly moodle: MoodleApplication,
    private readonly options: UorStudentSyncWorkerOptions = {},
  ) {
    this.#owner = (options.uuid ?? randomUUID)();
    this.#now = options.now ?? (() => new Date());
    this.#pollMs = options.pollMs ?? POLL_MS;
    this.#leaseMs = options.leaseMs ?? LEASE_MS;
  }

  async start() {
    if (this.options.enabled === false || this.#timer) return;
    this.#stopping = false;
    this.#timer = setInterval(() => this.kick(), this.#pollMs);
    this.#timer.unref?.();
    if (this.options.refreshSource) {
      await this.scheduleDueRefreshes();
      this.#periodicTimer = setInterval(() => {
        void this.scheduleDueRefreshes().catch(() => undefined);
      }, this.options.periodicScanMs ?? PERIODIC_SCAN_MS);
      this.#periodicTimer.unref?.();
    }
    this.kick();
  }

  async stop() {
    this.#stopping = true;
    if (this.#timer) clearInterval(this.#timer);
    if (this.#periodicTimer) clearInterval(this.#periodicTimer);
    this.#timer = null;
    this.#periodicTimer = null;
    if (this.#drain) await this.#drain.catch(() => undefined);
  }

  async enqueueLogin(student: UorStudentIdentity) {
    const bucket = Math.floor(this.#now().getTime() / LOGIN_BUCKET_MS);
    const [secretariaJob, moodleJob] = await Promise.all([
      this.repository.enqueue({
        student,
        provider: "secretaria",
        operation: "secretaria_full",
        reason: "institutional-login",
        idempotencyKey: `login:secretaria:${bucket}`,
      }),
      this.repository.enqueue({
        student,
        provider: "moodle",
        operation: "moodle_bootstrap_or_refresh",
        reason: "institutional-login",
        idempotencyKey: `login:moodle:${bucket}`,
      }),
    ]);
    this.kick();
    return [secretariaJob, moodleJob];
  }

  async scheduleDueRefreshes() {
    if (!this.options.refreshSource) return [];
    const now = this.#now();
    const candidates = await this.options.refreshSource.listDue({
      now,
      secretariaStaleBefore: new Date(now.getTime() - SECRETARIA_TTL_MS),
      moodleStaleBefore: new Date(now.getTime() - MOODLE_TTL_MS),
      limit: 200,
    });
    const jobs = await Promise.all(candidates.map((candidate) => {
      const ttl = candidate.provider === "secretaria" ? SECRETARIA_TTL_MS : MOODLE_TTL_MS;
      const bucket = Math.floor(now.getTime() / ttl);
      return this.repository.enqueue({
        student: candidate.student,
        provider: candidate.provider,
        operation: candidate.provider === "secretaria" ? "secretaria_full" : "moodle_bootstrap_or_refresh",
        reason: "periodic-stale-refresh",
        idempotencyKey: `periodic:${candidate.provider}:${bucket}`,
      });
    }));
    if (jobs.length) this.kick();
    return jobs;
  }

  kick() {
    if (this.options.enabled === false || this.#stopping || this.#drain) return;
    this.#drain = this.#drainJobs()
      .catch(() => undefined)
      .finally(() => {
        this.#drain = null;
      });
  }

  async waitForIdle() {
    if (this.#drain) await this.#drain;
  }

  async #drainJobs() {
    while (!this.#stopping) {
      const job = await this.repository.claimNext({ owner: this.#owner, now: this.#now(), leaseMs: this.#leaseMs });
      if (!job) return;
      await this.#run(job);
    }
  }

  async #run(job: UorStudentSyncJob) {
    let heartbeat: NodeJS.Timeout | null = setInterval(() => {
      void this.repository.heartbeat({
        id: job.id,
        owner: this.#owner,
        now: this.#now(),
        leaseMs: this.#leaseMs,
      }).catch(() => false);
    }, Math.min(HEARTBEAT_MS, Math.max(1_000, Math.floor(this.#leaseMs / 3))));
    heartbeat.unref?.();
    try {
      const providerRunId = await this.#dispatch(job);
      await this.repository.complete({
        id: job.id,
        owner: this.#owner,
        providerRunId,
        now: this.#now(),
      });
    } catch (error) {
      const failure = errorDetails(error);
      await this.options.changeProcessor?.recordFailure?.({ student: job.student, provider: job.provider, errorCode: failure.code }).catch(() => undefined);
      const now = this.#now();
      await this.repository.fail({
        id: job.id,
        owner: this.#owner,
        errorCode: failure.code,
        retryable: failure.retryable,
        retryAt: new Date(now.getTime() + retryDelayMs(job.attempts)),
        now,
      });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    }
  }

  async #dispatch(job: UorStudentSyncJob) {
    const student = { id: job.student.id, studentNumber: job.student.studentNumber };
    if (job.operation === "secretaria_full") {
      const run = await this.secretaria.startSync(student);
      if (
        this.options.changeProcessor
        && run.snapshotVersion !== null
        && (run.status === "COMPLETED" || run.status === "PARTIAL")
      ) {
        await this.options.changeProcessor.record({ student: job.student, snapshotVersion: run.snapshotVersion });
      }
      return run.id;
    }

    const connection = await this.moodle.getConnection(student);
    if (connection.actionRequired === "reauthenticate") {
      const error = new Error("Moodle credentials required") as Error & { code: string; statusCode: number };
      error.code = "MOODLE_REAUTH_REQUIRED";
      error.statusCode = 409;
      throw error;
    }
    if (!connection.credentialsStored) {
      return (await this.moodle.connect(student, {
        username: student.studentNumber,
        password: DEFAULT_MOODLE_STUDENT_PASSWORD,
        rememberCredentials: true,
      })).initialSyncRunId;
    }
    if (!connection.connected) {
      return (await this.moodle.retryStoredConnection(student)).initialSyncRunId;
    }
    return (await this.moodle.startSync(student, job.reason)).id;
  }
}
