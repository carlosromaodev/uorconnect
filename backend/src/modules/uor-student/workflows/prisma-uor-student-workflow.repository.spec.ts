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
const reviewer = { id: 4, institutionCode: "UOR", studentNumber: "20260003" };

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
        (3, 'OUTRA', '20260001', 'Outro tenant', CURRENT_TIMESTAMP),
        (4, 'UOR', '20260003', 'Revisor', CURRENT_TIMESTAMP);
    `);
    sqlite.exec(await readFile(IDENTITY_MIGRATION, "utf8"));
    sqlite.exec(`
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000001' WHERE "id" = 1;
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000002' WHERE "id" = 2;
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000003' WHERE "id" = 3;
      UPDATE "Student" SET "uorStudentPublicId" = '10000000-0000-4000-8000-000000000004' WHERE "id" = 4;
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

  it("expira reportes comunitários e deriva confirmação ou contestação independente", async () => {
    const report = await repository.create({
      owner,
      category: "community_report",
      scopeKey: "algoritmos:2026",
      status: "reported",
      payload: { kind: "room_change", description: "Mudança para a sala 8" },
      expiresAt: new Date(Date.now() + 60_000),
    });
    const expired = await repository.create({
      owner,
      category: "community_report",
      scopeKey: "algoritmos:2025",
      status: "reported",
      payload: { kind: "room_change", description: "Informação antiga" },
      expiresAt: new Date(Date.now() - 60_000),
    });

    expect(await repository.getPublic({
      student: participant,
      id: expired.id,
      category: "community_report",
      statuses: ["reported"],
    })).toBeNull();
    expect(await repository.reactPublic({
      student: owner,
      aggregateId: report.id,
      category: "community_report",
      role: "reviewer",
      status: "confirmed",
      allowedAggregateStatuses: ["reported", "confirmed", "contested"],
    })).toBeNull();

    const first = await repository.reactPublic({
      student: participant,
      aggregateId: report.id,
      category: "community_report",
      role: "reviewer",
      status: "confirmed",
      allowedAggregateStatuses: ["reported", "confirmed", "contested"],
    });
    const confirmed = await repository.reactPublic({
      student: reviewer,
      aggregateId: report.id,
      category: "community_report",
      role: "reviewer",
      status: "confirmed",
      allowedAggregateStatuses: ["reported", "confirmed", "contested"],
    });
    const contested = await repository.reactPublic({
      student: reviewer,
      aggregateId: report.id,
      category: "community_report",
      role: "reviewer",
      status: "contested",
      allowedAggregateStatuses: ["reported", "confirmed", "contested"],
    });

    expect(first?.status).toBe("reported");
    expect(confirmed?.status).toBe("confirmed");
    expect(contested).toMatchObject({
      status: "contested",
      actors: expect.arrayContaining([
        expect.objectContaining({ profileId: "10000000-0000-4000-8000-000000000002", status: "confirmed" }),
        expect.objectContaining({ profileId: "10000000-0000-4000-8000-000000000004", status: "contested" }),
      ]),
    });
  });

  it("reserva um anúncio uma única vez e bloqueia nova reserva depois da venda", async () => {
    const listing = await repository.create({
      owner,
      category: "market_listing",
      scopeKey: "book",
      status: "published",
      payload: { title: "Livro de algoritmos", price: 5_000, currency: "AOA" },
      expiresAt: new Date(Date.now() + 60_000),
    });
    const reserved = await repository.reactPublic({
      student: participant,
      aggregateId: listing.id,
      category: "market_listing",
      role: "buyer",
      status: "reserved",
      allowedAggregateStatuses: ["published"],
    });

    expect(reserved?.status).toBe("reserved");
    expect(await repository.reactPublic({
      student: reviewer,
      aggregateId: listing.id,
      category: "market_listing",
      role: "buyer",
      status: "reserved",
      allowedAggregateStatuses: ["published"],
    })).toBeNull();

    const sold = await repository.transitionOwned({
      student: owner,
      id: listing.id,
      category: "market_listing",
      from: ["reserved"],
      to: "sold",
    });
    expect(sold?.status).toBe("sold");
    expect(await repository.reactPublic({
      student: reviewer,
      aggregateId: listing.id,
      category: "market_listing",
      role: "buyer",
      status: "reserved",
      allowedAggregateStatuses: ["published"],
    })).toBeNull();
  });

  it("revoga atomicamente a relação de explicação e todos os acessos associados", async () => {
    const relationship = await repository.create({
      owner,
      category: "tutoring_request",
      scopeKey: "algoritmos:2026",
      status: "pending",
      payload: { subjectKey: "algoritmos", period: "2026" },
    });
    await repository.addActor({
      owner,
      aggregateId: relationship.id,
      category: "tutoring_request",
      profileId: "10000000-0000-4000-8000-000000000002",
      role: "tutor",
      status: "invited",
    });
    const active = await repository.decideActor({
      student: participant,
      aggregateId: relationship.id,
      category: "tutoring_request",
      role: "tutor",
      from: ["invited"],
      to: "accepted",
      aggregateStatuses: ["pending"],
    });
    const grant = await repository.create({
      owner,
      category: "tutoring_grant",
      scopeKey: relationship.id,
      status: "active",
      payload: { subjectKey: "algoritmos", period: "2026", fields: ["academic.grades"] },
      expiresAt: new Date(Date.now() + 60_000),
    });
    await repository.addActor({
      owner,
      aggregateId: grant.id,
      category: "tutoring_grant",
      profileId: "10000000-0000-4000-8000-000000000002",
      role: "tutor",
      status: "active",
    });

    expect(active?.status).toBe("active");
    expect((await repository.getForActor({
      student: participant,
      id: grant.id,
      category: "tutoring_grant",
      role: "tutor",
      actorStatuses: ["active"],
      aggregateStatuses: ["active"],
    }))?.status).toBe("active");

    const revoked = await repository.revokeTutoringRelationship({
      student: participant,
      relationshipId: relationship.id,
      traceId: "trace-revoke",
    });
    expect(revoked?.status).toBe("revoked");
    expect(await repository.getForActor({
      student: participant,
      id: grant.id,
      category: "tutoring_grant",
      role: "tutor",
      actorStatuses: ["active"],
      aggregateStatuses: ["active"],
    })).toBeNull();
    expect(await client!.uorStudentAggregate.findUnique({ where: { id: grant.id }, select: { status: true } })).toEqual({ status: "REVOKED" });
  });
});
