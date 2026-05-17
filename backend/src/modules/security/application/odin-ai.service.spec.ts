import { describe, expect, it } from "vitest";
import {
  buildOdinAiCasePayload,
  normalizeOdinAiVerdict,
  type OdinAiCaseContext,
} from "./odin-ai.service";

const baseCase: OdinAiCaseContext = {
  caseType: "DEVICE",
  caseId: "device-000000000001",
  generatedAt: "2026-05-18T10:00:00.000Z",
  windowHours: 48,
  riskScore: 88,
  riskLevel: "HIGH",
  reasons: [
    "Mesma cookie/dispositivo usada por 4 contas diferentes.",
    "Contas diferentes no mesmo dispositivo votaram no mesmo projeto.",
  ],
  summary: {
    totalEvents: 8,
    loginCount: 4,
    voteCount: 4,
    distinctStudents: 4,
    distinctProjects: 1,
  },
  subject: {
    label: "Dispositivo partilhado",
    studentNumber: null,
    projectName: null,
  },
  relatedEvents: [
    {
      eventType: "LOGIN_SUCCESS",
      studentNumber: "20260001",
      studentName: "Ana",
      studentCourse: "Engenharia Informática",
      targetType: null,
      targetId: null,
      targetLabel: null,
      createdAt: "2026-05-18T09:58:00.000Z",
    },
    {
      eventType: "PROJECT_VOTE",
      studentNumber: "20260001",
      studentName: "Ana",
      studentCourse: "Engenharia Informática",
      targetType: "Submission",
      targetId: 77,
      targetLabel: "UOR Connect",
      createdAt: "2026-05-18T09:59:00.000Z",
    },
  ],
  platformContext: {
    eventName: "UOR Connect",
    eventDate: "18/05/2026",
    currentPhase: "Votação presencial",
  },
};

describe("ODIN AI analysis service", () => {
  it("normalizes Gemini JSON into bounded probabilities and safe action types", () => {
    const verdict = normalizeOdinAiVerdict({
      narrative: "Dispositivo com uso coordenado.",
      fraud_probability: 187,
      legitimate_probability: -10,
      most_likely_scenario: "Coordenação manual.",
      alternative_scenario: "Laboratório partilhado.",
      recommendation: "Invalidar apenas os votos ligados ao padrão.",
      confidence_level: "alta",
      action_type: "SUSPEND_FOREVER",
    });

    expect(verdict).toEqual({
      narrative: "Dispositivo com uso coordenado.",
      fraudProbability: 100,
      legitimateProbability: 0,
      mostLikelyScenario: "Coordenação manual.",
      alternativeScenario: "Laboratório partilhado.",
      recommendation: "Invalidar apenas os votos ligados ao padrão.",
      confidenceLevel: "alta",
      actionType: "REVIEW",
    });
  });

  it("builds a Gemini payload that keeps the organization as final decision maker", () => {
    const payload = buildOdinAiCasePayload(baseCase);

    expect(payload.systemPrompt).toContain("Nunca afirmas certeza absoluta");
    expect(payload.systemPrompt).toContain("a decisão final é da organização");
    expect(payload.caseContext.caseType).toBe("DEVICE");
    expect(payload.caseContext.reasons).toHaveLength(2);
    expect(payload.caseContext.relatedEvents[0]).not.toHaveProperty("ipAddress");
    expect(payload.promptVersion).toMatch(/^odin-ai-v/);
  });
});
