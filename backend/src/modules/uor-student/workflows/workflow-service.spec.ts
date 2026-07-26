import { describe, expect, it, vi } from "vitest";
import { LiveUorStudentWorkflowApplication } from "./workflow-service";
import type { UorStudentWorkflowRepository, UorStudentWorkflowView } from "./domain";
import type { UorStudentOfficialDataRepository } from "../application/ports";

const student = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };

function repository(items: UorStudentWorkflowView[] = []): UorStudentWorkflowRepository {
  return {
    create: vi.fn(async (input) => ({
      id: "10000000-0000-4000-8000-000000000001",
      category: input.category,
      ownerProfileId: "20000000-0000-4000-8000-000000000001",
      scopeKey: input.scopeKey,
      status: input.status,
      payload: input.payload,
      version: 1,
      expiresAt: input.expiresAt?.toISOString() ?? null,
      actors: [],
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    })),
    getAccessible: vi.fn(async () => null),
    getOwned: vi.fn(async () => null),
    getPublic: vi.fn(async () => null),
    getForActor: vi.fn(async () => null),
    list: vi.fn(async () => ({ items, nextCursor: null })),
    transitionOwned: vi.fn(async () => null),
    addActor: vi.fn(async () => null),
    decideActor: vi.fn(async () => null),
    reactPublic: vi.fn(async () => null),
    revokeTutoringRelationship: vi.fn(async () => null),
    listEvents: vi.fn(async () => null),
  };
}

function event(id: string, startsAt: string, endsAt: string): UorStudentWorkflowView {
  return {
    id,
    category: "personal_event",
    ownerProfileId: "20000000-0000-4000-8000-000000000001",
    scopeKey: startsAt,
    status: "scheduled",
    payload: { title: id, startsAt, endsAt },
    version: 1,
    expiresAt: null,
    actors: [],
    createdAt: startsAt,
    updatedAt: startsAt,
  };
}

function officialEnrollments(items: Array<{ id: string; attributes: Record<string, unknown> }>): UorStudentOfficialDataRepository {
  return {
    getDataset: vi.fn(async () => ({
      domain: "academic.enrollments",
      items,
      pagination: { limit: 100, hasMore: false, nextCursor: null, total: items.length },
      provenance: { source: "secretaria_uor" as const, observedAt: "2026-07-26T10:00:00.000Z", coverage: "exact" as const, stale: false },
      snapshotVersion: 3,
    })),
  };
}

