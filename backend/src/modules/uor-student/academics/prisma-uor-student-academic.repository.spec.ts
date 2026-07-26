import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaUorStudentAcademicRepository } from "./prisma-uor-student-academic.repository";

const IDENTITY_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql");
const ACADEMIC_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722190000_uor_student_academic_engine/migration.sql");
const student = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };

describe("PrismaUorStudentAcademicRepository", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let repository: PrismaUorStudentAcademicRepository;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-academic-"));
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
        (2, 'UOR', '20260002');
    `);
    sqlite.exec(await readFile(IDENTITY_MIGRATION, "utf8"));
    sqlite.exec(await readFile(ACADEMIC_MIGRATION, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    repository = new PrismaUorStudentAcademicRepository(client as unknown as PrismaClient);
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("persiste e edita a simulação separada das notas oficiais", async () => {
    const scenario = {
      subjectKey: "algoritmos",
      period: "2025/2026",
      entries: [{ key: "exam", label: "Exame", score: 14, weight: 1 }],
    };
    const created = await repository.createSimulation({
      student,
      scenario,
      normalizedEntries: [{ key: "exam", label: "Exame", score: "14", weight: "1" }],
      result: { average: "14.00", considered: 1, missing: 0 },
      traceId: "trace-create",
    });
    const updated = await repository.updateSimulation({
      student,
      id: created.id,
      scenario,
      normalizedEntries: [{ key: "exam", label: "Exame", score: "16", weight: "1" }],
      result: { average: "16.00", considered: 1, missing: 0 },
      traceId: "trace-update",
    });
    expect(created.rule.status).toBe("hypothesis");
    expect(updated?.result.average).toBe("16.00");
    expect(await client!.uorStudentAcademicSimulation.count()).toBe(1);
    expect(await client!.uorStudentAuditEvent.count({ where: { studentId: 1 } })).toBe(2);
  });

  it("impede IDOR e pagina por ID opaco pertencente ao titular", async () => {
    const first = await repository.createSimulation({
      student,
      scenario: { subjectKey: "redes", period: null, entries: [] },
      normalizedEntries: [{ key: "a", label: "A", score: "10", weight: "1" }],
      result: { average: "10.00", considered: 1, missing: 0 },
    });
    const denied = await repository.updateSimulation({
      student: { id: 2, institutionCode: "UOR", studentNumber: "20260002" },
      id: first.id,
      scenario: { subjectKey: "redes", period: null, entries: [] },
      normalizedEntries: [{ key: "a", label: "A", score: "20", weight: "1" }],
      result: { average: "20.00", considered: 1, missing: 0 },
    });
    const page = await repository.listSimulations({ student, limit: 1 });
    expect(denied).toBeNull();
    expect(page.items[0]?.id).toBe(first.id);
    expect((await repository.listSimulations({ student: { id: 2, institutionCode: "UOR", studentNumber: "20260002" }, limit: 10 })).items).toEqual([]);
  });
});
