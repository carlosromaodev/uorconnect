export type ExhibitorScoreAction =
  | "STUDENT_VOTE"
  | "FIRST_COURSE_VOTE_BONUS"
  | "OTHER_UNIVERSITY_VOTE_BONUS"
  | "JURY_VOTE"
  | "QUALIFIED_FEEDBACK"
  | "STAND_VISIT"
  | "STAND_BONUS"
  | "AMBASSADOR_MISSION"
  | "EXHIBITOR_MISSION"
  | "TEAM_BONUS"
  | "PENALTY"
  | "SELF_VOTE_ATTEMPT"
  | "EXHIBITOR_CHECK_IN"
  | "EXHIBITOR_CHECK_OUT";

export type ExhibitorScoreConfig = {
  version: number;
  weights: {
    sameCourseVote: number;
    differentCourseVote: number;
    firstCourseVoteBonus: number;
    otherUniversityVoteBonus: number;
    qualifiedFeedback: number;
    juryVote: number;
    standVisit: number;
    lightPenalty: number;
    selfVoteAbusePenalty: number;
  };
  streakBonuses: Array<{
    minCourses: number;
    points: number;
  }>;
  rounds?: Array<{
    key: string;
    label: string;
    multiplier: number;
    startsAt: string;
    endsAt: string;
    status: "ACTIVE" | "FROZEN" | "CLOSED" | "DRAFT";
  }>;
};

export type CalculateExhibitorScoreEventInput = {
  action: ExhibitorScoreAction;
  submissionCourse?: string | null;
  voterCourse?: string | null;
  isFirstVoteFromCourse?: boolean;
  roundMultiplier?: number;
  config?: ExhibitorScoreConfig;
};

export type CalculatedExhibitorScoreEvent = {
  action: ExhibitorScoreAction;
  basePoints: number;
  bonusPoints: number;
  multiplier: number;
  points: number;
  eligibleForRoundMultiplier: boolean;
  reason: string;
};

export const DEFAULT_EXHIBITOR_SCORE_CONFIG: ExhibitorScoreConfig = {
  version: 1,
  weights: {
    sameCourseVote: 1,
    differentCourseVote: 2,
    firstCourseVoteBonus: 3,
    otherUniversityVoteBonus: 3,
    qualifiedFeedback: 2,
    juryVote: 500,
    standVisit: 1,
    lightPenalty: -10,
    selfVoteAbusePenalty: -50,
  },
  streakBonuses: [
    { minCourses: 10, points: 55 },
    { minCourses: 8, points: 35 },
    { minCourses: 6, points: 20 },
    { minCourses: 4, points: 10 },
  ],
};

export function normalizeScoreCourse(value?: string | null) {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeScoreUniversity(value?: string | null) {
  const normalized = normalizeScoreCourse(value);
  if (!normalized) return "";
  if (["uor", "universidade oscar ribas", "universidade oscar ribas uor"].includes(normalized)) {
    return "universidade oscar ribas";
  }
  if (
    [
      "isptec",
      "instituto superior politecnico de tecnologias e ciencias",
      "instituto superior politecnico de tecnologias e ciencias isptec",
    ].includes(normalized)
  ) {
    return "isptec";
  }
  return normalized;
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function sanitizeMultiplier(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return value;
}

function sameCourse(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeScoreCourse(left);
  const normalizedRight = normalizeScoreCourse(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function calculateExhibitorScoreEvent(
  input: CalculateExhibitorScoreEventInput,
): CalculatedExhibitorScoreEvent {
  const config = input.config ?? DEFAULT_EXHIBITOR_SCORE_CONFIG;

  if (input.action === "SELF_VOTE_ATTEMPT") {
    return {
      action: input.action,
      basePoints: 0,
      bonusPoints: 0,
      multiplier: 1,
      points: 0,
      eligibleForRoundMultiplier: false,
      reason: "Auto-voto anulado",
    };
  }

  if (input.action === "JURY_VOTE") {
    return {
      action: input.action,
      basePoints: config.weights.juryVote,
      bonusPoints: 0,
      multiplier: 1,
      points: config.weights.juryVote,
      eligibleForRoundMultiplier: false,
      reason: "Voto de júri",
    };
  }

  if (input.action === "QUALIFIED_FEEDBACK") {
    return {
      action: input.action,
      basePoints: config.weights.qualifiedFeedback,
      bonusPoints: 0,
      multiplier: 1,
      points: config.weights.qualifiedFeedback,
      eligibleForRoundMultiplier: false,
      reason: "Feedback qualificado aprovado",
    };
  }

  if (input.action === "OTHER_UNIVERSITY_VOTE_BONUS") {
    return {
      action: input.action,
      basePoints: 0,
      bonusPoints: config.weights.otherUniversityVoteBonus,
      multiplier: 1,
      points: config.weights.otherUniversityVoteBonus,
      eligibleForRoundMultiplier: false,
      reason: "Voto de outra universidade/instituição",
    };
  }

  if (input.action === "STAND_VISIT") {
    const multiplier = sanitizeMultiplier(input.roundMultiplier);
    return {
      action: input.action,
      basePoints: config.weights.standVisit,
      bonusPoints: 0,
      multiplier,
      points: roundScore(config.weights.standVisit * multiplier),
      eligibleForRoundMultiplier: true,
      reason: "Visita confirmada ao stand",
    };
  }

  if (input.action === "PENALTY") {
    return {
      action: input.action,
      basePoints: config.weights.lightPenalty,
      bonusPoints: 0,
      multiplier: 1,
      points: config.weights.lightPenalty,
      eligibleForRoundMultiplier: false,
      reason: "Penalização operacional",
    };
  }

  if (input.action === "STUDENT_VOTE") {
    const isSameCourse = sameCourse(input.submissionCourse, input.voterCourse);
    const basePoints = isSameCourse
      ? config.weights.sameCourseVote
      : config.weights.differentCourseVote;
    const bonusPoints = input.isFirstVoteFromCourse ? config.weights.firstCourseVoteBonus : 0;
    const multiplier = sanitizeMultiplier(input.roundMultiplier);

    return {
      action: input.action,
      basePoints,
      bonusPoints,
      multiplier,
      points: roundScore((basePoints + bonusPoints) * multiplier),
      eligibleForRoundMultiplier: true,
      reason: isSameCourse
        ? "Voto de estudante do mesmo curso"
        : input.isFirstVoteFromCourse
          ? "Voto de estudante de curso diferente com bónus de curso novo"
          : "Voto de estudante de curso diferente",
    };
  }

  return {
    action: input.action,
    basePoints: 0,
    bonusPoints: 0,
    multiplier: 1,
    points: 0,
    eligibleForRoundMultiplier: false,
    reason: "Evento sem pontuação automática",
  };
}

export function getCourseDiversityStreakBonus(
  streakLength: number,
  config: ExhibitorScoreConfig = DEFAULT_EXHIBITOR_SCORE_CONFIG,
) {
  if (!Number.isFinite(streakLength) || streakLength < 2) return 0;
  const match = config.streakBonuses
    .slice()
    .sort((left, right) => right.minCourses - left.minCourses)
    .find((bonus) => streakLength >= bonus.minCourses);

  return match?.points ?? 0;
}
