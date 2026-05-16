import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordEmptyStandPenalty,
  recordExhibitorMemberDuty,
  recordExhibitorScoreAdjustment,
  recordJuryProjectVoteScore,
  recordStudentProjectVoteScore,
} from "./exhibitor-scoring.service";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((callback) => callback(prismaMock)),
  student: {
    findUnique: vi.fn(),
  },
  submission: {
    findFirst: vi.fn(),
  },
  submissionMember: {
    findFirst: vi.fn(),
  },
  studentVote: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  juryMember: {
    findUnique: vi.fn(),
  },
  exhibitorScoreEvent: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  exhibitorScoreConfig: {
    findFirst: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

const student = {
  id: 12,
  studentNumber: "20240012",
  name: "Ana UOR",
  course: "Gestão",
  email: "ana@uor.test",
  university: "Universidade Óscar Ribas",
  isUorStudent: true,
};

const submission = {
  id: 77,
  name: "Smart Campus",
  type: "PROJECT",
  status: "APPROVED",
  area: "Tecnologia",
  course: "Engenharia Informática",
  studentId: 99,
  studentNumberSnapshot: "20240099",
  student: {
    id: 99,
    university: "Universidade Óscar Ribas",
    isUorStudent: true,
  },
};

describe("recordStudentProjectVoteScore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock));
    prismaMock.student.findUnique.mockResolvedValue(student);
    prismaMock.submission.findFirst.mockResolvedValue(submission);
    prismaMock.submissionMember.findFirst.mockResolvedValue(null);
    prismaMock.studentVote.findUnique.mockResolvedValue(null);
    prismaMock.juryMember.findUnique.mockResolvedValue({
      id: 501,
      name: "Júri Principal",
      phone: "+244900000000",
      isActive: true,
    });
    prismaMock.exhibitorScoreEvent.findUnique.mockResolvedValue(null);
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([]);
    prismaMock.exhibitorScoreConfig.findFirst.mockResolvedValue(null);
    prismaMock.studentVote.create.mockResolvedValue({
      id: 4001,
      studentId: student.id,
      submissionId: submission.id,
      createdAt: new Date("2026-05-14T10:05:00.000Z"),
    });
    prismaMock.studentVote.count.mockResolvedValue(8);
    prismaMock.exhibitorScoreEvent.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: Math.floor(Math.random() * 10_000), ...data }),
    );
    prismaMock.exhibitorScoreEvent.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: 9001, ...create }),
    );
    prismaMock.exhibitorScoreEvent.aggregate.mockResolvedValue({ _sum: { points: 5 } });
  });

  it("creates the vote and ledger events for a first vote from a different course", async () => {
    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      roundKey: "R4",
      roundLabel: "Sprint final",
      roundMultiplier: 2,
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.studentVote.create).toHaveBeenCalledWith({
      data: { studentId: student.id, submissionId: submission.id, eventKey: "uor-2026" },
    });
    expect(prismaMock.exhibitorScoreEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessKey: "student-vote:uor-2026:77:12",
        action: "STUDENT_VOTE",
        sourceType: "STUDENT_VOTE",
        sourceId: "4001",
        submissionId: submission.id,
        studentId: student.id,
        voterCourse: "Gestão",
        submissionCourse: "Engenharia Informática",
        basePoints: 2,
        bonusPoints: 0,
        multiplier: 2,
        points: 4,
        scoreConfigVersion: 1,
        status: "VALID",
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "first-course-vote:uor-2026:77:gestao" },
      update: {},
      create: expect.objectContaining({
        action: "FIRST_COURSE_VOTE_BONUS",
        bonusPoints: 3,
        multiplier: 2,
        points: 6,
      }),
    });
    expect(result).toEqual({
      accepted: true,
      message: "Voto registado com pontuação do expositor.",
      votesCount: 8,
      score: 5,
      scoreDelta: 10,
      scoringEvents: [
        expect.objectContaining({ action: "STUDENT_VOTE", points: 4 }),
        expect.objectContaining({ action: "FIRST_COURSE_VOTE_BONUS", points: 6 }),
      ],
    });
  });

  it("adds a separate +3 bonus when a valid vote comes from another university", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      ...student,
      university: "ISPTEC",
      isUorStudent: false,
    });

    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      roundMultiplier: 2,
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "other-university-vote:uor-2026:77:12" },
      update: {},
      create: expect.objectContaining({
        action: "OTHER_UNIVERSITY_VOTE_BONUS",
        sourceType: "STUDENT_VOTE",
        sourceId: "4001",
        bonusPoints: 3,
        multiplier: 1,
        points: 3,
        reason: "Voto de outra universidade/instituição",
        metadataJson: expect.stringContaining("ISPTEC"),
      }),
    });
    expect(result.scoreDelta).toBe(13);
    expect(result.scoringEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "STUDENT_VOTE", points: 4 }),
      expect.objectContaining({ action: "FIRST_COURSE_VOTE_BONUS", points: 6 }),
      expect.objectContaining({ action: "OTHER_UNIVERSITY_VOTE_BONUS", points: 3 }),
    ]));
  });

  it("does not add the university bonus when voter and project belong to the same university", async () => {
    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessKey: "other-university-vote:uor-2026:77:12" },
      }),
    );
    expect(result.scoringEvents).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "OTHER_UNIVERSITY_VOTE_BONUS" }),
    ]));
  });

  it("checks duplicate votes by student, project and event edition", async () => {
    prismaMock.studentVote.findUnique.mockResolvedValue({
      id: 4001,
      studentId: student.id,
      submissionId: submission.id,
      eventKey: "uor-2026",
    });

    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.studentVote.findUnique).toHaveBeenCalledWith({
      where: {
        studentId_submissionId_eventKey: {
          studentId: student.id,
          submissionId: submission.id,
          eventKey: "uor-2026",
        },
      },
    });
    expect(prismaMock.studentVote.create).not.toHaveBeenCalled();
    expect(result.message).toBe("Voto já registado anteriormente.");
    expect(result.scoreDelta).toBe(0);
  });

  it("does not award first-course bonus when the voter course is not confirmed", async () => {
    prismaMock.student.findUnique.mockResolvedValue({
      ...student,
      course: null,
    });

    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.exhibitorScoreEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessKey: "student-vote:uor-2026:77:12",
        action: "STUDENT_VOTE",
        points: 2,
        voterCourse: null,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).not.toHaveBeenCalled();
    expect(result.scoreDelta).toBe(2);
    expect(result.scoringEvents).toHaveLength(1);
  });

  it("loads the active round multiplier from score config when no explicit multiplier is passed", async () => {
    prismaMock.exhibitorScoreConfig.findFirst.mockResolvedValue({
      version: 4,
      weightsJson: JSON.stringify({
        sameCourseVote: 1,
        differentCourseVote: 2,
        firstCourseVoteBonus: 3,
        qualifiedFeedback: 2,
        juryVote: 500,
        standVisit: 1,
        lightPenalty: -10,
        selfVoteAbusePenalty: -50,
      }),
      streakBonusesJson: JSON.stringify([{ minCourses: 3, points: 10 }]),
      roundsJson: JSON.stringify([
        {
          key: "final",
          label: "Sprint final",
          multiplier: 2,
          startsAt: "2026-05-14T10:00:00.000Z",
          endsAt: "2026-05-14T11:00:00.000Z",
          status: "ACTIVE",
        },
      ]),
    });

    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessKey: "student-vote:uor-2026:77:12",
        roundKey: "final",
        roundLabel: "Sprint final",
        multiplier: 2,
        points: 4,
        scoreConfigVersion: 4,
      }),
    });
    expect(result.scoreDelta).toBe(10);
  });

  it("creates streak bonus once when a new course reaches a configured milestone", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      { voterCourse: "Direito" },
      { voterCourse: "Gestão" },
      { voterCourse: "Engenharia Civil" },
      { voterCourse: "Arquitetura" },
    ]);

    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "streak:uor-2026:77:4" },
      update: {},
      create: expect.objectContaining({
        action: "TEAM_BONUS",
        sourceType: "COURSE_DIVERSITY_STREAK",
        sourceId: "4",
        bonusPoints: 10,
        points: 10,
        reason: "Streak de diversidade: 4 cursos novos alcançados",
      }),
    });
    expect(result.scoringEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: "TEAM_BONUS",
        points: 10,
      }),
    ]));
    expect(result.scoreDelta).toBe(15);
  });

  it("blocks self votes and records a cancelled zero-point audit event", async () => {
    prismaMock.submission.findFirst.mockResolvedValue({
      ...submission,
      studentId: student.id,
      studentNumberSnapshot: student.studentNumber,
    });

    const result = await recordStudentProjectVoteScore({
      submissionId: submission.id,
      studentId: student.id,
      eventKey: "uor-2026",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.studentVote.create).not.toHaveBeenCalled();
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "self-vote-attempt:uor-2026:77:12" },
      update: {},
      create: expect.objectContaining({
        action: "SELF_VOTE_ATTEMPT",
        status: "CANCELLED",
        points: 0,
        reason: "Auto-voto anulado",
      }),
    });
    expect(result.accepted).toBe(false);
    expect(result.message).toBe("Auto-voto anulado. O voto não foi contabilizado.");
  });

  it("records jury votes as exclusive non-multiplied score events", async () => {
    const result = await recordJuryProjectVoteScore({
      submissionId: submission.id,
      juryId: 501,
      juryPhone: "+244900000000",
      eventKey: "uor-2026",
      roundMultiplier: 2,
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.studentVote.create).not.toHaveBeenCalled();
    expect(prismaMock.exhibitorScoreEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessKey: "jury-vote:uor-2026:77:501",
        action: "JURY_VOTE",
        sourceType: "JURY_VOTE",
        sourceId: "501",
        basePoints: 500,
        bonusPoints: 0,
        multiplier: 1,
        points: 500,
        status: "VALID",
      }),
    });
    expect(result).toEqual({
      accepted: true,
      message: "Voto de júri registado com pontuação do expositor.",
      votesCount: 8,
      score: 5,
      scoreDelta: 500,
      scoringEvents: [expect.objectContaining({ action: "JURY_VOTE", points: 500 })],
    });
  });

  it("records qualified feedback once using the source id as idempotency key", async () => {
    const result = await recordExhibitorScoreAdjustment({
      submissionId: submission.id,
      eventKey: "uor-2026",
      action: "QUALIFIED_FEEDBACK",
      sourceType: "STUDENT_COMMENT",
      sourceId: "comment-99",
      studentId: student.id,
      points: 2,
      reason: "Feedback claro e relacionado ao projeto.",
      createdByStudentNumber: "20240001",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "score-adjustment:uor-2026:77:QUALIFIED_FEEDBACK:STUDENT_COMMENT:comment-99" },
      update: {},
      create: expect.objectContaining({
        action: "QUALIFIED_FEEDBACK",
        sourceType: "STUDENT_COMMENT",
        sourceId: "comment-99",
        studentId: student.id,
        points: 2,
        status: "VALID",
        reason: "Feedback claro e relacionado ao projeto.",
      }),
    });
    expect(result.scoreDelta).toBe(2);
  });

  it("records admin penalties as non-multiplied negative score events", async () => {
    const result = await recordExhibitorScoreAdjustment({
      submissionId: submission.id,
      eventKey: "uor-2026",
      action: "PENALTY",
      sourceType: "ADMIN_ADJUSTMENT",
      sourceId: "penalty-1",
      points: -10,
      reason: "Stand sem representação na ronda.",
      createdByStudentNumber: "20240001",
      roundKey: "R1",
      roundLabel: "Ronda 1",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "score-adjustment:uor-2026:77:PENALTY:ADMIN_ADJUSTMENT:penalty-1" },
      update: {},
      create: expect.objectContaining({
        action: "PENALTY",
        sourceType: "ADMIN_ADJUSTMENT",
        sourceId: "penalty-1",
        basePoints: -10,
        bonusPoints: 0,
        multiplier: 1,
        points: -10,
        status: "VALID",
        reason: "Stand sem representação na ronda.",
      }),
    });
    expect(result.scoreDelta).toBe(-10);
  });

  it("records ambassador missions only once by mission source key", async () => {
    prismaMock.exhibitorScoreEvent.findUnique.mockResolvedValue({
      id: 9001,
      businessKey: "score-adjustment:uor-2026:77:AMBASSADOR_MISSION:MISSION:round-1-course-scout",
      points: 15,
    });

    const result = await recordExhibitorScoreAdjustment({
      submissionId: submission.id,
      eventKey: "uor-2026",
      action: "AMBASSADOR_MISSION",
      sourceType: "MISSION",
      sourceId: "round-1-course-scout",
      submissionMemberId: 801,
      points: 15,
      reason: "Explorador de cursos concluído.",
      createdByStudentNumber: "20240001",
      roundKey: "r1",
      roundLabel: "Ronda 1",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).not.toHaveBeenCalled();
    expect(result.message).toBe("Evento de pontuação já registado anteriormente.");
    expect(result.scoreDelta).toBe(0);
  });

  it("records an empty stand penalty when a round has no active exhibitor", async () => {
    const result = await recordEmptyStandPenalty({
      submissionId: submission.id,
      eventKey: "uor-2026",
      roundKey: "r2",
      roundLabel: "Ronda 2",
      createdByStudentNumber: "20240001",
      awardedAt: new Date("2026-05-14T11:00:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "stand-empty-penalty:uor-2026:77:r2" },
      update: {},
      create: expect.objectContaining({
        action: "PENALTY",
        sourceType: "STAND_EMPTY",
        sourceId: "r2",
        roundKey: "r2",
        roundLabel: "Ronda 2",
        basePoints: -10,
        bonusPoints: 0,
        multiplier: 1,
        points: -10,
        status: "VALID",
        reason: "Stand sem expositor ativo na ronda.",
      }),
    });
    expect(result.scoreDelta).toBe(-10);
  });

  it("does not penalize an empty stand check when an exhibitor is active", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionMemberId: 801,
        action: "EXHIBITOR_CHECK_IN",
        role: "EXPOSITOR",
        awardedAt: new Date("2026-05-14T10:00:00.000Z"),
      },
    ]);

    const result = await recordEmptyStandPenalty({
      submissionId: submission.id,
      eventKey: "uor-2026",
      roundKey: "r2",
      roundLabel: "Ronda 2",
      createdByStudentNumber: "20240001",
      awardedAt: new Date("2026-05-14T11:00:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).not.toHaveBeenCalled();
    expect(result.message).toBe("Stand com expositor ativo; penalização não aplicada.");
    expect(result.scoreDelta).toBe(0);
  });

  it("records member check-in as an audit-only duty event", async () => {
    prismaMock.submissionMember.findFirst.mockResolvedValue({
      id: 801,
      submissionId: submission.id,
      studentId: student.id,
      studentNumber: student.studentNumber,
      name: "Ana UOR",
      confirmedAt: new Date("2026-05-14T09:00:00.000Z"),
    });

    const result = await recordExhibitorMemberDuty({
      submissionId: submission.id,
      submissionMemberId: 801,
      eventKey: "uor-2026",
      action: "EXHIBITOR_CHECK_IN",
      role: "EXPOSITOR",
      roundKey: "r1",
      roundLabel: "Ronda 1",
      createdByStudentNumber: "20240001",
      awardedAt: new Date("2026-05-14T10:05:00.000Z"),
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "member-duty:uor-2026:77:801:r1:EXHIBITOR_CHECK_IN" },
      update: {},
      create: expect.objectContaining({
        action: "EXHIBITOR_CHECK_IN",
        role: "EXPOSITOR",
        sourceType: "MEMBER_DUTY",
        sourceId: "801:r1",
        submissionMemberId: 801,
        points: 0,
        status: "VALID",
      }),
    });
    expect(result.message).toBe("Função do membro registada.");
    expect(result.scoreDelta).toBe(0);
  });

  it("blocks a third simultaneous exhibitor in the same stand round", async () => {
    prismaMock.submissionMember.findFirst.mockResolvedValue({
      id: 803,
      submissionId: submission.id,
      studentId: 30,
      studentNumber: "20240030",
      name: "Terceiro Membro",
      confirmedAt: new Date("2026-05-14T09:00:00.000Z"),
    });
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionMemberId: 801,
        action: "EXHIBITOR_CHECK_IN",
        role: "EXPOSITOR",
        roundKey: "r1",
        awardedAt: new Date("2026-05-14T10:00:00.000Z"),
      },
      {
        submissionMemberId: 802,
        action: "EXHIBITOR_CHECK_IN",
        role: "EXPOSITOR",
        roundKey: "r1",
        awardedAt: new Date("2026-05-14T10:01:00.000Z"),
      },
    ]);

    await expect(recordExhibitorMemberDuty({
      submissionId: submission.id,
      submissionMemberId: 803,
      eventKey: "uor-2026",
      action: "EXHIBITOR_CHECK_IN",
      role: "EXPOSITOR",
      roundKey: "r1",
      createdByStudentNumber: "20240001",
    })).rejects.toThrow("Apenas 2 membros podem estar ativos no stand em simultâneo.");

    expect(prismaMock.exhibitorScoreEvent.upsert).not.toHaveBeenCalled();
  });
});
