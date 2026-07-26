import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaUorStudentWorkflowRepository } from "./prisma-uor-student-workflow.repository";

const IDENTITY_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql");
const WORKFLOW_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722210000_uor_student_local_workflows/migration.sql");

const owner = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };
const participant = { id: 2, institutionCode: "UOR", studentNumber: "20260002" };
const otherTenant = { id: 3, institutionCode: "OUTRA", studentNumber: "20260001" };

describe("PrismaUorStudentWorkflowRepository", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let repository: PrismaUorStudentWorkflowRepository;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-workflow-"));
    const databasePath = path.join(directory, "repository.db");
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE "Student" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "institutionCode" TEXT NOT NULL,
        "studentNumber" TEXT NOT NULL,
        "name" TEXT,
        "course" TEXT,
        "classCode" TEXT,
        "academicYear" TEXT,
        "academicPeriod" TEXT,
        "academicSyncedAt" DATETIME,
        "isUorStudent" BOOLEAN NOT NULL DEFAULT true,
        "deletedAt" DATETIME,
        "updatedAt" DATETIME NOT NULL
      );
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber", "name", "updatedAt") VALUES
        (1, 'UOR', '20260001', 'Titular', CURRENT_TIMESTAMP),
        (2, 'UOR', '20260002', 'Participante', CURRENT_TIMESTAMP),
        (3, 'OUTRA', '20260001', 'Outro tenant', CURRENT_TIMESTAMP);
    `);
    sqlite.exec(await readFile(IDENTITY_MIGRATION, "utf8"));
    sqlite.exec(`
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000001' WHERE "id" = 1;
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000002' WHERE "id" = 2;
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000003' WHERE "id" = 3;
    `);
    sqlite.exec(await readFile(WORKFLOW_MIGRATION, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    repository = new PrismaUorStudentWorkflowRepository(client as unknown as PrismaClient);
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("isola o titular, usa perfil opaco e preserva histórico funcional", async () => {
    const created = await repository.create({
      owner,
      category: "personal_event",
      scopeKey: "2026-07-23T09:00:00Z",
      status: "scheduled",
      payload: { title: "Estudo", startsAt: "2026-07-23T09:00:00Z" },
      traceId: "trace-create",
    });
    const changed = await repository.transitionOwned({
      student: owner,
      id: created.id,
      category: "personal_event",
      from: ["scheduled"],
      to: "cancelled",
      traceId: "trace-cancel",
    });

    expect(created.ownerProfileId).toBe("10000000-0000-4000-8000-000000000001");
    expect(changed?.status).toBe("cancelled");
    expect(await repository.getAccessible({ student: participant, id: created.id })).toBeNull();
    expect(await repository.getAccessible({ student: otherTenant, id: created.id })).toBeNull();
    expect(await repository.listEvents({ student: owner, aggregateId: created.id, limit: 10 })).toHaveLength(2);
    expect(await client!.uorStudentAuditEvent.findFirst({ where: { resourceId: created.id } })).toMatchObject({ product: "uor_student", traceId: "trace-create" });
  });

  it("exige ação própria do participante e impede inclusão entre instituições", async () => {
    const request = await repository.create({
      owner,
      category: "collective_request",
      scopeKey: "algoritmos:2026",
      status: "draft",
      payload: { subjectKey: "algoritmos", period: "2026" },
    });
    expect(await repository.addActor({
      owner,
      aggregateId: request.id,
      category: "collective_request",
      profileId: "10000000-0000-4000-8000-000000000003",
      role: "participant",
      status: "invited",
    })).toBeNull();

    await repository.addActor({
      owner,
      aggregateId: request.id,
      category: "collective_request",
      profileId: "10000000-0000-4000-8000-000000000002",
      role: "participant",
      status: "invited",
    });
    const accepted = await repository.decideActor({
      student: participant,
      aggregateId: request.id,
      category: "collective_request",
      role: "participant",
      from: ["invited"],
      to: "accepted",
      traceId: "trace-accept",
    });
    expect(accepted?.actors).toEqual([expect.objectContaining({ profileId: "10000000-0000-4000-8000-000000000002", status: "accepted" })]);
    expect(await repository.decideActor({
      student: owner,
      aggregateId: request.id,
      category: "collective_request",
      role: "participant",
      from: ["invited"],
      to: "accepted",
    })).toBeNull();
  });
});
