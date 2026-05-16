import { prisma } from "../../../shared/prisma";
import { isCompetitionEligible } from "../../submission/domain/submission-policy";
import {
  calculateExhibitorScoreEvent,
  getCourseDiversityStreakBonus,
  normalizeScoreCourse,
  normalizeScoreUniversity,
  type CalculatedExhibitorScoreEvent,
} from "./exhibitor-scoring.rules";
import {
  parseStoredExhibitorScoreConfig,
  resolveExhibitorScoreRound,
} from "./exhibitor-scoring.config";

type ScoreDatabase = typeof prisma & {
  exhibitorScoreEvent: {
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
    create(args: unknown): Promise<Record<string, unknown>>;
    upsert(args: unknown): Promise<Record<string, unknown>>;
    aggregate(args: unknown): Promise<{ _sum: { points: number | null } }>;
  };
  exhibitorScoreConfig: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  };
};

type RecordStudentProjectVoteScoreInput = {
  submissionId: number;
  studentId: number;
  eventKey?: string;
  roundKey?: string | null;
  roundLabel?: string | null;
  roundMultiplier?: number;
  awardedAt?: Date;
};

type RecordJuryProjectVoteScoreInput = {
  submissionId: number;
  juryId: number;
  juryPhone: string;
  eventKey?: string;
  roundKey?: string | null;
  roundLabel?: string | null;
  roundMultiplier?: number;
  awardedAt?: Date;
};

type RecordExhibitorScoreAdjustmentInput = {
  submissionId: number;
  eventKey?: string;
  action: "QUALIFIED_FEEDBACK" | "PENALTY" | "STAND_BONUS" | "AMBASSADOR_MISSION" | "EXHIBITOR_MISSION" | "TEAM_BONUS";
  sourceType: string;
  sourceId: string;
  studentId?: number | null;
  actorStudentId?: number | null;
  submissionMemberId?: number | null;
  points: number;
  reason: string;
  role?: string | null;
  roundKey?: string | null;
  roundLabel?: string | null;
  metadata?: Record<string, unknown>;
  createdByStudentNumber?: string | null;
  awardedAt?: Date;
};

type RecordExhibitorMemberDutyInput = {
  submissionId: number;
  submissionMemberId: number;
  eventKey?: string;
  action: "EXHIBITOR_CHECK_IN" | "EXHIBITOR_CHECK_OUT";
  role: "EXPOSITOR" | "AMBASSADOR";
  roundKey?: string | null;
  roundLabel?: string | null;
  metadata?: Record<string, unknown>;
  createdByStudentNumber?: string | null;
  awardedAt?: Date;
};

type RecordEmptyStandPenaltyInput = {
  submissionId: number;
  eventKey?: string;
  roundKey: string;
  roundLabel?: string | null;
  metadata?: Record<string, unknown>;
  createdByStudentNumber?: string | null;
  awardedAt?: Date;
};

type ScoreEventResult = CalculatedExhibitorScoreEvent & {
  businessKey: string;
  sourceType: string;
  sourceId?: string | null;
};

type RecordStudentProjectVoteScoreResult = {
  accepted: boolean;
  message: string;
  votesCount: number;
  score: number;
  scoreDelta: number;
  scoringEvents: ScoreEventResult[];
};

function asScoreDatabase(db = prisma): ScoreDatabase {
  return db as ScoreDatabase;
}

