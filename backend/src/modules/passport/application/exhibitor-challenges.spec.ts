import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrUpdateOwnedProjectChallenge } from "./passport.service";

const prismaMock = vi.hoisted(() => ({
  submission: {
    findFirst: vi.fn(),
  },
  passportMission: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  passportBadge: {
    upsert: vi.fn(),
  },
  qrAction: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  passportChallenge: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

describe("exhibitor passport challenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.passportMission.upsert.mockImplementation(({ create }) => Promise.resolve({ id: create.key === "exhibitor-challenge" ? 44 : 1, ...create }));
    prismaMock.passportBadge.upsert.mockImplementation(({ create }) => Promise.resolve({ id: 1, ...create }));
  });

  it("creates a pending exhibitor challenge for the authenticated owner's approved project", async () => {
    prismaMock.submission.findFirst.mockResolvedValue({
      id: 77,
      name: "Smart Campus",
      type: "PROJECT",
      status: "APPROVED",
      studentId: 12,
    });
    prismaMock.passportMission.findUnique.mockResolvedValue({ id: 44, key: "exhibitor-challenge", active: true });
    prismaMock.qrAction.findFirst.mockResolvedValue(null);
    prismaMock.qrAction.create.mockResolvedValue({
      id: 909,
      token: "qra_desafio",
      type: "EXHIBITOR_CHALLENGE",
      label: "Desafio: Smart Campus",
      active: false,
      targetId: 77,
      passportMissionId: 44,
    });
    prismaMock.passportChallenge.findFirst.mockResolvedValue(null);
    prismaMock.passportChallenge.create.mockResolvedValue({
      id: 3001,
      missionId: 44,
      qrActionId: 909,
      type: "EXHIBITOR_CHALLENGE",
      question: "Qual problema o projeto resolve?",
      optionsJson: JSON.stringify(["Filas", "Clima", "Trânsito"]),
      correctAnswerHash: "hash",
      explanation: null,
      maxAttempts: 2,
      active: false,
      startsAt: null,
      endsAt: null,
      createdByStudentNumber: "20240001",
      approvedAt: null,
      approvedByStudentNumber: null,
      createdAt: new Date("2026-05-10T08:00:00.000Z"),
      updatedAt: new Date("2026-05-10T08:00:00.000Z"),
    });

    const result = await createOrUpdateOwnedProjectChallenge({
      submissionId: 77,
      ownerStudentId: 12,
      ownerStudentNumber: "20240001",
      question: "Qual problema o projeto resolve?",
      options: ["Filas", "Clima", "Trânsito"],
      correctAnswer: "Filas",
      maxAttempts: 2,
    });

    expect(prismaMock.submission.findFirst).toHaveBeenCalledWith({
      where: { id: 77, studentId: 12, status: "APPROVED", deletedAt: null },
      select: { id: true, name: true, type: true, status: true, studentId: true },
    });
    expect(prismaMock.qrAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "EXHIBITOR_CHALLENGE",
        label: "Desafio: Smart Campus",
        targetId: 77,
        active: false,
        passportMissionId: 44,
      }),
    });
    expect(prismaMock.passportChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        missionId: 44,
        qrActionId: 909,
        type: "EXHIBITOR_CHALLENGE",
        question: "Qual problema o projeto resolve?",
        optionsJson: JSON.stringify(["Filas", "Clima", "Trânsito"]),
        maxAttempts: 2,
        active: false,
        createdByStudentNumber: "20240001",
        approvedAt: null,
        approvedByStudentNumber: null,
      }),
    });
    expect(result.status).toBe("PENDING_APPROVAL");
    expect(result.challenge.active).toBe(false);
  });

  it("rejects challenge creation for projects not owned by the student or not approved", async () => {
    prismaMock.submission.findFirst.mockResolvedValue(null);

    await expect(createOrUpdateOwnedProjectChallenge({
      submissionId: 77,
      ownerStudentId: 12,
      ownerStudentNumber: "20240001",
      question: "Pergunta?",
      options: ["A", "B"],
      correctAnswer: "A",
      maxAttempts: 1,
    })).rejects.toThrow("Projeto aprovado não encontrado para este expositor.");
  });
});
