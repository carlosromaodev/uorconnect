import { prisma } from "../../../shared/prisma";
import { calculateWeightedAverage } from "./academic-engine";
import type { UorStudentIdentity, UorStudentOfficialDataRepository } from "../application/ports";
import type { UorStudentWorkflowApplication } from "../workflows/workflow-service";

type Database = typeof prisma;

function canonical(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function byAliases(record: Record<string, unknown>, aliases: string[]) {
  const keys = new Set(aliases.map(canonical));
  return Object.entries(record).find(([key]) => keys.has(canonical(key)))?.[1];
}

function number(value: unknown) {
  const normalized = typeof value === "string" ? value.replace(/<[^>]+>/g, "").trim().replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function texts(value: unknown) {
  if (Array.isArray(value)) return value.flatMap((item) => text(item) ? [text(item)!] : []);
  const normalized = text(value);
  return normalized ? normalized.split(/[,;|]/).map((item) => item.trim()).filter(Boolean) : [];
}

function curriculumStatus(value: unknown) {
  const status = canonical(text(value) ?? "");
  if (["approved", "aprovado", "completed", "concluido", "concluida"].some((item) => status.includes(canonical(item)))) return "completed" as const;
  if (["enrolled", "inscrito", "current", "frequentar", "frequencia"].some((item) => status.includes(canonical(item)))) return "current" as const;
  if (["failed", "reprovado"].some((item) => status.includes(canonical(item)))) return "failed" as const;
  if (["blocked", "bloqueado"].some((item) => status.includes(canonical(item)))) return "blocked" as const;
  return "pending" as const;
}

function snapshotItems(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as { items?: unknown };
    return Array.isArray(parsed.items) ? parsed.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  } catch { return []; }
}

function startOfIsoWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export class LiveUorStudentAcademicInsights {
  constructor(
    private readonly officialData: UorStudentOfficialDataRepository,
    private readonly workflows: UorStudentWorkflowApplication,
    private readonly db: Database = prisma,
  ) {}

  async evolution(student: UorStudentIdentity) {
    const connection = await this.db.secretariaConnection.findFirst({ where: { studentId: student.id, student: { institutionCode: student.institutionCode, studentNumber: student.studentNumber } }, select: { activeSnapshotVersion: true } });
    if (!connection) return { series: [], method: "official_snapshot_weighted_average_v1", coverage: "not_synced" as const };
    const snapshots = await this.db.secretariaSnapshot.findMany({ where: { studentId: student.id, domain: "academic.grades" }, orderBy: { snapshotVersion: "asc" }, take: 100 });
    const series = snapshots.flatMap((snapshot) => {
      const scores = snapshotItems(snapshot.payloadJson).flatMap((item, index) => {
        const score = number(byAliases(item, ["finalGrade", "notaFinal", "classificacaoFinal", "grade", "nota", "classificacao", "score", "resultado", "valorNota"]));
        if (score === null || score < 0 || score > 20) return [];
        const weight = number(byAliases(item, ["weight", "peso", "ponderacao", "percentagem"])) ?? 1;
        return [{ key: String(index), label: text(byAliases(item, ["subjectName", "subject", "disciplina"])) ?? String(index), score, weight: weight > 1 ? weight / 100 : weight, official: true }];
      });
      if (!scores.length) return [];
      const average = calculateWeightedAverage(scores);
      return [{ snapshotVersion: snapshot.snapshotVersion, average: average.value, considered: average.considered, missing: average.missing, observedAt: snapshot.observedAt.toISOString(), source: "secretaria_uor" as const, stale: snapshot.snapshotVersion !== connection.activeSnapshotVersion }];
    });
    return { series, method: "official_snapshot_weighted_average_v1", coverage: series.length ? "exact" as const : "not_synced" as const };
  }

  async completionEstimate(student: UorStudentIdentity) {
    const [history, credits] = await Promise.all([
      this.officialData.getDataset({ student, domain: "academic.history", limit: 100 }),
      this.officialData.getDataset({ student, domain: "academic.credits", limit: 100 }),
    ]);
    const all = [...history.items.map((item) => item.attributes), ...credits.items.map((item) => item.attributes)];
    let totalCredits = all.map((item) => number(byAliases(item, ["totalCredits", "creditTotal", "creditosTotais"]))).find((value) => value !== null) ?? null;
    let completedCredits = all.map((item) => number(byAliases(item, ["completedCredits", "creditsCompleted", "creditosConcluidos"]))).find((value) => value !== null) ?? null;
    const completed = history.items.filter(({ attributes }) => {
      const status = canonical(text(byAliases(attributes, ["status", "state", "estado", "result"])) ?? "");
      return ["completed", "approved", "aprovado", "concluida", "concluido"].some((value) => status.includes(canonical(value)));
    });
    if (completedCredits === null) completedCredits = completed.reduce((sum, { attributes }) => sum + (number(byAliases(attributes, ["credits", "creditos", "ects"])) ?? 0), 0) || null;
    if (totalCredits === null) {
      const values = history.items.map(({ attributes }) => number(byAliases(attributes, ["credits", "creditos", "ects"]))).filter((value): value is number => value !== null);
      totalCredits = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    }
    const periods = new Set(completed.map(({ attributes }) => text(byAliases(attributes, ["period", "periodo", "academicPeriod", "anoLectivo"]))).filter(Boolean));
    if (totalCredits === null || completedCredits === null || totalCredits <= 0 || completedCredits > totalCredits || periods.size === 0) {
      return { status: "insufficient_information" as const, estimatedRemainingPeriods: null, estimatedCompletion: null, completedCredits, totalCredits, method: "credit_velocity_v1", assumptions: ["Requer créditos totais, créditos concluídos e pelo menos um período oficial."], uncertainty: "high" as const, provenance: history.provenance };
    }
    const velocity = completedCredits / periods.size;
    const remaining = Math.max(0, totalCredits - completedCredits);
    const estimatedRemainingPeriods = velocity > 0 ? Math.ceil(remaining / velocity) : null;
    return { status: estimatedRemainingPeriods === null ? "insufficient_information" as const : "estimated" as const, estimatedRemainingPeriods, estimatedCompletion: estimatedRemainingPeriods === null ? null : `após_${estimatedRemainingPeriods}_periodos`, completedCredits, totalCredits, method: "credit_velocity_v1", assumptions: ["Mantém o ritmo médio histórico de créditos concluídos.", "Não antecipa reprovações, pausas ou alterações curriculares."], uncertainty: periods.size < 3 ? "high" as const : "medium" as const, provenance: history.provenance };
  }

  async curriculumMap(student: UorStudentIdentity) {
    const [history, enrollments, progression, credits] = await Promise.all([
      this.officialData.getDataset({ student, domain: "academic.history", limit: 100 }),
      this.officialData.getDataset({ student, domain: "academic.enrollments", limit: 100 }),
      this.officialData.getDataset({ student, domain: "academic.progression", limit: 100 }),
      this.officialData.getDataset({ student, domain: "academic.credits", limit: 100 }),
    ]);
    const statusPriority = { pending: 0, blocked: 1, failed: 2, current: 3, completed: 4 } as const;
    const subjects = new Map<string, {
      subjectKey: string;
      subjectCode: string | null;
      subjectName: string;
      status: "completed" | "current" | "pending" | "failed" | "blocked";
      officialStatus: string | null;
      credits: number | null;
      period: string | null;
      prerequisites: string[];
      source: "secretaria_uor";
    }>();
    for (const dataset of [history, enrollments, progression]) {
      for (const { id, attributes } of dataset.items) {
        const subjectCode = text(byAliases(attributes, ["subjectCode", "codigoDisciplina", "codDiscip", "code", "codigo"]));
        const subjectName = text(byAliases(attributes, ["subjectName", "subject", "disciplina", "nomeDisciplina", "unidadeCurricular", "name", "nome"])) ?? subjectCode;
        if (!subjectName) continue;
        const subjectKey = canonical(subjectCode ?? subjectName) || id;
        const officialStatus = text(byAliases(attributes, ["status", "state", "estado", "result", "resultado"]));
        const prerequisites = texts(byAliases(attributes, ["prerequisites", "precedencias", "preRequisitos", "dependencies", "dependencias"]));
        const blocked = Boolean(byAliases(attributes, ["blocked", "bloqueada", "isBlocked"])) || canonical(officialStatus ?? "").includes("bloque");
        const status = blocked ? "blocked" as const : curriculumStatus(officialStatus);
        const existing = subjects.get(subjectKey);
        const next = {
          subjectKey,
          subjectCode,
          subjectName,
          status,
          officialStatus,
          credits: number(byAliases(attributes, ["credits", "creditos", "ects"])),
          period: text(byAliases(attributes, ["period", "periodo", "academicPeriod", "anoLectivo"])),
          prerequisites,
          source: "secretaria_uor" as const,
        };
        if (!existing) {
          subjects.set(subjectKey, next);
          continue;
        }
        subjects.set(subjectKey, {
          ...existing,
          ...(statusPriority[next.status] >= statusPriority[existing.status] ? next : {}),
          subjectCode: existing.subjectCode ?? next.subjectCode,
          credits: existing.credits ?? next.credits,
          period: next.period ?? existing.period,
          prerequisites: [...new Set([...existing.prerequisites, ...next.prerequisites])],
        });
      }
    }
    const creditAttributes = credits.items.map((item) => item.attributes);
    const totalCredits = creditAttributes.map((item) => number(byAliases(item, ["totalCredits", "creditTotal", "creditosTotais"]))).find((value) => value !== null) ?? null;
    const completedCredits = creditAttributes.map((item) => number(byAliases(item, ["completedCredits", "creditsCompleted", "creditosConcluidos"]))).find((value) => value !== null) ?? null;
    const percentage = totalCredits !== null && completedCredits !== null && totalCredits > 0 && completedCredits <= totalCredits
      ? Number(((completedCredits / totalCredits) * 100).toFixed(2))
      : null;
    return {
      items: [...subjects.values()].sort((left, right) => left.subjectName.localeCompare(right.subjectName, "pt")),
      completion: {
        completedCredits,
        totalCredits,
        percentage,
        status: percentage === null ? "not_available" as const : "official" as const,
      },
      provenance: {
        history: history.provenance,
        enrollments: enrollments.provenance,
        progression: progression.provenance,
        credits: credits.provenance,
      },
    };
  }

  async overload(student: UorStudentIdentity) {
    const [classes, exams, personal] = await Promise.all([
      this.officialData.getDataset({ student, domain: "academic.classes", limit: 100 }),
      this.officialData.getDataset({ student, domain: "academic.exams", limit: 100 }),
      this.workflows.list({ student, category: "personal_event", access: "owner", statuses: ["scheduled"], limit: 100 }),
    ]);
    const official = [...classes.items, ...exams.items].flatMap(({ id, attributes }) => {
      const start = text(byAliases(attributes, ["startsAt", "startAt", "date", "data", "examDate", "inicio"]));
      const end = text(byAliases(attributes, ["endsAt", "endAt", "fim"]));
      const startsAt = start ? new Date(start) : null;
      const endsAt = end ? new Date(end) : null;
      return startsAt && Number.isFinite(startsAt.getTime()) ? [{ id, startsAt, endsAt: endsAt && Number.isFinite(endsAt.getTime()) ? endsAt : new Date(startsAt.getTime() + 2 * 60 * 60_000), source: "secretaria_uor" as const }] : [];
    });
    const local = personal.items.flatMap((item) => {
      const startsAt = typeof item.payload.startsAt === "string" ? new Date(item.payload.startsAt) : null;
      const endsAt = typeof item.payload.endsAt === "string" ? new Date(item.payload.endsAt) : null;
      return startsAt && endsAt && Number.isFinite(startsAt.getTime()) && Number.isFinite(endsAt.getTime()) ? [{ id: item.id, startsAt, endsAt, source: "uor_student" as const }] : [];
    });
    const weeks = new Map<string, { count: number; hours: number; sources: Set<string> }>();
    for (const item of [...official, ...local]) {
      const key = startOfIsoWeek(item.startsAt);
      const bucket = weeks.get(key) ?? { count: 0, hours: 0, sources: new Set<string>() };
      bucket.count += 1;
      bucket.hours += Math.max(0, (item.endsAt.getTime() - item.startsAt.getTime()) / 3_600_000);
      bucket.sources.add(item.source);
      weeks.set(key, bucket);
    }
    return {
      status: "advisory" as const,
      method: "weekly_event_density_v1",
      threshold: { events: 5, hours: 20 },
      periods: [...weeks.entries()].filter(([, value]) => value.count >= 5 || value.hours >= 20).map(([weekStartsAt, value]) => ({ weekStartsAt, eventCount: value.count, estimatedHours: Number(value.hours.toFixed(2)), sources: [...value.sources] })),
      recommendation: "Revê prioridades e intervalos de descanso; esta indicação não é uma decisão académica oficial.",
    };
  }

  async agenda(student: UorStudentIdentity) {
    const [classes, exams, personal] = await Promise.all([
      this.officialData.getDataset({ student, domain: "academic.classes", limit: 100 }),
      this.officialData.getDataset({ student, domain: "academic.exams", limit: 100 }),
      this.workflows.list({ student, category: "personal_event", access: "owner", statuses: ["scheduled"], limit: 100 }),
    ]);
    const official = (kind: "class" | "exam", dataset: typeof classes) => dataset.items.map(({ id, attributes }) => ({
      id,
      kind,
      title: text(byAliases(attributes, ["title", "subjectName", "subject", "disciplina", "description", "descricao"])) ?? (kind === "class" ? "Aula" : "Exame"),
      startsAt: text(byAliases(attributes, ["startsAt", "startAt", "date", "data", "examDate", "inicio"])),
      endsAt: text(byAliases(attributes, ["endsAt", "endAt", "fim"])),
      location: text(byAliases(attributes, ["room", "sala", "location", "local"])),
      source: "secretaria_uor" as const,
      provenance: dataset.provenance,
    }));
    const local = personal.items.map((item) => ({
      id: item.id,
      kind: "personal" as const,
      title: text(item.payload.title) ?? "Evento pessoal",
      startsAt: text(item.payload.startsAt),
      endsAt: text(item.payload.endsAt),
      location: null,
      source: "uor_student" as const,
      provenance: { source: "uor_student" as const, observedAt: item.updatedAt, coverage: "exact" as const, stale: false },
    }));
    const items = [...official("class", classes), ...official("exam", exams), ...local]
      .sort((left, right) => String(left.startsAt ?? "").localeCompare(String(right.startsAt ?? "")));
    return { items, coverage: { classes: classes.provenance, exams: exams.provenance, personal: { source: "uor_student" as const, observedAt: null, coverage: "exact" as const, stale: false } } };
  }

  async conflicts(student: UorStudentIdentity) {
    const agenda = await this.agenda(student);
    const intervals = agenda.items.flatMap((item) => {
      const startsAt = item.startsAt ? new Date(item.startsAt) : null;
      const explicitEnd = item.endsAt ? new Date(item.endsAt) : null;
      if (!startsAt || !Number.isFinite(startsAt.getTime())) return [];
      const endsAt = explicitEnd && Number.isFinite(explicitEnd.getTime()) ? explicitEnd : new Date(startsAt.getTime() + 2 * 60 * 60_000);
      return endsAt > startsAt ? [{ ...item, startsAt, endsAt }] : [];
    });
    const conflicts: Array<{ leftId: string; rightId: string; leftSource: string; rightSource: string; startsAt: string; endsAt: string }> = [];
    intervals.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    for (let left = 0; left < intervals.length; left += 1) {
      for (let right = left + 1; right < intervals.length; right += 1) {
        const first = intervals[left]!;
        const second = intervals[right]!;
        if (second.startsAt >= first.endsAt) break;
        conflicts.push({ leftId: first.id, rightId: second.id, leftSource: first.source, rightSource: second.source, startsAt: new Date(Math.max(first.startsAt.getTime(), second.startsAt.getTime())).toISOString(), endsAt: new Date(Math.min(first.endsAt.getTime(), second.endsAt.getTime())).toISOString() });
      }
    }
    return { status: "advisory" as const, method: "unified_interval_overlap_v1", conflicts };
  }
}
