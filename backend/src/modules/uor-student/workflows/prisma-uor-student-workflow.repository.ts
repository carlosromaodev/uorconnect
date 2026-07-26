import { prisma } from "../../../shared/prisma";
import { UorStudentError } from "../domain/errors";
import type {
  UorStudentWorkflowCategory,
  UorStudentWorkflowRepository,
  UorStudentWorkflowView,
} from "./domain";
import { uorStudentWorkflowCategories } from "./domain";

type Database = typeof prisma;
type WorkflowRow = Awaited<ReturnType<Database["uorStudentAggregate"]["findFirst"]>>;

const categorySet = new Set<string>(uorStudentWorkflowCategories);

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

type WorkflowWithRelations = NonNullable<WorkflowRow> & {
  owner: { uorStudentPublicId: string | null };
  actors: Array<{
    role: string;
    status: string;
    payloadJson: string | null;
    decidedAt: Date | null;
    student: { uorStudentPublicId: string | null };
  }>;
};

function workflowView(row: WorkflowWithRelations): UorStudentWorkflowView {
  if (!categorySet.has(row.category) || !row.owner.uorStudentPublicId) throw new Error("UOR_STUDENT_WORKFLOW_INVALID");
  return {
    id: row.id,
    category: row.category as UorStudentWorkflowCategory,
    ownerProfileId: row.owner.uorStudentPublicId,
    scopeKey: row.scopeKey,
    status: row.status.toLowerCase(),
    payload: parseJson(row.payloadJson) ?? {},
    version: row.version,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    actors: row.actors.flatMap((actor) => actor.student.uorStudentPublicId ? [{
      profileId: actor.student.uorStudentPublicId,
      role: actor.role.toLowerCase(),
      status: actor.status.toLowerCase(),
      payload: parseJson(actor.payloadJson),
      decidedAt: actor.decidedAt?.toISOString() ?? null,
    }] : []),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const include = {
  owner: { select: { uorStudentPublicId: true } },
  actors: {
    select: {
      role: true,
      status: true,
      payloadJson: true,
      decidedAt: true,
      student: { select: { uorStudentPublicId: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export class PrismaUorStudentWorkflowRepository implements UorStudentWorkflowRepository {
  constructor(private readonly db: Database = prisma) {}

  async create(input: Parameters<UorStudentWorkflowRepository["create"]>[0]) {
    const row = await this.db.$transaction(async (tx) => {
      const aggregate = await tx.uorStudentAggregate.create({
        data: {
          ownerStudentId: input.owner.id,
          institutionCode: input.owner.institutionCode,
          category: input.category,
          scopeKey: input.scopeKey,
          status: input.status.toUpperCase(),
          payloadJson: JSON.stringify(input.payload),
          expiresAt: input.expiresAt,
        },
      });
      await tx.uorStudentAggregateEvent.create({
        data: {
          aggregateId: aggregate.id,
          actorStudentId: input.owner.id,
          institutionCode: input.owner.institutionCode,
          type: `${input.category}.created`,
          toStatus: aggregate.status,
          traceId: input.traceId,
        },
      });
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.owner.id,
          institutionCode: input.owner.institutionCode,
          domain: input.category,
          action: "aggregate.created",
          resourceType: input.category,
          resourceId: aggregate.id,
          purpose: input.category,
          result: "succeeded",
          traceId: input.traceId,
        },
      });
      return tx.uorStudentAggregate.findUniqueOrThrow({ where: { id: aggregate.id }, include });
    });
    return workflowView(row);
  }

  async getAccessible(input: Parameters<UorStudentWorkflowRepository["getAccessible"]>[0]) {
    const row = await this.db.uorStudentAggregate.findFirst({
      where: {
        id: input.id,
        institutionCode: input.student.institutionCode,
        ...(input.category ? { category: input.category } : {}),
        OR: [
          { ownerStudentId: input.student.id },
          { actors: { some: { studentId: input.student.id } } },
        ],
      },
      include,
    });
    return row ? workflowView(row) : null;
  }

  async getOwned(input: Parameters<UorStudentWorkflowRepository["getOwned"]>[0]) {
    const row = await this.db.uorStudentAggregate.findFirst({
      where: {
        id: input.id,
        ownerStudentId: input.student.id,
        institutionCode: input.student.institutionCode,
        category: input.category,
        ...(input.statuses?.length ? { status: { in: input.statuses.map((status) => status.toUpperCase()) } } : {}),
      },
      include,
    });
    return row ? workflowView(row) : null;
  }

  async getPublic(input: Parameters<UorStudentWorkflowRepository["getPublic"]>[0]) {
    const row = await this.db.uorStudentAggregate.findFirst({
      where: {
        id: input.id,
        institutionCode: input.student.institutionCode,
        category: input.category,
        status: { in: input.statuses.map((status) => status.toUpperCase()) },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include,
    });
    return row ? workflowView(row) : null;
  }

  async getForActor(input: Parameters<UorStudentWorkflowRepository["getForActor"]>[0]) {
    const row = await this.db.uorStudentAggregate.findFirst({
      where: {
        id: input.id,
        institutionCode: input.student.institutionCode,
        category: input.category,
        status: { in: input.aggregateStatuses.map((status) => status.toUpperCase()) },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        actors: { some: { studentId: input.student.id, role: input.role.toUpperCase(), status: { in: input.actorStatuses.map((status) => status.toUpperCase()) } } },
      },
      include,
    });
    return row ? workflowView(row) : null;
  }

  async list(input: Parameters<UorStudentWorkflowRepository["list"]>[0]) {
    let before: { updatedAt: Date; id: string } | null = null;
    if (input.cursor) {
      const cursor = await this.db.uorStudentAggregate.findFirst({
        where: { id: input.cursor, institutionCode: input.student.institutionCode, category: input.category },
        select: { id: true, updatedAt: true },
      });
      if (!cursor) throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400);
      before = cursor;
    }
    const access = input.access === "owner"
      ? { ownerStudentId: input.student.id }
      : input.access === "actor"
        ? { actors: { some: { studentId: input.student.id } } }
        : {};
    const rows = await this.db.uorStudentAggregate.findMany({
      where: {
        institutionCode: input.student.institutionCode,
        category: input.category,
        ...access,
        ...(input.access === "public_institution" ? { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } : {}),
        ...(input.statuses?.length ? { status: { in: input.statuses.map((status) => status.toUpperCase()) } } : {}),
        ...(before ? { AND: [{ OR: [{ updatedAt: { lt: before.updatedAt } }, { updatedAt: before.updatedAt, id: { lt: before.id } }] }] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      include,
    });
    const hasMore = rows.length > input.limit;
    const items = rows.slice(0, input.limit);
    return { items: items.map(workflowView), nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async transitionOwned(input: Parameters<UorStudentWorkflowRepository["transitionOwned"]>[0]) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.uorStudentAggregate.findFirst({
        where: {
          id: input.id,
          ownerStudentId: input.student.id,
          institutionCode: input.student.institutionCode,
          category: input.category,
          status: { in: input.from.map((status) => status.toUpperCase()) },
        },
      });
      if (!current) return null;
      const changed = await tx.uorStudentAggregate.updateMany({
        where: { id: current.id, version: current.version, status: current.status },
        data: {
          status: input.to.toUpperCase(),
          version: { increment: 1 },
          ...(input.payload ? { payloadJson: JSON.stringify(input.payload) } : {}),
        },
      });
      if (changed.count !== 1) throw new UorStudentError("UOR_STUDENT_WORKFLOW_CONFLICT", "O recurso foi alterado por outro pedido.", 409, true);
      await tx.uorStudentAggregateEvent.create({
        data: {
          aggregateId: current.id,
          actorStudentId: input.student.id,
          institutionCode: input.student.institutionCode,
          type: `${input.category}.transitioned`,
          fromStatus: current.status,
          toStatus: input.to.toUpperCase(),
          traceId: input.traceId,
        },
      });
      return workflowView(await tx.uorStudentAggregate.findUniqueOrThrow({ where: { id: current.id }, include }));
    });
  }

  async addActor(input: Parameters<UorStudentWorkflowRepository["addActor"]>[0]) {
    return this.db.$transaction(async (tx) => {
      const [aggregate, target] = await Promise.all([
        tx.uorStudentAggregate.findFirst({
          where: { id: input.aggregateId, ownerStudentId: input.owner.id, institutionCode: input.owner.institutionCode, category: input.category },
        }),
        tx.student.findFirst({
          where: { uorStudentPublicId: input.profileId, institutionCode: input.owner.institutionCode, deletedAt: null, isUorStudent: true },
          select: { id: true },
        }),
      ]);
      if (!aggregate || !target) return null;
      await tx.uorStudentAggregateActor.upsert({
        where: { aggregateId_studentId_role: { aggregateId: aggregate.id, studentId: target.id, role: input.role.toUpperCase() } },
        create: {
          aggregateId: aggregate.id,
          studentId: target.id,
          institutionCode: input.owner.institutionCode,
          role: input.role.toUpperCase(),
          status: input.status.toUpperCase(),
          payloadJson: input.payload ? JSON.stringify(input.payload) : null,
        },
        update: {},
      });
      if (input.category === "market_listing" && input.status.toUpperCase() === "RESERVED") {
        const reserved = await tx.uorStudentAggregate.updateMany({
          where: { id: aggregate.id, status: "PUBLISHED", version: aggregate.version },
          data: { status: "RESERVED", version: { increment: 1 } },
        });
        if (reserved.count !== 1) throw new UorStudentError("UOR_STUDENT_MARKET_CONFLICT", "O anúncio já não está disponível para reserva.", 409);
      }
      if (input.category === "community_report") {
        const decisions = await tx.uorStudentAggregateActor.groupBy({
          by: ["status"],
          where: { aggregateId: aggregate.id, role: input.role.toUpperCase() },
          _count: { _all: true },
        });
        const count = (status: string) => decisions.find((item) => item.status === status)?._count._all ?? 0;
        const derivedStatus = count("CONTESTED") > 0 ? "CONTESTED" : count("CONFIRMED") >= 2 ? "CONFIRMED" : "REPORTED";
        await tx.uorStudentAggregate.update({ where: { id: aggregate.id }, data: { status: derivedStatus, version: { increment: 1 } } });
      }
      await tx.uorStudentAggregateEvent.create({
        data: {
          aggregateId: aggregate.id,
          actorStudentId: input.owner.id,
          institutionCode: input.owner.institutionCode,
          type: `${input.category}.actor_added`,
          payloadJson: JSON.stringify({ role: input.role }),
          traceId: input.traceId,
        },
      });
      return workflowView(await tx.uorStudentAggregate.findUniqueOrThrow({ where: { id: aggregate.id }, include }));
    });
  }

  async decideActor(input: Parameters<UorStudentWorkflowRepository["decideActor"]>[0]) {
    return this.db.$transaction(async (tx) => {
      const aggregate = await tx.uorStudentAggregate.findFirst({
        where: {
          id: input.aggregateId,
          institutionCode: input.student.institutionCode,
          category: input.category,
          ...(input.aggregateStatuses?.length ? { status: { in: input.aggregateStatuses.map((status) => status.toUpperCase()) } } : {}),
        },
      });
      if (!aggregate) return null;
      const changed = await tx.uorStudentAggregateActor.updateMany({
        where: {
          aggregateId: aggregate.id,
          studentId: input.student.id,
          role: input.role.toUpperCase(),
          status: { in: input.from.map((status) => status.toUpperCase()) },
        },
        data: { status: input.to.toUpperCase(), decidedAt: new Date() },
      });
      if (changed.count !== 1) return null;
      if (input.category === "tutoring_request" && input.role.toUpperCase() === "TUTOR") {
        await tx.uorStudentAggregate.update({
          where: { id: aggregate.id },
          data: { status: input.to.toUpperCase() === "ACCEPTED" ? "ACTIVE" : input.to.toUpperCase() === "REVOKED" ? "REVOKED" : "REJECTED", version: { increment: 1 } },
        });
      }
      await tx.uorStudentAggregateEvent.create({
        data: {
          aggregateId: aggregate.id,
          actorStudentId: input.student.id,
          institutionCode: input.student.institutionCode,
          type: `${input.category}.actor_decided`,
          toStatus: input.to.toUpperCase(),
          payloadJson: JSON.stringify({ role: input.role }),
          traceId: input.traceId,
        },
      });
      return workflowView(await tx.uorStudentAggregate.findUniqueOrThrow({ where: { id: aggregate.id }, include }));
    });
  }

  async reactPublic(input: Parameters<UorStudentWorkflowRepository["reactPublic"]>[0]) {
    return this.db.$transaction(async (tx) => {
      const aggregate = await tx.uorStudentAggregate.findFirst({
        where: {
          id: input.aggregateId,
          institutionCode: input.student.institutionCode,
          category: input.category,
          status: { in: input.allowedAggregateStatuses.map((status) => status.toUpperCase()) },
          expiresAt: { gt: new Date() },
          NOT: { ownerStudentId: input.student.id },
        },
      });
      if (!aggregate) return null;
      await tx.uorStudentAggregateActor.upsert({
        where: {
          aggregateId_studentId_role: {
            aggregateId: aggregate.id,
            studentId: input.student.id,
            role: input.role.toUpperCase(),
          },
        },
        create: {
          aggregateId: aggregate.id,
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          role: input.role.toUpperCase(),
          status: input.status.toUpperCase(),
          payloadJson: input.payload ? JSON.stringify(input.payload) : null,
          decidedAt: new Date(),
        },
        update: {
          status: input.status.toUpperCase(),
          payloadJson: input.payload ? JSON.stringify(input.payload) : null,
          decidedAt: new Date(),
        },
      });
      await tx.uorStudentAggregateEvent.create({
        data: {
          aggregateId: aggregate.id,
          actorStudentId: input.student.id,
          institutionCode: input.student.institutionCode,
          type: `${input.category}.reaction_recorded`,
          toStatus: input.status.toUpperCase(),
          payloadJson: JSON.stringify({ role: input.role }),
          traceId: input.traceId,
        },
      });
      return workflowView(await tx.uorStudentAggregate.findUniqueOrThrow({ where: { id: aggregate.id }, include }));
    });
  }

  async revokeTutoringRelationship(input: Parameters<UorStudentWorkflowRepository["revokeTutoringRelationship"]>[0]) {
    return this.db.$transaction(async (tx) => {
      const relationship = await tx.uorStudentAggregate.findFirst({
        where: {
          id: input.relationshipId,
          institutionCode: input.student.institutionCode,
          category: "tutoring_request",
          status: "ACTIVE",
          OR: [
            { ownerStudentId: input.student.id },
            { actors: { some: { studentId: input.student.id, role: "TUTOR", status: "ACCEPTED" } } },
          ],
        },
      });
      if (!relationship) return null;
      await tx.uorStudentAggregate.update({ where: { id: relationship.id }, data: { status: "REVOKED", version: { increment: 1 } } });
      await tx.uorStudentAggregate.updateMany({
        where: {
          institutionCode: input.student.institutionCode,
          category: "tutoring_grant",
          scopeKey: relationship.id,
          status: "ACTIVE",
        },
        data: { status: "REVOKED", version: { increment: 1 } },
      });
      await tx.uorStudentAggregateEvent.create({ data: { aggregateId: relationship.id, actorStudentId: input.student.id, institutionCode: input.student.institutionCode, type: "tutoring_relationship.revoked", fromStatus: "ACTIVE", toStatus: "REVOKED", traceId: input.traceId } });
      await tx.uorStudentAuditEvent.create({ data: { studentId: input.student.id, institutionCode: input.student.institutionCode, domain: "tutoring", action: "relationship.revoked", resourceType: "tutoring_relationship", resourceId: relationship.id, purpose: "tutoring_data_access", result: "succeeded", traceId: input.traceId } });
      return workflowView(await tx.uorStudentAggregate.findUniqueOrThrow({ where: { id: relationship.id }, include }));
    });
  }

  async listEvents(input: Parameters<UorStudentWorkflowRepository["listEvents"]>[0]) {
    const accessible = await this.getAccessible({ student: input.student, id: input.aggregateId });
    if (!accessible) return null;
    const rows = await this.db.uorStudentAggregateEvent.findMany({
      where: { aggregateId: input.aggregateId, institutionCode: input.student.institutionCode },
      select: { id: true, type: true, fromStatus: true, toStatus: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(input.limit, 100),
    });
    return rows.map((row) => ({ ...row, type: row.type, createdAt: row.createdAt.toISOString() }));
  }
}
