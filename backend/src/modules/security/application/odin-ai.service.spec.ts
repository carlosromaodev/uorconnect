import { describe, expect, it } from "vitest";
import {
  clampOdinAiProbability,
  normalizeOdinAiVerdict,
  presentOdinAiProbabilities,
} from "./odin-ai.service";

describe("ODIN AI probability handling", () => {
  it("normalizes provider probabilities returned in decimal or percent scale", () => {
    expect(clampOdinAiProbability(0.87, 50)).toBe(87);
    expect(clampOdinAiProbability("0.13", 50)).toBe(13);
    expect(clampOdinAiProbability("87%", 50)).toBe(87);
    expect(clampOdinAiProbability("texto", 42)).toBe(42);

    expect(normalizeOdinAiVerdict({
      fraud_probability: 0.91,
      legitimate_probability: 0.09,
    })).toMatchObject({
      fraudProbability: 91,
      legitimateProbability: 9,
    });
  });

  it("does not display 1% fraud when deterministic ODIN evidence is critical", () => {
    expect(presentOdinAiProbabilities({
      fraudProbability: 1,
      legitimateProbability: 99,
      riskScore: 100,
      unifiedRiskScore: 100,
      consistencyCheck: "FAILED",
    })).toEqual({
      fraudProbability: 100,
      legitimateProbability: 0,
    });
  });
});
