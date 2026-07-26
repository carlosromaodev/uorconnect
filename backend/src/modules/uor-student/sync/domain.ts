import type { UorStudentIdentity } from "../application/ports";

export type UorStudentSyncProvider = "secretaria" | "moodle";
export type UorStudentSyncOperation = "secretaria_full" | "moodle_bootstrap_or_refresh";
export type UorStudentSyncJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type UorStudentSyncJob = {
  id: string;
  student: UorStudentIdentity;
  provider: UorStudentSyncProvider;
  operation: UorStudentSyncOperation;
  reason: string;
  idempotencyKey: string;
  status: UorStudentSyncJobStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  providerRunId: string | null;
  lastErrorCode: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EnqueueUorStudentSyncJob = {
  student: UorStudentIdentity;
  provider: UorStudentSyncProvider;
  operation: UorStudentSyncOperation;
  reason: string;
  idempotencyKey: string;
  maxAttempts?: number;
};

export interface UorStudentSyncJobRepository {
  enqueue(input: EnqueueUorStudentSyncJob): Promise<UorStudentSyncJob>;
  claimNext(input: { owner: string; now: Date; leaseMs: number }): Promise<UorStudentSyncJob | null>;
  heartbeat(input: { id: string; owner: string; now: Date; leaseMs: number }): Promise<boolean>;
  complete(input: { id: string; owner: string; providerRunId: string | null; now: Date }): Promise<boolean>;
  fail(input: {
    id: string;
    owner: string;
    errorCode: string;
    retryable: boolean;
    retryAt: Date;
    now: Date;
  }): Promise<boolean>;
}

export interface UorStudentSyncScheduler {
  enqueueLogin(student: UorStudentIdentity): Promise<UorStudentSyncJob[]>;
  start(): Promise<void> | void;
  stop(): Promise<void> | void;
}

export interface UorStudentOfficialChangeProcessor {
  record(input: { student: UorStudentIdentity; snapshotVersion: number }): Promise<void>;
  recordFailure?(input: { student: UorStudentIdentity; provider: UorStudentSyncProvider; errorCode: string }): Promise<void>;
}

export type UorStudentRefreshCandidate = {
  student: UorStudentIdentity;
  provider: UorStudentSyncProvider;
};

export interface UorStudentRefreshCandidateSource {
  listDue(input: {
    now: Date;
    secretariaStaleBefore: Date;
    moodleStaleBefore: Date;
    limit: number;
  }): Promise<UorStudentRefreshCandidate[]>;
}
