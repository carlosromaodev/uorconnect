import type { UorStudentIdentity, UorStudentOfficialDataRepository } from "../application/ports";
import type {
  UorStudentAcademicAveragesView,
  UorStudentAcademicRuleView,
  UorStudentAcademicSimulationView,
  UorStudentDataBlock,
} from "../domain/models";
import { UorStudentError } from "../domain/errors";
import {
  calculateRequiredGrade,
  calculateWeightedAverage,
  DERIVED_AVERAGE_RULE,
  SCHOLARSHIP_HYPOTHESIS_RULE,
  type AcademicScoreInput,
  type RequiredGradeInput,
} from "./academic-engine";

export type AcademicSimulationInput = {
  subjectKey: string;
  period: string | null;
  entries: Array<{ key: string; label: string; score: string | number | null; weight: string | number }>;
};

export interface UorStudentAcademicRepository {
  listRules(institutionCode: string): Promise<UorStudentAcademicRuleView[]>;
  createSimulation(input: {
    student: UorStudentIdentity;
    scenario: AcademicSimulationInput;
    normalizedEntries: Array<{ key: string; label: string; score: string | null; weight: string }>;
    result: { average: string | null; considered: number; missing: number };
    traceId?: string;
  }): Promise<UorStudentAcademicSimulationView>;
  updateSimulation(input: {
    student: UorStudentIdentity;
    id: string;
    scenario: AcademicSimulationInput;
    normalizedEntries: Array<{ key: string; label: string; score: string | null; weight: string }>;
    result: { average: string | null; considered: number; missing: number };
    traceId?: string;
  }): Promise<UorStudentAcademicSimulationView | null>;
  listSimulations(input: { student: UorStudentIdentity; limit: number; cursor?: string }): Promise<{
    items: UorStudentAcademicSimulationView[];
    nextCursor: string | null;
  }>;
}

export interface UorStudentAcademicApplication {
  getAverages(student: UorStudentIdentity): Promise<UorStudentAcademicAveragesView>;
  listRules(student: UorStudentIdentity): Promise<UorStudentAcademicRuleView[]>;
  createSimulation(student: UorStudentIdentity, input: AcademicSimulationInput, traceId?: string): Promise<UorStudentAcademicSimulationView>;
  updateSimulation(student: UorStudentIdentity, id: string, input: AcademicSimulationInput, traceId?: string): Promise<UorStudentAcademicSimulationView>;
  listSimulations(student: UorStudentIdentity, page: { limit: number; cursor?: string }): ReturnType<UorStudentAcademicRepository["listSimulations"]>;
  requiredGrade(input: RequiredGradeInput): ReturnType<typeof calculateRequiredGrade>;
  scholarshipScenario(input: Omit<RequiredGradeInput, "target">): ReturnType<typeof calculateRequiredGrade> & { hypothesis: typeof SCHOLARSHIP_HYPOTHESIS_RULE };
}

