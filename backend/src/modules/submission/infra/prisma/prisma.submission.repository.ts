import type {
  CreateSubmissionInput,
  ReviewRepository,
  SubmissionRepository,
  SubmissionSummary,
  SubmissionStatus,
  SubmissionType,
  VoteRepository
} from "../../domain/submission.repository";
import type { Submission } from "../../domain/submission";
import { prisma } from "../../../../shared/prisma";
import {
  countTeamMembers,
  DEFAULT_SUBMISSION_PRIMARY_COLOR,
  DEFAULT_SUBMISSION_SECONDARY_COLOR,
  normalizeTeamMembersInput,
  stringifyTeamMembers
} from "../../domain/submission-format";

function parseNeeds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Mantém compatibilidade com dados antigos/seed onde needs foi salvo como texto plano.
    return value ? [value] : [];
  }
}

export class PrismaSubmissionRepository implements SubmissionRepository {
  async create(data: CreateSubmissionInput): Promise<Submission> {
    const members = normalizeTeamMembersInput(data.members);
    const digits = data.leaderPhone.replace(/\D/g, "");
    const syntheticLeaderEmail = data.leaderEmail?.trim() || `submission-${digits}@uor-connect.local`;

    const submission = await prisma.submission.create({
      data: {
        type: data.type,
        name: data.name,
        description: data.description,
        area: data.area,
        course: data.course ?? null,
        stage: data.stage ?? null,
        category: data.category ?? null,
        productType: data.productType ?? null,
        teamSize: members.length,
        members: stringifyTeamMembers(members),
        leaderName: data.leaderName.trim(),
        leaderPhone: data.leaderPhone,
        leaderEmail: syntheticLeaderEmail,
        needs: JSON.stringify(data.needs),
        paymentProof: data.paymentProof,
        paymentConfirmed: data.paymentConfirmed,
        repoUrl: data.repoUrl ?? null,
        websiteUrl: data.websiteUrl ?? null,
        observations: data.observations ?? null,
        agreeRules: data.agreeRules,
        primaryColor: data.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR,
        secondaryColor: data.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR,
        bannerUrl: data.bannerUrl ?? null,
        referenceCode: data.referenceCode ?? (await this.nextReference()),
        leader: {
          connectOrCreate: {
            where: { email: syntheticLeaderEmail },
            create: { email: syntheticLeaderEmail }
          }
        }
      }
    });

    return this.map(submission);
  }

  async findById(id: number): Promise<Submission | null> {
    const submission = await prisma.submission.findUnique({ where: { id } });
    return submission ? this.map(submission) : null;
  }

  async findByReference(ref: string): Promise<Submission | null> {
    const submission = await prisma.submission.findUnique({ where: { referenceCode: ref } });
    return submission ? this.map(submission) : null;
  }

  async list(status?: SubmissionStatus, type?: SubmissionType): Promise<Submission[]> {
    const submissions = await prisma.submission.findMany({
      where: {
        status,
        type
      },
      orderBy: { createdAt: "desc" }
    });
    return submissions.map(this.map);
  }

