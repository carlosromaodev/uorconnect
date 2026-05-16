import type {
  CreateSubmissionInput,
  ReviewRepository,
  SubmissionRepository,
  SubmissionSummary,
  SubmissionStatus,
  SubmissionType,
  VoteRepository
} from "../../domain/submission.repository";
import type { Prisma } from "@prisma/client";
import type { Submission } from "../../domain/submission";
import { prisma } from "../../../../shared/prisma";
import { normalizeAngolaPhone } from "../../../auth/domain/student-format";
import {
  countTeamMembers,
  DEFAULT_SUBMISSION_PRIMARY_COLOR,
  DEFAULT_SUBMISSION_SECONDARY_COLOR,
  normalizeTeamMembersInput,
  stringifyTeamMembers
} from "../../domain/submission-format";

type SubmissionRecord = Prisma.SubmissionGetPayload<object>;

function parseNeeds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Mantém compatibilidade com dados antigos/seed onde needs foi salvo como texto plano.
    return value ? [value] : [];
  }
}

function isMissingSubmissionOwnershipColumnError(error: unknown) {
  return error instanceof Error
    && /studentId/i.test(error.message)
    && /does not exist|unknown arg|no such column/i.test(error.message);
}

function isSyntheticLeaderEmail(value?: string | null) {
  return Boolean(value && /^submission-\d+@uor-connect\.local$/i.test(value));
}

function buildSubmissionWriteData(data: CreateSubmissionInput, options?: { includeOwnership?: boolean }) {
  const members = normalizeTeamMembersInput(data.members);
  const digits = data.leaderPhone.replace(/\D/g, "");
  const syntheticLeaderEmail = data.leaderEmail?.trim() || `submission-${digits}@uor-connect.local`;
  const includeOwnership = options?.includeOwnership ?? true;

  return {
    members,
    syntheticLeaderEmail,
    writeData: {
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
      paymentStatus: data.paymentStatus ?? "PENDING_REVIEW",
      paymentSubmittedAt: data.paymentSubmittedAt ?? new Date(),
      paymentReviewedAt: data.paymentReviewedAt ?? null,
      paymentReviewedByStudentNumber: data.paymentReviewedByStudentNumber ?? null,
      paymentReviewNote: data.paymentReviewNote ?? null,
      repoUrl: data.repoUrl ?? null,
      websiteUrl: data.websiteUrl ?? null,
      instagramUrl: data.instagramUrl ?? null,
      facebookUrl: data.facebookUrl ?? null,
      linkedinUrl: data.linkedinUrl ?? null,
      githubUrl: data.githubUrl ?? null,
      observations: data.observations ?? null,
      agreeRules: data.agreeRules,
      primaryColor: data.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR,
      secondaryColor: data.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR,
      bannerUrl: data.bannerUrl ?? null,
      studentNumberSnapshot: includeOwnership ? (data.studentNumberSnapshot ?? null) : undefined,
      student: includeOwnership && data.studentId ? { connect: { id: data.studentId } } : undefined,
      leader: {
        connectOrCreate: {
          where: { email: syntheticLeaderEmail },
          create: { email: syntheticLeaderEmail }
        }
      }
    },
  };
}

export class PrismaSubmissionRepository implements SubmissionRepository {
  async create(data: CreateSubmissionInput): Promise<Submission> {
    const referenceCode = data.referenceCode ?? (await this.nextReference());

    try {
      const { writeData } = buildSubmissionWriteData(data);
      const submission = await prisma.submission.create({
        data: {
          referenceCode,
          ...writeData,
        }
      });

      return this.map(submission);
    } catch (error) {
      if (!isMissingSubmissionOwnershipColumnError(error)) {
        throw error;
      }

      const { writeData } = buildSubmissionWriteData(data, { includeOwnership: false });
      const submission = await prisma.submission.create({
        data: {
          referenceCode,
          ...writeData,
        }
      });

      return this.map(submission);
    }
  }

  async findById(id: number): Promise<Submission | null> {
    const submission = await prisma.submission.findFirst({ where: { id, deletedAt: null } });
    return submission ? this.map(submission) : null;
  }

  async findOwnedById(id: number, studentId: number): Promise<Submission | null> {
    try {
      const submission = await prisma.submission.findFirst({
        where: { id, studentId, deletedAt: null },
      });
      return submission ? this.map(submission) : null;
    } catch (error) {
      if (isMissingSubmissionOwnershipColumnError(error)) {
        return null;
      }
      throw error;
    }
  }

