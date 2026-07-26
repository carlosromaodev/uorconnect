import { describe, expect, it } from "vitest";
import { calculateRequiredGrade, calculateWeightedAverage } from "./academic-engine";

describe("academic-engine", () => {
  it("calcula média decimal reproduzível e não transforma nota ausente em zero", () => {
    const result = calculateWeightedAverage([
      { key: "a", label: "Avaliação A", score: "15.5", weight: "0.4", official: true },
      { key: "b", label: "Avaliação B", score: 12, weight: "0.6", official: true },
      { key: "c", label: "Avaliação C", score: null, weight: "1", official: true },
    ]);
    expect(result).toMatchObject({ value: "13.40", considered: 2, missing: 1, totalWeight: "1" });
    expect(result.inputs[2]).toMatchObject({ score: null, included: false });
    expect(result.rule).toMatchObject({ code: "uor_student.observed_weighted_mean", version: 1 });
  });

  it("calcula a nota necessária e distingue alvo impossível", () => {
    expect(calculateRequiredGrade({
      completed: [{ key: "continuous", label: "Avaliação contínua", score: 12, weight: 0.4, official: true }],
      remainingWeight: 0.6,
      target: 10,
    })).toMatchObject({ status: "required", requiredScore: "8.67", completedWeight: "0.4", totalWeight: "1" });

    expect(calculateRequiredGrade({
      completed: [{ key: "continuous", label: "Avaliação contínua", score: 5, weight: 0.8, official: true }],
      remainingWeight: 0.2,
      target: 14,
    })).toMatchObject({ status: "impossible", requiredScore: null, gaps: ["target_not_reachable_with_remaining_weight"] });
  });

  it("falha fechado para notas fora da escala", () => {
    expect(() => calculateWeightedAverage([
      { key: "invalid", label: "Inválida", score: 21, weight: 1, official: true },
    ])).toThrow("ACADEMIC_SCORE_OUT_OF_RANGE");
  });
});
