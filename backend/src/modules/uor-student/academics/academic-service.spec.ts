import { describe, expect, it, vi } from "vitest";
import type { UorStudentOfficialDataRepository } from "../application/ports";
import type { UorStudentAcademicRepository } from "./academic-service";
import { LiveUorStudentAcademicApplication } from "./academic-service";

const student = { id: 1, institutionCode: "UOR", studentNumber: "20260001" };

function setup() {
  const officialData = {
    getDataset: vi.fn(async () => ({
      domain: "academic.grades",
      items: [
        { id: `usi_${"a".repeat(43)}`, attributes: { descDiscip: "Algoritmos", tipoAvaliacao: "Contínua", nota: "14,0", peso: "40%" } },
        { id: `usi_${"b".repeat(43)}`, attributes: { descDiscip: "Algoritmos", tipoAvaliacao: "Exame", notaFinal: 16, peso: "60%" } },
        { id: `usi_${"c".repeat(43)}`, attributes: { descDiscip: "Redes", tipoAvaliacao: "Exame", notaFinal: null } },
      ],
      pagination: { limit: 100, hasMore: false, nextCursor: null, total: 3 },
      provenance: { source: "secretaria_uor", observedAt: "2026-07-22T10:00:00.000Z", coverage: "exact", stale: false },
      snapshotVersion: 2,
    })),
  } as unknown as UorStudentOfficialDataRepository;
  const repository = {
    listRules: vi.fn(async () => []),
    createSimulation: vi.fn(async (input) => ({
      id: "92cdd872-3f56-421d-902d-3b453b5cde6c",
      subjectKey: input.scenario.subjectKey,
      period: input.scenario.period,
      status: "active",
      rule: { code: "uor_student.simulation_weighted_mean", version: 1, status: "hypothesis" },
      scenario: input.normalizedEntries,
      result: input.result,
      createdAt: "2026-07-22T10:00:00.000Z",
      updatedAt: "2026-07-22T10:00:00.000Z",
    })),
    updateSimulation: vi.fn(),
    listSimulations: vi.fn(async () => ({ items: [], nextCursor: null })),
  } as unknown as UorStudentAcademicRepository;
  return { application: new LiveUorStudentAcademicApplication(officialData, repository), repository };
}

describe("LiveUorStudentAcademicApplication", () => {
  it("normaliza notas oficiais, calcula por cadeira e preserva ausências", async () => {
    const { application } = setup();
    const result = await application.getAverages(student);
    expect(result.subjects).toEqual(expect.arrayContaining([
      expect.objectContaining({ subjectName: "Algoritmos", average: "15.20", considered: 2, missing: 0 }),
      expect.objectContaining({ subjectName: "Redes", average: null, considered: 0, missing: 1 }),
    ]));
    expect(result.overall).toEqual({ average: "15.20", consideredSubjects: 1, missingSubjects: 1 });
    expect(result.rule).toMatchObject({ code: "uor_student.observed_weighted_mean", version: 1, status: "derived_method" });
    expect(result.provenance.source).toBe("secretaria_uor");
  });

  it("guarda simulação num namespace hipotético sem modificar inputs oficiais", async () => {
    const { application, repository } = setup();
    const result = await application.createSimulation(student, {
      subjectKey: "algoritmos",
      period: "2025/2026",
      entries: [
        { key: "continuous", label: "Contínua", score: 12, weight: 0.4 },
        { key: "exam", label: "Exame", score: 16, weight: 0.6 },
      ],
    }, "trace-simulation");
    expect(result).toMatchObject({ result: { average: "14.40" }, rule: { status: "hypothesis" } });
    expect(repository.createSimulation).toHaveBeenCalledWith(expect.objectContaining({
      student,
      traceId: "trace-simulation",
      result: { average: "14.40", considered: 2, missing: 0 },
    }));
  });
});
