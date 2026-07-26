import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaUorStudentIdentityRepository } from "./prisma-uor-student-identity.repository";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql",
);
const uorStudent = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };

describe("PrismaUorStudentIdentityRepository", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let repository: PrismaUorStudentIdentityRepository;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-identity-"));
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
        "deletedAt" DATETIME,
        "updatedAt" DATETIME NOT NULL
      );
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber", "name", "course", "academicSyncedAt", "updatedAt") VALUES
        (1, 'UOR', '20260001', 'Estudante Oficial', 'Engenharia', '2026-07-22T10:00:00.000Z', '2026-07-22T10:00:00.000Z'),
        (2, 'OUTRA', '20260001', 'Outro Estudante', 'Direito', '2026-07-22T10:00:00.000Z', '2026-07-22T10:00:00.000Z');
    `);
    sqlite.exec(await readFile(MIGRATION_PATH, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    repository = new PrismaUorStudentIdentityRepository(client as unknown as PrismaClient);
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("mantém campos oficiais separados dos campos declarados e usa ID opaco estável", async () => {
    const before = await repository.getProfile(uorStudent);
    const updated = await repository.updateProfile({
      student: uorStudent,
      patch: { email: "student@example.test", bio: "Perfil local" },
      traceId: "trace-profile",
    });
    const again = await repository.getProfile(uorStudent);

    expect(before?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(updated.id).toBe(before?.id);
    expect(again?.fields.displayName).toMatchObject({ value: "Estudante Oficial", source: "secretaria_uor" });
    expect(again?.fields.email).toMatchObject({ value: "student@example.test", source: "student" });
    expect(await client!.student.findUnique({ where: { id: 1 }, select: { name: true, course: true } })).toEqual({
      name: "Estudante Oficial",
      course: "Engenharia",
    });
    expect(await client!.uorStudentAuditEvent.findFirst({ where: { studentId: 1 } })).toMatchObject({
      action: "profile.updated",
      traceId: "trace-profile",
      product: "uor_student",
    });
  });

  it("revoga consentimento por finalidade e isola matrícula igual de outra instituição", async () => {
    const granted = await repository.setPrivacy({
      student: uorStudent,
      purpose: "ranking_participation",
      enabled: true,
      fields: ["course", "academicYear"],
      expiresAt: null,
      traceId: "trace-consent",
    });
    const revoked = await repository.setPrivacy({
      student: uorStudent,
      purpose: "ranking_participation",
      enabled: false,
      fields: ["course", "academicYear"],
      expiresAt: null,
      traceId: "trace-revoke",
    });

    expect(granted.enabled).toBe(true);
    expect(revoked).toMatchObject({ enabled: false, policyVersion: "uor-student-privacy-2026-07-22" });
    expect(revoked.revokedAt).not.toBeNull();
    expect(await repository.listPrivacy({ id: 2, institutionCode: "OUTRA", studentNumber: "20260001" })).toEqual([]);
  });

  it("exporta somente o escopo solicitado e não permite IDOR", async () => {
    const request = await repository.createDataRequest({
      student: uorStudent,
      type: "export",
      scope: ["profile", "privacy"],
      traceId: "trace-export",
    });
    const payload = await repository.getExportPayload(uorStudent, request.id);
    const denied = await repository.getExportPayload({ id: 2, institutionCode: "OUTRA", studentNumber: "20260001" }, request.id);

    expect(request).toMatchObject({ type: "export", status: "completed", resultAvailable: true });
    expect(payload).toHaveProperty("profile");
    expect(payload).toHaveProperty("privacy");
    expect(payload).not.toHaveProperty("providerSnapshots");
    expect(JSON.stringify(payload)).not.toMatch(/credentialsEnvelope|sessionEnvelope|password/i);
    expect(denied).toBeNull();
  });
});
