import { describe, expect, it, vi } from "vitest";
import type { MoodleGateway } from "../domain/gateway";
import type {
  MoodleRepository,
  PersistedCourseSnapshot,
  PersistedMoodleConnection,
  PersistedMoodleSyncRun,
} from "../domain/repository";
import { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import { MoodleCursorCodec } from "../infra/moodle-cursor";
import { LiveMoodleApplication } from "./live-moodle.application";
import type { MoodleSessionManager } from "./moodle-session-manager";
import type { MoodleSyncWorker } from "./moodle-sync-worker";

const now = new Date("2026-07-19T12:00:00.000Z");
const serializedKeys = `v1:${Buffer.alloc(32, 8).toString("base64")}`;

function activeConnection(): PersistedMoodleConnection {
  return {
    studentId: 7,
    status: "CONNECTED",
    moodleUserId: "77",
    profilePublicId: "bb080d0c-311f-4f2c-8cf0-4818f67eb810",
    moodleStudentNumber: "2026-007",
    displayName: "Estudante",
    email: null,
    timezone: null,
    profileSyncedAt: now,
    credentialsEnvelope: "protected",
    sessionEnvelope: "protected",
    connectionGeneration: 2,
    sessionVersion: 2,
    activeSnapshotVersion: 5,
    activeSyncRunId: "new-run",
    connectionAttemptId: null,
    connectionAttemptLeaseUntil: null,
    sessionExpiresAt: null,
    reauthLeaseOwner: null,
    reauthLeaseUntil: null,
    failedReauthCount: 0,
    nextReauthAt: null,
    lastAuthenticatedAt: now,
    lastSuccessfulSyncAt: now,
    lastUsedAt: now,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

function course(index: number): PersistedCourseSnapshot {
  return {
    publicId: `${index.toString().padStart(8, "0")}-1111-4111-8111-111111111111`,
    moodleExternalKey: String(index),
    snapshotVersion: 5,
    syncRunId: "published-run",
    name: `Disciplina ${index}`,
    normalizedName: `disciplina ${index}`,
    shortName: `D${index}`,
    category: null,
    descriptionText: null,
    visible: true,
    hiddenByStudent: false,
    favourite: false,
    startAt: null,
    endAt: null,
    progressAvailable: false,
    progressPercent: null,
    stale: false,
    sourceSyncedAt: null,
    normalizedHash: "hash",
    syncedAt: now,
  };
}

describe("LiveMoodleApplication overview", () => {
  it("não deixa uma sync nova zerar as contagens do snapshot publicado", async () => {
    const queuedRun: PersistedMoodleSyncRun = {
      id: "new-run",
      studentId: 7,
      status: "QUEUED",
      reason: "manual",
      connectionGeneration: 2,
      snapshotVersion: 6,
      attempts: 0,
      leaseOwner: null,
      leaseUntil: null,
      heartbeatAt: null,
      startedAt: null,
      finishedAt: null,
      discoveredCourses: 0,
      processedCourses: 0,
      failedCourses: 0,
      totalMaterials: 0,
      checkpointJson: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
    };
    const courses = Array.from({ length: 29 }, (_, index) => course(index + 1));
    const publishedRun: PersistedMoodleSyncRun = {
      ...queuedRun,
      id: "published-run",
      status: "COMPLETED",
      snapshotVersion: 5,
      discoveredCourses: 29,
      processedCourses: 29,
      totalMaterials: 73,
      finishedAt: now,
    };
    const repository = {
      recoverExpiredConnectionAttempt: vi.fn().mockResolvedValue(activeConnection()),
      getLatestSyncRun: vi.fn().mockResolvedValue(queuedRun),
      getSyncRunBySnapshot: vi.fn().mockResolvedValue(publishedRun),
      listCourses: vi.fn().mockResolvedValue({ items: courses, total: 29, hasMore: false }),
      listMaterials: vi.fn().mockResolvedValue({ items: [{ stale: false }], total: 1, hasMore: false }),
    } as unknown as MoodleRepository;
    const keyring = MoodleCryptoKeyring.fromConfig("v1", serializedKeys);
    const cursor = new MoodleCursorCodec({ activeKeyId: "v1", serializedKeys });
    const app = new LiveMoodleApplication(
      repository,
      {} as MoodleGateway,
      keyring,
      cursor,
      {} as MoodleSessionManager,
      { kick: vi.fn(), start: vi.fn(), stop: vi.fn() } as unknown as MoodleSyncWorker,
      () => now,
    );

    const overview = await app.getOverview({ id: 7, studentNumber: "2026-007" });

    expect(overview.data.counts.courses).toEqual({ value: 29, status: "exact" });
    expect(overview.data.counts.materials).toEqual({ value: 73, status: "exact" });
    expect(overview.data.coverage).toEqual({
      processedCourses: 29,
      totalCourses: 29,
      failedCourses: 0,
    });
    keyring.destroy();
    cursor.destroy();
  });

  it("marca PARTIAL como stale sem criar uma sync a cada GET dentro do cooldown", async () => {
    const partialRun: PersistedMoodleSyncRun = {
      id: "partial-run",
      studentId: 7,
      status: "PARTIAL",
      reason: "scheduled",
      connectionGeneration: 2,
      snapshotVersion: 5,
      attempts: 1,
      leaseOwner: null,
      leaseUntil: null,
      heartbeatAt: null,
      startedAt: now,
      finishedAt: now,
      discoveredCourses: 1,
      processedCourses: 0,
      failedCourses: 1,
      totalMaterials: 1,
      checkpointJson: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
    };
    const createOrReuseSyncRun = vi.fn();
    const repository = {
      recoverExpiredConnectionAttempt: vi.fn().mockResolvedValue(activeConnection()),
      getLatestSyncRun: vi.fn().mockResolvedValue(partialRun),
      getSyncRunBySnapshot: vi.fn().mockResolvedValue(partialRun),
      listCourses: vi.fn().mockResolvedValue({ items: [course(1)], total: 1, hasMore: false }),
      listMaterials: vi.fn().mockResolvedValue({ items: [{ stale: true }], total: 1, hasMore: false }),
      createOrReuseSyncRun,
    } as unknown as MoodleRepository;
    const keyring = MoodleCryptoKeyring.fromConfig("v1", serializedKeys);
    const cursor = new MoodleCursorCodec({ activeKeyId: "v1", serializedKeys });
    const app = new LiveMoodleApplication(
      repository,
      {} as MoodleGateway,
      keyring,
      cursor,
      {} as MoodleSessionManager,
      { kick: vi.fn(), start: vi.fn(), stop: vi.fn() } as unknown as MoodleSyncWorker,
      () => now,
    );

    const overview = await app.getOverview({ id: 7, studentNumber: "2026-007" });

    expect(overview.stale).toBe(true);
    expect(overview.data.counts.courses.status).toBe("partial");
    expect(createOrReuseSyncRun).not.toHaveBeenCalled();
    keyring.destroy();
    cursor.destroy();
  });

  it("usa total nulo antes do primeiro snapshot", async () => {
    const disconnectedSnapshot = { ...activeConnection(), activeSnapshotVersion: null, lastSuccessfulSyncAt: null };
    const repository = {
      recoverExpiredConnectionAttempt: vi.fn().mockResolvedValue(disconnectedSnapshot),
      getLatestSyncRun: vi.fn().mockResolvedValue(null),
      createOrReuseSyncRun: vi.fn().mockResolvedValue({}),
    } as unknown as MoodleRepository;
    const keyring = MoodleCryptoKeyring.fromConfig("v1", serializedKeys);
    const cursor = new MoodleCursorCodec({ activeKeyId: "v1", serializedKeys });
    const app = new LiveMoodleApplication(
      repository,
      {} as MoodleGateway,
      keyring,
      cursor,
      {} as MoodleSessionManager,
      { kick: vi.fn(), start: vi.fn(), stop: vi.fn() } as unknown as MoodleSyncWorker,
      () => now,
    );

    const result = await app.listCourses(
      { id: 7, studentNumber: "2026-007" },
      { limit: 20 },
    );

    expect(result.pagination.total).toBeNull();
    expect(result.pagination.totalStatus).toBe("not_synced");
    keyring.destroy();
    cursor.destroy();
  });
});
