import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reviewQualifiedFeedbackFromComment,
} from "./exhibitor-scoring.feedback";

const recordAdjustmentMock = vi.hoisted(() => vi.fn());
const getConfigMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((callback) => callback(prismaMock)),
  studentComment: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  exhibitorScoreEvent: {
    updateMany: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("./exhibitor-scoring.service", () => ({
  recordExhibitorScoreAdjustment: recordAdjustmentMock,
}));

vi.mock("./exhibitor-scoring.admin", () => ({
  getExhibitorScoreConfig: getConfigMock,
}));

const comment = {
  id: 91,
  content: "O projeto está bem explicado, tem impacto claro e a solução foi demonstrada com detalhes.",
  moderationStatus: "PENDING",
  feedbackScoredAt: null,
  studentId: 12,
  submissionId: 77,
  student: {
    id: 12,
    studentNumber: "20240012",
    name: "Ana UOR",
    course: "Gestão",
  },
  submission: {
    id: 77,
    name: "Smart Campus",
    status: "APPROVED",
    deletedAt: null,
    type: "PROJECT",
    area: "Tecnologia",
  },
};

describe("qualified feedback review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock));
    prismaMock.studentComment.findUnique.mockResolvedValue(comment);
    prismaMock.studentComment.findFirst.mockResolvedValue(null);
    prismaMock.studentComment.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...comment, ...data }),
    );
    prismaMock.exhibitorScoreEvent.updateMany.mockResolvedValue({ count: 1 });
    getConfigMock.mockResolvedValue({
      weights: { qualifiedFeedback: 2 },
    });
    recordAdjustmentMock.mockResolvedValue({
      accepted: true,
      message: "Evento de pontuação registado.",
      votesCount: 4,
      score: 20,
      scoreDelta: 2,
      scoringEvents: [{ action: "QUALIFIED_FEEDBACK", points: 2, reason: "Feedback qualificado aprovado" }],
    });
  });

  it("approves a qualified project comment and creates one score event", async () => {
    const result = await reviewQualifiedFeedbackFromComment({
      commentId: 91,
      action: "APPROVE",
      actorStudentNumber: "20240001",
      note: "Feedback útil para avaliação.",
    });

    expect(recordAdjustmentMock).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: 77,
      action: "QUALIFIED_FEEDBACK",
      sourceType: "STUDENT_COMMENT",
      sourceId: "91",
      studentId: 12,
      points: 2,
      reason: "Feedback útil para avaliação.",
      createdByStudentNumber: "20240001",
      metadata: expect.objectContaining({
        studentNumber: "20240012",
        moderationAction: "APPROVE",
      }),
    }));
    expect(prismaMock.studentComment.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: expect.objectContaining({
        moderationStatus: "APPROVED",
        feedbackReviewedByStudentNumber: "20240001",
        feedbackReviewNote: "Feedback útil para avaliação.",
        feedbackScoredAt: expect.any(Date),
      }),
    });
    expect(result.scoreDelta).toBe(2);
  });

  it("does not score repeated qualified feedback from the same student for the same project", async () => {
    prismaMock.studentComment.findFirst.mockResolvedValue({
      id: 44,
    });

    const result = await reviewQualifiedFeedbackFromComment({
      commentId: 91,
      action: "APPROVE",
      actorStudentNumber: "20240001",
      note: "Feedback aprovado sem pontuar por duplicação.",
    });

    expect(prismaMock.studentComment.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 91 },
        studentId: 12,
        submissionId: 77,
        moderationStatus: "APPROVED",
        feedbackScoredAt: { not: null },
      },
      select: { id: true },
    });
    expect(recordAdjustmentMock).not.toHaveBeenCalled();
    expect(prismaMock.studentComment.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: expect.objectContaining({
        moderationStatus: "APPROVED",
        feedbackReviewedByStudentNumber: "20240001",
        feedbackReviewNote: "Feedback aprovado sem pontuar por duplicação.",
        feedbackScoredAt: null,
      }),
    });
    expect(result).toEqual({
      success: true,
      action: "APPROVE",
      scoreDelta: 0,
      score: 0,
      scoringEvents: [],
      duplicateOfCommentId: 44,
    });
  });

  it("rejects short or empty feedback without scoring", async () => {
    prismaMock.studentComment.findUnique.mockResolvedValue({
      ...comment,
      content: "Bom.",
    });

    await expect(reviewQualifiedFeedbackFromComment({
      commentId: 91,
      action: "APPROVE",
      actorStudentNumber: "20240001",
      note: "Muito curto.",
    })).rejects.toThrow("Feedback qualificado precisa de pelo menos 20 caracteres.");

    expect(recordAdjustmentMock).not.toHaveBeenCalled();
  });

  it("revokes an approved feedback score event and keeps audit trail", async () => {
    prismaMock.studentComment.findUnique.mockResolvedValue({
      ...comment,
      moderationStatus: "APPROVED",
      feedbackScoredAt: new Date("2026-05-14T10:00:00.000Z"),
    });

    const result = await reviewQualifiedFeedbackFromComment({
      commentId: 91,
      action: "REVOKE",
      actorStudentNumber: "20240001",
      note: "Feedback revogado pela organização.",
    });

    expect(prismaMock.exhibitorScoreEvent.updateMany).toHaveBeenCalledWith({
      where: {
        businessKey: "score-adjustment:main-event:77:QUALIFIED_FEEDBACK:STUDENT_COMMENT:91",
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokedByStudentNumber: "20240001",
        revokeReason: "Feedback revogado pela organização.",
      },
    });
    expect(prismaMock.studentComment.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: expect.objectContaining({
        moderationStatus: "REVOKED",
        feedbackReviewNote: "Feedback revogado pela organização.",
      }),
    });
    expect(result).toEqual({
      success: true,
      action: "REVOKE",
      revokedEvents: 1,
      scoreDelta: -2,
    });
  });
});