function stringifyMetadata(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sameStudentNumber(left?: string | null, right?: string | null) {
  const normalizedLeft = (left ?? "").trim();
  const normalizedRight = (right ?? "").trim();
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function resolveProjectUniversity(submission: {
  student?: { university?: string | null; isUorStudent?: boolean | null } | null;
  studentId?: number | null;
}) {
  const ownerUniversity = normalizeScoreUniversity(submission.student?.university);
  if (ownerUniversity) return ownerUniversity;
  if (submission.student?.isUorStudent || submission.studentId) {
    return normalizeScoreUniversity("Universidade Óscar Ribas");
  }
  return "";
}

function isVoteFromOtherUniversity(input: {
  voterUniversity?: string | null;
  voterIsUorStudent?: boolean | null;
  projectUniversity?: string | null;
}) {
  const voterUniversity = normalizeScoreUniversity(input.voterUniversity);
  const projectUniversity = normalizeScoreUniversity(input.projectUniversity);

  if (!voterUniversity || !projectUniversity) return false;
  if (voterUniversity === projectUniversity) return false;
  if (input.voterIsUorStudent === true && voterUniversity === normalizeScoreUniversity("Universidade Óscar Ribas")) {
    return false;
  }

  return true;
}

function buildEventResult(event: CalculatedExhibitorScoreEvent, businessKey: string, sourceType: string, sourceId?: string | null) {
  return {
    ...event,
    businessKey,
    sourceType,
    sourceId,
  };
}

function collectActiveExhibitors(dutyEvents: Array<{
  submissionMemberId?: unknown;
  action?: unknown;
  role?: unknown;
}>) {
  const activeExhibitors = new Map<number, boolean>();

  for (const event of dutyEvents) {
    const memberId = Number(event.submissionMemberId);
    if (!Number.isFinite(memberId)) continue;
    if (event.action === "EXHIBITOR_CHECK_IN" && event.role === "EXPOSITOR") {
      activeExhibitors.set(memberId, true);
    }
    if (event.action === "EXHIBITOR_CHECK_OUT") {
      activeExhibitors.delete(memberId);
    }
  }

  return activeExhibitors;
}

async function getSubmissionScore(tx: ScoreDatabase, submissionId: number) {
  const score = await tx.exhibitorScoreEvent.aggregate({
    _sum: { points: true },
    where: {
      submissionId,
      status: "VALID",
      revokedAt: null,
    },
  });

  return toNumber(score._sum.points);
}

async function countSubmissionVotes(tx: ScoreDatabase, submissionId: number, eventKey: string) {
  return tx.studentVote.count({
    where: {
      submissionId,
      eventKey,
    },
  });
}

async function loadActiveScoreConfig(tx: ScoreDatabase, eventKey: string) {
  const stored = await tx.exhibitorScoreConfig.findFirst({
    where: {
      eventKey,
      active: true,
      status: "ACTIVE",
      lockedAt: null,
    },
    orderBy: { version: "desc" },
    select: {
      version: true,
      weightsJson: true,
      streakBonusesJson: true,
      roundsJson: true,
    },
  });

  return parseStoredExhibitorScoreConfig(stored as {
    version?: number | null;
    weightsJson?: string | null;
    streakBonusesJson?: string | null;
    roundsJson?: string | null;
  } | null);
}

function resolveRoundContext(input: {
  config: Awaited<ReturnType<typeof loadActiveScoreConfig>>;
  awardedAt: Date;
  roundKey?: string | null;
  roundLabel?: string | null;
  roundMultiplier?: number;
}) {
  const resolved = resolveExhibitorScoreRound({
    config: input.config,
    awardedAt: input.awardedAt,
    roundKey: input.roundKey ?? null,
  });

  return {
    roundKey: input.roundKey ?? resolved.key,
    roundLabel: input.roundLabel ?? resolved.label,
    roundMultiplier: input.roundMultiplier ?? resolved.multiplier,
  };
}

export async function recordStudentProjectVoteScore(
  input: RecordStudentProjectVoteScoreInput,
  db = prisma,
): Promise<RecordStudentProjectVoteScoreResult> {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();

  return asScoreDatabase(db).$transaction(async (transactionClient: unknown) => {
    const tx = asScoreDatabase(transactionClient as typeof prisma);
    const config = await loadActiveScoreConfig(tx, eventKey);
    const roundContext = resolveRoundContext({
      config,
      awardedAt,
      roundKey: input.roundKey ?? null,
      roundLabel: input.roundLabel ?? null,
      roundMultiplier: input.roundMultiplier,
    });
    const [student, submission] = await Promise.all([
      tx.student.findUnique({
        where: { id: input.studentId },
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
          email: true,
          university: true,
          isUorStudent: true,
        },
      }),
      tx.submission.findFirst({
        where: {
          id: input.submissionId,
          status: "APPROVED",
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          area: true,
          course: true,
          studentId: true,
          studentNumberSnapshot: true,
          student: {
            select: {
              id: true,
              university: true,
              isUorStudent: true,
            },
          },
        },
      }),
    ]);

    if (!student) {
      throw new Error("Student not found");
    }

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!isCompetitionEligible(submission.type, submission.area)) {
      throw new Error("Submission not eligible for voting");
    }

    const member = await tx.submissionMember.findFirst({
      where: {
        submissionId: submission.id,
        confirmedAt: { not: null },
        OR: [
          { studentId: student.id },
          { studentNumber: student.studentNumber },
          { expectedStudentNumber: student.studentNumber },
        ],
      },
      select: { id: true },
    });

    const selfVote = submission.studentId === student.id
      || sameStudentNumber(submission.studentNumberSnapshot, student.studentNumber)
      || Boolean(member);

    if (selfVote) {
      const cancelled = calculateExhibitorScoreEvent({
        action: "SELF_VOTE_ATTEMPT",
        submissionCourse: submission.course,
        voterCourse: student.course,
        isFirstVoteFromCourse: false,
        config,
      });
      const businessKey = `self-vote-attempt:${eventKey}:${submission.id}:${student.id}`;

      await tx.exhibitorScoreEvent.upsert({
        where: { businessKey },
        update: {},
        create: {
          businessKey,
          eventKey,
          submissionId: submission.id,
          studentId: student.id,
          actorStudentId: student.id,
          submissionMemberId: member?.id ?? null,
          sourceType: "SELF_VOTE_ATTEMPT",
          sourceId: `${student.id}`,
          action: "SELF_VOTE_ATTEMPT",
          role: "STUDENT",
          roundKey: roundContext.roundKey,
          roundLabel: roundContext.roundLabel,
          voterCourse: student.course ?? null,
          submissionCourse: submission.course ?? null,
          basePoints: cancelled.basePoints,
          bonusPoints: cancelled.bonusPoints,
          multiplier: cancelled.multiplier,
          points: cancelled.points,
          status: "CANCELLED",
          reason: cancelled.reason,
          metadataJson: stringifyMetadata({
            studentNumber: student.studentNumber,
            submissionName: submission.name,
          }),
          scoreConfigVersion: config.version,
          awardedAt,
        },
      });

      return {
        accepted: false,
        message: "Auto-voto anulado. O voto não foi contabilizado.",
        votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
        score: await getSubmissionScore(tx, submission.id),
        scoreDelta: 0,
        scoringEvents: [buildEventResult(cancelled, businessKey, "SELF_VOTE_ATTEMPT", `${student.id}`)],
      };
    }

    const existingVote = await tx.studentVote.findUnique({
      where: {
        studentId_submissionId_eventKey: {
          studentId: student.id,
          submissionId: submission.id,
          eventKey,
        },
      },
    });

    if (existingVote) {
      return {
        accepted: true,
        message: "Voto já registado anteriormente.",
        votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
        score: await getSubmissionScore(tx, submission.id),
        scoreDelta: 0,
        scoringEvents: [],
      };
    }

    const vote = await tx.studentVote.create({
      data: { studentId: student.id, submissionId: submission.id, eventKey },
    });
    const sourceId = String(vote.id);
    const voteScore = calculateExhibitorScoreEvent({
      action: "STUDENT_VOTE",
      submissionCourse: submission.course,
      voterCourse: student.course,
      isFirstVoteFromCourse: false,
      roundMultiplier: roundContext.roundMultiplier,
      config,
    });
    const voteBusinessKey = `student-vote:${eventKey}:${submission.id}:${student.id}`;

    await tx.exhibitorScoreEvent.create({
      data: {
        businessKey: voteBusinessKey,
        eventKey,
        submissionId: submission.id,
        studentId: student.id,
        actorStudentId: student.id,
        sourceType: "STUDENT_VOTE",
        sourceId,
        action: "STUDENT_VOTE",
        role: "STUDENT",
        roundKey: roundContext.roundKey,
        roundLabel: roundContext.roundLabel,
        voterCourse: student.course ?? null,
        submissionCourse: submission.course ?? null,
        basePoints: voteScore.basePoints,
        bonusPoints: 0,
        multiplier: voteScore.multiplier,
        points: voteScore.points,
        status: "VALID",
        reason: voteScore.reason,
        metadataJson: stringifyMetadata({
          studentNumber: student.studentNumber,
          studentName: student.name,
          eligibleForRoundMultiplier: voteScore.eligibleForRoundMultiplier,
        }),
        scoreConfigVersion: config.version,
        awardedAt,
      },
    });

    const scoringEvents: ScoreEventResult[] = [
      buildEventResult(voteScore, voteBusinessKey, "STUDENT_VOTE", sourceId),
    ];
    let scoreDelta = voteScore.points;

    const courseKey = normalizeScoreCourse(student.course);
    if (courseKey) {
      const firstCourseBusinessKey = `first-course-vote:${eventKey}:${submission.id}:${courseKey}`;
      const firstCourseBonusPoints = config.weights.firstCourseVoteBonus * voteScore.multiplier;
      const firstCourseEvent = await tx.exhibitorScoreEvent.upsert({
        where: { businessKey: firstCourseBusinessKey },
        update: {},
        create: {
          businessKey: firstCourseBusinessKey,
          eventKey,
          submissionId: submission.id,
          studentId: student.id,
          actorStudentId: student.id,
          sourceType: "STUDENT_VOTE",
          sourceId,
          action: "FIRST_COURSE_VOTE_BONUS",
          role: "STUDENT",
          roundKey: roundContext.roundKey,
          roundLabel: roundContext.roundLabel,
          voterCourse: student.course ?? null,
          submissionCourse: submission.course ?? null,
          basePoints: 0,
          bonusPoints: config.weights.firstCourseVoteBonus,
          multiplier: voteScore.multiplier,
          points: firstCourseBonusPoints,
          status: "VALID",
          reason: "Primeiro voto vindo deste curso",
          metadataJson: stringifyMetadata({
            courseKey,
            ruleApplied: "FIRST_COURSE",
            studentNumber: student.studentNumber,
            eligibleForRoundMultiplier: voteScore.eligibleForRoundMultiplier,
          }),
          scoreConfigVersion: config.version,
          awardedAt,
        },
      });

      if (firstCourseEvent.sourceId === sourceId) {
        const bonusEvent: CalculatedExhibitorScoreEvent = {
          action: "FIRST_COURSE_VOTE_BONUS" as CalculatedExhibitorScoreEvent["action"],
          basePoints: 0,
          bonusPoints: config.weights.firstCourseVoteBonus,
          multiplier: voteScore.multiplier,
          points: firstCourseBonusPoints,
          eligibleForRoundMultiplier: true,
          reason: "Primeiro voto vindo deste curso",
        };
        scoringEvents.push(buildEventResult(
          bonusEvent,
          firstCourseBusinessKey,
          "STUDENT_VOTE",
          sourceId,
        ));
        scoreDelta += firstCourseBonusPoints;

        const courseEvents = await tx.exhibitorScoreEvent.findMany({
          where: {
            eventKey,
            submissionId: submission.id,
            action: "FIRST_COURSE_VOTE_BONUS",
            status: "VALID",
            revokedAt: null,
          },
          select: {
            voterCourse: true,
          },
          orderBy: { awardedAt: "asc" },
        });
        const reachedCourses = new Set(
          courseEvents
            .map((event) => normalizeScoreCourse(event.voterCourse as string | null | undefined))
            .filter(Boolean),
        );
        const streakLength = reachedCourses.size;
        const streakBonusPoints = getCourseDiversityStreakBonus(streakLength, config);

        if (streakBonusPoints > 0) {
          const streakBusinessKey = `streak:${eventKey}:${submission.id}:${streakLength}`;
          const streakEvent = await tx.exhibitorScoreEvent.upsert({
            where: { businessKey: streakBusinessKey },
            update: {},
            create: {
              businessKey: streakBusinessKey,
              eventKey,
              submissionId: submission.id,
              studentId: student.id,
              actorStudentId: student.id,
              sourceType: "COURSE_DIVERSITY_STREAK",
              sourceId: String(streakLength),
              action: "TEAM_BONUS",
              role: "PROJECT",
              roundKey: roundContext.roundKey,
              roundLabel: roundContext.roundLabel,
              voterCourse: student.course ?? null,
              submissionCourse: submission.course ?? null,
              basePoints: 0,
              bonusPoints: streakBonusPoints,
              multiplier: 1,
              points: streakBonusPoints,
              status: "VALID",
              reason: `Streak de diversidade: ${streakLength} cursos novos alcançados`,
              metadataJson: stringifyMetadata({
                ruleApplied: `STREAK_${streakLength}`,
                streakLength,
                triggerCourseKey: courseKey,
              }),
              scoreConfigVersion: config.version,
              awardedAt,
            },
          });

          if (streakEvent.sourceId === String(streakLength)) {
            const streakCalculatedEvent: CalculatedExhibitorScoreEvent = {
              action: "TEAM_BONUS",
              basePoints: 0,
              bonusPoints: streakBonusPoints,
              multiplier: 1,
              points: streakBonusPoints,
              eligibleForRoundMultiplier: false,
              reason: `Streak de diversidade: ${streakLength} cursos novos alcançados`,
            };
            scoringEvents.push(buildEventResult(
              streakCalculatedEvent,
              streakBusinessKey,
              "COURSE_DIVERSITY_STREAK",
              String(streakLength),
            ));
            scoreDelta += streakBonusPoints;
          }
        }
      }
    }

    const projectUniversity = resolveProjectUniversity(submission);
    const voterUniversity = normalizeScoreUniversity(student.university);
    if (isVoteFromOtherUniversity({
      voterUniversity,
      voterIsUorStudent: student.isUorStudent,
      projectUniversity,
    })) {
      const otherUniversityBonus = calculateExhibitorScoreEvent({
        action: "OTHER_UNIVERSITY_VOTE_BONUS",
        submissionCourse: submission.course,
        voterCourse: student.course,
        config,
      });
      const otherUniversityBusinessKey = `other-university-vote:${eventKey}:${submission.id}:${student.id}`;
      const otherUniversityEvent = await tx.exhibitorScoreEvent.upsert({
        where: { businessKey: otherUniversityBusinessKey },
        update: {},
        create: {
          businessKey: otherUniversityBusinessKey,
          eventKey,
          submissionId: submission.id,
          studentId: student.id,
          actorStudentId: student.id,
          sourceType: "STUDENT_VOTE",
          sourceId,
          action: "OTHER_UNIVERSITY_VOTE_BONUS",
          role: "STUDENT",
          roundKey: roundContext.roundKey,
          roundLabel: roundContext.roundLabel,
          voterCourse: student.course ?? null,
          submissionCourse: submission.course ?? null,
          basePoints: otherUniversityBonus.basePoints,
          bonusPoints: otherUniversityBonus.bonusPoints,
          multiplier: otherUniversityBonus.multiplier,
          points: otherUniversityBonus.points,
          status: "VALID",
          reason: otherUniversityBonus.reason,
          metadataJson: stringifyMetadata({
            ruleApplied: "OTHER_UNIVERSITY",
            studentNumber: student.studentNumber,
            voterUniversity: student.university ?? null,
            voterUniversityKey: voterUniversity,
            projectUniversityKey: projectUniversity,
            eligibleForRoundMultiplier: otherUniversityBonus.eligibleForRoundMultiplier,
          }),
          scoreConfigVersion: config.version,
          awardedAt,
        },
      });

      if (otherUniversityEvent.sourceId === sourceId) {
        scoringEvents.push(buildEventResult(
          otherUniversityBonus,
          otherUniversityBusinessKey,
          "STUDENT_VOTE",
          sourceId,
        ));
        scoreDelta += otherUniversityBonus.points;
      }
    }

    return {
      accepted: true,
      message: "Voto registado com pontuação do expositor.",
      votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
      score: await getSubmissionScore(tx, submission.id),
      scoreDelta,
      scoringEvents,
    };
  });
}

