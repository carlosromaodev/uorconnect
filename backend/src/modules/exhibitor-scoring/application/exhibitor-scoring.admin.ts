import { prisma } from "../../../shared/prisma";
import {
  DEFAULT_EXHIBITOR_SCORE_CONFIG,
  calculateExhibitorScoreEvent,
  normalizeScoreCourse,
  type ExhibitorScoreConfig,
} from "./exhibitor-scoring.rules";
import { parseStoredExhibitorScoreConfig, type ExhibitorScoreRound } from "./exhibitor-scoring.config";
import { escapeHtml } from "../../reports/http/pdf-report.utils";

type ScoreAdminDatabase = typeof prisma & {
  exhibitorScoreConfig: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
    create(args: unknown): Promise<Record<string, unknown>>;
  };
  exhibitorScoreEvent: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    update(args: unknown): Promise<Record<string, unknown>>;
    upsert(args: unknown): Promise<Record<string, unknown>>;
  };
  exhibitorScoreRankingFreeze: {
    updateMany(args: unknown): Promise<{ count: number }>;
    create(args: unknown): Promise<Record<string, unknown>>;
  };
  studentVote: {
    groupBy(args: unknown): Promise<Array<{ submissionId: number; _count: { _all: number } }>>;
  };
};

type UpdateExhibitorScoreConfigInput = {
  eventKey?: string;
  weights?: Partial<ExhibitorScoreConfig["weights"]>;
  streakBonuses?: ExhibitorScoreConfig["streakBonuses"];
  rounds?: ExhibitorScoreRound[];
  createdByStudentNumber?: string | null;
};

type FreezeExhibitorScoreRankingInput = {
  eventKey?: string;
  frozenAt?: Date;
  createdByStudentNumber?: string | null;
  reason?: string | null;
};

type ExportExhibitorScoreRankingInput = {
  eventKey?: string;
  frozenOnly?: boolean;
};

type RecalculateUnlockedExhibitorScoreEventsInput = {
  eventKey?: string;
  actorStudentNumber?: string | null;
  reason: string;
};

type AwardExhibitorMemberLevelsInput = {
  eventKey?: string;
  actorStudentNumber?: string | null;
  awardedAt?: Date;
};

type AwardExhibitorAutomaticMissionsInput = {
  eventKey?: string;
  actorStudentNumber?: string | null;
  awardedAt?: Date;
};

type AwardExhibitorTeamBonusesInput = {
  eventKey?: string;
  actorStudentNumber?: string | null;
  awardedAt?: Date;
};

type ExhibitorScoreEventListInput = {
  eventKey?: string;
};

function asScoreAdminDatabase(db = prisma): ScoreAdminDatabase {
  return db as ScoreAdminDatabase;
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJsonObject(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function getStoredActiveConfig(db: ScoreAdminDatabase, eventKey: string) {
  return db.exhibitorScoreConfig.findFirst({
    where: {
      eventKey,
      active: true,
    },
    orderBy: { version: "desc" },
    select: {
      version: true,
      weightsJson: true,
      streakBonusesJson: true,
      roundsJson: true,
    },
  });
}

function sanitizeWeights(input: Partial<ExhibitorScoreConfig["weights"]> | undefined) {
  if (!input) return {};
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value === "number" && Number.isFinite(value)),
  ) as Partial<ExhibitorScoreConfig["weights"]>;
}

export async function getExhibitorScoreConfig(eventKey = "main-event", db = prisma) {
  const stored = await getStoredActiveConfig(asScoreAdminDatabase(db), eventKey);
  return parseStoredExhibitorScoreConfig(stored as {
    version?: number | null;
    weightsJson?: string | null;
    streakBonusesJson?: string | null;
    roundsJson?: string | null;
  } | null);
}

export async function updateExhibitorScoreConfig(
  input: UpdateExhibitorScoreConfigInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const now = new Date();

  return asScoreAdminDatabase(db).$transaction(async (transactionClient: unknown) => {
    const tx = asScoreAdminDatabase(transactionClient as typeof prisma);
    const stored = await getStoredActiveConfig(tx, eventKey);
    const current = parseStoredExhibitorScoreConfig(stored as {
      version?: number | null;
      weightsJson?: string | null;
      streakBonusesJson?: string | null;
      roundsJson?: string | null;
    } | null);
    const nextConfig: ExhibitorScoreConfig = {
      version: current.version + 1,
      weights: {
        ...current.weights,
        ...sanitizeWeights(input.weights),
      },
      streakBonuses: input.streakBonuses?.length
        ? input.streakBonuses
        : current.streakBonuses,
      rounds: input.rounds ?? current.rounds ?? [],
    };

    await tx.exhibitorScoreConfig.updateMany({
      where: { eventKey, active: true },
      data: {
        active: false,
        status: "SUPERSEDED",
        lockedAt: now,
      },
    });

    const created = await tx.exhibitorScoreConfig.create({
      data: {
        eventKey,
        version: nextConfig.version,
        active: true,
        status: "ACTIVE",
        weightsJson: stringifyJson(nextConfig.weights),
        streakBonusesJson: stringifyJson(nextConfig.streakBonuses),
        roundsJson: stringifyJson(nextConfig.rounds ?? []),
        createdByStudentNumber: input.createdByStudentNumber ?? null,
      },
    });

    return parseStoredExhibitorScoreConfig(created as {
      version?: number | null;
      weightsJson?: string | null;
      streakBonusesJson?: string | null;
      roundsJson?: string | null;
    });
  });
}

export async function freezeExhibitorScoreRanking(
  input: FreezeExhibitorScoreRankingInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const frozenAt = input.frozenAt ?? new Date();
  const tx = asScoreAdminDatabase(db);
  const result = await tx.exhibitorScoreEvent.updateMany({
    where: {
      eventKey,
      status: "VALID",
      revokedAt: null,
      lockedAt: null,
    },
    data: {
      lockedAt: frozenAt,
    },
  });
  const snapshot = await exportExhibitorScoreRanking({ eventKey, frozenOnly: true }, db);

  await tx.exhibitorScoreRankingFreeze.updateMany({
    where: { eventKey, active: true },
    data: { active: false },
  });
  const freeze = await tx.exhibitorScoreRankingFreeze.create({
    data: {
      active: true,
      eventKey,
      note: input.reason?.trim() || null,
      frozenByStudentNumber: input.createdByStudentNumber ?? null,
      frozenAt,
      snapshotJson: stringifyJson(snapshot),
    },
  });

  return {
    freezeId: Number(freeze.id),
    eventKey,
    frozenAt: frozenAt.toISOString(),
    lockedEvents: result.count,
    totalProjects: snapshot.totalProjects,
  };
}

