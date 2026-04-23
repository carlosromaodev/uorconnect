import { prisma } from "../../../shared/prisma";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import type { AdminProjectVoteSummary, AdminVoteEntry, AdminVotesRepository } from "../use-cases/admin-votes";
import { isCompetitionEligible, normalizeSubmissionType } from "../../submission/domain/submission-policy";

type AdminVotesPageInput = {
  page?: number;
  limit?: number;
};

type EligibleSubmission = {
  id: number;
  name: string;
  type: "PROJECT" | "BUSINESS" | "PRODUCT";
  area: string;
  createdAt: Date;
};

function normalizePageInput(input?: AdminVotesPageInput) {
  const page = Math.max(1, input?.page ?? 1);
  const limit = Math.min(Math.max(10, input?.limit ?? 50), 200);
  return { page, limit };
}

export class PrismaAdminVotesRepository implements AdminVotesRepository {
  private readonly cacheTtlMs = 5_000;
  private cachedEligibleSubmissions: { value: EligibleSubmission[]; expiresAt: number } | null = null;
  private cachedSummaries: { value: AdminProjectVoteSummary[]; expiresAt: number } | null = null;
  private cachedVotesPages = new Map<string, { value: { items: AdminVoteEntry[]; total: number; page: number; totalPages: number }; expiresAt: number }>();

  private isCacheValid(cache: { expiresAt: number } | null) {
    return Boolean(cache && cache.expiresAt > Date.now());
  }

  private readVotesPageCache(key: string) {
    const cached = this.cachedVotesPages.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    if (cached) {
      this.cachedVotesPages.delete(key);
    }

    return null;
  }

  private async listEligibleSubmissions() {
    if (this.isCacheValid(this.cachedEligibleSubmissions)) {
      return this.cachedEligibleSubmissions?.value ?? [];
    }

    const submissions = await prisma.submission.findMany({
      where: { type: "PROJECT" },
      select: {
        id: true,
        name: true,
        type: true,
        area: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const eligible = submissions.filter((submission) => isCompetitionEligible(submission.type, submission.area));
    this.cachedEligibleSubmissions = {
      value: eligible,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return eligible;
  }

  async listProjectSummaries(): Promise<AdminProjectVoteSummary[]> {
    if (this.isCacheValid(this.cachedSummaries)) {
      return this.cachedSummaries?.value ?? [];
    }

    const eligibleSubmissions = await this.listEligibleSubmissions();
    if (eligibleSubmissions.length === 0) return [];

    const submissionIds = eligibleSubmissions.map((submission) => submission.id);
    const [voteCounts, commentCounts, ratings] = await Promise.all([
      prisma.studentVote.groupBy({
        by: ["submissionId"],
        where: { submissionId: { in: submissionIds } },
        _count: { _all: true },
      }),
      prisma.studentComment.groupBy({
        by: ["submissionId"],
        where: { submissionId: { in: submissionIds } },
        _count: { _all: true },
      }),
      prisma.review.groupBy({
        by: ["submissionId"],
        where: { submissionId: { in: submissionIds } },
        _avg: { rating: true },
      }),
    ]);

    const voteCountBySubmissionId = new Map(voteCounts.map((item) => [item.submissionId, item._count._all]));
    const commentCountBySubmissionId = new Map(commentCounts.map((item) => [item.submissionId, item._count._all]));
    const ratingBySubmissionId = new Map(ratings.map((item) => [item.submissionId, Number((item._avg.rating ?? 0).toFixed(1))]));

    const summaries = eligibleSubmissions.map((submission) => ({
      id: submission.id,
      name: submission.name,
      type: normalizeSubmissionType(submission.type, submission.area),
      votes: voteCountBySubmissionId.get(submission.id) ?? 0,
      comments: commentCountBySubmissionId.get(submission.id) ?? 0,
      averageRating: ratingBySubmissionId.get(submission.id) ?? 0,
    }));

    this.cachedSummaries = {
      value: summaries,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return summaries;
  }

  async listVotes(): Promise<AdminVoteEntry[]> {
    const eligibleSubmissions = await this.listEligibleSubmissions();
    const submissionIdSet = new Set(eligibleSubmissions.map((submission) => submission.id));
    if (submissionIdSet.size === 0) return [];

    const votes = await prisma.studentVote.findMany({
      where: { submissionId: { in: Array.from(submissionIdSet) } },
      include: {
        student: {
          select: {
            studentNumber: true,
            name: true,
            course: true,
            email: true,
          },
        },
        submission: {
          select: {
            id: true,
            name: true,
            type: true,
            area: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return votes.map((vote) => ({
      id: vote.id,
      studentId: vote.studentId,
      studentNumber: vote.student.studentNumber,
      studentName: normalizeStudentProfile(vote.student).name ?? null,
      studentEmail: vote.student.email ?? null,
      submissionId: vote.submissionId,
      submissionName: vote.submission.name,
      createdAt: vote.createdAt.toISOString(),
    }));
  }

  async listProjectSummariesPaged(input?: AdminVotesPageInput) {
    const { page, limit } = normalizePageInput(input);
    const all = await this.listProjectSummaries();
    const start = (page - 1) * limit;

    return {
      items: all.slice(start, start + limit),
      total: all.length,
      page,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
    };
  }

  async listVotesPaged(input?: AdminVotesPageInput) {
    const { page, limit } = normalizePageInput(input);
    const cacheKey = `${page}:${limit}`;
    const cached = this.readVotesPageCache(cacheKey);
    if (cached) {
      return cached;
    }

    const eligibleSubmissions = await this.listEligibleSubmissions();
    const submissionIds = eligibleSubmissions.map((submission) => submission.id);
    if (submissionIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        totalPages: 1,
      };
    }

    const [total, votes] = await Promise.all([
      prisma.studentVote.count({
        where: { submissionId: { in: submissionIds } },
      }),
      prisma.studentVote.findMany({
        where: { submissionId: { in: submissionIds } },
        include: {
          student: {
            select: {
              studentNumber: true,
              name: true,
              course: true,
              email: true,
            },
          },
          submission: {
            select: {
              id: true,
              name: true,
              type: true,
              area: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const payload = {
      items: votes.map((vote) => ({
        id: vote.id,
        studentId: vote.studentId,
        studentNumber: vote.student.studentNumber,
        studentName: normalizeStudentProfile(vote.student).name ?? null,
        studentEmail: vote.student.email ?? null,
        submissionId: vote.submissionId,
        submissionName: vote.submission.name,
        createdAt: vote.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };

    this.cachedVotesPages.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return payload;
  }
}
