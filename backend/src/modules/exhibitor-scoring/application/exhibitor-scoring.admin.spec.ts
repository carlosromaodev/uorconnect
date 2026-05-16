import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  awardExhibitorAutomaticMissions,
  awardExhibitorMemberLevels,
  awardExhibitorTeamBonuses,
  buildExhibitorScoreRankingPdfHtml,
  detectExhibitorScoringAlerts,
  exportExhibitorScoreRanking,
  exportExhibitorScoreRankingCsv,
  freezeExhibitorScoreRanking,
  getExhibitorAmbassadorRanking,
  recalculateUnlockedExhibitorScoreEvents,
  updateExhibitorScoreConfig,
} from "./exhibitor-scoring.admin";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((callback) => callback(prismaMock)),
  exhibitorScoreConfig: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  exhibitorScoreEvent: {
    updateMany: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  exhibitorScoreRankingFreeze: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  studentVote: {
    groupBy: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

describe("exhibitor scoring admin operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback) => callback(prismaMock));
    prismaMock.exhibitorScoreConfig.findFirst.mockResolvedValue({
      version: 1,
      weightsJson: "{}",
      streakBonusesJson: JSON.stringify([{ minCourses: 3, points: 10 }]),
      roundsJson: "[]",
    });
    prismaMock.exhibitorScoreConfig.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.exhibitorScoreConfig.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 2, ...data }),
    );
    prismaMock.exhibitorScoreEvent.updateMany.mockResolvedValue({ count: 42 });
    prismaMock.exhibitorScoreEvent.update.mockImplementation(({ data, where }) =>
      Promise.resolve({ id: where.id, ...data }),
    );
    prismaMock.exhibitorScoreEvent.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: 20, ...create }),
    );
    prismaMock.exhibitorScoreRankingFreeze.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.exhibitorScoreRankingFreeze.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 9, ...data, frozenAt: new Date("2026-05-14T12:00:00.000Z"), createdAt: new Date("2026-05-14T12:00:00.000Z") }),
    );
    prismaMock.studentVote.groupBy.mockResolvedValue([
      { submissionId: 1, _count: { _all: 3 } },
      { submissionId: 2, _count: { _all: 4 } },
    ]);
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 1,
        action: "STUDENT_VOTE",
        points: 4,
        basePoints: 2,
        bonusPoints: 0,
        multiplier: 2,
        status: "VALID",
        lockedAt: new Date("2026-05-14T12:00:00.000Z"),
        submission: {
          id: 1,
          name: "Projeto A",
          course: "Engenharia Informática",
          type: "PROJECT",
          area: "Tecnologia",
        },
      },
      {
        submissionId: 1,
        action: "FIRST_COURSE_VOTE_BONUS",
        points: 6,
        basePoints: 0,
        bonusPoints: 3,
        multiplier: 2,
        status: "VALID",
        lockedAt: new Date("2026-05-14T12:00:00.000Z"),
        submission: {
          id: 1,
          name: "Projeto A",
          course: "Engenharia Informática",
          type: "PROJECT",
          area: "Tecnologia",
        },
      },
      {
        submissionId: 2,
        action: "JURY_VOTE",
        points: 500,
        basePoints: 500,
        bonusPoints: 0,
        multiplier: 1,
        status: "VALID",
        lockedAt: new Date("2026-05-14T12:00:00.000Z"),
        submission: {
          id: 2,
          name: "Projeto B",
          course: "Gestão",
          type: "PROJECT",
          area: "Tecnologia",
        },
      },
    ]);
  });

  it("creates a new active config version and supersedes the previous one", async () => {
    const result = await updateExhibitorScoreConfig({
      eventKey: "uor-2026",
      weights: { juryVote: 300 },
      rounds: [
        {
          key: "final",
          label: "Sprint final",
          multiplier: 2,
          startsAt: "2026-05-15T10:00:00.000Z",
          endsAt: "2026-05-15T11:00:00.000Z",
          status: "ACTIVE",
        },
      ],
      createdByStudentNumber: "20240001",
    });

    expect(prismaMock.exhibitorScoreConfig.updateMany).toHaveBeenCalledWith({
      where: { eventKey: "uor-2026", active: true },
      data: {
        active: false,
        status: "SUPERSEDED",
        lockedAt: expect.any(Date),
      },
    });
    expect(prismaMock.exhibitorScoreConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventKey: "uor-2026",
        version: 2,
        active: true,
        status: "ACTIVE",
        createdByStudentNumber: "20240001",
      }),
    });
    expect(result.version).toBe(2);
    expect(result.weights.juryVote).toBe(300);
    expect(result.rounds?.[0].key).toBe("final");
  });

  it("locks all valid unlocked score events when freezing the ranking", async () => {
    const frozenAt = new Date("2026-05-14T12:00:00.000Z");

    const result = await freezeExhibitorScoreRanking({
      eventKey: "uor-2026",
      frozenAt,
      createdByStudentNumber: "20240001",
      reason: "Encerramento oficial",
    });

    expect(prismaMock.exhibitorScoreEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventKey: "uor-2026",
        status: "VALID",
        revokedAt: null,
        lockedAt: null,
      },
      data: {
        lockedAt: frozenAt,
      },
    });
    expect(prismaMock.exhibitorScoreRankingFreeze.updateMany).toHaveBeenCalledWith({
      where: { eventKey: "uor-2026", active: true },
      data: { active: false },
    });
    expect(prismaMock.exhibitorScoreRankingFreeze.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        active: true,
        eventKey: "uor-2026",
        note: "Encerramento oficial",
        frozenByStudentNumber: "20240001",
        snapshotJson: expect.stringContaining("\"projects\""),
      }),
    });
    expect(result).toEqual({
      freezeId: 9,
      eventKey: "uor-2026",
      frozenAt: frozenAt.toISOString(),
      lockedEvents: 42,
      totalProjects: 2,
    });
  });

  it("exports ranking ordered by score with action breakdown and vote counts", async () => {
    const result = await exportExhibitorScoreRanking({
      eventKey: "uor-2026",
      frozenOnly: true,
    });

    expect(prismaMock.exhibitorScoreEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventKey: "uor-2026",
        status: "VALID",
        revokedAt: null,
        lockedAt: { not: null },
      }),
    }));
    expect(prismaMock.studentVote.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        submissionId: { in: [1, 2] },
        eventKey: "uor-2026",
      },
    }));
    expect(result.projects).toEqual([
      expect.objectContaining({
        rank: 1,
        submissionId: 2,
        name: "Projeto B",
        score: 500,
        votes: 4,
        breakdown: { JURY_VOTE: 500 },
        courses: [],
      }),
      expect.objectContaining({
        rank: 2,
        submissionId: 1,
        name: "Projeto A",
        score: 10,
        votes: 3,
        breakdown: {
          STUDENT_VOTE: 4,
          FIRST_COURSE_VOTE_BONUS: 6,
        },
        courses: [],
      }),
    ]);
  });

  it("resolves ranking ties by jury points, course diversity, penalties, feedback and missions", async () => {
    prismaMock.studentVote.groupBy.mockResolvedValue([
      { submissionId: 1, _count: { _all: 3 } },
      { submissionId: 2, _count: { _all: 3 } },
      { submissionId: 3, _count: { _all: 3 } },
    ]);
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 1,
        action: "JURY_VOTE",
        points: 10,
        voterCourse: null,
        submission: { id: 1, name: "Projeto C", course: "Engenharia Informática", type: "PROJECT", area: "Tecnologia" },
      },
      {
        submissionId: 1,
        action: "QUALIFIED_FEEDBACK",
        points: 10,
        voterCourse: "Gestão",
        submission: { id: 1, name: "Projeto C", course: "Engenharia Informática", type: "PROJECT", area: "Tecnologia" },
      },
      {
        submissionId: 2,
        action: "STUDENT_VOTE",
        points: 8,
        voterCourse: "Gestão",
        submission: { id: 2, name: "Projeto A", course: "Gestão", type: "PROJECT", area: "Tecnologia" },
      },
      {
        submissionId: 2,
        action: "QUALIFIED_FEEDBACK",
        points: 12,
        voterCourse: "Direito",
        submission: { id: 2, name: "Projeto A", course: "Gestão", type: "PROJECT", area: "Tecnologia" },
      },
      {
        submissionId: 3,
        action: "STUDENT_VOTE",
        points: 15,
        voterCourse: "Gestão",
        submission: { id: 3, name: "Projeto B", course: "Medicina", type: "PROJECT", area: "Saúde" },
      },
      {
        submissionId: 3,
        action: "PENALTY",
        points: -5,
        voterCourse: null,
        submission: { id: 3, name: "Projeto B", course: "Medicina", type: "PROJECT", area: "Saúde" },
      },
      {
        submissionId: 3,
        action: "AMBASSADOR_MISSION",
        points: 10,
        voterCourse: null,
        submission: { id: 3, name: "Projeto B", course: "Medicina", type: "PROJECT", area: "Saúde" },
      },
    ]);

    const result = await exportExhibitorScoreRanking({
      eventKey: "uor-2026",
    });

    expect(result.projects.map((project) => project.name)).toEqual([
      "Projeto C",
      "Projeto A",
      "Projeto B",
    ]);
  });

  it("recalculates unlocked events and stores before/after metadata", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        id: 11,
        eventKey: "uor-2026",
        submissionId: 1,
        action: "STUDENT_VOTE",
        points: 2,
        basePoints: 2,
        bonusPoints: 0,
        multiplier: 1,
        voterCourse: "Gestão",
        submissionCourse: "Engenharia Informática",
        metadataJson: "{}",
        lockedAt: null,
        submission: {
          id: 1,
          name: "Projeto A",
          course: "Engenharia Informática",
          type: "PROJECT",
          area: "Tecnologia",
        },
      },
      {
        id: 12,
        eventKey: "uor-2026",
        submissionId: 1,
        action: "JURY_VOTE",
        points: 500,
        basePoints: 500,
        bonusPoints: 0,
        multiplier: 1,
        voterCourse: null,
        submissionCourse: "Engenharia Informática",
        metadataJson: "{}",
        lockedAt: null,
        submission: {
          id: 1,
          name: "Projeto A",
          course: "Engenharia Informática",
          type: "PROJECT",
          area: "Tecnologia",
        },
      },
    ]);
    prismaMock.exhibitorScoreConfig.findFirst.mockResolvedValue({
      version: 2,
      weightsJson: JSON.stringify({
        sameCourseVote: 1,
        differentCourseVote: 3,
        firstCourseVoteBonus: 3,
        qualifiedFeedback: 2,
        juryVote: 300,
        standVisit: 1,
        lightPenalty: -10,
        selfVoteAbusePenalty: -50,
      }),
      streakBonusesJson: "[]",
      roundsJson: "[]",
    });

    const result = await recalculateUnlockedExhibitorScoreEvents({
      eventKey: "uor-2026",
      actorStudentNumber: "20240001",
      reason: "Ajuste oficial dos pesos",
    });

    expect(prismaMock.exhibitorScoreEvent.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: expect.objectContaining({
        basePoints: 3,
        points: 3,
        scoreConfigVersion: 2,
        metadataJson: expect.stringContaining("Ajuste oficial dos pesos"),
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: expect.objectContaining({
        basePoints: 300,
        points: 300,
        scoreConfigVersion: 2,
      }),
    });
    expect(result).toEqual({
      eventKey: "uor-2026",
      scannedEvents: 2,
      changedEvents: 2,
      beforeTotal: 502,
      afterTotal: 303,
    });
  });

  it("awards Bronze, Silver and Gold member level bonuses from ledger stats", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "AMBASSADOR_MISSION",
        points: 5,
        voterCourse: "Gestão",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Bronze Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "STAND_VISIT",
        points: 1,
        voterCourse: "Direito",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Bronze Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "AMBASSADOR_MISSION",
        points: 5,
        voterCourse: "Gestão",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "EXHIBITOR_MISSION",
        points: 5,
        voterCourse: "Direito",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "AMBASSADOR_MISSION",
        points: 5,
        voterCourse: "Economia",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "EXHIBITOR_MISSION",
        points: 5,
        voterCourse: "Psicologia",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        submissionId: 77,
        submissionMemberId: 2,
        action: "STAND_VISIT",
        points: 1,
        voterCourse: ["Medicina", "Arquitetura", "Contabilidade", "Psicologia", "Economia"][index % 5],
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      })),
    ]);

    const result = await awardExhibitorMemberLevels({
      eventKey: "uor-2026",
      actorStudentNumber: "20240001",
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "member-level:uor-2026:77:1:BRONZE" },
      update: {},
      create: expect.objectContaining({
        action: "TEAM_BONUS",
        sourceType: "MEMBER_LEVEL",
        sourceId: "1:BRONZE",
        submissionMemberId: 1,
        bonusPoints: 5,
        points: 5,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "member-level:uor-2026:77:2:GOLD" },
      update: {},
      create: expect.objectContaining({
        action: "TEAM_BONUS",
        sourceType: "MEMBER_LEVEL",
        sourceId: "2:GOLD",
        submissionMemberId: 2,
        bonusPoints: 30,
        points: 30,
      }),
    });
    expect(result.awarded).toEqual([
      expect.objectContaining({ memberId: 1, level: "BRONZE", points: 5 }),
      expect.objectContaining({ memberId: 2, level: "GOLD", points: 30 }),
    ]);
  });

  it("awards only the upgrade delta when a member already has a lower level bonus", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "TEAM_BONUS",
        sourceType: "MEMBER_LEVEL",
        sourceId: "2:BRONZE",
        points: 5,
        voterCourse: null,
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "AMBASSADOR_MISSION",
        sourceType: "MISSION",
        sourceId: "m1",
        points: 5,
        voterCourse: "Gestão",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "EXHIBITOR_MISSION",
        sourceType: "MISSION",
        sourceId: "m2",
        points: 5,
        voterCourse: "Direito",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "AMBASSADOR_MISSION",
        sourceType: "MISSION",
        sourceId: "m3",
        points: 5,
        voterCourse: "Economia",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "EXHIBITOR_MISSION",
        sourceType: "MISSION",
        sourceId: "m4",
        points: 5,
        voterCourse: "Psicologia",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        submissionId: 77,
        submissionMemberId: 2,
        action: "STAND_VISIT",
        sourceType: "VISIT",
        sourceId: `visit-${index}`,
        points: 1,
        voterCourse: ["Medicina", "Arquitetura", "Contabilidade", "Psicologia", "Economia"][index % 5],
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Gold Member" },
      })),
    ]);

    const result = await awardExhibitorMemberLevels({
      eventKey: "uor-2026",
      actorStudentNumber: "20240001",
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "member-level:uor-2026:77:2:GOLD" },
      update: {},
      create: expect.objectContaining({
        action: "TEAM_BONUS",
        sourceType: "MEMBER_LEVEL",
        sourceId: "2:GOLD",
        submissionMemberId: 2,
        bonusPoints: 25,
        points: 25,
      }),
    });
    expect(result.awarded).toEqual([
      expect.objectContaining({ memberId: 2, level: "GOLD", points: 25 }),
    ]);
  });

  it("awards automatic stand and ambassador missions from ledger activity", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "EXHIBITOR_CHECK_IN",
        role: "EXPOSITOR",
        roundKey: "r1",
        points: 0,
        voterCourse: null,
        awardedAt: new Date("2026-05-15T09:00:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Expositor 1" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "EXHIBITOR_CHECK_IN",
        role: "EXPOSITOR",
        roundKey: "r1",
        points: 0,
        voterCourse: null,
        awardedAt: new Date("2026-05-15T09:01:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Expositor 2" },
      },
      ...["Gestão", "Direito", "Economia", "Medicina", "Arquitetura"].map((course, index) => ({
        submissionId: 77,
        submissionMemberId: 3,
        action: "STUDENT_VOTE",
        studentId: index < 2 ? 900 : 901 + index,
        role: "AMBASSADOR",
        roundKey: index < 3 ? "r1" : "r2",
        points: 2,
        voterCourse: course,
        awardedAt: new Date(`2026-05-15T09:0${index + 2}:00.000Z`),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 3, name: "Embaixador" },
      })),
      {
        submissionId: 77,
        submissionMemberId: 3,
        studentId: 900,
        action: "QUALIFIED_FEEDBACK",
        role: "AMBASSADOR",
        roundKey: "r1",
        points: 2,
        voterCourse: "Gestão",
        awardedAt: new Date("2026-05-15T09:05:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 3, name: "Embaixador" },
      },
    ]);

    const result = await awardExhibitorAutomaticMissions({
      eventKey: "uor-2026",
      actorStudentNumber: "20240001",
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "stand-active:uor-2026:77:r1" },
      update: {},
      create: expect.objectContaining({
        action: "STAND_BONUS",
        sourceType: "STAND_ACTIVE_ROUND",
        sourceId: "r1",
        bonusPoints: 5,
        points: 5,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "mission:uor-2026:77:3:r1:AMBASSADOR_COURSE_EXPLORER" },
      update: {},
      create: expect.objectContaining({
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: "3:r1:AMBASSADOR_COURSE_EXPLORER",
        submissionMemberId: 3,
        bonusPoints: 15,
        points: 15,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "mission:uor-2026:77:3:global:AMBASSADOR_MAX_DIVERSITY" },
      update: {},
      create: expect.objectContaining({
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: "3:global:AMBASSADOR_MAX_DIVERSITY",
        submissionMemberId: 3,
        bonusPoints: 25,
        points: 25,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "mission:uor-2026:77:3:r1:AMBASSADOR_FAST_CONVERTER" },
      update: {},
      create: expect.objectContaining({
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: "3:r1:AMBASSADOR_FAST_CONVERTER",
        submissionMemberId: 3,
        bonusPoints: 8,
        points: 8,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "mission:uor-2026:77:3:r1:AMBASSADOR_COMPLETE" },
      update: {},
      create: expect.objectContaining({
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: "3:r1:AMBASSADOR_COMPLETE",
        submissionMemberId: 3,
        bonusPoints: 12,
        points: 12,
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      eventKey: "uor-2026",
      scannedEvents: 8,
      awardedCount: 12,
      awardedPoints: 133,
    }));
  });

  it("awards team MVP bonuses from ambassador ranking and member levels", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "STUDENT_VOTE",
        sourceType: "STUDENT_VOTE",
        points: 2,
        voterCourse: "Gestão",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Ana" },
      },
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "STUDENT_VOTE",
        sourceType: "STUDENT_VOTE",
        points: 2,
        voterCourse: "Direito",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Ana" },
      },
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        points: 15,
        voterCourse: "Economia",
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Ana" },
      },
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "TEAM_BONUS",
        sourceType: "MEMBER_LEVEL",
        sourceId: "1:BRONZE",
        points: 5,
        voterCourse: null,
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Ana" },
      },
      {
        submissionId: 77,
        submissionMemberId: 2,
        action: "TEAM_BONUS",
        sourceType: "MEMBER_LEVEL",
        sourceId: "2:BRONZE",
        points: 5,
        voterCourse: null,
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 2, name: "Bruno" },
      },
    ]);

    const result = await awardExhibitorTeamBonuses({
      eventKey: "uor-2026",
      actorStudentNumber: "20240001",
    });

    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "team-bonus:uor-2026:77:TOP_CONVERSIONS" },
      update: {},
      create: expect.objectContaining({
        action: "TEAM_BONUS",
        sourceType: "TEAM_MVP_BONUS",
        sourceId: "TOP_CONVERSIONS",
        bonusPoints: 20,
        points: 20,
      }),
    });
    expect(prismaMock.exhibitorScoreEvent.upsert).toHaveBeenCalledWith({
      where: { businessKey: "team-bonus:uor-2026:77:TEAM_BRONZE_PLUS" },
      update: {},
      create: expect.objectContaining({
        action: "TEAM_BONUS",
        sourceType: "TEAM_MVP_BONUS",
        sourceId: "TEAM_BRONZE_PLUS",
        bonusPoints: 25,
        points: 25,
      }),
    });
    expect(result.awardedPoints).toBeGreaterThanOrEqual(45);
  });

  it("builds an internal ambassador ranking from member-attributed conversions", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "STUDENT_VOTE",
        sourceType: "STUDENT_VOTE",
        points: 2,
        voterCourse: "Gestão",
        roundKey: "r1",
        awardedAt: new Date("2026-05-15T09:00:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Ana" },
      },
      {
        submissionId: 77,
        submissionMemberId: 1,
        action: "QUALIFIED_FEEDBACK",
        sourceType: "STUDENT_COMMENT",
        points: 2,
        voterCourse: "Direito",
        roundKey: "r2",
        awardedAt: new Date("2026-05-15T10:00:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 1, name: "Ana" },
      },
      {
        submissionId: 88,
        submissionMemberId: 2,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        points: 15,
        voterCourse: "Economia",
        roundKey: "r1",
        awardedAt: new Date("2026-05-15T09:30:00.000Z"),
        submission: { id: 88, name: "Projeto B", course: "Gestão", type: "PROJECT", area: "Negócios" },
        submissionMember: { id: 2, name: "Bruno" },
      },
    ]);

    const result = await getExhibitorAmbassadorRanking({ eventKey: "uor-2026" });

    expect(result.members).toEqual([
      expect.objectContaining({
        rank: 1,
        memberId: 1,
        memberName: "Ana",
        submissionId: 77,
        conversions: 2,
        coursesReached: 2,
        missionPoints: 0,
        scoreContribution: 4,
        maxCourseStreak: 2,
        inactiveRounds: 0,
      }),
      expect.objectContaining({
        rank: 2,
        memberId: 2,
        memberName: "Bruno",
        submissionId: 88,
        conversions: 1,
        coursesReached: 1,
        missionPoints: 15,
        scoreContribution: 15,
        maxCourseStreak: 1,
        inactiveRounds: 1,
      }),
    ]);
  });

  it("detects suspicious scoring patterns for admin review", async () => {
    prismaMock.exhibitorScoreEvent.findMany.mockResolvedValue([
      ...Array.from({ length: 6 }, (_, index) => ({
        submissionId: 77,
        submissionMemberId: 3,
        action: "STUDENT_VOTE",
        points: 2,
        voterCourse: "Gestão",
        awardedAt: new Date(`2026-05-15T09:0${index}:00.000Z`),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: { id: 3, name: "Embaixador" },
      })),
      {
        submissionId: 77,
        submissionMemberId: null,
        action: "SELF_VOTE_ATTEMPT",
        points: 0,
        voterCourse: "Informática",
        awardedAt: new Date("2026-05-15T09:10:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: null,
      },
      {
        submissionId: 77,
        submissionMemberId: null,
        action: "QUALIFIED_FEEDBACK",
        sourceType: "STUDENT_COMMENT",
        sourceId: "comment-1",
        studentId: 10,
        points: 2,
        voterCourse: "Gestão",
        awardedAt: new Date("2026-05-15T09:11:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: null,
      },
      {
        submissionId: 77,
        submissionMemberId: null,
        action: "QUALIFIED_FEEDBACK",
        sourceType: "STUDENT_COMMENT",
        sourceId: "comment-2",
        studentId: 10,
        points: 2,
        voterCourse: "Gestão",
        awardedAt: new Date("2026-05-15T09:12:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: null,
      },
      {
        submissionId: 77,
        submissionMemberId: null,
        action: "STUDENT_VOTE",
        sourceType: "QR_SCAN",
        sourceId: "scan-1",
        points: 2,
        voterCourse: "Gestão",
        metadataJson: JSON.stringify({ outsideEventContext: true }),
        awardedAt: new Date("2026-05-15T09:13:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: null,
      },
      {
        submissionId: 77,
        submissionMemberId: null,
        action: "STUDENT_VOTE",
        status: "PENDING_REVIEW",
        points: 2,
        voterCourse: "Gestão",
        awardedAt: new Date("2026-05-15T09:14:00.000Z"),
        submission: { id: 77, name: "Projeto A", course: "Informática", type: "PROJECT", area: "Tecnologia" },
        submissionMember: null,
      },
    ]);

    const result = await detectExhibitorScoringAlerts({ eventKey: "uor-2026" });

    expect(result.alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "COURSE_CONCENTRATION",
        severity: "MEDIUM",
        submissionId: 77,
      }),
      expect.objectContaining({
        type: "SELF_VOTE_ATTEMPT",
        severity: "HIGH",
        submissionId: 77,
      }),
      expect.objectContaining({
        type: "MEMBER_BURST",
        severity: "MEDIUM",
        submissionId: 77,
        memberId: 3,
      }),
      expect.objectContaining({
        type: "REPEATED_FEEDBACK",
        severity: "MEDIUM",
        submissionId: 77,
      }),
      expect.objectContaining({
        type: "QR_OUTSIDE_CONTEXT",
        severity: "HIGH",
        submissionId: 77,
      }),
      expect.objectContaining({
        type: "PENDING_REVIEW_POINTS",
        severity: "MEDIUM",
        submissionId: 77,
      }),
    ]));
  });

  it("exports the scoring ranking as CSV", async () => {
    const csv = await exportExhibitorScoreRankingCsv({
      eventKey: "uor-2026",
      frozenOnly: true,
    });

    expect(csv).toContain("rank,submissionId,name,course,type,area,score,votes,breakdown");
    expect(csv).toContain("1,2,Projeto B,Gestão,PROJECT,Tecnologia,500,4");
  });

  it("builds a searchable PDF HTML report with tables and course summaries", async () => {
    const html = await buildExhibitorScoreRankingPdfHtml({
      eventKey: "uor-2026",
      frozenOnly: true,
    });

    expect(html).toContain("Ranking de Pontuação dos Projetos");
    expect(html).toContain("<table");
    expect(html).toContain("Projeto B");
    expect(html).toContain("Votos por curso");
  });
});
