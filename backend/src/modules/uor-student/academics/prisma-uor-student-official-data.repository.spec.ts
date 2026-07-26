import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as SQLitePrismaClient } from "@uor/moodle-test-prisma";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaUorStudentOfficialDataRepository } from "./prisma-uor-student-official-data.repository";

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "prisma/migrations/20260721223000_secretaria_integration_foundation/migration.sql",
);

describe("PrismaUorStudentOfficialDataRepository", () => {
  let directory: string;
  let client: SQLitePrismaClient | null = null;
  let repository: PrismaUorStudentOfficialDataRepository;

  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "uor-student-official-data-"));
    const databasePath = path.join(directory, "repository.db");
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(`
      CREATE TABLE "Student" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "institutionCode" TEXT NOT NULL,
        "studentNumber" TEXT NOT NULL,
        "deletedAt" DATETIME
      );
      INSERT INTO "Student" ("id", "institutionCode", "studentNumber") VALUES
        (1, 'UOR', '20260001'),
        (2, 'OUTRA', '20260001');
    `);
    sqlite.exec(await readFile(MIGRATION_PATH, "utf8"));
    sqlite.close();
    client = new SQLitePrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${databasePath}` }) });
    repository = new PrismaUorStudentOfficialDataRepository("test-cursor-secret", client as unknown as PrismaClient);
    await client.secretariaConnection.create({
      data: { studentId: 1, status: "CONNECTED", activeSnapshotVersion: 1 },
    });
    const dataset = {
      domain: "academic.grades",
      items: [
        { subject: "Algoritmos", grade: 15 },
        { subject: "Base de Dados", grade: null },
        { subject: "Redes", grade: 13 },
      ],
      total: 3,
      observedAt: "2026-07-22T10:00:00.000Z",
      coverage: "live",
    };
    await client.secretariaSnapshot.create({
      data: {
        studentId: 1,
        domain: "academic.grades",
        snapshotVersion: 1,
        payloadJson: JSON.stringify(dataset),
        itemCount: 3,
        coverage: "live",
        sourceHash: "hash",
        observedAt: new Date(dataset.observedAt),
      },
    });
  });

  afterEach(async () => {
    await client?.$disconnect();
    client = null;
    await rm(directory, { recursive: true, force: true });
  });

  it("pagina localmente, preserva nulos e usa IDs/cursor opacos autenticados", async () => {
    const student = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };
    const first = await repository.getDataset({ student, domain: "academic.grades", limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.items[1]?.attributes.grade).toBeNull();
    expect(first.items[0]?.id).toMatch(/^usi_[A-Za-z0-9_-]{43}$/);
    expect(first.pagination).toMatchObject({ total: 3, hasMore: true });
    const second = await repository.getDataset({
      student,
      domain: "academic.grades",
      limit: 2,
      cursor: first.pagination.nextCursor!,
    });
    expect(second.items.map((item) => item.attributes.subject)).toEqual(["Redes"]);
    await expect(repository.getDataset({
      student,
      domain: "academic.grades",
      limit: 2,
      cursor: `${first.pagination.nextCursor}tampered`,
    })).rejects.toMatchObject({ code: "UOR_STUDENT_CURSOR_INVALID" });
  });

  it("não lê snapshot por matrícula isolada nem fabrica conjunto vazio confirmado", async () => {
    const otherTenant = await repository.getDataset({
      student: { id: 2, institutionCode: "OUTRA", studentNumber: "20260001" },
      domain: "academic.grades",
      limit: 20,
    });
    expect(otherTenant).toMatchObject({
      items: [],
      pagination: { total: null },
      provenance: { coverage: "not_synced" },
    });
  });
});
