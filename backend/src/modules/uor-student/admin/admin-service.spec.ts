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
      3,
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

  it("publica para a Direção somente read model agregado e suprime grupos pequenos", async () => {
    await client!.$executeRawUnsafe(`
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber", "name", "course", "academicYear", "academicPeriod", "isUorStudent", "updatedAt") VALUES
        (3, 'UOR', '20260003', 'A', 'Engenharia', '2', '2026/1', true, CURRENT_TIMESTAMP),
        (4, 'UOR', '20260004', 'B', 'Engenharia', '2', '2026/1', true, CURRENT_TIMESTAMP),
        (5, 'UOR', '20260005', 'C', 'Engenharia', '2', '2026/1', true, CURRENT_TIMESTAMP),
        (6, 'UOR', '20260006', 'D', 'Direito', '1', '2026/1', true, CURRENT_TIMESTAMP),
        (7, 'UOR', '20260007', 'E', 'Direito', '1', '2026/1', true, CURRENT_TIMESTAMP),
        (8, 'OUTRA', '20260003', 'F', 'Engenharia', '2', '2026/1', true, CURRENT_TIMESTAMP)
    `);

    const result = await service.directionAcademicContextReadModel(admin, "2026/1");
    expect(result).toMatchObject({
      producer: "uor_student",
      authorizedConsumer: "uor_direction",
      purpose: "institutional_academic_planning",
      institutionCode: "UOR",
      minimumSample: 3,
      suppressedBuckets: 1,
      buckets: [{ course: "Engenharia", academicYear: "2", academicPeriod: "2026/1", students: 3 }],
    });
    expect(JSON.stringify(result)).not.toMatch(/2026000|uorStudentPublicId|studentNumber|name|phone/i);
    expect(await client!.uorStudentAuditEvent.findFirst({
      where: { action: "direction.academic_context.published" },
    })).toMatchObject({ purpose: "institutional_academic_planning", result: "succeeded" });
  });

  it("corrige o número académico sem trocar o ID interno, perfil público ou relações", async () => {
    const aggregate = await client!.uorStudentAggregate.create({
      data: {
        ownerStudentId: 2,
        institutionCode: "UOR",
        category: "personal_event",
        scopeKey: "2026-08-01T10:00:00Z",
        status: "SCHEDULED",
        payloadJson: "{}",
      },
    });
    const result = await service.correctStudentNumber({
      student: admin,
      profileId: "10000000-0000-4000-8000-000000000002",
      newStudentNumber: "20269999",
      reason: "Correção confirmada pelo registo académico.",
      traceId: "trace-number-correction",
    });

    expect(result).toEqual({
      profileId: "10000000-0000-4000-8000-000000000002",
      previousStudentNumber: "20260002",
      studentNumber: "20269999",
      relationshipsPreserved: true,
    });
    expect(await client!.student.findUnique({
      where: { id: 2 },
      select: { id: true, uorStudentPublicId: true, studentNumber: true },
    })).toEqual({
      id: 2,
      uorStudentPublicId: "10000000-0000-4000-8000-000000000002",
      studentNumber: "20269999",
    });
    expect(await client!.uorStudentAggregate.findUnique({
      where: { id: aggregate.id },
      select: { ownerStudentId: true },
    })).toEqual({ ownerStudentId: 2 });
    expect(await client!.uorStudentAuditEvent.findFirst({
      where: { action: "student_number.corrected" },
    })).toMatchObject({ resourceId: "10000000-0000-4000-8000-000000000002", traceId: "trace-number-correction" });

    await expect(service.correctStudentNumber({
      student: admin,
      profileId: "10000000-0000-4000-8000-000000000002",
      newStudentNumber: "20260001",
      reason: "Tentativa de colisão para teste.",
    })).rejects.toMatchObject({ code: "UOR_STUDENT_NUMBER_CONFLICT" });
  });
});
