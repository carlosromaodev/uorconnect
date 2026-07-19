import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaMoodleRepository } from "./prisma-moodle.repository";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "prisma/migrations/20260719140000_moodle_integration_persistence/migration.sql",
);

describe("PrismaMoodleRepository", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let repository: PrismaMoodleRepository;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-moodle-repository-"));
    const databasePath = path.join(directory, "repository.db");
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE "Student" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "studentNumber" TEXT NOT NULL
      );
      INSERT INTO "Student" ("id", "studentNumber") VALUES
        (1, '20260001'),
        (2, '20260002');
    `);
    sqlite.exec(await readFile(MIGRATION_PATH, "utf8"));
    sqlite.close();

    client = new SQLitePrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }),
    });
    repository = new PrismaMoodleRepository(client as unknown as PrismaClient);
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("aplica CAS à ligação, à reautenticação e ao tombstone", async () => {
    const attempt = await repository.beginConnectionAttempt({
      studentId: 1,
      attemptId: "attempt-a",
      leaseDurationMs: 90_000,
    });
    expect(attempt.acquired).toBe(true);
    expect(attempt.connection.connectionGeneration).toBe(1);

    const competingAttempt = await repository.beginConnectionAttempt({
      studentId: 1,
      attemptId: "attempt-b",
      leaseDurationMs: 90_000,
    });
    expect(competingAttempt.acquired).toBe(false);
    expect(competingAttempt.connection.connectionAttemptId).toBe("attempt-a");

    expect(await repository.completeConnectionAttempt({
      studentId: 1,
      connectionGeneration: attempt.connection.connectionGeneration,
      attemptId: "attempt-a",
      moodleUserId: "upstream-user-1",
      profile: {
        studentNumber: "20260001",
        displayName: "Estudante Um",
        email: "student@example.test",
        timezone: "Africa/Luanda",
        syncedAt: new Date("2026-07-19T12:00:00.000Z"),
      },
      credentialsEnvelope: "v1.key.iv.tag.credentials",
      sessionEnvelope: "v1.key.iv.tag.session-1",
      sessionExpiresAt: null,
    })).toBe(true);

    const connected = await repository.getConnection(1);
    expect(connected).toMatchObject({
      status: "CONNECTED",
      sessionVersion: 1,
      moodleStudentNumber: "20260001",
    });

    const leaseA = await repository.acquireReauthenticationLease({
      studentId: 1,
      connectionGeneration: 1,
      sessionVersion: 1,
      owner: "worker-a",
      leaseDurationMs: 90_000,
    });
    const leaseB = await repository.acquireReauthenticationLease({
      studentId: 1,
      connectionGeneration: 1,
      sessionVersion: 1,
      owner: "worker-b",
      leaseDurationMs: 90_000,
    });
    expect(leaseA.acquired).toBe(true);
    expect(leaseB.acquired).toBe(false);

    expect(await repository.completeReauthentication({
      studentId: 1,
      connectionGeneration: 1,
      sessionVersion: 1,
      owner: "worker-a",
      moodleUserId: "upstream-user-1",
      profile: {
        studentNumber: "20260001",
        displayName: "Estudante Um Atualizado",
        email: "student@example.test",
        timezone: "Africa/Luanda",
        syncedAt: new Date("2026-07-19T12:05:00.000Z"),
      },
      sessionEnvelope: "v1.key.iv.tag.session-2",
      sessionExpiresAt: null,
    })).toBe(true);
    expect((await repository.getConnection(1))?.sessionVersion).toBe(2);

    const disconnected = await repository.disconnectAndPurge(1);
    expect(disconnected.status).toBe("DISCONNECTED");
    expect(disconnected.connectionGeneration).toBe(2);
    expect(disconnected.credentialsEnvelope).toBeNull();
    expect(disconnected.sessionEnvelope).toBeNull();
  });

  it("publica snapshots inteiros, mantém UUIDs estáveis e isola proprietários", async () => {
    await connect(repository, 1, "20260001", "attempt-1");
    await connect(repository, 2, "20260002", "attempt-2");

    const scheduled = await repository.createOrReuseSyncRun({
      studentId: 1,
      reason: "manual",
    });
    const reused = await repository.createOrReuseSyncRun({
      studentId: 1,
      reason: "stale-read",
    });
    expect(reused).toMatchObject({ reused: true });
    expect(reused.run.id).toBe(scheduled.run.id);

    const run = await repository.claimNextSyncRun({
      owner: "sync-worker",
      leaseDurationMs: 60_000,
    });
    expect(run?.id).toBe(scheduled.run.id);
    expect(await repository.stageCourseGraph(snapshotInput(run!.id, run!.snapshotVersion))).toBe(true);
    expect(await repository.publishSnapshot({
      studentId: 1,
      runId: run!.id,
      connectionGeneration: run!.connectionGeneration,
      snapshotVersion: run!.snapshotVersion,
      leaseOwner: "sync-worker",
      outcome: "COMPLETED",
    })).toBe(true);
    expect(await repository.getSyncRunBySnapshot({
      studentId: 1,
      snapshotVersion: run!.snapshotVersion,
    })).toMatchObject({ id: run!.id, status: "COMPLETED" });

    const firstPage = await repository.listCourses({
      studentId: 1,
      snapshotVersion: run!.snapshotVersion,
      limit: 20,
    });
    expect(firstPage.total).toBe(1);
    expect(firstPage.items[0]).toMatchObject({
      name: "Algoritmos",
      progressAvailable: false,
      progressPercent: null,
    });
    const coursePublicId = firstPage.items[0]!.publicId;
    const materialPage = await repository.listMaterials({
      studentId: 1,
      snapshotVersion: run!.snapshotVersion,
      coursePublicId,
      limit: 20,
    });
    expect(materialPage.total).toBe(1);
    expect(await repository.findCourse({
      studentId: 2,
      snapshotVersion: run!.snapshotVersion,
      publicId: coursePublicId,
    })).toBeNull();
    expect(await repository.findMaterial({
      studentId: 2,
      snapshotVersion: run!.snapshotVersion,
      publicId: materialPage.items[0]!.publicId,
    })).toBeNull();

    const nextScheduled = await repository.createOrReuseSyncRun({
      studentId: 1,
      reason: "refresh",
    });
    const nextRun = await repository.claimNextSyncRun({
      owner: "sync-worker",
      leaseDurationMs: 60_000,
    });
    expect(nextRun?.id).toBe(nextScheduled.run.id);
    expect(await repository.stageCourseGraph(
      snapshotInput(nextRun!.id, nextRun!.snapshotVersion, "Algoritmos II"),
    )).toBe(true);
    expect(await repository.publishSnapshot({
      studentId: 1,
      runId: nextRun!.id,
      connectionGeneration: nextRun!.connectionGeneration,
      snapshotVersion: nextRun!.snapshotVersion,
      leaseOwner: "sync-worker",
      outcome: "COMPLETED",
    })).toBe(true);
    const secondPage = await repository.listCourses({
      studentId: 1,
      snapshotVersion: nextRun!.snapshotVersion,
      limit: 20,
    });
    expect(secondPage.items[0]!.publicId).toBe(coursePublicId);
  });

  it("recupera por relógio da base um reconnect expirado sem apagar a sessão anterior", async () => {
    await connect(repository, 1, "20260001", "initial");
    const reconnect = await repository.beginConnectionAttempt({
      studentId: 1,
      attemptId: "abandoned-reconnect",
      leaseDurationMs: 90_000,
    });
    await client!.moodleConnection.update({
      where: { studentId: 1 },
      data: { connectionAttemptLeaseUntil: new Date("2000-01-01T00:00:00.000Z") },
    });

    const recovered = await repository.recoverExpiredConnectionAttempt(1);

    expect(recovered).toMatchObject({
      status: "DEGRADED",
      connectionGeneration: reconnect.connection.connectionGeneration,
      credentialsEnvelope: "credentials-20260001",
      sessionEnvelope: "session-20260001",
      connectionAttemptId: null,
    });
  });

  it("impede que um worker antigo restaure snapshots após logout", async () => {
    await connect(repository, 1, "20260001", "attempt-1");
    await repository.createOrReuseSyncRun({ studentId: 1, reason: "manual" });
    const run = await repository.claimNextSyncRun({
      owner: "old-worker",
      leaseDurationMs: 60_000,
    });
    await repository.disconnectAndPurge(1);

    expect(await repository.stageCourseGraph({
      ...snapshotInput(run!.id, run!.snapshotVersion),
      leaseOwner: "old-worker",
    })).toBe(false);
    expect(await client!.moodleCourseSnapshot.count({ where: { studentId: 1 } })).toBe(0);
    expect(await client!.moodleEntityRef.count({ where: { studentId: 1 } })).toBe(0);
  });

  it("mantém cascade como defesa no hard-delete do estudante", async () => {
    await connect(repository, 1, "20260001", "attempt-1");
    await client!.$executeRawUnsafe('DELETE FROM "Student" WHERE "id" = 1');
    expect(await client!.moodleConnection.count({ where: { studentId: 1 } })).toBe(0);
  });
});

async function connect(
  repository: PrismaMoodleRepository,
  studentId: number,
  studentNumber: string,
  attemptId: string,
) {
  const attempt = await repository.beginConnectionAttempt({
    studentId,
    attemptId,
    leaseDurationMs: 90_000,
  });
  await repository.completeConnectionAttempt({
    studentId,
    connectionGeneration: attempt.connection.connectionGeneration,
    attemptId,
    moodleUserId: `moodle-${studentNumber}`,
    profile: {
      studentNumber,
      displayName: `Estudante ${studentNumber}`,
      email: null,
      timezone: "Africa/Luanda",
      syncedAt: new Date("2026-07-19T12:00:00.000Z"),
    },
    credentialsEnvelope: `credentials-${studentNumber}`,
    sessionEnvelope: `session-${studentNumber}`,
    sessionExpiresAt: null,
  });
}

function snapshotInput(runId: string, snapshotVersion: number, name = "Algoritmos") {
  return {
    studentId: 1,
    runId,
    connectionGeneration: 1,
    snapshotVersion,
    leaseOwner: "sync-worker",
    course: {
      moodleExternalKey: "course-10",
      name,
      normalizedName: name.toLocaleLowerCase("pt"),
      shortName: "ALG",
      category: "Engenharia",
      descriptionText: null,
      visible: true,
      hiddenByStudent: false,
      favourite: false,
      startAt: null,
      endAt: null,
      progressAvailable: false,
      progressPercent: null,
      normalizedHash: `hash-${name}`,
    },
    sections: [{
      moodleExternalKey: "section-100",
      courseExternalKey: "course-10",
      position: 0,
      title: "Geral",
      normalizedTitle: "geral",
      summaryText: null,
      visible: true,
      available: true,
      normalizedHash: "hash-section",
    }],
    materials: [{
      moodleExternalKey: "material-1000",
      courseExternalKey: "course-10",
      sectionExternalKey: "section-100",
      type: "file",
      title: "Plano da disciplina",
      normalizedTitle: "plano da disciplina",
      descriptionText: null,
      available: true,
      openAvailable: true,
      downloadAvailable: true,
      fileName: "plano.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024n,
      sourceUpdatedAt: null,
      metadataJson: null,
      locatorEnvelope: "v1.key.iv.tag.locator",
      normalizedHash: "hash-material",
    }],
  };
}
