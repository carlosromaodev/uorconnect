import { UorStudentError } from "../domain/errors";
import type { UorStudentIdentity, UorStudentOfficialDataRepository, UorStudentPublicIdentityResolver } from "../application/ports";
import type {
  UorStudentWorkflowCategory,
  UorStudentWorkflowRepository,
  UorStudentWorkflowView,
} from "./domain";

const financialFieldPattern = /(^|[._-])(finance|financial|debt|payment|receipt|charge|balance|tuition)([._-]|$)/i;

export type UorStudentWorkflowApplication = {
  create(input: Parameters<UorStudentWorkflowRepository["create"]>[0]): Promise<UorStudentWorkflowView>;
  get(student: UorStudentIdentity, id: string, category?: UorStudentWorkflowCategory): Promise<UorStudentWorkflowView>;
  getOwned(student: UorStudentIdentity, id: string, category: UorStudentWorkflowCategory, statuses?: string[]): Promise<UorStudentWorkflowView>;
  getPublic(student: UorStudentIdentity, id: string, category: UorStudentWorkflowCategory, statuses: string[]): Promise<UorStudentWorkflowView>;
  getDelegatedAcademicData(student: UorStudentIdentity, grantId: string): Promise<{ grantId: string; subjectKey: string; period: string; fields: Record<string, unknown>; expiresAt: string | null }>;
  list(input: Parameters<UorStudentWorkflowRepository["list"]>[0]): ReturnType<UorStudentWorkflowRepository["list"]>;
  transition(input: Parameters<UorStudentWorkflowRepository["transitionOwned"]>[0]): Promise<UorStudentWorkflowView>;
  addActor(input: Parameters<UorStudentWorkflowRepository["addActor"]>[0]): Promise<UorStudentWorkflowView>;
  decideActor(input: Parameters<UorStudentWorkflowRepository["decideActor"]>[0]): Promise<UorStudentWorkflowView>;
  reactPublic(input: Parameters<UorStudentWorkflowRepository["reactPublic"]>[0]): Promise<UorStudentWorkflowView>;
  history(student: UorStudentIdentity, id: string, limit: number): Promise<NonNullable<Awaited<ReturnType<UorStudentWorkflowRepository["listEvents"]>>>>;
  revokeTutoringRelationship(student: UorStudentIdentity, relationshipId: string, traceId?: string): Promise<UorStudentWorkflowView>;
  findPersonalConflicts(student: UorStudentIdentity): Promise<Array<{ leftId: string; rightId: string; startsAt: string; endsAt: string }>>;
  aggregateTeachingEvaluations(student: UorStudentIdentity, scopeKey: string, minimumSample?: number): Promise<{
    status: "available" | "insufficient_sample";
    sampleSize: number;
    minimumSample: number;
    average: string | null;
    dimensions: Record<string, string>;
    scopeKey: string;
  }>;
  createTeachingEvaluation(input: {
    student: UorStudentIdentity;
    teacherKey: string;
    subjectKey: string;
    period: string;
    score: number;
    dimensions: Record<string, number>;
    comment?: string;
    traceId?: string;
  }): Promise<UorStudentWorkflowView>;
  setAlertPreference(input: { student: UorStudentIdentity; event: string; enabled: boolean; channels: string[]; traceId?: string }): Promise<UorStudentWorkflowView>;
};

function notFound(): never {
  throw new UorStudentError("UOR_STUDENT_WORKFLOW_NOT_FOUND", "O recurso não foi encontrado ou não pertence ao perfil.", 404);
}

