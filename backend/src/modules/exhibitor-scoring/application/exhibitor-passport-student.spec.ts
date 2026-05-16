import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStudentExhibitorPassportSummary } from "./exhibitor-passport-student";

const prismaMock = vi.hoisted(() => ({
  submission: {
    findMany: vi.fn(),
  },
  exhibitorScoreConfig: {
    findFirst: vi.fn(),
  },
  exhibitorScoreEvent: {
    findMany: vi.fn(),
  },
  studentVote: {
    groupBy: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

const submission = {
  id: 77,
  referenceCode: "UOR-2026-ABC",
  name: "Smart Campus",
  type: "PROJECT",
  status: "APPROVED",
  area: "Tecnologia",
  course: "Engenharia Informática",
  primaryColor: "#FD8305",
  secondaryColor: "#223D42",
  studentId: 12,
  memberConfirmations: [
    {
      id: 501,
      name: "Ana UOR",
      studentId: 12,
      studentNumber: "20240012",
      expectedStudentNumber: "20240012",
      confirmedAt: new Date("2026-05-14T08:00:00.000Z"),
      isExternal: false,
    },
    {
      id: 502,
      name: "Bruno UOR",
      studentId: 13,
      studentNumber: "20240013",
      expectedStudentNumber: "20240013",
      confirmedAt: new Date("2026-05-14T08:10:00.000Z"),
      isExternal: false,
    },
  ],
};

const rankingEvents = [
  {
    submissionId: 77,
    action: "STUDENT_VOTE",
    points: 2,
    voterCourse: "Gestão",
    submission,
  },
  {
    submissionId: 77,
    action: "FIRST_COURSE_VOTE_BONUS",
    points: 3,
    voterCourse: "Gestão",
    submission,
  },
  {
    submissionId: 77,
    action: "OTHER_UNIVERSITY_VOTE_BONUS",
    points: 3,
    sourceType: "STUDENT_VOTE",
    sourceId: "4001:OTHER_UNIVERSITY",
    reason: "Voto de outra universidade/instituição",
    voterCourse: "Gestão",
    submission,
  },
  {
    submissionId: 77,
    action: "STAND_BONUS",
    points: 5,
    sourceType: "STAND_ACTIVE",
    sourceId: "501:r1:STAND_ACTIVE",
    reason: "Stand ativo com 2 expositores.",
    voterCourse: null,
    submission,
  },
  {
    submissionId: 77,
    action: "AMBASSADOR_MISSION",
    points: 15,
    sourceType: "MISSION",
    sourceId: "501:r1:AMBASSADOR_COURSE_EXPLORER",
    reason: "Missão Explorador de Cursos concluída.",
    voterCourse: "Direito",
    submission,
  },
  {
    submissionId: 77,
    action: "PENALTY",
    points: -5,
    sourceType: "ADMIN_ADJUSTMENT",
    sourceId: "penalty-1",
    reason: "Atraso no stand.",
    voterCourse: null,
    submission,
  },
];

const ledgerEvents = rankingEvents.map((event, index) => ({
  id: index + 1,
  businessKey: `event-${index + 1}`,
  eventKey: "uor-2026",
  submissionId: event.submissionId,
  action: event.action,
  sourceType: event.sourceType ?? event.action,
  sourceId: event.sourceId ?? String(index + 1),
  role: event.action === "PENALTY" ? "ADMIN" : "EXPOSITOR",
  roundKey: "r1",
  roundLabel: "Ronda 1",
  voterCourse: event.voterCourse,
  basePoints: event.points,
  bonusPoints: 0,
  multiplier: 1,
  points: event.points,
  status: "VALID",
  reason: event.reason ?? "Evento de pontuação.",
  metadataJson: "{}",
  awardedAt: new Date(`2026-05-14T10:0${index}:00.000Z`),
  submission: {
    id: submission.id,
    name: submission.name,
    course: submission.course,
    type: submission.type,
    area: submission.area,
  },
}));

describe("student exhibitor passport summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T07:37:00.000Z"));
    prismaMock.submission.findMany.mockResolvedValue([submission]);
    prismaMock.exhibitorScoreConfig.findFirst.mockResolvedValue({
      version: 3,
      weightsJson: "{}",
      streakBonusesJson: JSON.stringify([
        { minCourses: 4, points: 10 },
        { minCourses: 6, points: 20 },
        { minCourses: 8, points: 35 },
        { minCourses: 10, points: 55 },
      ]),
      roundsJson: JSON.stringify([
        {
          key: "r1",
          label: "Aquecimento",
          multiplier: 1,
          startsAt: "2026-05-15T07:00:00.000Z",
          endsAt: "2026-05-15T07:45:00.000Z",
          status: "ACTIVE",
        },
        {
          key: "r2",
          label: "Sprint das turmas",
          multiplier: 1.5,
          startsAt: "2026-05-15T07:45:00.000Z",
          endsAt: "2026-05-15T08:30:00.000Z",
          status: "ACTIVE",
        },
        {
          key: "r3",
          label: "Sprint final",
          multiplier: 2,
          startsAt: "2026-05-15T08:30:00.000Z",
          endsAt: "2026-05-15T09:00:00.000Z",
          status: "ACTIVE",
        },
      ]),
    });
    prismaMock.exhibitorScoreEvent.findMany
      .mockResolvedValueOnce(rankingEvents)
      .mockResolvedValueOnce(ledgerEvents);
    prismaMock.studentVote.groupBy.mockResolvedValue([
      { submissionId: 77, _count: { _all: 2 } },
    ]);
  });

  it("builds a visible exhibitor passport from the student's approved project", async () => {
    const summary = await getStudentExhibitorPassportSummary({
      studentId: 12,
      eventKey: "uor-2026",
    });

    expect(prismaMock.submission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "APPROVED",
        OR: expect.any(Array),
      }),
    }));
    expect(summary.hasExhibitorPassport).toBe(true);
    expect(summary.roundFlow).toEqual(expect.objectContaining({
      currentRoundKey: "r1",
      currentMultiplier: 1,
      minutesRemaining: 8,
      streakTargets: [
        { minCourses: 4, points: 10, label: "4 cursos" },
        { minCourses: 6, points: 20, label: "6 cursos" },
        { minCourses: 8, points: 35, label: "8 cursos" },
        { minCourses: 10, points: 55, label: "10 cursos" },
      ],
    }));
    expect(summary.roundFlow?.items).toEqual([
      expect.objectContaining({
        key: "r1",
        label: "Aquecimento",
        phase: "current",
        multiplier: 1,
        progressPercent: 82,
        minutesRemaining: 8,
      }),
      expect.objectContaining({
        key: "r2",
        label: "Sprint das turmas",
        phase: "next",
        multiplier: 1.5,
        startsInMinutes: 8,
      }),
      expect.objectContaining({
        key: "r3",
        label: "Sprint final",
        phase: "upcoming",
        multiplier: 2,
      }),
    ]);
    expect(summary.activeProject).toEqual(expect.objectContaining({
      submissionId: 77,
      name: "Smart Campus",
      score: 23,
      ranking: {
        position: 1,
        totalProjects: 1,
        points: 23,
      },
      teamConfirmedMembers: 2,
      teamTotalMembers: 2,
    }));
    expect(summary.activeProject?.teamActivity).toEqual([
      expect.objectContaining({
        memberId: 501,
        name: "Ana UOR",
        role: "RESPONSAVEL",
        points: 20,
        actions: 2,
        positiveActions: 2,
        penalties: 0,
        level: "Prata",
        lastActivityAt: "2026-05-14T10:04:00.000Z",
      }),
      expect.objectContaining({
        memberId: 502,
        name: "Bruno UOR",
        role: "MEMBRO",
        points: 0,
        actions: 0,
        level: "Sem movimento",
      }),
    ]);
    expect(summary.activeProject?.missions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "project-approved", status: "done" }),
      expect.objectContaining({ key: "team-confirmed", status: "done" }),
      expect.objectContaining({ key: "stand-active", status: "done", pointsEarned: 5 }),
      expect.objectContaining({ key: "first-course", status: "done", pointsEarned: 3 }),
      expect.objectContaining({ key: "inter-university-vote", status: "done", pointsEarned: 3 }),
      expect.objectContaining({ key: "course-explorer", status: "done", pointsEarned: 15 }),
      expect.objectContaining({ key: "fast-converter", status: "locked" }),
    ]));
    expect(summary.activeProject?.missions.length).toBeGreaterThanOrEqual(24);
    expect(summary.activeProject?.badges).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "team-ready", earned: true }),
      expect.objectContaining({ key: "course-explorer", earned: true }),
      expect.objectContaining({ key: "clean-round", earned: false }),
    ]));
    expect(summary.activeProject?.continuousActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "valid-votes",
        title: "Conseguir votos válidos",
        pointsLabel: "+1/+2 por voto",
        completedCount: 1,
        pointsEarned: 2,
      }),
      expect.objectContaining({
        key: "new-courses",
        title: "Alcançar cursos novos",
        pointsLabel: "+3 por curso novo",
        completedCount: 1,
        pointsEarned: 3,
      }),
      expect.objectContaining({
        key: "other-universities",
        title: "Atrair outras instituições",
        pointsLabel: "+3 por voto externo",
        completedCount: 1,
        pointsEarned: 3,
      }),
      expect.objectContaining({
        key: "avoid-penalties",
        status: "attention",
      }),
    ]));
    expect(summary.activeProject?.bonusOpportunities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "ambassador-fast-converter",
        title: "Conversor Rápido",
        pointsLabel: "+8 pts",
      }),
      expect.objectContaining({
        key: "member-levels",
        title: "Níveis dos membros",
      }),
      expect.objectContaining({
        key: "team-bronze",
        title: "Equipa Bronze+",
      }),
      expect.objectContaining({
        key: "inter-university-streak",
        title: "Ponte entre universidades",
        pointsLabel: "bónus externo",
      }),
    ]));
    expect(summary.activeProject?.recentEvents[0]).toEqual(expect.objectContaining({
      businessKey: "event-6",
      points: -5,
      effect: "LOSS",
    }));
  });

  it("keeps the public round flow visible when the student has no eligible exhibitor project", async () => {
    prismaMock.submission.findMany.mockResolvedValue([]);
    prismaMock.exhibitorScoreEvent.findMany.mockReset();
    prismaMock.studentVote.groupBy.mockReset();

    const summary = await getStudentExhibitorPassportSummary({
      studentId: 12,
      eventKey: "uor-2026",
    });

    expect(summary).toEqual({
      eventKey: "uor-2026",
      generatedAt: expect.any(String),
      hasExhibitorPassport: false,
      activeProject: null,
      projects: [],
      roundFlow: expect.objectContaining({
        currentRoundKey: "r1",
        currentMultiplier: 1,
        minutesRemaining: 8,
      }),
    });
  });

  it("uses a start-middle-final round map when the event has no configured rounds", async () => {
    prismaMock.exhibitorScoreConfig.findFirst.mockResolvedValueOnce({
      version: 3,
      weightsJson: "{}",
      streakBonusesJson: "[]",
      roundsJson: "[]",
    });

    const summary = await getStudentExhibitorPassportSummary({
      studentId: 12,
      eventKey: "uor-2026",
    });

    expect(summary.roundFlow).toEqual(expect.objectContaining({
      currentRoundKey: "default-start",
      currentLabel: "Início da atividade",
      currentMultiplier: 1,
      minutesRemaining: 83,
    }));
    expect(summary.roundFlow?.items).toEqual([
      expect.objectContaining({
        key: "default-start",
        label: "Início da atividade",
        phase: "current",
        multiplier: 1,
      }),
      expect.objectContaining({
        key: "default-middle",
        label: "Meio da atividade",
        phase: "next",
        multiplier: 1.5,
      }),
      expect.objectContaining({
        key: "default-final",
        label: "Fim da atividade",
        phase: "upcoming",
        multiplier: 2,
      }),
    ]);
  });

  it("does not mark Equipa Bronze+ as complete for unrelated team bonuses", async () => {
    const topConversionBonus = {
      id: 90,
      businessKey: "team-bonus:uor-2026:77:TOP_CONVERSIONS",
      eventKey: "uor-2026",
      submissionId: 77,
      action: "TEAM_BONUS",
      sourceType: "TEAM_MVP_BONUS",
      sourceId: "TOP_CONVERSIONS",
      role: "TEAM",
      roundKey: null,
      roundLabel: null,
      voterCourse: null,
      basePoints: 0,
      bonusPoints: 20,
      multiplier: 1,
      points: 20,
      status: "VALID",
      reason: "Bónus MVP: embaixador com mais conversões da equipa.",
      metadataJson: "{}",
      awardedAt: new Date("2026-05-14T11:00:00.000Z"),
      submission: {
        id: submission.id,
        name: submission.name,
        course: submission.course,
        type: submission.type,
        area: submission.area,
      },
    };
    prismaMock.exhibitorScoreEvent.findMany.mockReset();
    prismaMock.exhibitorScoreEvent.findMany
      .mockResolvedValueOnce([topConversionBonus])
      .mockResolvedValueOnce([topConversionBonus]);

    const summary = await getStudentExhibitorPassportSummary({
      studentId: 12,
      eventKey: "uor-2026",
    });

    expect(summary.activeProject?.missions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "team-bronze", status: "locked" }),
    ]));
    expect(summary.activeProject?.bonusOpportunities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "team-bronze",
        completedCount: 0,
        status: "available",
      }),
    ]));
    expect(summary.activeProject?.bonusOpportunities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "team-mvp-conversions",
        completedCount: 1,
        pointsEarned: 20,
        status: "done",
      }),
    ]));
  });

  it("marks automatic zero-penalty bonuses as completed when the ledger award exists", async () => {
    const zeroPenaltyBonus = {
      id: 91,
      businessKey: "mission:uor-2026:77:project:ZERO_PENALTIES",
      eventKey: "uor-2026",
      submissionId: 77,
      action: "EXHIBITOR_MISSION",
      sourceType: "AUTO_MISSION",
      sourceId: "project:ZERO_PENALTIES",
      role: "EXPOSITOR",
      roundKey: null,
      roundLabel: null,
      voterCourse: null,
      basePoints: 0,
      bonusPoints: 10,
      multiplier: 1,
      points: 10,
      status: "VALID",
      reason: "Missão Zero Penalizações concluída automaticamente.",
      metadataJson: "{}",
      awardedAt: new Date("2026-05-14T11:05:00.000Z"),
      submission: {
        id: submission.id,
        name: submission.name,
        course: submission.course,
        type: submission.type,
        area: submission.area,
      },
    };
    prismaMock.exhibitorScoreEvent.findMany.mockReset();
    prismaMock.exhibitorScoreEvent.findMany
      .mockResolvedValueOnce([zeroPenaltyBonus])
      .mockResolvedValueOnce([zeroPenaltyBonus]);

    const summary = await getStudentExhibitorPassportSummary({
      studentId: 12,
      eventKey: "uor-2026",
    });

    expect(summary.activeProject?.bonusOpportunities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "zero-penalties",
        completedCount: 1,
        pointsEarned: 10,
        status: "done",
      }),
    ]));
    expect(summary.activeProject?.recentEvents[0]).toEqual(expect.objectContaining({
      businessKey: "mission:uor-2026:77:project:ZERO_PENALTIES",
      effect: "GAIN",
      points: 10,
    }));
  });
});
