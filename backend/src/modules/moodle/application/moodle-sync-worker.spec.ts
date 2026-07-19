import { describe, expect, it, vi } from "vitest";
import type { MoodleGateway, MoodleGatewayCourseContent, MoodleGatewaySession } from "../domain/gateway";
import type { MoodleRepository, PersistedMoodleConnection, PersistedMoodleSyncRun } from "../domain/repository";
import { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import type { MoodleSessionManager } from "./moodle-session-manager";
import { MoodleSyncWorker } from "./moodle-sync-worker";

const now = new Date("2026-07-19T12:00:00.000Z");

function connection(): PersistedMoodleConnection {
  return {
    studentId: 1,
    status: "CONNECTED",
    moodleUserId: "1",
    profilePublicId: "d8c8cac8-bd42-441d-8764-3fe410aab895",
    moodleStudentNumber: "20260001",
    displayName: "Estudante",
    email: null,
    timezone: null,
    profileSyncedAt: now,
    credentialsEnvelope: "protected",
    sessionEnvelope: "protected",
    connectionGeneration: 1,
    sessionVersion: 1,
    activeSnapshotVersion: null,
    activeSyncRunId: "sync-1",
    connectionAttemptId: null,
    connectionAttemptLeaseUntil: null,
    sessionExpiresAt: null,
    reauthLeaseOwner: null,
    reauthLeaseUntil: null,
    failedReauthCount: 0,
    nextReauthAt: null,
    lastAuthenticatedAt: now,
    lastSuccessfulSyncAt: null,
    lastUsedAt: now,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
  };
}

function syncRun(): PersistedMoodleSyncRun {
  return {
    id: "sync-1",
    studentId: 1,
    status: "RUNNING",
    reason: "test",
    connectionGeneration: 1,
    snapshotVersion: 1,
    attempts: 1,
    leaseOwner: "test-owner",
    leaseUntil: new Date("2026-07-19T12:01:00.000Z"),
    heartbeatAt: now,
    startedAt: now,
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
}

function content(complete: boolean): MoodleGatewayCourseContent {
  return {
    complete,
    source: complete ? "ajax" : "html",
    course: {
      externalKey: "10",
      name: "Algoritmos",
      shortName: "ALG",
      category: null,
      description: null,
      startDate: null,
      endDate: null,
      progressAvailable: false,
      progressPercent: null,
      visible: true,
      hiddenByStudent: false,
      favourite: false,
    },
    sections: [],
    materials: [{
      externalKey: "20",
      courseExternalKey: "10",
      sectionExternalKey: "",
      type: "file",
      title: "Aula 1",
      description: null,
      available: true,
      openAvailable: true,
      downloadAvailable: true,
      mimeType: "application/pdf",
      sizeBytes: 100,
      updatedAt: null,
      locator: { kind: "plugin-file", path: "/pluginfile.php/1/aula.pdf" },
    }],
  };
}

describe("MoodleSyncWorker completeness", () => {
  it.each([
    { name: "lista de cursos não comprovada", listComplete: false, contentComplete: true },
    { name: "conteúdo de curso não comprovado", listComplete: true, contentComplete: false },
  ])("publica PARTIAL quando $name", async ({ listComplete, contentComplete }) => {
    const run = syncRun();
    const publishSnapshot = vi.fn().mockResolvedValue(true);
    const stageCourseGraph = vi.fn().mockResolvedValue(true);
    const repository = {
      claimNextSyncRun: vi.fn().mockResolvedValueOnce(run).mockResolvedValue(null),
      getConnection: vi.fn().mockResolvedValue(connection()),
      updateSyncProgress: vi.fn().mockResolvedValue(true),
      stageCourseGraph,
      publishSnapshot,
      purgeSnapshotVersions: vi.fn().mockResolvedValue(undefined),
      finishSyncRun: vi.fn().mockResolvedValue(true),
      heartbeatSyncRun: vi.fn().mockResolvedValue(true),
    } as unknown as MoodleRepository;
    const gateway = {
      listCourses: vi.fn().mockResolvedValue({
        courses: [content(true).course],
        complete: listComplete,
        source: listComplete ? "ajax" : "html",
      }),
      getCourseContent: vi.fn().mockResolvedValue(content(contentComplete)),
    } as unknown as MoodleGateway;
    const sessions = {
      withSession: async <T>(
        _student: unknown,
        operation: (session: MoodleGatewaySession) => Promise<T>,
      ) => operation({} as MoodleGatewaySession),
      clear: vi.fn(),
    } as unknown as MoodleSessionManager;
    const serializedKeys = `v1:${Buffer.alloc(32, 5).toString("base64")}`;
    const keyring = MoodleCryptoKeyring.fromConfig("v1", serializedKeys);
    const worker = new MoodleSyncWorker(repository, gateway, keyring, sessions, {
      enabled: true,
      concurrency: 2,
      uuid: () => "test-owner",
    });

    await worker.start();
    await vi.waitFor(() => expect(publishSnapshot).toHaveBeenCalledOnce());
    await worker.stop();

    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({ outcome: "PARTIAL" }));
    expect(stageCourseGraph).toHaveBeenCalledWith(expect.objectContaining({
      materials: [expect.objectContaining({ fileName: null })],
    }));
    keyring.destroy();
  });

  it("preserva como stale cursos antigos ausentes de uma lista incompleta", async () => {
    const run = syncRun();
    const stageCourseGraph = vi.fn().mockResolvedValue(true);
    const publishSnapshot = vi.fn().mockResolvedValue(true);
    const oldCourse = {
      publicId: "550e8400-e29b-41d4-a716-446655440099",
      moodleExternalKey: "99",
      snapshotVersion: 9,
      syncRunId: "old-run",
      name: "Disciplina preservada",
      normalizedName: "disciplina preservada",
      shortName: "DP",
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
      normalizedHash: "old-hash",
      syncedAt: new Date("2026-07-18T08:00:00.000Z"),
    };
    const repository = {
      claimNextSyncRun: vi.fn().mockResolvedValueOnce(run).mockResolvedValue(null),
      getConnection: vi.fn().mockResolvedValue({ ...connection(), activeSnapshotVersion: 9 }),
      updateSyncProgress: vi.fn().mockResolvedValue(true),
      stageCourseGraph,
      publishSnapshot,
      purgeSnapshotVersions: vi.fn().mockResolvedValue(undefined),
      finishSyncRun: vi.fn().mockResolvedValue(true),
      heartbeatSyncRun: vi.fn().mockResolvedValue(true),
      listCourses: vi.fn().mockResolvedValue({ items: [oldCourse], total: 1, hasMore: false }),
      listSections: vi.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
      listMaterials: vi.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
    } as unknown as MoodleRepository;
    const gateway = {
      listCourses: vi.fn().mockResolvedValue({
        courses: [content(true).course],
        complete: false,
        source: "html",
      }),
      getCourseContent: vi.fn().mockResolvedValue(content(true)),
    } as unknown as MoodleGateway;
    const sessions = {
      withSession: async <T>(
        _student: unknown,
        operation: (session: MoodleGatewaySession) => Promise<T>,
      ) => operation({} as MoodleGatewaySession),
      clear: vi.fn(),
    } as unknown as MoodleSessionManager;
    const keyring = MoodleCryptoKeyring.fromConfig(
      "v1",
      `v1:${Buffer.alloc(32, 6).toString("base64")}`,
    );
    const worker = new MoodleSyncWorker(repository, gateway, keyring, sessions, {
      enabled: true,
      concurrency: 2,
      uuid: () => "test-owner",
    });

    await worker.start();
    await vi.waitFor(() => expect(publishSnapshot).toHaveBeenCalledOnce());
    await worker.stop();

    expect(stageCourseGraph).toHaveBeenCalledTimes(2);
    expect(stageCourseGraph).toHaveBeenCalledWith(expect.objectContaining({
      course: expect.objectContaining({
        moodleExternalKey: "99",
        stale: true,
        sourceSyncedAt: oldCourse.syncedAt,
      }),
    }));
    keyring.destroy();
  });
});