type RankingProject = {
  rank: number;
  submissionId: number;
  name: string;
  course: string | null;
  type: string;
  area: string;
  score: number;
  votes: number;
  breakdown: Record<string, number>;
  courses: Array<{
    course: string;
    points: number;
    events: number;
  }>;
};

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export async function exportExhibitorScoreRanking(
  input: ExportExhibitorScoreRankingInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const scoreEvents = await asScoreAdminDatabase(db).exhibitorScoreEvent.findMany({
    where: {
      eventKey,
      status: "VALID",
      revokedAt: null,
      ...(input.frozenOnly ? { lockedAt: { not: null } } : {}),
    },
    select: {
      submissionId: true,
      action: true,
      points: true,
      voterCourse: true,
      basePoints: true,
      bonusPoints: true,
      multiplier: true,
      status: true,
      lockedAt: true,
      submission: {
        select: {
          id: true,
          name: true,
          course: true,
          type: true,
          area: true,
        },
      },
    },
    orderBy: [
      { submissionId: "asc" },
      { awardedAt: "asc" },
    ],
  }) as Array<{
    submissionId: number;
    action: string;
    points: number;
    voterCourse?: string | null;
    submission?: {
      id: number;
      name: string;
      course: string | null;
      type: string;
      area: string;
    } | null;
  }>;
  const submissionIds = Array.from(new Set(scoreEvents.map((event) => event.submissionId)));
  const voteCounts = submissionIds.length
    ? await asScoreAdminDatabase(db).studentVote.groupBy({
      by: ["submissionId"],
      where: {
        submissionId: { in: submissionIds },
        eventKey,
      },
      _count: { _all: true },
    })
    : [];
  const votesBySubmissionId = new Map(voteCounts.map((item) => [item.submissionId, item._count._all]));
  const projectsBySubmissionId = new Map<number, Omit<RankingProject, "rank">>();

  for (const event of scoreEvents) {
    const submission = event.submission;
    if (!submission) continue;

    const current = projectsBySubmissionId.get(event.submissionId) ?? {
      submissionId: event.submissionId,
      name: submission.name,
      course: submission.course,
      type: submission.type,
      area: submission.area,
      score: 0,
      votes: votesBySubmissionId.get(event.submissionId) ?? 0,
      breakdown: {},
      courses: [],
    };

    current.score = roundScore(current.score + event.points);
    current.breakdown[event.action] = roundScore((current.breakdown[event.action] ?? 0) + event.points);
    const courseLabel = event.voterCourse?.trim();
    if (courseLabel) {
      const existingCourse = current.courses.find((course) => normalizeScoreCourse(course.course) === normalizeScoreCourse(courseLabel));
      if (existingCourse) {
        existingCourse.points = roundScore(existingCourse.points + event.points);
        existingCourse.events += 1;
      } else {
        current.courses.push({
          course: courseLabel,
          points: roundScore(event.points),
          events: 1,
        });
      }
      current.courses.sort((left, right) => right.points - left.points || left.course.localeCompare(right.course));
    }
    projectsBySubmissionId.set(event.submissionId, current);
  }

  const projects = Array.from(projectsBySubmissionId.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftJury = left.breakdown.JURY_VOTE ?? 0;
      const rightJury = right.breakdown.JURY_VOTE ?? 0;
      if (rightJury !== leftJury) return rightJury - leftJury;
      if (right.courses.length !== left.courses.length) return right.courses.length - left.courses.length;
      const leftPenalty = left.breakdown.PENALTY ?? 0;
      const rightPenalty = right.breakdown.PENALTY ?? 0;
      if (rightPenalty !== leftPenalty) return rightPenalty - leftPenalty;
      const leftFeedback = left.breakdown.QUALIFIED_FEEDBACK ?? 0;
      const rightFeedback = right.breakdown.QUALIFIED_FEEDBACK ?? 0;
      if (rightFeedback !== leftFeedback) return rightFeedback - leftFeedback;
      const leftMissions = (left.breakdown.AMBASSADOR_MISSION ?? 0) + (left.breakdown.EXHIBITOR_MISSION ?? 0);
      const rightMissions = (right.breakdown.AMBASSADOR_MISSION ?? 0) + (right.breakdown.EXHIBITOR_MISSION ?? 0);
      if (rightMissions !== leftMissions) return rightMissions - leftMissions;
      if (right.votes !== left.votes) return right.votes - left.votes;
      return left.name.localeCompare(right.name);
    })
    .map<RankingProject>((project, index) => ({
      rank: index + 1,
      ...project,
    }));

  return {
    eventKey,
    generatedAt: new Date().toISOString(),
    frozenOnly: Boolean(input.frozenOnly),
    totalProjects: projects.length,
    totalScore: roundScore(projects.reduce((sum, project) => sum + project.score, 0)),
    weights: DEFAULT_EXHIBITOR_SCORE_CONFIG.weights,
    projects,
  };
}

