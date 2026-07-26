import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UorStudentStepUpApplication } from "./step-up-service";

const IDENTITY_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql");
const WORKFLOW_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722210000_uor_student_local_workflows/migration.sql");
const student = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };

describe("UorStudentStepUpApplication", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let service: UorStudentStepUpApplication;
  let now: Date;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-step-up-"));
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
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber", "updatedAt") VALUES (1, 'UOR', '20260001', CURRENT_TIMESTAMP);
    `);
    sqlite.exec(await readFile(IDENTITY_MIGRATION, "utf8"));
    sqlite.exec(await readFile(WORKFLOW_MIGRATION, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    now = new Date("2026-07-22T12:00:00.000Z");
    service = new UorStudentStepUpApplication("step-up-test-secret", { send: vi.fn(async () => undefined) }, client as unknown as PrismaClient, () => now, () => "123456");
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("liga o OTP à ação, recurso, ator e prazo e persiste tentativas", async () => {
    const challenge = await service.request({ student, action: "external_command.confirm", resourceId: "command-0001", traceId: "trace-request" });
    await expect(service.verify({ student, challengeId: challenge.challengeId, action: "external_command.confirm", resourceId: "command-0002", code: "123456" })).rejects.toMatchObject({ code: "UOR_STUDENT_STEP_UP_INVALID" });
    await expect(service.verify({ student, challengeId: challenge.challengeId, action: "external_command.confirm", resourceId: "command-0001", code: "000000" })).rejects.toMatchObject({ code: "UOR_STUDENT_STEP_UP_INCORRECT" });
    expect(await client!.uorStudentStepUpChallenge.findUnique({ where: { id: challenge.challengeId }, select: { attempts: true } })).toEqual({ attempts: 1 });
    const verified = await service.verify({ student, challengeId: challenge.challengeId, action: "external_command.confirm", resourceId: "command-0001", code: "123456" });
    expect(service.verifyToken(student, verified.token, "external_command.confirm", "command-0001")).toBe(true);
    expect(service.verifyToken(student, verified.token, "external_command.confirm", "command-0002")).toBe(false);
    expect(service.verifyToken({ ...student, id: 2 }, verified.token, "external_command.confirm", "command-0001")).toBe(false);
    now = new Date(now.getTime() + 6 * 60_000);
    expect(service.verifyToken(student, verified.token, "external_command.confirm", "command-0001")).toBe(false);
  });
});