  async findByReference(ref: string): Promise<Submission | null> {
    const submission = await prisma.submission.findUnique({ where: { referenceCode: ref } });
    return submission && !submission.deletedAt ? this.map(submission) : null;
  }

  async list(status?: SubmissionStatus, type?: SubmissionType): Promise<Submission[]> {
    const submissions = await prisma.submission.findMany({
      where: {
        deletedAt: null,
        status,
        type
      },
      orderBy: { createdAt: "desc" }
    });
    return submissions.map(this.map);
  }

  async listByStudent(studentId: number): Promise<Submission[]> {
    try {
      const submissions = await prisma.submission.findMany({
        where: {
          deletedAt: null,
          OR: [
            { studentId },
            {
              memberConfirmations: {
                some: {
                  studentId,
                  confirmedAt: { not: null },
                },
              },
            },
          ],
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      return submissions.map(this.map);
    } catch (error) {
      if (isMissingSubmissionOwnershipColumnError(error)) {
        return [];
      }
      throw error;
    }
  }

  async summary(id: number): Promise<SubmissionSummary | null> {
    const submission = await prisma.submission.findFirst({
      where: { id, deletedAt: null },
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
    const count = await prisma.submission.count({ where: { name, leaderPhone, deletedAt: null } });
    return count > 0;
  }

  async updateOwnedSubmission(id: number, studentId: number, data: Omit<CreateSubmissionInput, "referenceCode">): Promise<Submission> {
    let existing: { id: number } | null = null;

    try {
      existing = await prisma.submission.findFirst({
        where: { id, studentId, deletedAt: null },
        select: { id: true },
      });
    } catch (error) {
      if (isMissingSubmissionOwnershipColumnError(error)) {
        throw new Error("Database migration required before editing owned submissions.");
      }
      throw error;
    }

    if (!existing) {
      throw new Error("Submission not found");
    }

    const { writeData } = buildSubmissionWriteData(data);
    const submission = await prisma.submission.update({
      where: { id },
      data: writeData,
    });

    return this.map(submission);
  }

  async updatePresentation(id: number, data: {
    description?: string;
    repoUrl?: string | null;
    websiteUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    linkedinUrl?: string | null;
    githubUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    bannerUrl?: string | null;
  }): Promise<Submission> {
    const updateData: {
      description?: string;
      repoUrl?: string | null;
      websiteUrl?: string | null;
      instagramUrl?: string | null;
      facebookUrl?: string | null;
      linkedinUrl?: string | null;
      githubUrl?: string | null;
      primaryColor?: string;
      secondaryColor?: string;
      bannerUrl?: string | null;
    } = {};

    if (data.description !== undefined) updateData.description = data.description;
    if (data.repoUrl !== undefined) updateData.repoUrl = data.repoUrl;
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
    if (data.instagramUrl !== undefined) updateData.instagramUrl = data.instagramUrl;
    if (data.facebookUrl !== undefined) updateData.facebookUrl = data.facebookUrl;
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
    if (data.githubUrl !== undefined) updateData.githubUrl = data.githubUrl;
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
    await prisma.submission.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletionReason: "Removida/desativada administrativamente. Interações e certificados históricos preservados.",
        isWinner: false,
        winnerSelectedAt: null,
      },
    });
  }

  async assignOwnershipByPhone(studentId: number, studentNumber: string, phone?: string | null): Promise<number> {
    const normalizedPhone = normalizeAngolaPhone(phone);
    if (!normalizedPhone) return 0;

    const matchingStudents = await prisma.student.findMany({
      where: { phone: normalizedPhone },
      select: { id: true },
    });

    if (matchingStudents.length !== 1 || matchingStudents[0]?.id !== studentId) {
      return 0;
    }

    try {
      const result = await prisma.submission.updateMany({
        where: {
          studentId: null,
          leaderPhone: normalizedPhone,
        },
        data: {
          studentId,
          studentNumberSnapshot: studentNumber,
        },
      });

      return result.count;
    } catch (error) {
      if (isMissingSubmissionOwnershipColumnError(error)) {
        return 0;
      }
      throw error;
    }
  }

  private async nextReference() {
    const latest = await prisma.submission.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    const seq = (latest?.id ?? 0) + 1;
    return `UOR-2026-${seq.toString().padStart(4, "0")}`;
  }

  private map = (submission: SubmissionRecord): Submission => ({
    ...submission,
    members: normalizeTeamMembersInput(submission.members),
    teamSize: countTeamMembers(submission.members),
    needs: parseNeeds(submission.needs),
    leaderEmail: isSyntheticLeaderEmail(submission.leaderEmail) ? null : submission.leaderEmail,
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