export async function recordJuryProjectVoteScore(
  input: RecordJuryProjectVoteScoreInput,
  db = prisma,
): Promise<RecordStudentProjectVoteScoreResult> {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();

  return asScoreDatabase(db).$transaction(async (transactionClient: unknown) => {
    const tx = asScoreDatabase(transactionClient as typeof prisma);
    const config = await loadActiveScoreConfig(tx, eventKey);
    const roundContext = resolveRoundContext({
      config,
      awardedAt,
      roundKey: input.roundKey ?? null,
      roundLabel: input.roundLabel ?? null,
      roundMultiplier: input.roundMultiplier,
    });
    const [jury, submission] = await Promise.all([
      tx.juryMember.findUnique({
        where: { id: input.juryId },
        select: {
          id: true,
          name: true,
          phone: true,
          isActive: true,
        },
      }),
      tx.submission.findFirst({
        where: {
          id: input.submissionId,
          status: "APPROVED",
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          area: true,
          course: true,
        },
      }),
    ]);

    if (!jury || !jury.isActive) {
      throw new Error("Jury member not found");
    }

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!isCompetitionEligible(submission.type, submission.area)) {
      throw new Error("Submission not eligible for voting");
    }

    const businessKey = `jury-vote:${eventKey}:${submission.id}:${jury.id}`;
    const existing = await tx.exhibitorScoreEvent.findUnique({
      where: { businessKey },
    });
    const juryScore = calculateExhibitorScoreEvent({
      action: "JURY_VOTE",
      submissionCourse: submission.course,
      roundMultiplier: input.roundMultiplier,
      config,
    });

    if (existing) {
      return {
        accepted: true,
        message: "Voto de júri já registado anteriormente.",
        votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
        score: await getSubmissionScore(tx, submission.id),
        scoreDelta: 0,
        scoringEvents: [],
      };
    }

    await tx.exhibitorScoreEvent.create({
      data: {
        businessKey,
        eventKey,
        submissionId: submission.id,
        sourceType: "JURY_VOTE",
        sourceId: String(jury.id),
        action: "JURY_VOTE",
        role: "JURY",
        roundKey: roundContext.roundKey,
        roundLabel: roundContext.roundLabel,
        submissionCourse: submission.course ?? null,
        basePoints: juryScore.basePoints,
        bonusPoints: juryScore.bonusPoints,
        multiplier: juryScore.multiplier,
        points: juryScore.points,
        status: "VALID",
        reason: juryScore.reason,
        metadataJson: stringifyMetadata({
          juryId: jury.id,
          juryPhone: input.juryPhone,
          juryName: jury.name,
          submissionName: submission.name,
        }),
        scoreConfigVersion: config.version,
        awardedAt,
      },
    });

    return {
      accepted: true,
      message: "Voto de júri registado com pontuação do expositor.",
      votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
      score: await getSubmissionScore(tx, submission.id),
      scoreDelta: juryScore.points,
      scoringEvents: [buildEventResult(juryScore, businessKey, "JURY_VOTE", String(jury.id))],
    };
  });
}

