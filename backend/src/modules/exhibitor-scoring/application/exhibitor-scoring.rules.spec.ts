import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXHIBITOR_SCORE_CONFIG,
  calculateExhibitorScoreEvent,
  getCourseDiversityStreakBonus,
  normalizeScoreCourse,
} from "./exhibitor-scoring.rules";

describe("exhibitor scoring rules", () => {
  it("awards same-course student votes without course bonus using the round multiplier", () => {
    const event = calculateExhibitorScoreEvent({
      action: "STUDENT_VOTE",
      submissionCourse: "Engenharia Informática",
      voterCourse: "Engenharia Informática",
      isFirstVoteFromCourse: false,
      roundMultiplier: 1.5,
      config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
    });

    expect(event).toEqual({
      action: "STUDENT_VOTE",
      basePoints: 1,
      bonusPoints: 0,
      multiplier: 1.5,
      points: 1.5,
      eligibleForRoundMultiplier: true,
      reason: "Voto de estudante do mesmo curso",
    });
  });

  it("awards different-course student votes with first-course bonus once before the multiplier", () => {
    const event = calculateExhibitorScoreEvent({
      action: "STUDENT_VOTE",
      submissionCourse: "Engenharia Informática",
      voterCourse: "Gestão",
      isFirstVoteFromCourse: true,
      roundMultiplier: 2,
      config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
    });

    expect(event.basePoints).toBe(2);
    expect(event.bonusPoints).toBe(3);
    expect(event.points).toBe(10);
    expect(event.reason).toBe("Voto de estudante de curso diferente com bónus de curso novo");
  });

  it("keeps jury vote exclusive and immune to student multipliers", () => {
    const event = calculateExhibitorScoreEvent({
      action: "JURY_VOTE",
      submissionCourse: "Engenharia Informática",
      voterCourse: "Gestão",
      isFirstVoteFromCourse: true,
      roundMultiplier: 2,
      config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
    });

    expect(event).toEqual({
      action: "JURY_VOTE",
      basePoints: 500,
      bonusPoints: 0,
      multiplier: 1,
      points: 500,
      eligibleForRoundMultiplier: false,
      reason: "Voto de júri",
    });
  });

  it("awards other-university votes as an auditable non-multiplied bonus", () => {
    const event = calculateExhibitorScoreEvent({
      action: "OTHER_UNIVERSITY_VOTE_BONUS",
      submissionCourse: "Engenharia Informática",
      voterCourse: "Gestão",
      roundMultiplier: 2,
      config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
    });

    expect(event).toEqual({
      action: "OTHER_UNIVERSITY_VOTE_BONUS",
      basePoints: 0,
      bonusPoints: 3,
      multiplier: 1,
      points: 3,
      eligibleForRoundMultiplier: false,
      reason: "Voto de outra universidade/instituição",
    });
  });

  it("rejects self votes as zero-point cancelled events", () => {
    const event = calculateExhibitorScoreEvent({
      action: "SELF_VOTE_ATTEMPT",
      submissionCourse: "Engenharia Informática",
      voterCourse: "Gestão",
      isFirstVoteFromCourse: true,
      roundMultiplier: 2,
      config: DEFAULT_EXHIBITOR_SCORE_CONFIG,
    });

    expect(event.points).toBe(0);
    expect(event.reason).toBe("Auto-voto anulado");
    expect(event.eligibleForRoundMultiplier).toBe(false);
  });

  it.each([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 10],
    [6, 20],
    [8, 35],
    [10, 55],
    [12, 55],
  ])("maps a %i-course diversity streak to %i bonus points", (streak, expected) => {
    expect(getCourseDiversityStreakBonus(streak, DEFAULT_EXHIBITOR_SCORE_CONFIG)).toBe(expected);
  });

  it("normalizes course names for uniqueness checks", () => {
    expect(normalizeScoreCourse("  Engenharia Informática ")).toBe("engenharia informatica");
    expect(normalizeScoreCourse("Gestão")).toBe("gestao");
  });
});
