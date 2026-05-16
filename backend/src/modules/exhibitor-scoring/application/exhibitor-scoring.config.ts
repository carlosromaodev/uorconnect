import {
  DEFAULT_EXHIBITOR_SCORE_CONFIG,
  type ExhibitorScoreConfig,
} from "./exhibitor-scoring.rules";

type StoredExhibitorScoreConfig = {
  version?: number | null;
  weightsJson?: string | null;
  streakBonusesJson?: string | null;
  roundsJson?: string | null;
};

export type ExhibitorScoreRound = NonNullable<ExhibitorScoreConfig["rounds"]>[number];

type ResolvedExhibitorScoreRound = {
  key: string | null;
  label: string | null;
  multiplier: number;
};

function readJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseWeights(value: unknown): ExhibitorScoreConfig["weights"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_EXHIBITOR_SCORE_CONFIG.weights;
  }

  const record = value as Record<string, unknown>;
  return {
    sameCourseVote: finiteNumber(record.sameCourseVote, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.sameCourseVote),
    differentCourseVote: finiteNumber(record.differentCourseVote, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.differentCourseVote),
    firstCourseVoteBonus: finiteNumber(record.firstCourseVoteBonus, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.firstCourseVoteBonus),
    otherUniversityVoteBonus: finiteNumber(record.otherUniversityVoteBonus, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.otherUniversityVoteBonus),
    qualifiedFeedback: finiteNumber(record.qualifiedFeedback, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.qualifiedFeedback),
    juryVote: finiteNumber(record.juryVote, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.juryVote),
    standVisit: finiteNumber(record.standVisit, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.standVisit),
    lightPenalty: finiteNumber(record.lightPenalty, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.lightPenalty),
    selfVoteAbusePenalty: finiteNumber(record.selfVoteAbusePenalty, DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.selfVoteAbusePenalty),
  };
}

function parseStreakBonuses(value: unknown): ExhibitorScoreConfig["streakBonuses"] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_EXHIBITOR_SCORE_CONFIG.streakBonuses;
  }

  const bonuses = value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const minCourses = finiteNumber(record.minCourses, 0);
      const points = finiteNumber(record.points, 0);
      if (minCourses < 2 || points <= 0) return null;
      return {
        minCourses: Math.trunc(minCourses),
        points,
      };
    })
    .filter((item): item is { minCourses: number; points: number } => Boolean(item));

  if (bonuses.length === 0) return DEFAULT_EXHIBITOR_SCORE_CONFIG.streakBonuses;
  return bonuses.sort((left, right) => right.minCourses - left.minCourses);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function parseRounds(value: unknown): ExhibitorScoreRound[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const key = typeof record.key === "string" ? record.key.trim() : "";
      const label = typeof record.label === "string" ? record.label.trim() : key;
      const multiplier = finiteNumber(record.multiplier, 1);
      const startsAt = record.startsAt;
      const endsAt = record.endsAt;
      const status = typeof record.status === "string" ? record.status.trim().toUpperCase() : "ACTIVE";

      if (!key || !label || multiplier <= 0 || !isIsoDate(startsAt) || !isIsoDate(endsAt)) {
        return null;
      }

      return {
        key,
        label,
        multiplier,
        startsAt,
        endsAt,
        status: ["ACTIVE", "FROZEN", "CLOSED", "DRAFT"].includes(status)
          ? status as ExhibitorScoreRound["status"]
          : "ACTIVE",
      };
    })
    .filter((item): item is ExhibitorScoreRound => Boolean(item))
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
}

export function parseStoredExhibitorScoreConfig(
  stored?: StoredExhibitorScoreConfig | null,
): ExhibitorScoreConfig {
  if (!stored) {
    return {
      ...DEFAULT_EXHIBITOR_SCORE_CONFIG,
      rounds: DEFAULT_EXHIBITOR_SCORE_CONFIG.rounds ?? [],
    };
  }

  return {
    version: stored.version ?? DEFAULT_EXHIBITOR_SCORE_CONFIG.version,
    weights: parseWeights(readJson(stored.weightsJson)),
    streakBonuses: parseStreakBonuses(readJson(stored.streakBonusesJson)),
    rounds: parseRounds(readJson(stored.roundsJson)),
  };
}

export function resolveExhibitorScoreRound(input: {
  config: ExhibitorScoreConfig;
  awardedAt: Date;
  roundKey?: string | null;
}): ResolvedExhibitorScoreRound {
  const rounds = input.config.rounds ?? [];
  const explicitRoundKey = input.roundKey?.trim();
  const explicitRound = explicitRoundKey
    ? rounds.find((round) => round.key === explicitRoundKey)
    : null;

  const round = explicitRound ?? rounds.find((candidate) => {
    if (candidate.status !== "ACTIVE") return false;
    const startsAt = Date.parse(candidate.startsAt);
    const endsAt = Date.parse(candidate.endsAt);
    const awardedAt = input.awardedAt.getTime();
    return awardedAt >= startsAt && awardedAt <= endsAt;
  });

  if (!round) {
    return {
      key: null,
      label: null,
      multiplier: 1,
    };
  }

  return {
    key: round.key,
    label: round.label,
    multiplier: round.multiplier,
  };
}
