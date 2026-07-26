import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UorStudentAcademicApplication } from "../academics/academic-service";
import { LiveUorStudentRankingApplication } from "./ranking-service";

const IDENTITY_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722170000_uor_student_identity_privacy/migration.sql");
const WORKFLOW_MIGRATION = path.resolve(process.cwd(), "prisma/migrations/20260722210000_uor_student_local_workflows/migration.sql");
const context = { course: "Engenharia", classCode: "ENG-1", period: "2026", subjectKey: "algoritmos" };

describe("LiveUorStudentRankingApplication", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let service: LiveUorStudentRankingApplication;
  const scores = new Map([[1, "15"], [2, "14"], [3, "13"], [4, "12"], [5, "11"]]);

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-ranking-"));
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
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber", "name", "course", "classCode", "academicPeriod", "updatedAt") VALUES
        (1, 'UOR', '20260001', 'Um', 'Engenharia', 'ENG-1', '2026', CURRENT_TIMESTAMP),
        (2, 'UOR', '20260002', 'Dois', 'Engenharia', 'ENG-1', '2026', CURRENT_TIMESTAMP),
        (3, 'UOR', '20260003', 'Três', 'Engenharia', 'ENG-1', '2026', CURRENT_TIMESTAMP),
        (4, 'UOR', '20260004', 'Quatro', 'Engenharia', 'ENG-1', '2026', CURRENT_TIMESTAMP),
        (5, 'UOR', '20260005', 'Cinco', 'Engenharia', 'ENG-1', '2026', CURRENT_TIMESTAMP),
        (6, 'OUTRA', '20260001', 'Outro', 'Engenharia', 'ENG-1', '2026', CURRENT_TIMESTAMP);
    `);
    sqlite.exec(await readFile(IDENTITY_MIGRATION, "utf8"));
    sqlite.exec(await readFile(WORKFLOW_MIGRATION, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    const academics = {
      getAverages: vi.fn(async (student: { id: number }) => ({
        subjects: [{ subjectKey: "algoritmos", subjectName: "Algoritmos", period: "2026", average: scores.get(student.id) ?? null, considered: 1, missing: 0 }],
        overall: { average: scores.get(student.id) ?? null, consideredSubjects: 1, missingSubjects: 0 },
        rule: { code: "derived", version: 1, status: "derived_method" as const, formula: "mean" },
        inputs: [],
        provenance: { source: "secretaria_uor" as const, observedAt: "2026-07-22T10:00:00.000Z", coverage: "exact" as const, stale: false },
      })),
    } as unknown as UorStudentAcademicApplication;
    service = new LiveUorStudentRankingApplication(academics, client as unknown as PrismaClient, 5);
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("oculta grupos pequenos, retorna somente posição privada e retira contribuição", async () => {
    for (let id = 1; id <= 4; id += 1) {
      await service.setParticipation({ student: { id, institutionCode: "UOR", studentNumber: `2026000${id}` }, context, enabled: true });
    }
    expect(await service.getPrivatePosition({ student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" }, context })).toMatchObject({ status: "insufficient_sample", position: null, sampleSize: 4, coverage: 1 });

    await service.setParticipation({ student: { id: 5, institutionCode: "UOR", studentNumber: "20260005" }, context, enabled: true });
    const result = await service.getPrivatePosition({ student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" }, context });
    expect(result).toMatchObject({ status: "available", position: 1, percentile: 100, sampleSize: 5, coverage: 1 });
    expect(result).not.toHaveProperty("participants");
    expect(JSON.stringify(result)).not.toMatch(/Dois|20260002/);

    await service.setParticipation({ student: { id: 5, institutionCode: "UOR", studentNumber: "20260005" }, context, enabled: false });
    expect(await service.getPrivatePosition({ student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" }, context })).toMatchObject({ status: "insufficient_sample", sampleSize: 4 });
  });

  it("recusa contexto que não corresponde ao perfil oficial", async () => {
    await expect(service.setParticipation({ student: { id: 1, institutionCode: "UOR", studentNumber: "20260001" }, context: { ...context, classCode: "OUTRA" }, enabled: true })).rejects.toMatchObject({ code: "UOR_STUDENT_RANKING_CONTEXT_INVALID" });
  });
});
