import { prisma } from "../../../shared/prisma";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import type { AdminVotesRepository } from "../use-cases/admin-votes";
import { isCompetitionEligible, normalizeSubmissionType } from "../../submission/domain/submission-policy";

export class PrismaAdminVotesRepository implements AdminVotesRepository {
  async listProjectSummaries() {
    const projects = await prisma.submission.findMany({
      include: {
        studentVotes: true,
        studentComments: true,
        reviews: true
      },
      orderBy: { createdAt: "desc" }
    });

    return projects
      .filter((submission) => isCompetitionEligible(submission.type, submission.area))
      .map((submission) => {
      const reviewCount = submission.reviews.length;
      const averageRating = reviewCount > 0
        ? submission.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
        : 0;

      return {
        id: submission.id,
        name: submission.name,
        type: normalizeSubmissionType(submission.type, submission.area),
        votes: submission.studentVotes.length,
        comments: submission.studentComments.length,
        averageRating: Number(averageRating.toFixed(1))
      };
    });
  }

  async listVotes() {
    const votes = await prisma.studentVote.findMany({
      include: {
        student: true,
        submission: true
      },
      orderBy: { createdAt: "desc" }
    });

    return votes
      .filter((vote) => isCompetitionEligible(vote.submission.type, vote.submission.area))
      .map((vote) => ({
      id: vote.id,
      studentId: vote.studentId,
      studentNumber: vote.student.studentNumber,
      studentName: normalizeStudentProfile(vote.student).name ?? null,
      studentEmail: vote.student.email ?? null,
      submissionId: vote.submissionId,
      submissionName: vote.submission.name,
      createdAt: vote.createdAt.toISOString()
    }));
  }
}
