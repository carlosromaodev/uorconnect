import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveUorStudentAuthorizationApplication } from "./authorization-service";

const IDENTITY_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql");
const WORKFLOW_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722210000_uor_student_local_workflows/migration.sql");
const owner = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };
const representative = { id: 2, institutionCode: "UOR", studentNumber: "20260002" };

describe("LiveUorStudentAuthorizationApplication", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let delivered: string[];
  let service: LiveUorStudentAuthorizationApplication;
  let now: Date;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-authorization-"));
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
        (2, 'UOR', '20260002', 'Representante', CURRENT_TIMESTAMP),
        (3, 'OUTRA', '20260003', 'Outro tenant', CURRENT_TIMESTAMP);
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
    delivered = [];
    now = new Date("2026-07-22T12:00:00.000Z");
    service = new LiveUorStudentAuthorizationApplication(
      "a-test-secret-long-enough",
      { send: vi.fn(async ({ message }) => { delivered.push(message); }) },
      client as unknown as PrismaClient,
      () => now,
      () => "123456",
    );
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  async function createAuthorization() {
    return service.create({
      owner,
      representativeProfileId: "10000000-0000-4000-8000-000000000002",
      purpose: "finance_reference_sharing",
      action: "finance.reference.view",
      resourceType: "payment_reference",
      resourceId: "usi_1234567890123456789012345678901234567890123",
      fields: ["reference.number", "reference.amount"],
      expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
      maxUses: 1,
      traceId: "trace-create",
    });
  }

  it("exige escopo granular e impede representante de outra instituição", async () => {
    await expect(service.create({
      owner,
      representativeProfileId: "10000000-0000-4000-8000-000000000002",
      purpose: "bad",
      action: "read",
      resourceType: "profile",
      resourceId: "resource-1",
      fields: ["*"],
      expiresAt: new Date(now.getTime() + 60_000),
      maxUses: 1,
    })).rejects.toMatchObject({ code: "UOR_STUDENT_AUTHORIZATION_SCOPE_INVALID" });
    await expect(service.create({
      owner,
      representativeProfileId: "10000000-0000-4000-8000-000000000003",
      purpose: "profile_share",
      action: "profile.view",
      resourceType: "profile",
      resourceId: "resource-1",
      fields: ["profile.name"],
      expiresAt: new Date(now.getTime() + 60_000),
      maxUses: 1,
    })).rejects.toMatchObject({ code: "UOR_STUDENT_REPRESENTATIVE_INVALID" });
  });

  it("liga OTP ao contexto, persiste tentativa falhada e aprova uma única vez", async () => {
    const authorization = await createAuthorization();
    const challenge = await service.requestOtp({ student: representative, authorizationId: authorization.id, traceId: "trace-otp" });
    expect(delivered[0]).toContain("123456");
    await expect(service.decide({ student: representative, authorizationId: authorization.id, challengeId: challenge.challengeId, code: "000000", decision: "approve" })).rejects.toMatchObject({ code: "UOR_STUDENT_OTP_INCORRECT" });
    expect(await client!.uorStudentOtpChallenge.findUnique({ where: { id: challenge.challengeId }, select: { attempts: true, status: true } })).toEqual({ attempts: 1, status: "PENDING" });

    const approved = await service.decide({ student: representative, authorizationId: authorization.id, challengeId: challenge.challengeId, code: "123456", decision: "approve", traceId: "trace-decision" });
    expect(approved.status).toBe("active");
    await expect(service.decide({ student: representative, authorizationId: authorization.id, challengeId: challenge.challengeId, code: "123456", decision: "approve" })).rejects.toMatchObject({ code: "UOR_STUDENT_AUTHORIZATION_NOT_DECIDABLE" });

    const consumed = await service.consume({ student: representative, authorizationId: authorization.id, purpose: authorization.purpose, action: authorization.action, resourceType: authorization.resourceType, resourceId: authorization.resourceId, fields: authorization.fields });
    expect(consumed).toMatchObject({ status: "used", usedCount: 1 });
    await expect(service.consume({ student: representative, authorizationId: authorization.id, purpose: authorization.purpose, action: authorization.action, resourceType: authorization.resourceType, resourceId: authorization.resourceId, fields: authorization.fields })).rejects.toMatchObject({ code: "UOR_STUDENT_AUTHORIZATION_DENIED" });
  });

  it("revoga imediatamente e mantém notificações minimizadas e deduplicadas", async () => {
    const authorization = await createAuthorization();
    const revoked = await service.revoke({ student: owner, authorizationId: authorization.id, traceId: "trace-revoke" });
    expect(revoked.status).toBe("revoked");
    expect((await service.listNotifications({ student: representative, limit: 10 })).items).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "authorization", status: "unread" }),
    ]));
    expect(JSON.stringify(await client!.uorStudentNotification.findMany())).not.toMatch(/reference\.number|reference\.amount|usi_/);
  });
});
