import { describe, expect, it } from "vitest";
import { DEFAULT_EXHIBITOR_SCORE_CONFIG } from "./exhibitor-scoring.rules";
import {
  parseStoredExhibitorScoreConfig,
  resolveExhibitorScoreRound,
} from "./exhibitor-scoring.config";

describe("exhibitor scoring config", () => {
  it("merges stored weight, streak and round JSON with defaults", () => {
    const config = parseStoredExhibitorScoreConfig({
      version: 7,
      weightsJson: JSON.stringify({
        juryVote: 300,
        sameCourseVote: 1.5,
      }),
      streakBonusesJson: JSON.stringify([
        { minCourses: 3, points: 12 },
        { minCourses: 5, points: 40 },
      ]),
      roundsJson: JSON.stringify([
        {
          key: "r1",
          label: "Abertura",
          multiplier: 1.5,
          startsAt: "2026-05-15T08:00:00.000Z",
          endsAt: "2026-05-15T09:00:00.000Z",
          status: "ACTIVE",
        },
      ]),
    });

    expect(config.version).toBe(7);
    expect(config.weights.juryVote).toBe(300);
    expect(config.weights.sameCourseVote).toBe(1.5);
    expect(config.weights.differentCourseVote).toBe(DEFAULT_EXHIBITOR_SCORE_CONFIG.weights.differentCourseVote);
    expect(config.streakBonuses).toEqual([
      { minCourses: 5, points: 40 },
      { minCourses: 3, points: 12 },
    ]);
    expect(config.rounds).toEqual([
      {
        key: "r1",
        label: "Abertura",
        multiplier: 1.5,
        startsAt: "2026-05-15T08:00:00.000Z",
        endsAt: "2026-05-15T09:00:00.000Z",
        status: "ACTIVE",
      },
    ]);
  });

  it("falls back to default config when stored JSON is invalid", () => {
    const config = parseStoredExhibitorScoreConfig({
      version: 3,
      weightsJson: "{not-json",
      streakBonusesJson: "[]",
      roundsJson: "{}",
    });

    expect(config.version).toBe(3);
    expect(config.weights).toEqual(DEFAULT_EXHIBITOR_SCORE_CONFIG.weights);
    expect(config.streakBonuses).toEqual(DEFAULT_EXHIBITOR_SCORE_CONFIG.streakBonuses);
    expect(config.rounds).toEqual([]);
  });

  it("keeps the other-university vote bonus configurable with a safe default", () => {
    const custom = parseStoredExhibitorScoreConfig({
      version: 2,
      weightsJson: JSON.stringify({
        otherUniversityVoteBonus: 4,
      }),
    });
    const fallback = parseStoredExhibitorScoreConfig({
      version: 3,
      weightsJson: JSON.stringify({}),
    });

    expect(custom.weights.otherUniversityVoteBonus).toBe(4);
    expect(fallback.weights.otherUniversityVoteBonus).toBe(3);
  });

  it("resolves an explicit round key before time matching", () => {
    const config = parseStoredExhibitorScoreConfig({
      version: 1,
      weightsJson: "{}",
      streakBonusesJson: "[]",
      roundsJson: JSON.stringify([
        {
          key: "morning",
          label: "Manha",
          multiplier: 1.5,
          startsAt: "2026-05-15T08:00:00.000Z",
          endsAt: "2026-05-15T09:00:00.000Z",
          status: "ACTIVE",
        },
        {
          key: "final",
          label: "Sprint final",
          multiplier: 2,
          startsAt: "2026-05-15T10:00:00.000Z",
          endsAt: "2026-05-15T11:00:00.000Z",
          status: "ACTIVE",
        },
      ]),
    });

    expect(resolveExhibitorScoreRound({
      config,
      awardedAt: new Date("2026-05-15T08:30:00.000Z"),
      roundKey: "final",
    })).toEqual({
      key: "final",
      label: "Sprint final",
      multiplier: 2,
    });
  });

  it("resolves the active round by award time and ignores frozen or inactive rounds", () => {
    const config = parseStoredExhibitorScoreConfig({
      version: 1,
      weightsJson: "{}",
      streakBonusesJson: "[]",
      roundsJson: JSON.stringify([
        {
          key: "inactive",
          label: "Inativa",
          multiplier: 5,
          startsAt: "2026-05-15T08:00:00.000Z",
          endsAt: "2026-05-15T09:00:00.000Z",
          status: "FROZEN",
        },
        {
          key: "valid",
          label: "Valida",
          multiplier: 1.2,
          startsAt: "2026-05-15T08:00:00.000Z",
          endsAt: "2026-05-15T09:00:00.000Z",
          status: "ACTIVE",
        },
      ]),
    });

    expect(resolveExhibitorScoreRound({
      config,
      awardedAt: new Date("2026-05-15T08:30:00.000Z"),
    })).toEqual({
      key: "valid",
      label: "Valida",
      multiplier: 1.2,
    });
  });

  it("returns a neutral round when no round matches", () => {
    const config = parseStoredExhibitorScoreConfig({
      version: 1,
      weightsJson: "{}",
      streakBonusesJson: "[]",
      roundsJson: "[]",
    });

    expect(resolveExhibitorScoreRound({
      config,
      awardedAt: new Date("2026-05-15T08:30:00.000Z"),
    })).toEqual({
      key: null,
      label: null,
      multiplier: 1,
    });
  });
});