export async function exportExhibitorScoreRankingCsv(
  input: ExportExhibitorScoreRankingInput,
  db = prisma,
) {
  const ranking = await exportExhibitorScoreRanking(input, db);
  const rows = [
    ["rank", "submissionId", "name", "course", "type", "area", "score", "votes", "breakdown"],
    ...ranking.projects.map((project) => [
      project.rank,
      project.submissionId,
      project.name,
      project.course ?? "",
      project.type,
      project.area,
      project.score,
      project.votes,
      JSON.stringify(project.breakdown),
    ]),
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function calculateRecalculatedScoreEvent(input: {
  action: string;
  submissionCourse?: string | null;
  voterCourse?: string | null;
  multiplier: number;
  config: ExhibitorScoreConfig;
}) {
  if (input.action === "STUDENT_VOTE") {
    return calculateExhibitorScoreEvent({
      action: "STUDENT_VOTE",
      submissionCourse: input.submissionCourse,
      voterCourse: input.voterCourse,
      isFirstVoteFromCourse: false,
      roundMultiplier: input.multiplier,
      config: input.config,
    });
  }

  if (input.action === "JURY_VOTE") {
    return calculateExhibitorScoreEvent({
      action: "JURY_VOTE",
      submissionCourse: input.submissionCourse,
      voterCourse: input.voterCourse,
      config: input.config,
    });
  }

  if (input.action === "QUALIFIED_FEEDBACK") {
    return calculateExhibitorScoreEvent({
      action: "QUALIFIED_FEEDBACK",
      config: input.config,
    });
  }

  if (input.action === "PENALTY") {
    return calculateExhibitorScoreEvent({
      action: "PENALTY",
      config: input.config,
    });
  }

  if (input.action === "FIRST_COURSE_VOTE_BONUS") {
    const multiplier = Number.isFinite(input.multiplier) && input.multiplier > 0 ? input.multiplier : 1;
    const points = roundScore(input.config.weights.firstCourseVoteBonus * multiplier);
    return {
      action: "FIRST_COURSE_VOTE_BONUS" as const,
      basePoints: 0,
      bonusPoints: input.config.weights.firstCourseVoteBonus,
      multiplier,
      points,
      eligibleForRoundMultiplier: true,
      reason: "Primeiro voto vindo deste curso",
    };
  }

  if (input.action === "OTHER_UNIVERSITY_VOTE_BONUS") {
    return calculateExhibitorScoreEvent({
      action: "OTHER_UNIVERSITY_VOTE_BONUS",
      config: input.config,
    });
  }

  return null;
}

export async function recalculateUnlockedExhibitorScoreEvents(
  input: RecalculateUnlockedExhibitorScoreEventsInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new Error("Recalculation reason is required");
  }

  const tx = asScoreAdminDatabase(db);
  const storedConfig = await getStoredActiveConfig(tx, eventKey);
  const config = parseStoredExhibitorScoreConfig(storedConfig as {
    version?: number | null;
    weightsJson?: string | null;
    streakBonusesJson?: string | null;
    roundsJson?: string | null;
  } | null);
  const events = await tx.exhibitorScoreEvent.findMany({
    where: {
      eventKey,
      status: "VALID",
      revokedAt: null,
      lockedAt: null,
      action: {
        in: [
          "STUDENT_VOTE",
          "FIRST_COURSE_VOTE_BONUS",
          "OTHER_UNIVERSITY_VOTE_BONUS",
          "JURY_VOTE",
          "QUALIFIED_FEEDBACK",
          "PENALTY",
        ],
      },
    },
    select: {
      id: true,
      action: true,
      submissionId: true,
      voterCourse: true,
      submissionCourse: true,
      basePoints: true,
      bonusPoints: true,
      multiplier: true,
      points: true,
      metadataJson: true,
      submission: {
        select: {
          id: true,
          name: true,
          course: true,
          type: true,
          area: true,
        },
      },
    },
    orderBy: { awardedAt: "asc" },
  });
  let beforeTotal = 0;
  let afterTotal = 0;
  let changedEvents = 0;
  const recalculatedAt = new Date().toISOString();

  for (const event of events) {
    const previousPoints = Number(event.points ?? 0);
    beforeTotal = roundScore(beforeTotal + previousPoints);
    const recalculated = calculateRecalculatedScoreEvent({
      action: String(event.action),
      submissionCourse: event.submissionCourse as string | null | undefined,
      voterCourse: event.voterCourse as string | null | undefined,
      multiplier: Number(event.multiplier ?? 1),
      config,
    });

    if (!recalculated) {
      afterTotal = roundScore(afterTotal + previousPoints);
      continue;
    }

    afterTotal = roundScore(afterTotal + recalculated.points);
    const changed = roundScore(previousPoints) !== roundScore(recalculated.points)
      || Number(event.basePoints ?? 0) !== recalculated.basePoints
      || Number(event.bonusPoints ?? 0) !== recalculated.bonusPoints
      || Number(event.multiplier ?? 1) !== recalculated.multiplier;

    if (!changed) continue;

    changedEvents += 1;
    const metadata = parseJsonObject(event.metadataJson);
    const recalculationHistory = Array.isArray(metadata.recalculationHistory)
      ? metadata.recalculationHistory
      : [];

    await tx.exhibitorScoreEvent.update({
      where: { id: Number(event.id) },
      data: {
        basePoints: recalculated.basePoints,
        bonusPoints: recalculated.bonusPoints,
        multiplier: recalculated.multiplier,
        points: recalculated.points,
        reason: recalculated.reason,
        scoreConfigVersion: config.version,
        metadataJson: stringifyJson({
          ...metadata,
          recalculationHistory: [
            ...recalculationHistory,
            {
              recalculatedAt,
              actorStudentNumber: input.actorStudentNumber ?? null,
              reason,
              before: {
                points: previousPoints,
                basePoints: event.basePoints,
                bonusPoints: event.bonusPoints,
                multiplier: event.multiplier,
                scoreConfigVersion: metadata.scoreConfigVersion ?? null,
              },
              after: {
                points: recalculated.points,
                basePoints: recalculated.basePoints,
                bonusPoints: recalculated.bonusPoints,
                multiplier: recalculated.multiplier,
                scoreConfigVersion: config.version,
              },
            },
          ],
        }),
      },
    });
  }

  return {
    eventKey,
    scannedEvents: events.length,
    changedEvents,
    beforeTotal,
    afterTotal,
  };
}

const memberLevelRules = [
  {
    level: "GOLD",
    label: "Ouro",
    points: 30,
    minConversions: 10,
    minCourses: 5,
    minMissions: 4,
  },
  {
    level: "SILVER",
    label: "Prata",
    points: 15,
    minConversions: 5,
    minCourses: 3,
    minMissions: 2,
  },
  {
    level: "BRONZE",
    label: "Bronze",
    points: 5,
    minConversions: 2,
    minCourses: 1,
    minMissions: 1,
  },
] as const;

function isMissionAction(action: string) {
  return action === "AMBASSADOR_MISSION" || action === "EXHIBITOR_MISSION";
}

function isConversionAction(action: string) {
  return ![
    "EXHIBITOR_CHECK_IN",
    "EXHIBITOR_CHECK_OUT",
    "SELF_VOTE_ATTEMPT",
    "PENALTY",
    "TEAM_BONUS",
  ].includes(action);
}

type LedgerEventForAutomation = {
  businessKey?: string | null;
  studentId?: number | null;
  status?: string | null;
  submissionId: number;
  submissionMemberId?: number | null;
  action: string;
  sourceType?: string | null;
  sourceId?: string | null;
  role?: string | null;
  roundKey?: string | null;
  roundLabel?: string | null;
  points: number;
  voterCourse?: string | null;
  metadataJson?: string | null;
  awardedAt?: Date | string | null;
  submission?: { id: number; name: string; course: string | null; type: string; area: string } | null;
  submissionMember?: { id: number; name: string } | null;
};

async function loadLedgerEventsForMembers(
  eventKey: string,
  db: ScoreAdminDatabase,
  options?: { includePending?: boolean },
) {
  return db.exhibitorScoreEvent.findMany({
    where: {
      eventKey,
      status: options?.includePending ? { in: ["VALID", "PENDING_REVIEW"] } : "VALID",
      revokedAt: null,
    },
    select: {
      businessKey: true,
      studentId: true,
      status: true,
      submissionId: true,
      submissionMemberId: true,
      action: true,
      sourceType: true,
      sourceId: true,
      role: true,
      roundKey: true,
      roundLabel: true,
      points: true,
      voterCourse: true,
      metadataJson: true,
      awardedAt: true,
      submission: {
        select: {
          id: true,
          name: true,
          course: true,
          type: true,
          area: true,
        },
      },
      submissionMember: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { awardedAt: "asc" },
  }) as Promise<LedgerEventForAutomation[]>;
}

async function upsertAutomaticAward(input: {
  tx: ScoreAdminDatabase;
  eventKey: string;
  businessKey: string;
  submissionId: number;
  submissionMemberId?: number | null;
  sourceType: string;
  sourceId: string;
  action: string;
  role?: string | null;
  roundKey?: string | null;
  roundLabel?: string | null;
  points: number;
  reason: string;
  metadata: Record<string, unknown>;
  actorStudentNumber?: string | null;
  awardedAt: Date;
}) {
  await input.tx.exhibitorScoreEvent.upsert({
    where: { businessKey: input.businessKey },
    update: {},
    create: {
      businessKey: input.businessKey,
      eventKey: input.eventKey,
      submissionId: input.submissionId,
      submissionMemberId: input.submissionMemberId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      action: input.action,
      role: input.role ?? null,
      roundKey: input.roundKey ?? null,
      roundLabel: input.roundLabel ?? null,
      basePoints: 0,
      bonusPoints: input.points,
      multiplier: 1,
      points: input.points,
      status: "VALID",
      reason: input.reason,
      metadataJson: stringifyJson(input.metadata),
      scoreConfigVersion: DEFAULT_EXHIBITOR_SCORE_CONFIG.version,
      createdByStudentNumber: input.actorStudentNumber ?? null,
      awardedAt: input.awardedAt,
    },
  });
}

export async function awardExhibitorAutomaticMissions(
  input: AwardExhibitorAutomaticMissionsInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();
  const tx = asScoreAdminDatabase(db);
  const events = await loadLedgerEventsForMembers(eventKey, tx);
  const existingAwardKeys = new Set(events.map((event) => event.businessKey).filter(Boolean));
  const standByRound = new Map<string, {
    submissionId: number;
    submissionName: string;
    roundKey: string;
    roundLabel: string | null;
    activeExhibitors: Set<number>;
  }>();
  const memberRoundStats = new Map<string, {
    submissionId: number;
    submissionName: string;
    memberId: number;
    memberName: string;
    roundKey: string;
      roundLabel: string | null;
      conversions: number;
      courses: Set<string>;
      standVisits: number;
      conversionTimes: number[];
      actionsByStudentId: Map<number, Set<string>>;
    }>();
  const memberGlobalStats = new Map<string, {
    submissionId: number;
    submissionName: string;
    memberId: number;
    memberName: string;
    conversions: number;
    courses: Set<string>;
  }>();

  for (const event of events) {
    const roundKey = event.roundKey ?? "global";
    const submissionName = event.submission?.name ?? `Projeto ${event.submissionId}`;

    if (event.action === "EXHIBITOR_CHECK_IN" || event.action === "EXHIBITOR_CHECK_OUT") {
      const standKey = `${event.submissionId}:${roundKey}`;
      const current = standByRound.get(standKey) ?? {
        submissionId: event.submissionId,
        submissionName,
        roundKey,
        roundLabel: event.roundLabel ?? null,
        activeExhibitors: new Set<number>(),
      };
      const memberId = Number(event.submissionMemberId);
      if (Number.isFinite(memberId)) {
        if (event.action === "EXHIBITOR_CHECK_IN" && event.role === "EXPOSITOR") {
          current.activeExhibitors.add(memberId);
        }
        if (event.action === "EXHIBITOR_CHECK_OUT") {
          current.activeExhibitors.delete(memberId);
        }
      }
      standByRound.set(standKey, current);
      continue;
    }

    if (!event.submissionMemberId || !event.submissionMember) continue;
    if (!isConversionAction(event.action) || event.points < 0) continue;

    const memberName = event.submissionMember.name;
    const roundStatsKey = `${event.submissionId}:${event.submissionMemberId}:${roundKey}`;
    const roundStats = memberRoundStats.get(roundStatsKey) ?? {
      submissionId: event.submissionId,
      submissionName,
      memberId: event.submissionMemberId,
      memberName,
      roundKey,
      roundLabel: event.roundLabel ?? null,
      conversions: 0,
      courses: new Set<string>(),
      standVisits: 0,
      conversionTimes: [],
      actionsByStudentId: new Map<number, Set<string>>(),
    };
    const globalStatsKey = `${event.submissionId}:${event.submissionMemberId}`;
    const globalStats = memberGlobalStats.get(globalStatsKey) ?? {
      submissionId: event.submissionId,
      submissionName,
      memberId: event.submissionMemberId,
      memberName,
      conversions: 0,
      courses: new Set<string>(),
    };
    const courseKey = normalizeScoreCourse(event.voterCourse);

    roundStats.conversions += 1;
    globalStats.conversions += 1;
    if (event.awardedAt) {
      const time = new Date(event.awardedAt).getTime();
      if (Number.isFinite(time)) {
        roundStats.conversionTimes.push(time);
      }
    }
    if (event.studentId) {
      const actions = roundStats.actionsByStudentId.get(event.studentId) ?? new Set<string>();
      actions.add(event.action);
      roundStats.actionsByStudentId.set(event.studentId, actions);
    }
    if (courseKey) {
      roundStats.courses.add(courseKey);
      globalStats.courses.add(courseKey);
    }
    if (event.action === "STAND_VISIT") {
      roundStats.standVisits += 1;
    }
    memberRoundStats.set(roundStatsKey, roundStats);
    memberGlobalStats.set(globalStatsKey, globalStats);
  }

  const awarded: Array<{
    businessKey: string;
    submissionId: number;
    memberId: number | null;
    action: string;
    sourceType: string;
    sourceId: string;
    points: number;
    reason: string;
  }> = [];

  const addAward = async (award: {
    businessKey: string;
    submissionId: number;
    memberId?: number | null;
    action: string;
    sourceType: string;
    sourceId: string;
    role?: string | null;
    roundKey?: string | null;
    roundLabel?: string | null;
    points: number;
    reason: string;
    metadata: Record<string, unknown>;
  }) => {
    if (existingAwardKeys.has(award.businessKey)) return;
    await upsertAutomaticAward({
      tx,
      eventKey,
      businessKey: award.businessKey,
      submissionId: award.submissionId,
      submissionMemberId: award.memberId ?? null,
      sourceType: award.sourceType,
      sourceId: award.sourceId,
      action: award.action,
      role: award.role,
      roundKey: award.roundKey,
      roundLabel: award.roundLabel,
      points: award.points,
      reason: award.reason,
      metadata: award.metadata,
      actorStudentNumber: input.actorStudentNumber ?? null,
      awardedAt,
    });
    existingAwardKeys.add(award.businessKey);
    awarded.push({
      businessKey: award.businessKey,
      submissionId: award.submissionId,
      memberId: award.memberId ?? null,
      action: award.action,
      sourceType: award.sourceType,
      sourceId: award.sourceId,
      points: award.points,
      reason: award.reason,
    });
  };

  for (const stand of standByRound.values()) {
    if (stand.activeExhibitors.size < 2) continue;
    await addAward({
      businessKey: `stand-active:${eventKey}:${stand.submissionId}:${stand.roundKey}`,
      submissionId: stand.submissionId,
      action: "STAND_BONUS",
      sourceType: "STAND_ACTIVE_ROUND",
      sourceId: stand.roundKey,
      role: "EXPOSITOR",
      roundKey: stand.roundKey,
      roundLabel: stand.roundLabel,
      points: 5,
      reason: "Stand ativo com 2 expositores registados na ronda.",
      metadata: {
        ruleApplied: "STAND_ACTIVE_ROUND",
        submissionName: stand.submissionName,
        activeExhibitors: stand.activeExhibitors.size,
      },
    });
  }

  for (const stats of memberRoundStats.values()) {
    const sortedTimes = stats.conversionTimes.slice().sort((left, right) => left - right);
    if (stats.courses.size >= 3) {
      await addAward({
        businessKey: `mission:${eventKey}:${stats.submissionId}:${stats.memberId}:${stats.roundKey}:AMBASSADOR_COURSE_EXPLORER`,
        submissionId: stats.submissionId,
        memberId: stats.memberId,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: `${stats.memberId}:${stats.roundKey}:AMBASSADOR_COURSE_EXPLORER`,
        role: "AMBASSADOR",
        roundKey: stats.roundKey,
        roundLabel: stats.roundLabel,
        points: 15,
        reason: "Missão Explorador de Cursos concluída automaticamente.",
        metadata: {
          ruleApplied: "AMBASSADOR_COURSE_EXPLORER",
          submissionName: stats.submissionName,
          memberName: stats.memberName,
          coursesReached: stats.courses.size,
          conversions: stats.conversions,
        },
      });
    }

    if (
      sortedTimes.length >= 2
      && sortedTimes.some((time, index) => index > 0 && time - sortedTimes[index - 1] <= 15 * 60 * 1000)
    ) {
      await addAward({
        businessKey: `mission:${eventKey}:${stats.submissionId}:${stats.memberId}:${stats.roundKey}:AMBASSADOR_FAST_CONVERTER`,
        submissionId: stats.submissionId,
        memberId: stats.memberId,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: `${stats.memberId}:${stats.roundKey}:AMBASSADOR_FAST_CONVERTER`,
        role: "AMBASSADOR",
        roundKey: stats.roundKey,
        roundLabel: stats.roundLabel,
        points: 8,
        reason: "Missão Conversor Rápido concluída automaticamente.",
        metadata: {
          ruleApplied: "AMBASSADOR_FAST_CONVERTER",
          submissionName: stats.submissionName,
          memberName: stats.memberName,
          conversions: stats.conversions,
        },
      });
    }

    for (const [studentId, actions] of stats.actionsByStudentId) {
      if (!actions.has("STUDENT_VOTE") || !actions.has("QUALIFIED_FEEDBACK")) continue;
      await addAward({
        businessKey: `mission:${eventKey}:${stats.submissionId}:${stats.memberId}:${stats.roundKey}:AMBASSADOR_COMPLETE`,
        submissionId: stats.submissionId,
        memberId: stats.memberId,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: `${stats.memberId}:${stats.roundKey}:AMBASSADOR_COMPLETE`,
        role: "AMBASSADOR",
        roundKey: stats.roundKey,
        roundLabel: stats.roundLabel,
        points: 12,
        reason: "Missão Embaixador Completo concluída automaticamente.",
        metadata: {
          ruleApplied: "AMBASSADOR_COMPLETE",
          submissionName: stats.submissionName,
          memberName: stats.memberName,
          studentId,
        },
      });
      break;
    }

    if (stats.standVisits >= 10) {
      await addAward({
        businessKey: `mission:${eventKey}:${stats.submissionId}:${stats.memberId}:${stats.roundKey}:EXHIBITOR_ELITE_HOST`,
        submissionId: stats.submissionId,
        memberId: stats.memberId,
        action: "EXHIBITOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: `${stats.memberId}:${stats.roundKey}:EXHIBITOR_ELITE_HOST`,
        role: "EXPOSITOR",
        roundKey: stats.roundKey,
        roundLabel: stats.roundLabel,
        points: 10,
        reason: "Missão Anfitrião de Elite concluída automaticamente.",
        metadata: {
          ruleApplied: "EXHIBITOR_ELITE_HOST",
          submissionName: stats.submissionName,
          memberName: stats.memberName,
          standVisits: stats.standVisits,
        },
      });
    }
  }

  const firstContactBySubmissionCourse = new Set<string>();
  for (const event of events) {
    if (!event.submissionMemberId || !event.submissionMember) continue;
    if (!isConversionAction(event.action) || event.points < 0) continue;
    const courseKey = normalizeScoreCourse(event.voterCourse);
    if (!courseKey) continue;
    const key = `${event.submissionId}:${courseKey}`;
    if (firstContactBySubmissionCourse.has(key)) continue;
    firstContactBySubmissionCourse.add(key);
    await addAward({
      businessKey: `mission:${eventKey}:${event.submissionId}:${event.submissionMemberId}:course:${courseKey}:AMBASSADOR_FIRST_CONTACT`,
      submissionId: event.submissionId,
      memberId: event.submissionMemberId,
      action: "AMBASSADOR_MISSION",
      sourceType: "AUTO_MISSION",
      sourceId: `${event.submissionMemberId}:course:${courseKey}:AMBASSADOR_FIRST_CONTACT`,
      role: "AMBASSADOR",
      roundKey: event.roundKey ?? null,
      roundLabel: event.roundLabel ?? null,
      points: 10,
      reason: "Missão Primeiro Contacto concluída automaticamente.",
      metadata: {
        ruleApplied: "AMBASSADOR_FIRST_CONTACT",
        submissionName: event.submission?.name ?? `Projeto ${event.submissionId}`,
        memberName: event.submissionMember.name,
        course: event.voterCourse,
      },
    });
  }

  for (const stats of memberGlobalStats.values()) {
    if (stats.courses.size >= 5) {
      await addAward({
        businessKey: `mission:${eventKey}:${stats.submissionId}:${stats.memberId}:global:AMBASSADOR_MAX_DIVERSITY`,
        submissionId: stats.submissionId,
        memberId: stats.memberId,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: `${stats.memberId}:global:AMBASSADOR_MAX_DIVERSITY`,
        role: "AMBASSADOR",
        roundKey: null,
        roundLabel: null,
        points: 25,
        reason: "Missão Diversidade Máxima concluída automaticamente.",
        metadata: {
          ruleApplied: "AMBASSADOR_MAX_DIVERSITY",
          submissionName: stats.submissionName,
          memberName: stats.memberName,
          coursesReached: stats.courses.size,
          conversions: stats.conversions,
        },
      });
    }

    if (stats.courses.size >= 8) {
      await addAward({
        businessKey: `mission:${eventKey}:${stats.submissionId}:${stats.memberId}:global:AMBASSADOR_BORDERLESS`,
        submissionId: stats.submissionId,
        memberId: stats.memberId,
        action: "AMBASSADOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: `${stats.memberId}:global:AMBASSADOR_BORDERLESS`,
        role: "AMBASSADOR",
        roundKey: null,
        roundLabel: null,
        points: 50,
        reason: "Missão Sem Fronteiras concluída automaticamente.",
        metadata: {
          ruleApplied: "AMBASSADOR_BORDERLESS",
          submissionName: stats.submissionName,
          memberName: stats.memberName,
          coursesReached: stats.courses.size,
        },
      });
    }
  }

  const projectStats = new Map<number, {
    submissionName: string;
    hasPenalty: boolean;
    hasJuryVote: boolean;
    activeRounds: Set<string>;
  }>();
  for (const event of events) {
    const current = projectStats.get(event.submissionId) ?? {
      submissionName: event.submission?.name ?? `Projeto ${event.submissionId}`,
      hasPenalty: false,
      hasJuryVote: false,
      activeRounds: new Set<string>(),
    };
    if (event.action === "PENALTY" || event.points < 0) current.hasPenalty = true;
    if (event.action === "JURY_VOTE") current.hasJuryVote = true;
    if (event.action === "STAND_BONUS" || event.sourceType === "STAND_ACTIVE_ROUND") {
      current.activeRounds.add(event.roundKey ?? "global");
    }
    projectStats.set(event.submissionId, current);
  }

  for (const project of projectStats.values()) {
    // Use the loop below for project ids, keeping the stats object compact above.
    void project;
  }
  for (const [submissionId, project] of projectStats) {
    if (!project.hasPenalty) {
      await addAward({
        businessKey: `mission:${eventKey}:${submissionId}:project:ZERO_PENALTIES`,
        submissionId,
        action: "EXHIBITOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: "project:ZERO_PENALTIES",
        role: "EXPOSITOR",
        points: 10,
        reason: "Missão Zero Penalizações concluída automaticamente.",
        metadata: {
          ruleApplied: "ZERO_PENALTIES",
          submissionName: project.submissionName,
        },
      });
    }

    if (project.hasJuryVote && project.activeRounds.size > 0) {
      await addAward({
        businessKey: `mission:${eventKey}:${submissionId}:project:PERFECT_PRESENTATION`,
        submissionId,
        action: "EXHIBITOR_MISSION",
        sourceType: "AUTO_MISSION",
        sourceId: "project:PERFECT_PRESENTATION",
        role: "EXPOSITOR",
        points: 15,
        reason: "Missão Apresentação Perfeita concluída automaticamente.",
        metadata: {
          ruleApplied: "PERFECT_PRESENTATION",
          submissionName: project.submissionName,
          activeRounds: Array.from(project.activeRounds),
        },
      });
    }
  }

  return {
    eventKey,
    scannedEvents: events.length,
    awardedCount: awarded.length,
    awardedPoints: roundScore(awarded.reduce((sum, award) => sum + award.points, 0)),
    awarded,
  };
}

export async function getExhibitorAmbassadorRanking(
  input: ExhibitorScoreEventListInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const events = await loadLedgerEventsForMembers(eventKey, asScoreAdminDatabase(db));
  const allRoundKeys = new Set(events.map((event) => event.roundKey).filter((roundKey): roundKey is string => Boolean(roundKey)));
  const stats = new Map<string, {
    submissionId: number;
    submissionName: string;
    memberId: number;
    memberName: string;
    conversions: number;
    courses: Set<string>;
    missionPoints: number;
    penalties: number;
    scoreContribution: number;
    level: string | null;
    roundKeys: Set<string>;
    courseSequence: string[];
  }>();

  for (const event of events) {
    if (!event.submissionMemberId || !event.submissionMember) continue;
    const key = `${event.submissionId}:${event.submissionMemberId}`;
    const current = stats.get(key) ?? {
      submissionId: event.submissionId,
      submissionName: event.submission?.name ?? `Projeto ${event.submissionId}`,
      memberId: event.submissionMemberId,
      memberName: event.submissionMember.name,
      conversions: 0,
      courses: new Set<string>(),
      missionPoints: 0,
      penalties: 0,
      scoreContribution: 0,
      level: null,
      roundKeys: new Set<string>(),
      courseSequence: [],
    };

    current.scoreContribution = roundScore(current.scoreContribution + Number(event.points ?? 0));
    if (event.action === "PENALTY" || event.points < 0) {
      current.penalties += 1;
    }
    if (isMissionAction(event.action)) {
      current.missionPoints = roundScore(current.missionPoints + Number(event.points ?? 0));
    }
    if (isConversionAction(event.action) && event.points >= 0) {
      current.conversions += 1;
    }
    if (event.sourceType === "MEMBER_LEVEL" && event.sourceId) {
      current.level = String(event.sourceId).split(":").at(-1) ?? current.level;
    }
    const courseKey = normalizeScoreCourse(event.voterCourse);
    if (courseKey) {
      current.courses.add(courseKey);
      current.courseSequence.push(courseKey);
    }
    if (event.roundKey) current.roundKeys.add(event.roundKey);
    stats.set(key, current);
  }

  function maxCourseStreak(sequence: string[]) {
    let max = 0;
    let current = 0;
    const seen = new Set<string>();
    for (const course of sequence) {
      if (seen.has(course)) {
        seen.clear();
        current = 0;
      }
      seen.add(course);
      current += 1;
      max = Math.max(max, current);
    }
    return max;
  }

  const members = Array.from(stats.values())
    .sort((left, right) => {
      if (right.conversions !== left.conversions) return right.conversions - left.conversions;
      if (right.courses.size !== left.courses.size) return right.courses.size - left.courses.size;
      if (right.missionPoints !== left.missionPoints) return right.missionPoints - left.missionPoints;
      return right.scoreContribution - left.scoreContribution;
    })
    .map((member, index) => ({
      rank: index + 1,
      submissionId: member.submissionId,
      submissionName: member.submissionName,
      memberId: member.memberId,
      memberName: member.memberName,
      conversions: member.conversions,
      coursesReached: member.courses.size,
      missionPoints: member.missionPoints,
      penalties: member.penalties,
      scoreContribution: member.scoreContribution,
      level: member.level,
      maxCourseStreak: maxCourseStreak(member.courseSequence),
      inactiveRounds: Math.max(0, allRoundKeys.size - member.roundKeys.size),
    }));

  return {
    eventKey,
    generatedAt: new Date().toISOString(),
    totalMembers: members.length,
    members,
  };
}

export async function detectExhibitorScoringAlerts(
  input: ExhibitorScoreEventListInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const events = await loadLedgerEventsForMembers(eventKey, asScoreAdminDatabase(db), { includePending: true });
  const alerts: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    submissionId: number;
    submissionName: string;
    memberId?: number | null;
    memberName?: string | null;
    message: string;
    count: number;
  }> = [];
  const courseCounts = new Map<string, {
    submissionId: number;
    submissionName: string;
    course: string;
    count: number;
  }>();
  const memberEvents = new Map<string, Array<LedgerEventForAutomation>>();
  const feedbackByStudentProject = new Map<string, {
    submissionId: number;
    submissionName: string;
    studentId: number;
    count: number;
  }>();
  const pendingBySubmission = new Map<number, {
    submissionId: number;
    submissionName: string;
    count: number;
  }>();

  for (const event of events) {
    const submissionName = event.submission?.name ?? `Projeto ${event.submissionId}`;
    if (event.action === "SELF_VOTE_ATTEMPT") {
      alerts.push({
        type: "SELF_VOTE_ATTEMPT",
        severity: "HIGH",
        submissionId: event.submissionId,
        submissionName,
        memberId: event.submissionMemberId ?? null,
        memberName: event.submissionMember?.name ?? null,
        message: "Tentativa de auto-voto registada no ledger.",
        count: 1,
      });
    }

    const courseKey = normalizeScoreCourse(event.voterCourse);
    if (courseKey && isConversionAction(event.action) && event.points >= 0) {
      const key = `${event.submissionId}:${courseKey}`;
      const current = courseCounts.get(key) ?? {
        submissionId: event.submissionId,
        submissionName,
        course: event.voterCourse ?? courseKey,
        count: 0,
      };
      current.count += 1;
      courseCounts.set(key, current);
    }

    if (event.submissionMemberId && isConversionAction(event.action) && event.points >= 0) {
      const key = `${event.submissionId}:${event.submissionMemberId}`;
      memberEvents.set(key, [...(memberEvents.get(key) ?? []), event]);
    }

    if (event.action === "QUALIFIED_FEEDBACK" && event.studentId) {
      const key = `${event.submissionId}:${event.studentId}`;
      const current = feedbackByStudentProject.get(key) ?? {
        submissionId: event.submissionId,
        submissionName,
        studentId: event.studentId,
        count: 0,
      };
      current.count += 1;
      feedbackByStudentProject.set(key, current);
    }

    const metadata = parseJsonObject(event.metadataJson);
    if (metadata.outsideEventContext === true || metadata.qrOutsideEventContext === true) {
      alerts.push({
        type: "QR_OUTSIDE_CONTEXT",
        severity: "HIGH",
        submissionId: event.submissionId,
        submissionName,
        memberId: event.submissionMemberId ?? null,
        memberName: event.submissionMember?.name ?? null,
        message: "QR usado fora do contexto esperado da feira.",
        count: 1,
      });
    }

    if (event.status === "PENDING_REVIEW") {
      const current = pendingBySubmission.get(event.submissionId) ?? {
        submissionId: event.submissionId,
        submissionName,
        count: 0,
      };
      current.count += 1;
      pendingBySubmission.set(event.submissionId, current);
    }
  }

  for (const item of courseCounts.values()) {
    if (item.count < 5) continue;
    alerts.push({
      type: "COURSE_CONCENTRATION",
      severity: "MEDIUM",
      submissionId: item.submissionId,
      submissionName: item.submissionName,
      message: `${item.count} conversões do mesmo curso (${item.course}) no mesmo projeto.`,
      count: item.count,
    });
  }

  for (const groupedEvents of memberEvents.values()) {
    const ordered = groupedEvents
      .filter((event) => event.awardedAt)
      .sort((left, right) => new Date(left.awardedAt as Date | string).getTime() - new Date(right.awardedAt as Date | string).getTime());
    if (ordered.length < 5) continue;

    for (let index = 0; index <= ordered.length - 5; index += 1) {
      const first = new Date(ordered[index].awardedAt as Date | string).getTime();
      const fifth = new Date(ordered[index + 4].awardedAt as Date | string).getTime();
      if (fifth - first > 10 * 60 * 1000) continue;
      const event = ordered[index];
      alerts.push({
        type: "MEMBER_BURST",
        severity: "MEDIUM",
        submissionId: event.submissionId,
        submissionName: event.submission?.name ?? `Projeto ${event.submissionId}`,
        memberId: event.submissionMemberId ?? null,
        memberName: event.submissionMember?.name ?? null,
        message: "Membro gerou 5 ou mais conversões em até 10 minutos.",
        count: ordered.length,
      });
      break;
    }
  }

  for (const item of feedbackByStudentProject.values()) {
    if (item.count < 2) continue;
    alerts.push({
      type: "REPEATED_FEEDBACK",
      severity: "MEDIUM",
      submissionId: item.submissionId,
      submissionName: item.submissionName,
      message: `Estudante ${item.studentId} gerou ${item.count} feedbacks qualificados para o mesmo projeto.`,
      count: item.count,
    });
  }

  for (const item of pendingBySubmission.values()) {
    alerts.push({
      type: "PENDING_REVIEW_POINTS",
      severity: "MEDIUM",
      submissionId: item.submissionId,
      submissionName: item.submissionName,
      message: `${item.count} evento(s) de pontuação aguardam revisão e não entram no ranking válido.`,
      count: item.count,
    });
  }

  return {
    eventKey,
    generatedAt: new Date().toISOString(),
    totalAlerts: alerts.length,
    alerts,
  };
}

export async function awardExhibitorTeamBonuses(
  input: AwardExhibitorTeamBonusesInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();
  const tx = asScoreAdminDatabase(db);
  const events = await loadLedgerEventsForMembers(eventKey, tx);
  const ranking = await getExhibitorAmbassadorRanking({ eventKey }, db);
  const bySubmission = new Map<number, typeof ranking.members>();
  const existingAwardKeys = new Set(events.map((event) => event.businessKey).filter(Boolean));

  for (const member of ranking.members) {
    bySubmission.set(member.submissionId, [...(bySubmission.get(member.submissionId) ?? []), member]);
  }

  const awarded: Array<{
    businessKey: string;
    submissionId: number;
    sourceId: string;
    points: number;
  }> = [];

  const addTeamBonus = async (inputBonus: {
    submissionId: number;
    submissionName: string;
    sourceId: string;
    points: number;
    reason: string;
    metadata: Record<string, unknown>;
  }) => {
    const businessKey = `team-bonus:${eventKey}:${inputBonus.submissionId}:${inputBonus.sourceId}`;
    if (existingAwardKeys.has(businessKey)) return;
    await upsertAutomaticAward({
      tx,
      eventKey,
      businessKey,
      submissionId: inputBonus.submissionId,
      sourceType: "TEAM_MVP_BONUS",
      sourceId: inputBonus.sourceId,
      action: "TEAM_BONUS",
      role: "TEAM",
      points: inputBonus.points,
      reason: inputBonus.reason,
      metadata: {
        ...inputBonus.metadata,
        submissionName: inputBonus.submissionName,
      },
      actorStudentNumber: input.actorStudentNumber ?? null,
      awardedAt,
    });
    existingAwardKeys.add(businessKey);
    awarded.push({
      businessKey,
      submissionId: inputBonus.submissionId,
      sourceId: inputBonus.sourceId,
      points: inputBonus.points,
    });
  };

  for (const [submissionId, members] of bySubmission) {
    const submissionName = members[0]?.submissionName ?? `Projeto ${submissionId}`;
    const byConversions = members.slice().sort((left, right) => right.conversions - left.conversions)[0];
    const byCourses = members.slice().sort((left, right) => right.coursesReached - left.coursesReached)[0];
    const byStreak = members.slice().sort((left, right) => right.maxCourseStreak - left.maxCourseStreak)[0];
    const byMissions = members.slice().sort((left, right) => right.missionPoints - left.missionPoints)[0];

    if (byConversions?.conversions > 0) {
      await addTeamBonus({
        submissionId,
        submissionName,
        sourceId: "TOP_CONVERSIONS",
        points: 20,
        reason: "Bónus MVP: embaixador com mais conversões da equipa.",
        metadata: { memberId: byConversions.memberId, memberName: byConversions.memberName, conversions: byConversions.conversions },
      });
    }
    if (byCourses?.coursesReached > 0) {
      await addTeamBonus({
        submissionId,
        submissionName,
        sourceId: "TOP_COURSES",
        points: 15,
        reason: "Bónus MVP: embaixador com mais cursos alcançados.",
        metadata: { memberId: byCourses.memberId, memberName: byCourses.memberName, coursesReached: byCourses.coursesReached },
      });
    }
    if (byStreak?.maxCourseStreak > 0) {
      await addTeamBonus({
        submissionId,
        submissionName,
        sourceId: "TOP_STREAK",
        points: 15,
        reason: "Bónus MVP: membro com maior streak de cursos.",
        metadata: { memberId: byStreak.memberId, memberName: byStreak.memberName, maxCourseStreak: byStreak.maxCourseStreak },
      });
    }
    if (byMissions?.missionPoints > 0) {
      await addTeamBonus({
        submissionId,
        submissionName,
        sourceId: "TOP_MISSIONS",
        points: 10,
        reason: "Bónus MVP: membro com mais pontos de missões.",
        metadata: { memberId: byMissions.memberId, memberName: byMissions.memberName, missionPoints: byMissions.missionPoints },
      });
    }
    if (members.length > 0 && members.every((member) => Boolean(member.level))) {
      await addTeamBonus({
        submissionId,
        submissionName,
        sourceId: "TEAM_BRONZE_PLUS",
        points: 25,
        reason: "Bónus MVP: todos os membros com nível Bronze ou superior.",
        metadata: { members: members.map((member) => ({ id: member.memberId, name: member.memberName, level: member.level })) },
      });
    }
  }

  return {
    eventKey,
    awardedCount: awarded.length,
    awardedPoints: roundScore(awarded.reduce((sum, item) => sum + item.points, 0)),
    awarded,
  };
}

export async function buildExhibitorScoreRankingPdfHtml(
  input: ExportExhibitorScoreRankingInput,
  db = prisma,
) {
  const ranking = await exportExhibitorScoreRanking(input, db);
  const generatedAt = new Date(ranking.generatedAt);
  const rows = ranking.projects.map((project) => `
    <tr>
      <td>${project.rank}</td>
      <td>${escapeHtml(project.name)}</td>
      <td>${escapeHtml(project.course ?? "Curso por confirmar")}</td>
      <td>${project.score}</td>
      <td>${project.votes}</td>
      <td>${escapeHtml(JSON.stringify(project.breakdown))}</td>
    </tr>
  `).join("");
  const courseRows = ranking.projects.flatMap((project) => (
    project.courses.map((course) => `
      <tr>
        <td>${escapeHtml(project.name)}</td>
        <td>${escapeHtml(course.course)}</td>
        <td>${course.events}</td>
        <td>${course.points}</td>
      </tr>
    `)
  )).join("");

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Ranking de Pontuação dos Projetos</title>
  <style>
    @page { size: A4; margin: 18mm 14mm; }
    body { font-family: Arial, sans-serif; color: #17202a; margin: 0; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    h2 { font-size: 16px; margin: 22px 0 8px; }
    p { font-size: 12px; margin: 0 0 10px; color: #52616b; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #223D42; color: white; text-align: left; }
    th, td { border: 1px solid #d8dee4; padding: 7px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .meta { margin-top: 6px; }
  </style>
</head>
<body>
  <h1>Ranking de Pontuação dos Projetos</h1>
  <p class="meta">Evento: ${escapeHtml(ranking.eventKey)} · Gerado em ${generatedAt.toISOString()} · ${ranking.frozenOnly ? "Snapshot congelado" : "Ranking atual"}</p>
  <h2>Classificação Geral</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Projeto</th><th>Curso</th><th>Pontos</th><th>Votos</th><th>Detalhe</th></tr>
    </thead>
    <tbody>${rows || "<tr><td colspan=\"6\">Sem dados de pontuação.</td></tr>"}</tbody>
  </table>
  <h2>Votos por curso</h2>
  <table>
    <thead>
      <tr><th>Projeto</th><th>Curso do votante</th><th>Eventos</th><th>Pontos</th></tr>
    </thead>
    <tbody>${courseRows || "<tr><td colspan=\"4\">Sem cursos registados.</td></tr>"}</tbody>
  </table>
</body>
</html>`;
}

export async function awardExhibitorMemberLevels(
  input: AwardExhibitorMemberLevelsInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();
  const tx = asScoreAdminDatabase(db);
  const events = await tx.exhibitorScoreEvent.findMany({
    where: {
      eventKey,
      status: "VALID",
      revokedAt: null,
      submissionMemberId: { not: null },
    },
    select: {
      submissionId: true,
      submissionMemberId: true,
      action: true,
      sourceType: true,
      sourceId: true,
      points: true,
      voterCourse: true,
      submission: {
        select: {
          id: true,
          name: true,
          course: true,
          type: true,
          area: true,
        },
      },
      submissionMember: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { awardedAt: "asc" },
  }) as Array<{
    submissionId: number;
    submissionMemberId: number | null;
    action: string;
    sourceType?: string | null;
    sourceId?: string | null;
    points: number;
    voterCourse?: string | null;
    submission?: { id: number; name: string; course: string | null; type: string; area: string } | null;
    submissionMember?: { id: number; name: string } | null;
  }>;
  const stats = new Map<string, {
    submissionId: number;
    memberId: number;
    memberName: string;
    submissionName: string;
    conversions: number;
    missions: number;
    courses: Set<string>;
    hasSeverePenalty: boolean;
    levelAwardedPoints: number;
  }>();

  for (const event of events) {
    if (!event.submissionMemberId || !event.submission || !event.submissionMember) continue;
    const key = `${event.submissionId}:${event.submissionMemberId}`;
    const current = stats.get(key) ?? {
      submissionId: event.submissionId,
      memberId: event.submissionMemberId,
      memberName: event.submissionMember.name,
      submissionName: event.submission.name,
      conversions: 0,
      missions: 0,
      courses: new Set<string>(),
      hasSeverePenalty: false,
      levelAwardedPoints: 0,
    };

    if (event.sourceType === "MEMBER_LEVEL") {
      current.levelAwardedPoints = roundScore(current.levelAwardedPoints + Number(event.points ?? 0));
      stats.set(key, current);
      continue;
    }

    if (isConversionAction(event.action) && event.points >= 0) {
      current.conversions += 1;
    }

    if (isMissionAction(event.action)) {
      current.missions += 1;
    }

    const courseKey = normalizeScoreCourse(event.voterCourse);
    if (courseKey) {
      current.courses.add(courseKey);
    }

    if (event.action === "PENALTY" && event.points <= -50) {
      current.hasSeverePenalty = true;
    }

    stats.set(key, current);
  }

  const awarded: Array<{
    submissionId: number;
    memberId: number;
    memberName: string;
    level: string;
    points: number;
  }> = [];

  for (const item of stats.values()) {
    if (item.hasSeverePenalty) continue;
    const level = memberLevelRules.find((rule) => (
      item.conversions >= rule.minConversions
      && item.courses.size >= rule.minCourses
      && item.missions >= rule.minMissions
    ));

    if (!level) continue;

    const pointsToAward = roundScore(level.points - item.levelAwardedPoints);
    if (pointsToAward <= 0) continue;

    const businessKey = `member-level:${eventKey}:${item.submissionId}:${item.memberId}:${level.level}`;
    await tx.exhibitorScoreEvent.upsert({
      where: { businessKey },
      update: {},
      create: {
        businessKey,
        eventKey,
        submissionId: item.submissionId,
        submissionMemberId: item.memberId,
        sourceType: "MEMBER_LEVEL",
        sourceId: `${item.memberId}:${level.level}`,
        action: "TEAM_BONUS",
        role: "MEMBER",
        basePoints: 0,
        bonusPoints: pointsToAward,
        multiplier: 1,
        points: pointsToAward,
        status: "VALID",
        reason: `Nível ${level.label} alcançado por membro expositor`,
        metadataJson: stringifyJson({
          ruleApplied: `MEMBER_LEVEL_${level.level}`,
          memberName: item.memberName,
          submissionName: item.submissionName,
          conversions: item.conversions,
          courses: item.courses.size,
          missions: item.missions,
          previousLevelPoints: item.levelAwardedPoints,
          targetLevelPoints: level.points,
        }),
        scoreConfigVersion: DEFAULT_EXHIBITOR_SCORE_CONFIG.version,
        createdByStudentNumber: input.actorStudentNumber ?? null,
        awardedAt,
      },
    });

    awarded.push({
      submissionId: item.submissionId,
      memberId: item.memberId,
      memberName: item.memberName,
      level: level.level,
      points: pointsToAward,
    });
  }

  return {
    eventKey,
    scannedMembers: stats.size,
    awarded,
  };
}
