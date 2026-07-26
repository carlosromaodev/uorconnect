import Decimal from "decimal.js";

export const DERIVED_AVERAGE_RULE = Object.freeze({
  code: "uor_student.observed_weighted_mean",
  version: 1,
  status: "derived_method" as const,
  formula: "sum(score × weight) / sum(weight)",
  scaleMin: "0",
  scaleMax: "20",
  decimalPlaces: 2,
});

export const SCHOLARSHIP_HYPOTHESIS_RULE = Object.freeze({
  code: "uor_student.scholarship_target_hypothesis",
  version: 1,
  status: "hypothesis" as const,
  target: "16",
  formula: "required = (target × totalWeight - completedWeightedSum) / remainingWeight",
});

export type AcademicScoreInput = {
  key: string;
  label: string;
  score: string | number | null;
  weight: string | number;
  official: boolean;
};

export type AcademicAverageResult = {
  value: string | null;
  considered: number;
  missing: number;
  totalWeight: string;
  rule: typeof DERIVED_AVERAGE_RULE;
  inputs: Array<{ key: string; label: string; score: string | null; weight: string; official: boolean; included: boolean }>;
};

function decimal(value: string | number, field: string) {
  try {
    const parsed = new Decimal(value);
    if (!parsed.isFinite()) throw new Error();
    return parsed;
  } catch {
    throw new Error(`ACADEMIC_${field.toUpperCase()}_INVALID`);
  }
}

export function calculateWeightedAverage(inputs: AcademicScoreInput[]): AcademicAverageResult {
  let weightedSum = new Decimal(0);
  let totalWeight = new Decimal(0);
  let considered = 0;
  let missing = 0;
  const normalized = inputs.map((input) => {
    const weight = decimal(input.weight, "weight");
    if (weight.lte(0)) throw new Error("ACADEMIC_WEIGHT_INVALID");
    if (input.score === null) {
      missing += 1;
      return { ...input, score: null, weight: weight.toString(), included: false };
    }
    const score = decimal(input.score, "score");
    if (score.lt(DERIVED_AVERAGE_RULE.scaleMin) || score.gt(DERIVED_AVERAGE_RULE.scaleMax)) {
      throw new Error("ACADEMIC_SCORE_OUT_OF_RANGE");
    }
    weightedSum = weightedSum.plus(score.times(weight));
    totalWeight = totalWeight.plus(weight);
    considered += 1;
    return { ...input, score: score.toString(), weight: weight.toString(), included: true };
  });
  return {
    value: totalWeight.isZero()
      ? null
      : weightedSum.div(totalWeight).toDecimalPlaces(DERIVED_AVERAGE_RULE.decimalPlaces, Decimal.ROUND_HALF_UP).toFixed(DERIVED_AVERAGE_RULE.decimalPlaces),
    considered,
    missing,
    totalWeight: totalWeight.toString(),
    rule: DERIVED_AVERAGE_RULE,
    inputs: normalized,
  };
}

export type RequiredGradeInput = {
  completed: AcademicScoreInput[];
  remainingWeight: string | number;
  target: string | number;
  scaleMin?: string | number;
  scaleMax?: string | number;
};

export type RequiredGradeResult = {
  status: "required" | "already_met" | "impossible" | "insufficient_information";
  requiredScore: string | null;
  target: string;
  remainingWeight: string;
  completedWeight: string;
  totalWeight: string;
  rule: { code: string; version: number; status: "calculation_method"; formula: string };
  gaps: string[];
};

export function calculateRequiredGrade(input: RequiredGradeInput): RequiredGradeResult {
  const remainingWeight = decimal(input.remainingWeight, "remaining_weight");
  const target = decimal(input.target, "target");
  const scaleMin = decimal(input.scaleMin ?? 0, "scale_min");
  const scaleMax = decimal(input.scaleMax ?? 20, "scale_max");
  const rule = {
    code: "uor_student.required_grade",
    version: 1,
    status: "calculation_method" as const,
    formula: "required = (target × totalWeight - completedWeightedSum) / remainingWeight",
  };
  if (remainingWeight.lte(0)) {
    return { status: "insufficient_information", requiredScore: null, target: target.toString(), remainingWeight: remainingWeight.toString(), completedWeight: "0", totalWeight: "0", rule, gaps: ["remaining_weight_must_be_positive"] };
  }
  let completedWeight = new Decimal(0);
  let completedWeightedSum = new Decimal(0);
  const gaps: string[] = [];
  for (const item of input.completed) {
    if (item.score === null) {
      gaps.push(`missing_score:${item.key}`);
      continue;
    }
    const score = decimal(item.score, "score");
    const weight = decimal(item.weight, "weight");
    if (weight.lte(0) || score.lt(scaleMin) || score.gt(scaleMax)) throw new Error("ACADEMIC_INPUT_OUT_OF_RANGE");
    completedWeight = completedWeight.plus(weight);
    completedWeightedSum = completedWeightedSum.plus(score.times(weight));
  }
  if (gaps.length) {
    return {
      status: "insufficient_information",
      requiredScore: null,
      target: target.toString(),
      remainingWeight: remainingWeight.toString(),
      completedWeight: completedWeight.toString(),
      totalWeight: completedWeight.plus(remainingWeight).toString(),
      rule,
      gaps,
    };
  }
  const totalWeight = completedWeight.plus(remainingWeight);
  const required = target.times(totalWeight).minus(completedWeightedSum).div(remainingWeight);
  const normalized = required.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  const status = required.lte(scaleMin) ? "already_met" : required.gt(scaleMax) ? "impossible" : "required";
  return {
    status,
    requiredScore: status === "already_met" ? scaleMin.toFixed(2) : status === "impossible" ? null : normalized,
    target: target.toString(),
    remainingWeight: remainingWeight.toString(),
    completedWeight: completedWeight.toString(),
    totalWeight: totalWeight.toString(),
    rule,
    gaps: status === "impossible" ? ["target_not_reachable_with_remaining_weight"] : [],
  };
}