export async function recordExhibitorScoreAdjustment(
  input: RecordExhibitorScoreAdjustmentInput,
  db = prisma,
): Promise<RecordStudentProjectVoteScoreResult> {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();
  const sourceType = input.sourceType.trim().toUpperCase();
  const sourceId = input.sourceId.trim();
  const businessKey = `score-adjustment:${eventKey}:${input.submissionId}:${input.action}:${sourceType}:${sourceId}`;
  const reason = input.reason.trim();

  if (!sourceType || !sourceId) {
    throw new Error("Score adjustment source is required");
  }

  if (reason.length < 3) {
    throw new Error("Score adjustment reason is required");
  }

  if (!Number.isFinite(input.points) || input.points === 0) {
    throw new Error("Score adjustment points must be non-zero");
  }

  if (input.action === "PENALTY" && input.points > 0) {
    throw new Error("Penalty points must be negative");
  }

  return asScoreDatabase(db).$transaction(async (transactionClient: unknown) => {
    const tx = asScoreDatabase(transactionClient as typeof prisma);
    const config = await loadActiveScoreConfig(tx, eventKey);
    const roundContext = resolveRoundContext({
      config,
      awardedAt,
      roundKey: input.roundKey ?? null,
      roundLabel: input.roundLabel ?? null,
    });
    const submission = await tx.submission.findFirst({
      where: {
        id: input.submissionId,
        status: "APPROVED",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        area: true,
        course: true,
      },
    });

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!isCompetitionEligible(submission.type, submission.area)) {
      throw new Error("Submission not eligible for scoring");
    }

    const existing = await tx.exhibitorScoreEvent.findUnique({
      where: { businessKey },
    });

    if (existing) {
      return {
        accepted: true,
        message: "Evento de pontuação já registado anteriormente.",
        votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
        score: await getSubmissionScore(tx, submission.id),
        scoreDelta: 0,
        scoringEvents: [],
      };
    }

    const basePoints = input.action === "QUALIFIED_FEEDBACK" ? 0 : input.points;
    const bonusPoints = input.action === "QUALIFIED_FEEDBACK" ? input.points : 0;
    const adjustmentEvent: CalculatedExhibitorScoreEvent = {
      action: input.action,
      basePoints,
      bonusPoints,
      multiplier: 1,
      points: input.points,
      eligibleForRoundMultiplier: false,
      reason,
    };

    await tx.exhibitorScoreEvent.upsert({
      where: { businessKey },
      update: {},
      create: {
        businessKey,
        eventKey,
        submissionId: submission.id,
        studentId: input.studentId ?? null,
        actorStudentId: input.actorStudentId ?? null,
        submissionMemberId: input.submissionMemberId ?? null,
        sourceType,
        sourceId,
        action: input.action,
        role: input.role ?? null,
        roundKey: roundContext.roundKey,
        roundLabel: roundContext.roundLabel,
        submissionCourse: submission.course ?? null,
        basePoints,
        bonusPoints,
        multiplier: 1,
        points: input.points,
        status: "VALID",
        reason,
        metadataJson: stringifyMetadata({
          submissionName: submission.name,
          ...(input.metadata ?? {}),
        }),
        scoreConfigVersion: config.version,
        createdByStudentNumber: input.createdByStudentNumber ?? null,
        awardedAt,
      },
    });

    return {
      accepted: true,
      message: "Evento de pontuação registado.",
      votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
      score: await getSubmissionScore(tx, submission.id),
      scoreDelta: input.points,
      scoringEvents: [buildEventResult(adjustmentEvent, businessKey, sourceType, sourceId)],
    };
  });
}

