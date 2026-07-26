import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaUorStudentSyncJobRepository } from "./prisma-uor-student-sync-job.repository";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "prisma/migrations/20260722150000_uor_student_sync_jobs/migration.sql",
);

describe("PrismaUorStudentSyncJobRepository", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let repository: PrismaUorStudentSyncJobRepository;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-sync-"));
    const databasePath = path.join(directory, "repository.db");
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE "Student" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "institutionCode" TEXT NOT NULL,
        "studentNumber" TEXT NOT NULL
      );
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber") VALUES
        (1, 'UOR', '20260001'),
        (2, 'OUTRA', '20260001');
    `);
    sqlite.exec(await readFile(MIGRATION_PATH, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }),
    });
    repository = new PrismaUorStudentSyncJobRepository(client as unknown as PrismaClient);
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("reutiliza a chave idempotente por estudante e mantém tenants isolados", async () => {
    const first = await repository.enqueue({
      student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" },
      provider: "secretaria",
      operation: "secretaria_full",
      reason: "login",
      idempotencyKey: "login:secretaria:1",
    });
    const reused = await repository.enqueue({
      student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" },
      provider: "secretaria",
      operation: "secretaria_full",
      reason: "login-duplicado",
      idempotencyKey: "login:secretaria:1",
    });
    const otherTenant = await repository.enqueue({
      student: { id: 2, institutionCode: "OUTRA", studentNumber: "20260001" },
      provider: "secretaria",
      operation: "secretaria_full",
      reason: "login",
      idempotencyKey: "login:secretaria:1",
    });

    expect(reused.id).toBe(first.id);
    expect(otherTenant.id).not.toBe(first.id);
    expect(await client!.uorStudentSyncJob.count()).toBe(2);
  });

  it("aplica lease, fence de owner e retoma trabalho abandonado", async () => {
    const queued = await repository.enqueue({
      student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" },
      provider: "moodle",
      operation: "moodle_bootstrap_or_refresh",
      reason: "login",
      idempotencyKey: "login:moodle:1",
    });
    const claimed = await repository.claimNext({
      owner: "worker-a",
      now: new Date("2030-07-22T12:00:00.000Z"),
      leaseMs: 60_000,
    });
    expect(claimed).toMatchObject({ id: queued.id, status: "RUNNING", attempts: 1 });
    expect(await repository.complete({
      id: queued.id,
      owner: "worker-b",
      providerRunId: null,
      now: new Date("2030-07-22T12:00:10.000Z"),
    })).toBe(false);

    const reclaimed = await repository.claimNext({
      owner: "worker-b",
      now: new Date("2030-07-22T12:02:00.000Z"),
      leaseMs: 60_000,
    });
    expect(reclaimed).toMatchObject({ id: queued.id, attempts: 2, leaseOwner: "worker-b" });
    expect(await repository.complete({
      id: queued.id,
      owner: "worker-b",
      providerRunId: "provider-run",
      now: new Date("2030-07-22T12:02:10.000Z"),
    })).toBe(true);
    expect(await client!.uorStudentSyncJob.findUnique({ where: { id: queued.id } })).toMatchObject({
      status: "COMPLETED",
      providerRunId: "provider-run",
      attempts: 2,
    });
  });
});