function canonical(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function valueByAliases(record: Record<string, unknown>, aliases: string[]) {
  const expected = new Set(aliases.map(canonical));
  return Object.entries(record).find(([key]) => expected.has(canonical(key)))?.[1];
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const normalized = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function score(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  const normalized = text(value)?.replace(/\s/g, "").replace(",", ".") ?? null;
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? String(numeric) : null;
}

function gradeScore(value: unknown) {
  const parsed = score(value);
  if (parsed === null) return null;
  const numeric = Number(parsed);
  return numeric >= 0 && numeric <= 20 ? parsed : null;
}

function normalizeOfficialGrade(item: { id: string; attributes: Record<string, unknown> }, index: number) {
  const subjectName = text(valueByAliases(item.attributes, [
    "subjectName", "subject", "disciplina", "descDiscip", "descDisciplina", "nomeDisciplina", "unidadeCurricular",
  ])) ?? `Unidade curricular ${index + 1}`;
  const subjectCode = text(valueByAliases(item.attributes, ["subjectCode", "codigoDisciplina", "codDiscip", "cdDisciplina"]));
  const period = text(valueByAliases(item.attributes, ["period", "periodo", "academicPeriod", "anoLectivo", "cdLectivo"]));
  const label = text(valueByAliases(item.attributes, ["assessment", "avaliacao", "tipoAvaliacao", "descricaoAvaliacao", "epoca"])) ?? "Classificação observada";
  const rawScore = valueByAliases(item.attributes, [
    "finalGrade", "notaFinal", "classificacaoFinal", "grade", "nota", "classificacao", "score", "resultado", "valorNota",
  ]);
  const rawWeight = valueByAliases(item.attributes, ["weight", "peso", "ponderacao", "percentagem"]);
  let normalizedWeight = score(rawWeight) ?? "1";
  if (rawWeight && typeof rawWeight === "string" && rawWeight.includes("%")) {
    const percent = score(rawWeight.replace("%", ""));
    normalizedWeight = percent ? String(Number(percent) / 100) : "1";
  }
  return {
    id: item.id,
    subjectKey: canonical(subjectCode ?? subjectName),
    subjectName,
    period,
    label,
    score: gradeScore(rawScore),
    weight: normalizedWeight,
  };
}

export class LiveUorStudentAcademicApplication implements UorStudentAcademicApplication {
  constructor(
    private readonly officialData: UorStudentOfficialDataRepository,
    private readonly repository: UorStudentAcademicRepository,
  ) {}

  async getAverages(student: UorStudentIdentity): Promise<UorStudentAcademicAveragesView> {
    const items: Array<{ id: string; attributes: Record<string, unknown> }> = [];
    let cursor: string | undefined;
    let provenance: UorStudentDataBlock = { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false };
    for (let page = 0; page < 20; page += 1) {
      const result = await this.officialData.getDataset({ student, domain: "academic.grades", limit: 100, cursor });
      items.push(...result.items);
      provenance = result.provenance;
      if (!result.pagination.hasMore || !result.pagination.nextCursor) break;
      cursor = result.pagination.nextCursor;
      if (page === 19) provenance = { ...provenance, coverage: "partial" };
    }
    const grades = items.map(normalizeOfficialGrade);
    const grouped = new Map<string, typeof grades>();
    for (const grade of grades) grouped.set(grade.subjectKey, [...(grouped.get(grade.subjectKey) ?? []), grade]);
    const subjects = [...grouped.values()].map((entries) => {
      const calculated = calculateWeightedAverage(entries.map((entry) => ({
        key: entry.id,
        label: entry.label,
        score: entry.score,
        weight: entry.weight,
        official: true,
      })));
      return {
        subjectKey: entries[0]!.subjectKey,
        subjectName: entries[0]!.subjectName,
        period: entries[0]!.period,
        average: calculated.value,
        considered: calculated.considered,
        missing: calculated.missing,
      };
    });
    const overall = calculateWeightedAverage(subjects.map((subject) => ({
      key: subject.subjectKey,
      label: subject.subjectName,
      score: subject.average,
      weight: 1,
      official: false,
    })));
    return {
      subjects,
      overall: {
        average: overall.value,
        consideredSubjects: overall.considered,
        missingSubjects: overall.missing,
      },
      rule: {
        code: DERIVED_AVERAGE_RULE.code,
        version: DERIVED_AVERAGE_RULE.version,
        status: DERIVED_AVERAGE_RULE.status,
        formula: DERIVED_AVERAGE_RULE.formula,
      },
      inputs: grades.map((grade) => ({
        id: grade.id,
        subjectKey: grade.subjectKey,
        label: grade.label,
        score: grade.score,
        weight: grade.weight,
        official: true,
      })),
      provenance,
    };
  }

  listRules(student: UorStudentIdentity) {
    return this.repository.listRules(student.institutionCode);
  }

  async createSimulation(student: UorStudentIdentity, input: AcademicSimulationInput, traceId?: string) {
    const calculated = this.#calculateScenario(input);
    return this.repository.createSimulation({ student, scenario: input, ...calculated, traceId });
  }

  async updateSimulation(student: UorStudentIdentity, id: string, input: AcademicSimulationInput, traceId?: string) {
    const calculated = this.#calculateScenario(input);
    const updated = await this.repository.updateSimulation({ student, id, scenario: input, ...calculated, traceId });
    if (!updated) throw new UorStudentError("UOR_STUDENT_SIMULATION_NOT_FOUND", "A simulação não foi encontrada.", 404);
    return updated;
  }

  listSimulations(student: UorStudentIdentity, page: { limit: number; cursor?: string }) {
    return this.repository.listSimulations({ student, ...page });
  }

  requiredGrade(input: RequiredGradeInput) {
    try { return calculateRequiredGrade(input); }
    catch { throw new UorStudentError("UOR_STUDENT_ACADEMIC_INPUT_INVALID", "Os valores do cálculo académico são inválidos.", 422); }
  }

  scholarshipScenario(input: Omit<RequiredGradeInput, "target">) {
    try {
      return { ...calculateRequiredGrade({ ...input, target: SCHOLARSHIP_HYPOTHESIS_RULE.target }), hypothesis: SCHOLARSHIP_HYPOTHESIS_RULE };
    } catch {
      throw new UorStudentError("UOR_STUDENT_ACADEMIC_INPUT_INVALID", "Os valores do cenário académico são inválidos.", 422);
    }
  }

  #calculateScenario(input: AcademicSimulationInput) {
    const entries: AcademicScoreInput[] = input.entries.map((entry) => ({ ...entry, official: false }));
    let calculated;
    try { calculated = calculateWeightedAverage(entries); }
    catch { throw new UorStudentError("UOR_STUDENT_ACADEMIC_INPUT_INVALID", "As notas ou ponderações da simulação são inválidas.", 422); }
    return {
      normalizedEntries: calculated.inputs.map((entry) => ({ key: entry.key, label: entry.label, score: entry.score, weight: entry.weight })),
      result: { average: calculated.value, considered: calculated.considered, missing: calculated.missing },
    };
  }
}