export async function recordEmptyStandPenalty(
  input: RecordEmptyStandPenaltyInput,
  db = prisma,
): Promise<RecordStudentProjectVoteScoreResult> {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();

  return asScoreDatabase(db).$transaction(async (transactionClient: unknown) => {
    const tx = asScoreDatabase(transactionClient as typeof prisma);
    const config = await loadActiveScoreConfig(tx, eventKey);
    const roundContext = resolveRoundContext({
      config,
      awardedAt,
      roundKey: input.roundKey,
      roundLabel: input.roundLabel ?? null,
    });
    const roundKey = roundContext.roundKey ?? input.roundKey;
    const submission = await tx.submission.findFirst({
      where: {
        id: input.submissionId,
        status: "APPROVED",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        area: true,
        course: true,
      },
    });

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!isCompetitionEligible(submission.type, submission.area)) {
      throw new Error("Submission not eligible for scoring");
    }

    const dutyEvents = await tx.exhibitorScoreEvent.findMany({
      where: {
        eventKey,
        submissionId: submission.id,
        roundKey,
        action: { in: ["EXHIBITOR_CHECK_IN", "EXHIBITOR_CHECK_OUT"] },
        status: "VALID",
        revokedAt: null,
      },
      select: {
        submissionMemberId: true,
        action: true,
        role: true,
        awardedAt: true,
      },
      orderBy: { awardedAt: "asc" },
    });
    const activeExhibitors = collectActiveExhibitors(dutyEvents);

    if (activeExhibitors.size > 0) {
      return {
        accepted: true,
        message: "Stand com expositor ativo; penalização não aplicada.",
        votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
        score: await getSubmissionScore(tx, submission.id),
        scoreDelta: 0,
        scoringEvents: [],
      };
    }

    const businessKey = `stand-empty-penalty:${eventKey}:${submission.id}:${roundKey}`;
    const existing = await tx.exhibitorScoreEvent.findUnique({
      where: { businessKey },
    });

    if (existing) {
      return {
        accepted: true,
        message: "Penalização de stand vazio já registada anteriormente.",
        votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
        score: await getSubmissionScore(tx, submission.id),
        scoreDelta: 0,
        scoringEvents: [],
      };
    }

    const points = config.weights.lightPenalty;
    const penaltyEvent: CalculatedExhibitorScoreEvent = {
      action: "PENALTY",
      basePoints: points,
      bonusPoints: 0,
      multiplier: 1,
      points,
      eligibleForRoundMultiplier: false,
      reason: "Stand sem expositor ativo na ronda.",
    };

    await tx.exhibitorScoreEvent.upsert({
      where: { businessKey },
      update: {},
      create: {
        businessKey,
        eventKey,
        submissionId: submission.id,
        sourceType: "STAND_EMPTY",
        sourceId: roundKey,
        action: "PENALTY",
        role: "EXPOSITOR",
        roundKey,
        roundLabel: roundContext.roundLabel ?? input.roundLabel ?? null,
        submissionCourse: submission.course ?? null,
        basePoints: points,
        bonusPoints: 0,
        multiplier: 1,
        points,
        status: "VALID",
        reason: penaltyEvent.reason,
        metadataJson: stringifyMetadata({
          submissionName: submission.name,
          activeExhibitors: 0,
          ...(input.metadata ?? {}),
        }),
        scoreConfigVersion: config.version,
        createdByStudentNumber: input.createdByStudentNumber ?? null,
        awardedAt,
      },
    });

    return {
      accepted: true,
      message: "Penalização de stand vazio registada.",
      votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
      score: await getSubmissionScore(tx, submission.id),
      scoreDelta: points,
      scoringEvents: [buildEventResult(penaltyEvent, businessKey, "STAND_EMPTY", roundKey)],
    };
  });
}

