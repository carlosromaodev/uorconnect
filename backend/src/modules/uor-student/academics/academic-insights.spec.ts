import { describe, expect, it } from "vitest";
import { LiveUorStudentAcademicInsights } from "./academic-insights";

const student = {
  id: 7,
  institutionCode: "UOR",
  studentNumber: "20260007",
};

const provenance = {
  source: "secretaria_uor" as const,
  observedAt: "2026-07-22T10:00:00.000Z",
  coverage: "exact" as const,
  stale: false,
};

function officialData() {
  const items: Record<string, Array<{ id: string; attributes: Record<string, unknown> }>> = {
    "academic.history": [
      { id: "history-1", attributes: { status: "Aprovado", period: "2025/1", credits: 30 } },
      { id: "history-2", attributes: { status: "Aprovado", period: "2025/2", credits: 30 } },
    ],
    "academic.credits": [
      { id: "credits-1", attributes: { totalCredits: 180, completedCredits: 60 } },
    ],
    "academic.enrollments": [
      { id: "enrollment-1", attributes: { disciplina: "Redes", estado: "Inscrito", creditos: 6, periodo: "2026/1" } },
    ],
    "academic.progression": [
      { id: "progression-1", attributes: { disciplina: "Sistemas Distribuídos", estado: "Bloqueado", precedencias: "Redes; Programação" } },
    ],
    "academic.classes": [
      {
        id: "class-1",
        attributes: {
          disciplina: "Arquitetura",
          inicio: "2026-07-27T10:00:00.000Z",
          fim: "2026-07-27T12:00:00.000Z",
          sala: "B12",
        },
      },
    ],
    "academic.exams": [
      {
        id: "exam-1",
        attributes: {
          disciplina: "Redes",
          data: "2026-07-27T11:00:00.000Z",
          fim: "2026-07-27T13:00:00.000Z",
        },
      },
    ],
  };
  return {
    getDataset: async ({ domain }: { domain: string }) => ({
      domain,
      items: items[domain] ?? [],
      pagination: { limit: 100, hasMore: false, nextCursor: null, total: items[domain]?.length ?? 0 },
      provenance,
      snapshotVersion: 2,
    }),
  };
}

function personalEvents() {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `personal-${index + 1}`,
    ownerProfileId: "11111111-1111-4111-8111-111111111111",
    category: "personal_event" as const,
    scopeKey: `personal-${index + 1}`,
    status: "scheduled",
    payload: {
      title: `Sessão ${index + 1}`,
      startsAt: `2026-07-${27 + index}T18:00:00.000Z`,
      endsAt: `2026-07-${27 + index}T22:30:00.000Z`,
    },
    visibility: "private",
    expiresAt: null,
    version: 1,
    createdAt: "2026-07-22T10:00:00.000Z",
    updatedAt: "2026-07-22T10:00:00.000Z",
    actors: [],
  }));
}

function service() {
  const observedAt = new Date("2026-07-22T10:00:00.000Z");
  const workflows = {
    list: async () => ({ items: personalEvents(), nextCursor: null }),
  };
  const db = {
    secretariaConnection: {
      findFirst: async () => ({ activeSnapshotVersion: 2 }),
    },
    secretariaSnapshot: {
      findMany: async () => [
        {
          snapshotVersion: 1,
          payloadJson: JSON.stringify({ items: [{ disciplina: "Arquitetura", nota: 12 }] }),
          observedAt,
        },
        {
          snapshotVersion: 2,
          payloadJson: JSON.stringify({ items: [{ disciplina: "Arquitetura", nota: 16 }] }),
          observedAt: new Date("2026-07-23T10:00:00.000Z"),
        },
      ],
    },
  };
  return new LiveUorStudentAcademicInsights(
    officialData() as never,
    workflows as never,
    db as never,
  );
}

describe("LiveUorStudentAcademicInsights", () => {
  it("produz evolução e previsão explicáveis sem transformar estimativa em facto oficial", async () => {
    const insights = service();

    const evolution = await insights.evolution(student);
    const completion = await insights.completionEstimate(student);

    expect(evolution).toMatchObject({
      method: "official_snapshot_weighted_average_v1",
      coverage: "exact",
      series: [
        { snapshotVersion: 1, average: "12.00", stale: true, source: "secretaria_uor" },
        { snapshotVersion: 2, average: "16.00", stale: false, source: "secretaria_uor" },
      ],
    });
    expect(completion).toMatchObject({
      status: "estimated",
      completedCredits: 60,
      totalCredits: 180,
      estimatedRemainingPeriods: 4,
      method: "credit_velocity_v1",
      uncertainty: "high",
    });
    expect(completion.assumptions).toHaveLength(2);
  });

  it("normaliza mapa curricular, precedências e conclusão sem inventar crédito oficial", async () => {
    const curriculum = await service().curriculumMap(student);

    expect(curriculum.completion).toEqual({
      completedCredits: 60,
      totalCredits: 180,
      percentage: 33.33,
      status: "official",
    });
    expect(curriculum.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ subjectName: "Redes", status: "current", credits: 6 }),
      expect.objectContaining({
        subjectName: "Sistemas Distribuídos",
        status: "blocked",
        prerequisites: ["Redes", "Programação"],
      }),
    ]));
    expect(curriculum.provenance.progression).toEqual(provenance);
  });

  it("unifica agenda, deteta sobreposição e sinaliza sobrecarga como recomendação", async () => {
    const insights = service();

    const agenda = await insights.agenda(student);
    const conflicts = await insights.conflicts(student);
    const overload = await insights.overload(student);

    expect(agenda.items).toHaveLength(7);
    expect(agenda.items.map((item) => item.source)).toEqual(
      expect.arrayContaining(["secretaria_uor", "uor_student"]),
    );
    expect(conflicts).toMatchObject({
      status: "advisory",
      method: "unified_interval_overlap_v1",
      conflicts: [
        {
          leftId: "class-1",
          rightId: "exam-1",
          startsAt: "2026-07-27T11:00:00.000Z",
          endsAt: "2026-07-27T12:00:00.000Z",
        },
      ],
    });
    expect(overload.status).toBe("advisory");
    expect(overload.periods).toEqual([
      expect.objectContaining({
        weekStartsAt: "2026-07-27",
        eventCount: 7,
        estimatedHours: 26.5,
      }),
    ]);
    expect(overload.recommendation).toContain("não é uma decisão académica oficial");
  });
});