function dateFromPayload(item: UorStudentWorkflowView, key: "startsAt" | "endsAt") {
  const value = item.payload[key];
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export class LiveUorStudentWorkflowApplication implements UorStudentWorkflowApplication {
  constructor(
    private readonly repository: UorStudentWorkflowRepository,
    private readonly officialData?: UorStudentOfficialDataRepository,
    private readonly identities?: UorStudentPublicIdentityResolver,
  ) {}

  create(input: Parameters<UorStudentWorkflowRepository["create"]>[0]) {
    if (input.category === "community_report" && (!input.expiresAt || input.expiresAt <= new Date())) {
      throw new UorStudentError("UOR_STUDENT_EXPIRY_REQUIRED", "O reporte comunitário precisa de uma validade futura.", 422);
    }
    if (input.category === "tutoring_grant") {
      const fields = Array.isArray(input.payload.fields) ? input.payload.fields : [];
      if (fields.length === 0 || fields.some((field) => typeof field !== "string" || field === "*" || financialFieldPattern.test(field))) {
        throw new UorStudentError("UOR_STUDENT_GRANT_SCOPE_INVALID", "O acesso do explicador deve ser académico, granular e nunca financeiro.", 422);
      }
    }
    if (input.category === "academic_appeal" && input.status !== "draft") {
      throw new UorStudentError("UOR_STUDENT_APPEAL_INVALID", "Um recurso local começa sempre como rascunho.", 422);
    }
    return this.repository.create(input);
  }

  async get(student: UorStudentIdentity, id: string, category?: UorStudentWorkflowCategory) {
    return await this.repository.getAccessible({ student, id, category }) ?? notFound();
  }

  async getOwned(student: UorStudentIdentity, id: string, category: UorStudentWorkflowCategory, statuses?: string[]) {
    return await this.repository.getOwned({ student, id, category, statuses }) ?? notFound();
  }

  async getPublic(student: UorStudentIdentity, id: string, category: UorStudentWorkflowCategory, statuses: string[]) {
    return await this.repository.getPublic({ student, id, category, statuses }) ?? notFound();
  }

  async getDelegatedAcademicData(student: UorStudentIdentity, grantId: string) {
    if (!this.officialData) throw new UorStudentError("UOR_STUDENT_DELEGATION_UNAVAILABLE", "O acesso académico delegado não está disponível.", 503, true);
    const grant = await this.repository.getForActor({ student, id: grantId, category: "tutoring_grant", role: "tutor", actorStatuses: ["active"], aggregateStatuses: ["active"] });
    if (!grant) notFound();
    const fields = Array.isArray(grant.payload.fields) ? grant.payload.fields.filter((field): field is string => typeof field === "string") : [];
    if (!fields.length || fields.some((field) => financialFieldPattern.test(field) || field === "*")) throw new UorStudentError("UOR_STUDENT_GRANT_SCOPE_INVALID", "O acesso delegado contém um escopo inválido.", 403);
    const owner = await this.identities?.findByProfileId({ profileId: grant.ownerProfileId, institutionCode: student.institutionCode });
    if (!owner) notFound();
    const domainByField: Record<string, string> = {
      "academic.grades": "academic.grades",
      "academic.attendance": "academic.attendance",
      "academic.schedule": "academic.classes",
    };
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      const domain = domainByField[field];
      if (!domain) continue;
      const selected: Array<{ id: string; attributes: Record<string, unknown> }> = [];
      let cursor: string | undefined;
      let provenance: Awaited<ReturnType<UorStudentOfficialDataRepository["getDataset"]>>["provenance"] | null = null;
      for (let page = 0; page < 20; page += 1) {
        const dataset = await this.officialData.getDataset({ student: owner, domain, limit: 100, cursor });
        provenance = dataset.provenance;
        selected.push(...dataset.items.filter((item) => scopedAcademicItem(item.attributes, String(grant.payload.subjectKey ?? ""), String(grant.payload.period ?? ""))));
        if (!dataset.pagination.nextCursor) break;
        cursor = dataset.pagination.nextCursor;
      }
      result[field] = { items: selected, provenance, scope: { subjectKey: grant.payload.subjectKey, period: grant.payload.period } };
    }
    if (fields.some((field) => field.startsWith("study_plan."))) {
      const plans = await this.repository.list({ student, category: "study_plan", access: "actor", statuses: ["active"], limit: 100 });
      const scoped = plans.items.filter((item) => item.scopeKey === grant.scopeKey);
      if (fields.includes("study_plan.tasks")) result["study_plan.tasks"] = scoped.flatMap((item) => Array.isArray(item.payload.tasks) ? item.payload.tasks : []);
      if (fields.includes("study_plan.sessions")) result["study_plan.sessions"] = scoped.flatMap((item) => Array.isArray(item.payload.sessions) ? item.payload.sessions : []);
    }
    return { grantId: grant.id, subjectKey: String(grant.payload.subjectKey ?? ""), period: String(grant.payload.period ?? ""), fields: result, expiresAt: grant.expiresAt };
  }

  list(input: Parameters<UorStudentWorkflowRepository["list"]>[0]) {
    return this.repository.list(input);
  }

  async transition(input: Parameters<UorStudentWorkflowRepository["transitionOwned"]>[0]) {
    return await this.repository.transitionOwned(input) ?? notFound();
  }

  async addActor(input: Parameters<UorStudentWorkflowRepository["addActor"]>[0]) {
    return await this.repository.addActor(input) ?? notFound();
  }

  async decideActor(input: Parameters<UorStudentWorkflowRepository["decideActor"]>[0]) {
    return await this.repository.decideActor(input) ?? notFound();
  }

  async reactPublic(input: Parameters<UorStudentWorkflowRepository["reactPublic"]>[0]) {
    return await this.repository.reactPublic(input) ?? notFound();
  }

  async history(student: UorStudentIdentity, id: string, limit: number) {
    return await this.repository.listEvents({ student, aggregateId: id, limit }) ?? notFound();
  }

  async revokeTutoringRelationship(student: UorStudentIdentity, relationshipId: string, traceId?: string) {
    return await this.repository.revokeTutoringRelationship({ student, relationshipId, traceId }) ?? notFound();
  }

  async findPersonalConflicts(student: UorStudentIdentity) {
    const { items } = await this.repository.list({ student, category: "personal_event", access: "owner", statuses: ["scheduled"], limit: 100 });
    const intervals = items.flatMap((item) => {
      const startsAt = dateFromPayload(item, "startsAt");
      const endsAt = dateFromPayload(item, "endsAt");
      return startsAt && endsAt && startsAt < endsAt ? [{ item, startsAt, endsAt }] : [];
    }).sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    const conflicts: Array<{ leftId: string; rightId: string; startsAt: string; endsAt: string }> = [];
    for (let left = 0; left < intervals.length; left += 1) {
      for (let right = left + 1; right < intervals.length; right += 1) {
        const first = intervals[left]!;
        const second = intervals[right]!;
        if (second.startsAt >= first.endsAt) break;
        conflicts.push({
          leftId: first.item.id,
          rightId: second.item.id,
          startsAt: second.startsAt > first.startsAt ? second.startsAt.toISOString() : first.startsAt.toISOString(),
          endsAt: second.endsAt < first.endsAt ? second.endsAt.toISOString() : first.endsAt.toISOString(),
        });
      }
    }
    return conflicts;
  }

  async aggregateTeachingEvaluations(student: UorStudentIdentity, scopeKey: string, minimumSample = 5) {
    const { items } = await this.repository.list({
      student,
      category: "teaching_evaluation",
      access: "public_institution",
      statuses: ["published"],
      limit: 100,
    });
    const eligible = items.filter((item) => item.scopeKey === scopeKey);
    if (eligible.length < minimumSample) {
      return { status: "insufficient_sample" as const, sampleSize: eligible.length, minimumSample, average: null, dimensions: {}, scopeKey };
    }
    const scores = eligible.flatMap((item) => typeof item.payload.score === "number" ? [item.payload.score] : []);
    const dimensionKeys = new Set(eligible.flatMap((item) => {
      const dimensions = item.payload.dimensions;
      return dimensions && typeof dimensions === "object" && !Array.isArray(dimensions) ? Object.keys(dimensions) : [];
    }));
    const dimensions: Record<string, string> = {};
    for (const key of dimensionKeys) {
      const values = eligible.flatMap((item) => {
        const source = item.payload.dimensions;
        const value = source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>)[key] : null;
        return typeof value === "number" ? [value] : [];
      });
      if (values.length) dimensions[key] = (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
    }
    return {
      status: "available" as const,
      sampleSize: eligible.length,
      minimumSample,
      average: scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(2) : null,
      dimensions,
      scopeKey,
    };
  }

  async createTeachingEvaluation(input: Parameters<UorStudentWorkflowApplication["createTeachingEvaluation"]>[0]) {
    const scopeKey = `${input.teacherKey}:${input.subjectKey}:${input.period}`;
    const own = await this.repository.list({
      student: input.student,
      category: "teaching_evaluation",
      access: "owner",
      statuses: ["published"],
      limit: 100,
    });
    if (own.items.some((item) => item.scopeKey === scopeKey)) {
      throw new UorStudentError("UOR_STUDENT_EVALUATION_DUPLICATE", "A experiência pedagógica já foi avaliada neste contexto.", 409);
    }
    if (!this.officialData) {
      throw new UorStudentError("UOR_STUDENT_ELIGIBILITY_UNAVAILABLE", "Não foi possível confirmar a associação académica.", 503, true);
    }
    const enrollments = await this.officialData.getDataset({
      student: input.student,
      domain: "academic.enrollments",
      limit: 100,
    });
    const eligible = enrollments.items.some(({ attributes }) => scopedAcademicItem(attributes, input.subjectKey, input.period));
    if (!eligible) {
      throw new UorStudentError("UOR_STUDENT_EVALUATION_NOT_ELIGIBLE", "A avaliação exige associação oficial à cadeira e ao período.", 403);
    }
    return this.repository.create({
      owner: input.student,
      category: "teaching_evaluation",
      scopeKey,
      status: "published",
      payload: {
        teacherKey: input.teacherKey,
        subjectKey: input.subjectKey,
        period: input.period,
        score: input.score,
        dimensions: input.dimensions,
        ...(input.comment ? { comment: input.comment } : {}),
      },
      traceId: input.traceId,
    });
  }

  async setAlertPreference(input: Parameters<UorStudentWorkflowApplication["setAlertPreference"]>[0]) {
    const current = await this.repository.list({ student: input.student, category: "alert_preference", access: "owner", limit: 100 });
    const latest = current.items.find((item) => item.scopeKey === input.event);
    const payload = { event: input.event, enabled: input.enabled, channels: [...new Set(input.channels)] };
    if (latest) {
      return await this.repository.transitionOwned({
        student: input.student,
        id: latest.id,
        category: "alert_preference",
        from: [latest.status],
        to: input.enabled ? "enabled" : "disabled",
        payload,
        traceId: input.traceId,
      }) ?? notFound();
    }
    return this.repository.create({ owner: input.student, category: "alert_preference", scopeKey: input.event, status: input.enabled ? "enabled" : "disabled", payload, traceId: input.traceId });
  }
}

function scopedAcademicItem(attributes: Record<string, unknown>, subjectKey: string, period: string) {
  const normalize = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const value = (aliases: string[]) => Object.entries(attributes).find(([key]) => aliases.map(normalize).includes(normalize(key)))?.[1];
  const subject = value(["subjectKey", "subjectCode", "unitCode", "code", "disciplineCode", "disciplina", "subject"]);
  const academicPeriod = value(["period", "academicPeriod", "year", "academicYear", "periodo", "anoLectivo"]);
  return normalize(subject) === normalize(subjectKey) && normalize(academicPeriod) === normalize(period);
}