describe("LiveUorStudentWorkflowApplication", () => {
  it("rejeita wildcard e campos financeiros num acesso de explicador", async () => {
    const service = new LiveUorStudentWorkflowApplication(repository());
    expect(() => service.create({
      owner: student,
      category: "tutoring_grant",
      scopeKey: "algoritmos:2026",
      status: "active",
      payload: { fields: ["academic.grades", "finance.debts"] },
    })).toThrow(expect.objectContaining({ code: "UOR_STUDENT_GRANT_SCOPE_INVALID" }));
  });

  it("exige validade futura para comunidade e rascunho para recurso local", async () => {
    const service = new LiveUorStudentWorkflowApplication(repository());
    expect(() => service.create({
      owner: student,
      category: "community_report",
      scopeKey: "algoritmos:2026",
      status: "reported",
      payload: { kind: "room_change" },
      expiresAt: new Date(Date.now() - 1),
    })).toThrow(expect.objectContaining({ code: "UOR_STUDENT_EXPIRY_REQUIRED" }));
    expect(() => service.create({
      owner: student,
      category: "academic_appeal",
      scopeKey: "algoritmos:2026:exam",
      status: "submitted",
      payload: { origin: "uor_student" },
    })).toThrow(expect.objectContaining({ code: "UOR_STUDENT_APPEAL_INVALID" }));
  });

  it("deteta apenas a intersecção temporal de eventos pessoais", async () => {
    const service = new LiveUorStudentWorkflowApplication(repository([
      event("a", "2026-07-23T09:00:00.000Z", "2026-07-23T10:30:00.000Z"),
      event("b", "2026-07-23T10:00:00.000Z", "2026-07-23T11:00:00.000Z"),
      event("c", "2026-07-23T12:00:00.000Z", "2026-07-23T13:00:00.000Z"),
    ]));
    expect(await service.findPersonalConflicts(student)).toEqual([{
      leftId: "a",
      rightId: "b",
      startsAt: "2026-07-23T10:00:00.000Z",
      endsAt: "2026-07-23T10:30:00.000Z",
    }]);
  });

  it("oculta agregação pedagógica abaixo da amostra mínima", async () => {
    const evaluations = Array.from({ length: 4 }, (_, index): UorStudentWorkflowView => ({
      ...event(String(index), new Date(index).toISOString(), new Date(index + 1).toISOString()),
      category: "teaching_evaluation",
      scopeKey: "docente:algoritmos:2026",
      status: "published",
      payload: { score: 4, dimensions: { clarity: 5 } },
    }));
    const service = new LiveUorStudentWorkflowApplication(repository(evaluations));
    expect(await service.aggregateTeachingEvaluations(student, "docente:algoritmos:2026", 5)).toEqual({
      status: "insufficient_sample",
      sampleSize: 4,
      minimumSample: 5,
      average: null,
      dimensions: {},
      scopeKey: "docente:algoritmos:2026",
    });
  });

  it("publica somente a agregação pedagógica quando a amostra é suficiente", async () => {
    const evaluations = Array.from({ length: 5 }, (_, index): UorStudentWorkflowView => ({
      ...event(String(index), new Date(index).toISOString(), new Date(index + 1).toISOString()),
      category: "teaching_evaluation",
      ownerProfileId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      scopeKey: "docente:algoritmos:2026",
      status: "published",
      payload: { score: index + 1, dimensions: { clarity: index + 1 }, comment: `comentário ${index}` },
    }));
    const service = new LiveUorStudentWorkflowApplication(repository(evaluations));
    const result = await service.aggregateTeachingEvaluations(student, "docente:algoritmos:2026", 5);

    expect(result).toEqual({
      status: "available",
      sampleSize: 5,
      minimumSample: 5,
      average: "3.00",
      dimensions: { clarity: "3.00" },
      scopeKey: "docente:algoritmos:2026",
    });
    expect(JSON.stringify(result)).not.toMatch(/ownerProfileId|comentário|20000000-/);
  });

  it("aceita avaliação apenas para associação oficial à cadeira e período, incluindo aliases locais", async () => {
    const storage = repository();
    const service = new LiveUorStudentWorkflowApplication(storage, officialEnrollments([
      { id: "enrollment-1", attributes: { disciplina: "Programação II", anoLectivo: "2025/2026" } },
    ]));

    await expect(service.createTeachingEvaluation({
      student,
      teacherKey: "docente-1",
      subjectKey: "Programacao II",
      period: "2025/2026",
      score: 4,
      dimensions: { clarity: 5 },
    })).resolves.toMatchObject({
      category: "teaching_evaluation",
      scopeKey: "docente-1:Programacao II:2025/2026",
      status: "published",
    });
    expect(storage.create).toHaveBeenCalledWith(expect.objectContaining({
      owner: student,
      category: "teaching_evaluation",
      payload: expect.objectContaining({ teacherKey: "docente-1", subjectKey: "Programacao II", period: "2025/2026" }),
    }));
  });

  it("nega avaliação sem associação oficial e impede duplicação contextual", async () => {
    const service = new LiveUorStudentWorkflowApplication(repository(), officialEnrollments([
      { id: "enrollment-1", attributes: { disciplina: "Redes", periodo: "2025/2026" } },
    ]));
    await expect(service.createTeachingEvaluation({
      student,
      teacherKey: "docente-1",
      subjectKey: "Algoritmos",
      period: "2025/2026",
      score: 4,
      dimensions: {},
    })).rejects.toMatchObject({ code: "UOR_STUDENT_EVALUATION_NOT_ELIGIBLE" });

    const existing: UorStudentWorkflowView = {
      ...event("evaluation-1", "2026-01-01T10:00:00.000Z", "2026-01-01T11:00:00.000Z"),
      category: "teaching_evaluation",
      scopeKey: "docente-1:Algoritmos:2025/2026",
      status: "published",
      payload: { score: 4 },
    };
    const duplicate = new LiveUorStudentWorkflowApplication(repository([existing]), officialEnrollments([]));
    await expect(duplicate.createTeachingEvaluation({
      student,
      teacherKey: "docente-1",
      subjectKey: "Algoritmos",
      period: "2025/2026",
      score: 5,
      dimensions: {},
    })).rejects.toMatchObject({ code: "UOR_STUDENT_EVALUATION_DUPLICATE" });
  });
});
