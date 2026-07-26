import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UorStudentAdminApplication } from "./admin-service";

const IDENTITY_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql");
const WORKFLOW_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722210000_uor_student_local_workflows/migration.sql");
const admin = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };

describe("UorStudentAdminApplication", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let service: UorStudentAdminApplication;
  let now: Date;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-admin-"));
    const databasePath = path.join(directory, "repository.db");
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE "Student" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "institutionCode" TEXT NOT NULL,
        "studentNumber" TEXT NOT NULL,
        "name" TEXT,
        "phone" TEXT,
        "course" TEXT,
        "classCode" TEXT,
        "academicYear" TEXT,
        "academicPeriod" TEXT,
        "academicSyncedAt" DATETIME,
        "isUorStudent" BOOLEAN NOT NULL DEFAULT true,
        "deletedAt" DATETIME,
        "updatedAt" DATETIME NOT NULL
      );
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber", "name", "phone", "updatedAt") VALUES
        (1, 'UOR', '20260001', 'Administrador', '+244900000001', CURRENT_TIMESTAMP),
        (2, 'UOR', '20260002', 'Autor', '+244900000002', CURRENT_TIMESTAMP);
      CREATE TABLE "StudentAccessCode" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "studentId" INTEGER,
        "phone" TEXT NOT NULL,
        "codeHash" TEXT NOT NULL,
        "codeLast4" TEXT NOT NULL,
        "expiresAt" DATETIME NOT NULL,
        "usedAt" DATETIME,
        "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "purpose" TEXT NOT NULL DEFAULT 'CONVENTIONAL_LOGIN',
        "providerMessageId" TEXT,
        "providerResponseJson" TEXT,
        "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
        "errorMessage" TEXT,
        CONSTRAINT "StudentAccessCode_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    sqlite.exec(await readFile(IDENTITY_MIGRATION, "utf8"));
    sqlite.exec(`
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000001' WHERE "id" = 1;
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000002' WHERE "id" = 2;
    `);
    sqlite.exec(await readFile(WORKFLOW_MIGRATION, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    now = new Date("2026-07-22T12:00:00.000Z");
    service = new UorStudentAdminApplication(
      "admin-test-secret-long-enough",
      { send: vi.fn(async () => undefined) },
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

  it("emite sessão MFA curta e não aceita código reutilizado", async () => {
    await service.requestMfa(admin);
    const verified = await service.verifyMfa(admin, "123456");
    expect(service.verifyMfaToken(admin, verified.token)).toBe(true);
    await expect(service.verifyMfa(admin, "123456")).rejects.toMatchObject({ code: "UOR_STUDENT_ADMIN_MFA_INVALID" });
    now = new Date(now.getTime() + 6 * 60_000);
    expect(service.verifyMfaToken(admin, verified.token)).toBe(false);
  });

  it("versiona configuração com vigência e conserva histórico", async () => {
    await service.setConfiguration({ student: admin, key: "ranking.minimum_sample", value: { value: 5 }, effectiveFrom: new Date(now.getTime() + 60_000), traceId: "trace-v1" });
    await service.setConfiguration({ student: admin, key: "ranking.minimum_sample", value: { value: 8 }, effectiveFrom: new Date(now.getTime() + 120_000), traceId: "trace-v2" });
    const configurations = await service.listConfigurations(admin);
    expect(configurations).toEqual([
      expect.objectContaining({ version: 2, status: "active", value: { value: 8 } }),
      expect.objectContaining({ version: 1, status: "retired", value: { value: 5 } }),
    ]);
  });

  it("modera somente conteúdo comunitário sem consultar notas ou finanças", async () => {
    const listing = await client!.uorStudentAggregate.create({ data: { ownerStudentId: 2, institutionCode: "UOR", category: "market_listing", scopeKey: "book", status: "PUBLISHED", payloadJson: "{}" } });
    const report = await client!.uorStudentAggregate.create({ data: { ownerStudentId: 1, institutionCode: "UOR", category: "market_report", scopeKey: listing.id, status: "PENDING_MODERATION", payloadJson: JSON.stringify({ reason: "fraud" }) } });
    const result = await service.moderate({ student: admin, reportId: report.id, decision: "remove_content", rationale: "Conteúdo incompatível com a política.", traceId: "trace-moderate" });
    expect(result).toMatchObject({ targetId: listing.id, targetStatus: "removed" });
    expect(await client!.uorStudentAggregate.findUnique({ where: { id: listing.id }, select: { status: true } })).toEqual({ status: "REMOVED" });
    expect(await client!.uorStudentAuditEvent.findFirst({ where: { resourceId: report.id } })).toMatchObject({ domain: "moderation", product: "uor_student" });
  });
});
