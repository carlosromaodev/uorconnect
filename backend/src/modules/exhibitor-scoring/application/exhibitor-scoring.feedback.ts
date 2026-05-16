import { prisma } from "../../../shared/prisma";
import { getExhibitorScoreConfig } from "./exhibitor-scoring.admin";
import { recordExhibitorScoreAdjustment } from "./exhibitor-scoring.service";

type FeedbackReviewAction = "APPROVE" | "REJECT" | "REVOKE";

type ReviewQualifiedFeedbackFromCommentInput = {
  commentId: number;
  eventKey?: string;
  action: FeedbackReviewAction;
  actorStudentNumber?: string | null;
  note: string;
};

function normalizeNote(value: string) {
  const note = value.trim();
  if (note.length < 3) {
    throw new Error("Feedback review note is required");
  }
  return note;
}

function assertQualifiedFeedback(content: string) {
  if (content.trim().length < 20) {
    throw new Error("Feedback qualificado precisa de pelo menos 20 caracteres.");
  }
}

export async function reviewQualifiedFeedbackFromComment(
  input: ReviewQualifiedFeedbackFromCommentInput,
) {
  const eventKey = input.eventKey ?? "main-event";
  const note = normalizeNote(input.note);
  const reviewedAt = new Date();
  const comment = await prisma.studentComment.findUnique({
    where: { id: input.commentId },
    include: {
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
        },
      },
      submission: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          type: true,
          area: true,
        },
      },
    },
  });

  if (!comment) {
    throw new Error("Project comment not found");
  }

  if (comment.submission.status !== "APPROVED" || comment.submission.deletedAt) {
    throw new Error("Submission not eligible for feedback scoring");
  }

  if (input.action === "APPROVE") {
    assertQualifiedFeedback(comment.content);
    const existingScoredFeedback = await prisma.studentComment.findFirst({
      where: {
        id: { not: comment.id },
        studentId: comment.studentId,
        submissionId: comment.submissionId,
        moderationStatus: "APPROVED",
        feedbackScoredAt: { not: null },
      },
      select: { id: true },
    });

    if (existingScoredFeedback) {
      await prisma.studentComment.update({
        where: { id: comment.id },
        data: {
          moderationStatus: "APPROVED",
          feedbackReviewedAt: reviewedAt,
          feedbackReviewedByStudentNumber: input.actorStudentNumber ?? null,
          feedbackReviewNote: note,
          feedbackScoredAt: null,
        },
      });

      return {
        success: true as const,
        action: "APPROVE" as const,
        scoreDelta: 0,
        score: 0,
        scoringEvents: [],
        duplicateOfCommentId: existingScoredFeedback.id,
      };
    }

    const config = await getExhibitorScoreConfig(eventKey);
    const points = config.weights.qualifiedFeedback;
    const result = await recordExhibitorScoreAdjustment({
      submissionId: comment.submissionId,
      eventKey,
      action: "QUALIFIED_FEEDBACK",
      sourceType: "STUDENT_COMMENT",
      sourceId: String(comment.id),
      studentId: comment.studentId,
      points,
      reason: note,
      createdByStudentNumber: input.actorStudentNumber ?? null,
      metadata: {
        moderationAction: "APPROVE",
        studentNumber: comment.student.studentNumber,
        studentName: comment.student.name,
        studentCourse: comment.student.course,
        submissionName: comment.submission.name,
      },
    });

    await prisma.studentComment.update({
      where: { id: comment.id },
      data: {
        moderationStatus: "APPROVED",
        feedbackReviewedAt: reviewedAt,
        feedbackReviewedByStudentNumber: input.actorStudentNumber ?? null,
        feedbackReviewNote: note,
        feedbackScoredAt: comment.feedbackScoredAt ?? reviewedAt,
      },
    });

    return {
      success: true as const,
      action: "APPROVE" as const,
      scoreDelta: result.scoreDelta,
      score: result.score,
      scoringEvents: result.scoringEvents,
    };
  }

  if (input.action === "REJECT") {
    await prisma.studentComment.update({
      where: { id: comment.id },
      data: {
        moderationStatus: "REJECTED",
        feedbackReviewedAt: reviewedAt,
        feedbackReviewedByStudentNumber: input.actorStudentNumber ?? null,
        feedbackReviewNote: note,
      },
    });

    return {
      success: true as const,
      action: "REJECT" as const,
      revokedEvents: 0,
      scoreDelta: 0,
    };
  }

  const businessKey = `score-adjustment:${eventKey}:${comment.submissionId}:QUALIFIED_FEEDBACK:STUDENT_COMMENT:${comment.id}`;
  const revoked = await prisma.exhibitorScoreEvent.updateMany({
    where: {
      businessKey,
      revokedAt: null,
    },
    data: {
      revokedAt: reviewedAt,
      revokedByStudentNumber: input.actorStudentNumber ?? null,
      revokeReason: note,
    },
  });
  await prisma.studentComment.update({
    where: { id: comment.id },
    data: {
      moderationStatus: "REVOKED",
      feedbackReviewedAt: reviewedAt,
      feedbackReviewedByStudentNumber: input.actorStudentNumber ?? null,
      feedbackReviewNote: note,
    },
  });

  return {
    success: true as const,
    action: "REVOKE" as const,
    revokedEvents: revoked.count,
    scoreDelta: revoked.count > 0 ? -2 : 0,
  };
}
