import { describe, expect, it, vi } from "vitest";
import { LiveUorStudentWorkflowApplication } from "./workflow-service";
import type { UorStudentWorkflowRepository, UorStudentWorkflowView } from "./domain";

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
});
