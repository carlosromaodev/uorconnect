import { prisma } from "../../../shared/prisma";
import type { UorStudentAcademicApplication } from "../academics/academic-service";
import type { UorStudentIdentity } from "../application/ports";
import { UorStudentError } from "../domain/errors";

type Database = typeof prisma;
export const UOR_STUDENT_RANKING_POLICY_VERSION = "uor-student-ranking-2026-07-22";

export type RankingContext = { course: string; classCode: string; period: string; subjectKey?: string };

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-AO");
}

function contextKey(context: RankingContext) {
  return [context.course, context.classCode, context.period, context.subjectKey ?? "overall"].map(normalize).join("|");
}

export class LiveUorStudentRankingApplication {
  constructor(
    private readonly academics: UorStudentAcademicApplication,
    private readonly db: Database = prisma,
    private readonly minimumSample = 5,
  ) {}

  async setParticipation(input: { student: UorStudentIdentity; context: RankingContext; enabled: boolean; traceId?: string }) {
    const profile = await this.db.student.findFirst({
      where: { id: input.student.id, institutionCode: input.student.institutionCode, studentNumber: input.student.studentNumber, deletedAt: null },
      select: { course: true, classCode: true, academicPeriod: true },
    });
    if (!profile || normalize(profile.course ?? "") !== normalize(input.context.course) || normalize(profile.classCode ?? "") !== normalize(input.context.classCode) || normalize(profile.academicPeriod ?? "") !== normalize(input.context.period)) {
      throw new UorStudentError("UOR_STUDENT_RANKING_CONTEXT_INVALID", "O contexto do ranking não corresponde ao perfil oficial.", 403);
    }
    const now = new Date();
    const key = contextKey(input.context);
    const row = await this.db.$transaction(async (tx) => {
      const participation = await tx.uorStudentRankingParticipation.upsert({
        where: { studentId_contextKey: { studentId: input.student.id, contextKey: key } },
        create: { studentId: input.student.id, institutionCode: input.student.institutionCode, contextKey: key, enabled: input.enabled, policyVersion: UOR_STUDENT_RANKING_POLICY_VERSION, consentedAt: input.enabled ? now : null, withdrawnAt: input.enabled ? null : now },
        update: { enabled: input.enabled, policyVersion: UOR_STUDENT_RANKING_POLICY_VERSION, ...(input.enabled ? { consentedAt: now, withdrawnAt: null } : { withdrawnAt: now }) },
      });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "ranking", action: input.enabled ? "ranking.joined" : "ranking.withdrawn", resourceType: "ranking_context", resourceId: participation.id, purpose: "ranking_participation", result: "succeeded", traceId: input.traceId } });
      return participation;
    });
    return { context: input.context, enabled: row.enabled, policyVersion: row.policyVersion, consentedAt: row.consentedAt?.toISOString() ?? null, withdrawnAt: row.withdrawnAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() };
  }

  async getPrivatePosition(input: { student: UorStudentIdentity; context: RankingContext }) {
    const key = contextKey(input.context);
    const ownParticipation = await this.db.uorStudentRankingParticipation.findUnique({ where: { studentId_contextKey: { studentId: input.student.id, contextKey: key } } });
    if (!ownParticipation?.enabled) throw new UorStudentError("UOR_STUDENT_RANKING_NOT_PARTICIPATING", "Ativa a participação neste contexto para consultar a posição privada.", 403);
    const participants = await this.db.uorStudentRankingParticipation.findMany({
      where: { institutionCode: input.student.institutionCode, contextKey: key, enabled: true },
      select: { student: { select: { id: true, institutionCode: true, studentNumber: true, course: true, classCode: true, academicPeriod: true } } },
      take: 10_000,
    });
    const validParticipants = participants.filter(({ student }) => normalize(student.course ?? "") === normalize(input.context.course) && normalize(student.classCode ?? "") === normalize(input.context.classCode) && normalize(student.academicPeriod ?? "") === normalize(input.context.period));
    const scored: Array<{ studentId: number; score: number; observedAt: string | null; stale: boolean }> = [];
    for (const { student } of validParticipants) {
      const result = await this.academics.getAverages(student);
      const value = input.context.subjectKey
        ? result.subjects.find((subject) => normalize(subject.subjectKey) === normalize(input.context.subjectKey!))?.average ?? null
        : result.overall.average;
      const numeric = value === null ? Number.NaN : Number(value);
      if (Number.isFinite(numeric)) scored.push({ studentId: student.id, score: numeric, observedAt: result.provenance.observedAt, stale: result.provenance.stale });
    }
    const sampleSize = scored.length;
    const coverage = validParticipants.length ? Number((sampleSize / validParticipants.length).toFixed(4)) : 0;
    if (sampleSize < this.minimumSample) {
      return { status: "insufficient_sample" as const, position: null, percentile: null, sampleSize, minimumSample: this.minimumSample, coverage, context: input.context, method: "official_weighted_average_desc_v1", updatedAt: null, stale: scored.some((item) => item.stale) };
    }
    scored.sort((left, right) => right.score - left.score || left.studentId - right.studentId);
    const own = scored.find((item) => item.studentId === input.student.id);
    if (!own) return { status: "not_eligible" as const, position: null, percentile: null, sampleSize, minimumSample: this.minimumSample, coverage, context: input.context, method: "official_weighted_average_desc_v1", updatedAt: null, stale: scored.some((item) => item.stale) };
    const higher = scored.filter((item) => item.score > own.score).length;
    const position = higher + 1;
    const percentile = sampleSize === 1 ? 100 : Number((((sampleSize - position) / (sampleSize - 1)) * 100).toFixed(2));
    return {
      status: "available" as const,
      position,
      percentile,
      sampleSize,
      minimumSample: this.minimumSample,
      coverage,
      context: input.context,
      method: "official_weighted_average_desc_v1",
      updatedAt: scored.map((item) => item.observedAt).filter((value): value is string => Boolean(value)).sort().at(0) ?? null,
      stale: scored.some((item) => item.stale),
    };
  }
}
