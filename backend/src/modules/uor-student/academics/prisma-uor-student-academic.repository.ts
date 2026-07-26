import { prisma } from "../../../shared/prisma";
import type { UorStudentAcademicRuleView, UorStudentAcademicSimulationView } from "../domain/models";
import { UorStudentError } from "../domain/errors";
import type { UorStudentAcademicRepository } from "./academic-service";

type Database = typeof prisma;

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

function ruleView(row: {
  id: string;
  code: string;
  version: number;
  name: string;
  kind: string;
  formula: string;
  parametersJson: string;
  status: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  decisionSource: string | null;
}): UorStudentAcademicRuleView {
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    name: row.name,
    kind: row.kind,
    formula: row.formula,
    parameters: parseJson(row.parametersJson, {}),
    status: row.status.toLowerCase() as "draft" | "approved" | "retired",
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
    decisionSource: row.decisionSource,
  };
}

function simulationView(row: {
  id: string;
  subjectKey: string;
  period: string | null;
  ruleCode: string;
  ruleVersion: number;
  ruleStatus: string;
  scenarioJson: string;
  resultJson: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): UorStudentAcademicSimulationView {
  const scenario = parseJson<Array<{ key: string; label: string; score: string | null; weight: string }>>(row.scenarioJson, []);
  const result = parseJson<{ average: string | null; considered: number; missing: number }>(row.resultJson, { average: null, considered: 0, missing: 0 });
  return {
    id: row.id,
    subjectKey: row.subjectKey,
    period: row.period,
    status: row.status === "ARCHIVED" ? "archived" : "active",
    rule: { code: row.ruleCode, version: row.ruleVersion, status: "hypothesis" },
    scenario,
    result,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaUorStudentAcademicRepository implements UorStudentAcademicRepository {
  constructor(private readonly db: Database = prisma) {}

  async listRules(institutionCode: string) {
    const rows = await this.db.uorStudentAcademicRule.findMany({
      where: { institutionCode },
      orderBy: [{ code: "asc" }, { version: "desc" }],
      take: 200,
    });
    return rows.map(ruleView);
  }

  async createSimulation(input: Parameters<UorStudentAcademicRepository["createSimulation"]>[0]) {
    const row = await this.db.$transaction(async (tx) => {
      const simulation = await tx.uorStudentAcademicSimulation.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          subjectKey: input.scenario.subjectKey,
          period: input.scenario.period,
          ruleCode: "uor_student.simulation_weighted_mean",
          ruleVersion: 1,
          ruleStatus: "hypothesis",
          scenarioJson: JSON.stringify(input.normalizedEntries),
          resultJson: JSON.stringify(input.result),
        },
      });
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          domain: "academics",
          action: "simulation.created",
          resourceType: "academic_simulation",
          resourceId: simulation.id,
          purpose: "student_academic_scenario",
          result: "succeeded",
          traceId: input.traceId,
          metadataJson: JSON.stringify({ subjectKey: input.scenario.subjectKey, period: input.scenario.period }),
        },
      });
      return simulation;
    });
    return simulationView(row);
  }

  async updateSimulation(input: Parameters<UorStudentAcademicRepository["updateSimulation"]>[0]) {
    const row = await this.db.$transaction(async (tx) => {
      const owned = await tx.uorStudentAcademicSimulation.findFirst({
        where: { id: input.id, studentId: input.student.id, institutionCode: input.student.institutionCode, status: "ACTIVE" },
      });
      if (!owned) return null;
      const simulation = await tx.uorStudentAcademicSimulation.update({
        where: { id: owned.id },
        data: {
          subjectKey: input.scenario.subjectKey,
          period: input.scenario.period,
          scenarioJson: JSON.stringify(input.normalizedEntries),
          resultJson: JSON.stringify(input.result),
        },
      });
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          domain: "academics",
          action: "simulation.updated",
          resourceType: "academic_simulation",
          resourceId: simulation.id,
          purpose: "student_academic_scenario",
          result: "succeeded",
          traceId: input.traceId,
        },
      });
      return simulation;
    });
    return row ? simulationView(row) : null;
  }

  async listSimulations(input: Parameters<UorStudentAcademicRepository["listSimulations"]>[0]) {
    let before: { updatedAt: Date; id: string } | null = null;
    if (input.cursor) {
      const cursor = await this.db.uorStudentAcademicSimulation.findFirst({
        where: { id: input.cursor, studentId: input.student.id, institutionCode: input.student.institutionCode },
        select: { id: true, updatedAt: true },
      });
      if (!cursor) throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400);
      before = cursor;
    }
    const rows = await this.db.uorStudentAcademicSimulation.findMany({
      where: {
        studentId: input.student.id,
        institutionCode: input.student.institutionCode,
        ...(before ? {
          OR: [
            { updatedAt: { lt: before.updatedAt } },
            { updatedAt: before.updatedAt, id: { lt: before.id } },
          ],
        } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return {
      items: items.map(simulationView),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  }
}