export async function recordExhibitorMemberDuty(
  input: RecordExhibitorMemberDutyInput,
  db = prisma,
): Promise<RecordStudentProjectVoteScoreResult> {
  const eventKey = input.eventKey ?? "main-event";
  const awardedAt = input.awardedAt ?? new Date();

  return asScoreDatabase(db).$transaction(async (transactionClient: unknown) => {
    const tx = asScoreDatabase(transactionClient as typeof prisma);
    const config = await loadActiveScoreConfig(tx, eventKey);
    const roundContext = resolveRoundContext({
      config,
      awardedAt,
      roundKey: input.roundKey ?? null,
      roundLabel: input.roundLabel ?? null,
    });
    const roundKey = roundContext.roundKey ?? "global";
    const [submission, member] = await Promise.all([
      tx.submission.findFirst({
        where: {
          id: input.submissionId,
          status: "APPROVED",
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          area: true,
          course: true,
        },
      }),
      tx.submissionMember.findFirst({
        where: {
          id: input.submissionMemberId,
          submissionId: input.submissionId,
        },
        select: {
          id: true,
          submissionId: true,
          studentId: true,
          studentNumber: true,
          name: true,
          confirmedAt: true,
        },
      }),
    ]);

    if (!submission) {
      throw new Error("Submission not found");
    }

    if (!isCompetitionEligible(submission.type, submission.area)) {
      throw new Error("Submission not eligible for scoring");
    }

    if (!member) {
      throw new Error("Submission member not found");
    }

    if (input.action === "EXHIBITOR_CHECK_IN" && input.role === "EXPOSITOR") {
      const dutyEvents = await tx.exhibitorScoreEvent.findMany({
        where: {
          eventKey,
          submissionId: submission.id,
          roundKey,
          action: { in: ["EXHIBITOR_CHECK_IN", "EXHIBITOR_CHECK_OUT"] },
          status: "VALID",
          revokedAt: null,
        },
        select: {
          submissionMemberId: true,
          action: true,
          role: true,
          awardedAt: true,
        },
        orderBy: { awardedAt: "asc" },
      });
      const activeExhibitors = collectActiveExhibitors(dutyEvents);

      activeExhibitors.delete(member.id);
      if (activeExhibitors.size >= 2) {
        throw new Error("Apenas 2 membros podem estar ativos no stand em simultâneo.");
      }
    }

    const sourceId = `${member.id}:${roundKey}`;
    const businessKey = `member-duty:${eventKey}:${submission.id}:${member.id}:${roundKey}:${input.action}`;
    const dutyEvent: CalculatedExhibitorScoreEvent = {
      action: input.action,
      basePoints: 0,
      bonusPoints: 0,
      multiplier: 1,
      points: 0,
      eligibleForRoundMultiplier: false,
      reason: input.action === "EXHIBITOR_CHECK_IN"
        ? "Check-in de membro no Passaporte do Expositor"
        : "Check-out de membro no Passaporte do Expositor",
    };

    await tx.exhibitorScoreEvent.upsert({
      where: { businessKey },
      update: {},
      create: {
        businessKey,
        eventKey,
        submissionId: submission.id,
        studentId: member.studentId ?? null,
        actorStudentId: member.studentId ?? null,
        submissionMemberId: member.id,
        sourceType: "MEMBER_DUTY",
        sourceId,
        action: input.action,
        role: input.role,
        roundKey,
        roundLabel: roundContext.roundLabel ?? input.roundLabel ?? null,
        submissionCourse: submission.course ?? null,
        basePoints: 0,
        bonusPoints: 0,
        multiplier: 1,
        points: 0,
        status: "VALID",
        reason: dutyEvent.reason,
        metadataJson: stringifyMetadata({
          memberName: member.name,
          memberStudentNumber: member.studentNumber,
          confirmedAt: member.confirmedAt instanceof Date ? member.confirmedAt.toISOString() : member.confirmedAt,
          ...(input.metadata ?? {}),
        }),
        scoreConfigVersion: config.version,
        createdByStudentNumber: input.createdByStudentNumber ?? null,
        awardedAt,
      },
    });

    return {
      accepted: true,
      message: "Função do membro registada.",
      votesCount: await countSubmissionVotes(tx, submission.id, eventKey),
      score: await getSubmissionScore(tx, submission.id),
      scoreDelta: 0,
      scoringEvents: [buildEventResult(dutyEvent, businessKey, "MEMBER_DUTY", sourceId)],
    };
  });
}
