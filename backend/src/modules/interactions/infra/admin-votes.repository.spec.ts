import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaAdminVotesRepository } from "./admin-votes.repository";

const prismaMock = vi.hoisted(() => ({
  submission: {
    findMany: vi.fn(),
  },
  studentVote: {
    groupBy: vi.fn(),
  },
  studentComment: {
    groupBy: vi.fn(),
  },
  review: {
    groupBy: vi.fn(),
  },
  analyticsEvent: {
    findMany: vi.fn(),
  },
  exhibitorScoreEvent: {
    groupBy: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

describe("PrismaAdminVotesRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.submission.findMany.mockResolvedValue([
      {
        id: 77,
        name: "Smart Campus",
        type: "PROJECT",
        area: "Tecnologia",
        createdAt: new Date("2026-05-14T10:00:00.000Z"),
      },
    ]);
    prismaMock.studentVote.groupBy.mockResolvedValue([
      { submissionId: 77, _count: { _all: 4 } },
    ]);
    prismaMock.studentComment.groupBy.mockResolvedValue([]);
    prismaMock.review.groupBy.mockResolvedValue([]);
    prismaMock.analyticsEvent.findMany.mockResolvedValue([]);
    prismaMock.exhibitorScoreEvent.groupBy.mockResolvedValue([
      { submissionId: 77, _sum: { points: 12.5 } },
    ]);
  });

  it("includes ledger score in project summaries", async () => {
    const repository = new PrismaAdminVotesRepository();

    const result = await repository.listProjectSummaries();

    expect(prismaMock.exhibitorScoreEvent.groupBy).toHaveBeenCalledWith({
      by: ["submissionId"],
      where: {
        submissionId: { in: [77] },
        status: "VALID",
        revokedAt: null,
      },
      _sum: { points: true },
    });
    expect(result[0]).toEqual(expect.objectContaining({
      id: 77,
      votes: 4,
      score: 12.5,
    }));
  });

  it("returns project summaries ordered by audited points for admin winners", async () => {
    prismaMock.submission.findMany.mockResolvedValueOnce([
      {
        id: 77,
        name: "Mais votos",
        type: "PROJECT",
        area: "Tecnologia",
        createdAt: new Date("2026-05-14T10:00:00.000Z"),
      },
      {
        id: 88,
        name: "Mais pontos",
        type: "PROJECT",
        area: "Tecnologia",
        createdAt: new Date("2026-05-13T10:00:00.000Z"),
      },
    ]);
    prismaMock.studentVote.groupBy.mockResolvedValueOnce([
      { submissionId: 77, _count: { _all: 30 } },
      { submissionId: 88, _count: { _all: 8 } },
    ]);
    prismaMock.exhibitorScoreEvent.groupBy.mockResolvedValueOnce([
      { submissionId: 77, _sum: { points: 30 } },
      { submissionId: 88, _sum: { points: 120 } },
    ]);

    const repository = new PrismaAdminVotesRepository();

    const result = await repository.listProjectSummariesPaged({ page: 1, limit: 10 });

    expect(result.items.map((project) => project.name)).toEqual([
      "Mais pontos",
      "Mais votos",
    ]);
  });
});