  async summary(id: number): Promise<SubmissionSummary | null> {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { reviews: { include: { reviewer: true } }, votes: true }
    });
    if (!submission) return null;

    const avg =
      submission.reviews.length > 0
        ? submission.reviews.reduce((sum: number, r) => sum + r.rating, 0) / submission.reviews.length
        : 0;

    return {
      ...this.map(submission),
      votes: submission.votes.length,
      averageRating: Number(avg.toFixed(1)),
      reviews: submission.reviews.map((r) => ({
        user: r.reviewer.email,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt
      }))
    };
  }

  async setStatus(id: number, status: SubmissionStatus): Promise<void> {
    await prisma.submission.update({ where: { id }, data: { status } });
  }

  async setWinner(id: number): Promise<void> {
    await prisma.$transaction([
      prisma.submission.updateMany({
        where: { isWinner: true },
        data: { isWinner: false, winnerSelectedAt: null }
      }),
      prisma.submission.update({
        where: { id },
        data: { isWinner: true, winnerSelectedAt: new Date() }
      })
    ]);
  }

  async clearWinners(): Promise<void> {
    await prisma.submission.updateMany({
      where: { isWinner: true },
      data: { isWinner: false, winnerSelectedAt: null }
    });
  }

  async hasDuplicate(name: string, leaderPhone: string): Promise<boolean> {
    const count = await prisma.submission.count({ where: { name, leaderPhone } });
    return count > 0;
  }

  async updatePresentation(id: number, data: {
    primaryColor?: string;
    secondaryColor?: string;
    bannerUrl?: string | null;
  }): Promise<Submission> {
    const updateData: {
      primaryColor?: string;
      secondaryColor?: string;
      bannerUrl?: string | null;
    } = {};

    if (data.primaryColor) updateData.primaryColor = data.primaryColor;
    if (data.secondaryColor) updateData.secondaryColor = data.secondaryColor;
    if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;

    const submission = await prisma.submission.update({
      where: { id },
      data: updateData
    });

    return this.map(submission);
  }

  async deleteWithRelations(id: number): Promise<void> {
    await prisma.$transaction([
      prisma.studentLike.deleteMany({ where: { submissionId: id } }),
      prisma.studentVote.deleteMany({ where: { submissionId: id } }),
      prisma.studentComment.deleteMany({ where: { submissionId: id } }),
      prisma.vote.deleteMany({ where: { submissionId: id } }),
      prisma.review.deleteMany({ where: { submissionId: id } }),
      prisma.submission.delete({ where: { id } })
    ]);
  }

  private async nextReference() {
    const latest = await prisma.submission.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const seq = (latest?.id ?? 0) + 1;
    return `UOR-2026-${seq.toString().padStart(4, "0")}`;
  }

  private map = (submission: any): Submission => ({
    ...submission,
    members: normalizeTeamMembersInput(submission.members),
    teamSize: countTeamMembers(submission.members),
    needs: parseNeeds(submission.needs),
    primaryColor: submission.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR,
    secondaryColor: submission.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR,
    bannerUrl: submission.bannerUrl ?? null
  });
}

export class PrismaSubmissionConfigRepository {
  async getConfig() {
    return prisma.submissionConfig.upsert({
      where: { key: "default" },
      update: {},
      create: { key: "default" }
    });
  }

  async updateConfig(data: {
    isOpen: boolean;
    iban: string;
    accountName: string;
    paymentAmount: string;
    paymentInstructions?: string | null;
    projectCommunityUrl?: string | null;
    businessCommunityUrl?: string | null;
    productCommunityUrl?: string | null;
  }) {
    return prisma.submissionConfig.upsert({
      where: { key: "default" },
      update: data,
      create: { key: "default", ...data }
    });
  }
}

export class PrismaVoteRepository implements VoteRepository {
  async vote(submissionId: number, email: string): Promise<void> {
    const userId = await this.resolveUser(email);
    await prisma.vote.create({
      data: {
        submissionId,
        voterId: userId
      }
    });
  }

  async count(submissionId: number): Promise<number> {
    return prisma.vote.count({ where: { submissionId } });
  }

  async hasVoted(submissionId: number, email: string): Promise<boolean> {
    const vote = await prisma.vote.findFirst({ where: { submissionId, voter: { email } } });
    return !!vote;
  }

  private async resolveUser(email: string) {
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
    return user.id;
  }
}

export class PrismaReviewRepository implements ReviewRepository {
  async upsert(submissionId: number, email: string, rating: number, comment?: string): Promise<void> {
    const reviewerId = await this.resolveUser(email);
    await prisma.review.upsert({
      where: {
        submissionId_reviewerId: {
          submissionId,
          reviewerId
        }
      },
      create: {
        submissionId,
        reviewerId,
        rating,
        comment
      },
      update: { rating, comment }
    });
  }

  async average(submissionId: number): Promise<number> {
    const agg = await prisma.review.aggregate({ _avg: { rating: true }, where: { submissionId } });
    return Number((agg._avg.rating ?? 0).toFixed(1));
  }

  async list(submissionId: number) {
    const reviews = await prisma.review.findMany({
      where: { submissionId },
      include: { reviewer: true },
      orderBy: { createdAt: "desc" }
    });
    return reviews.map((r) => ({ user: r.reviewer.email, rating: r.rating, comment: r.comment, createdAt: r.createdAt }));
  }

  private async resolveUser(email: string) {
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
    return user.id;
  }
}
