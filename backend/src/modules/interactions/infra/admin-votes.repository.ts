import { prisma } from "../../../shared/prisma";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import type { AdminProjectVoteSummary, AdminVoteCourseSummary, AdminVoteEntry, AdminVotesRepository } from "../use-cases/admin-votes";
import { isCompetitionEligible, normalizeSubmissionType } from "../../submission/domain/submission-policy";
import { buildSubmissionSlug } from "../../submission/domain/submission-format";

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
  projectFrozen: boolean;
  projectFrozenAt: Date | null;
  projectFreezeReason: string | null;
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
  private cachedCourseSummaries: { value: AdminVoteCourseSummary[]; expiresAt: number } | null = null;
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

  invalidateCache() {
    this.cachedEligibleSubmissions = null;
    this.cachedSummaries = null;
    this.cachedCourseSummaries = null;
    this.cachedVotesPages.clear();
  }

  private async listEligibleSubmissions() {
    if (this.isCacheValid(this.cachedEligibleSubmissions)) {
      return this.cachedEligibleSubmissions?.value ?? [];
    }

    const submissions = await prisma.submission.findMany({
      where: { type: "PROJECT", status: "APPROVED", deletedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        area: true,
        createdAt: true,
        projectFrozen: true,
        projectFrozenAt: true,
        projectFreezeReason: true,
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
    const [voteCounts, scoreTotals, commentCounts, ratings, projectViewEvents] = await Promise.all([
      prisma.studentVote.groupBy({
        by: ["submissionId"],
        where: { submissionId: { in: submissionIds } },
        _count: { _all: true },
      }),
      prisma.exhibitorScoreEvent.groupBy({
        by: ["submissionId"],
        where: {
          submissionId: { in: submissionIds },
          status: "VALID",
          revokedAt: null,
        },
        _sum: { points: true },
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
      prisma.analyticsEvent.findMany({
        where: {
          eventType: "project_detail_view",
          pageUrl: { contains: "/projeto/" },
        },
        select: {
          pageUrl: true,
          visitorId: true,
          studentId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 25_000,
      }),
    ]);

    const voteCountBySubmissionId = new Map(voteCounts.map((item) => [item.submissionId, item._count._all]));
    const scoreBySubmissionId = new Map(scoreTotals.map((item) => [
      item.submissionId,
      item._sum.points ?? 0,
    ]));
    const commentCountBySubmissionId = new Map(commentCounts.map((item) => [item.submissionId, item._count._all]));
    const ratingBySubmissionId = new Map(ratings.map((item) => [item.submissionId, Number((item._avg.rating ?? 0).toFixed(1))]));
    const viewsBySubmissionId = new Map<number, { pageViews: number; visitors: Set<string>; authenticated: Set<number> }>();

    for (const submission of eligibleSubmissions) {
      const slug = buildSubmissionSlug(submission.name, submission.id);
      const detailPath = `/projeto/${slug}`;
      const bucket = { pageViews: 0, visitors: new Set<string>(), authenticated: new Set<number>() };

      for (const event of projectViewEvents) {
        if (!event.pageUrl?.includes(detailPath)) continue;
        bucket.pageViews += 1;
        bucket.visitors.add(event.visitorId);
        if (event.studentId) bucket.authenticated.add(event.studentId);
      }

      viewsBySubmissionId.set(submission.id, bucket);
    }

    const summaries = eligibleSubmissions.map((submission) => ({
      id: submission.id,
      name: submission.name,
      detailPath: `/projeto/${buildSubmissionSlug(submission.name, submission.id)}`,
      type: normalizeSubmissionType(submission.type, submission.area),
      votes: voteCountBySubmissionId.get(submission.id) ?? 0,
      score: scoreBySubmissionId.get(submission.id) ?? 0,
      comments: commentCountBySubmissionId.get(submission.id) ?? 0,
      averageRating: ratingBySubmissionId.get(submission.id) ?? 0,
      pageViews: viewsBySubmissionId.get(submission.id)?.pageViews ?? 0,
      uniqueVisitors: viewsBySubmissionId.get(submission.id)?.visitors.size ?? 0,
      authenticatedVisitors: viewsBySubmissionId.get(submission.id)?.authenticated.size ?? 0,
      projectFrozen: submission.projectFrozen,
      projectFrozenAt: submission.projectFrozenAt?.toISOString() ?? null,
      projectFreezeReason: submission.projectFreezeReason ?? null,
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
      studentCourse: vote.student.course ?? null,
      submissionId: vote.submissionId,
      submissionName: vote.submission.name,
      createdAt: vote.createdAt.toISOString(),
    }));
  }

  async listRecentVotes(limit = 120): Promise<AdminVoteEntry[]> {
    const page = await this.listVotesPaged({ page: 1, limit });
    return page.items;
  }

  async listCourseSummaries(): Promise<AdminVoteCourseSummary[]> {
    if (this.isCacheValid(this.cachedCourseSummaries)) {
      return this.cachedCourseSummaries?.value ?? [];
    }

    const eligibleSubmissions = await this.listEligibleSubmissions();
    const submissionIds = eligibleSubmissions.map((submission) => submission.id);
    if (submissionIds.length === 0) return [];

    const recentCutoff = Date.now() - 5 * 60 * 1000;
    const votes = await prisma.studentVote.findMany({
      where: { submissionId: { in: submissionIds } },
      select: {
        studentId: true,
        createdAt: true,
        student: {
          select: {
            course: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50_000,
    });

    const stats = votes.reduce<
      Map<string, { course: string; votes: number; students: Set<number>; recentVotes: number; lastVoteAt: Date | null }>
    >((acc, vote) => {
      const course = vote.student.course?.trim() || "Curso por confirmar";
      const current = acc.get(course) ?? {
        course,
        votes: 0,
        students: new Set<number>(),
        recentVotes: 0,
        lastVoteAt: null,
      };

      current.votes += 1;
      current.students.add(vote.studentId);
      if (vote.createdAt.getTime() >= recentCutoff) current.recentVotes += 1;
      if (!current.lastVoteAt || vote.createdAt > current.lastVoteAt) current.lastVoteAt = vote.createdAt;
      acc.set(course, current);
      return acc;
    }, new Map());

    const summaries = Array.from(stats.values())
      .map((item) => ({
        course: item.course,
        votes: item.votes,
        students: item.students.size,
        recentVotes: item.recentVotes,
        lastVoteAt: item.lastVoteAt?.toISOString() ?? null,
      }))
      .sort((left, right) => right.recentVotes - left.recentVotes || right.votes - left.votes || left.course.localeCompare(right.course));

    this.cachedCourseSummaries = {
      value: summaries,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return summaries;
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
        studentCourse: vote.student.course ?? null,
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
