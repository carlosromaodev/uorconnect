import { describe, expect, it } from "vitest";
import {
  buildGeminiGenerationConfig,
  buildOdinAiStudentProfile,
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

  it("limits Gemini 2.5 output and disables thinking for fast ODIN responses", () => {
    expect(buildGeminiGenerationConfig("gemini-2.5-flash")).toMatchObject({
      responseMimeType: "application/json",
      maxOutputTokens: 1400,
      thinkingConfig: { thinkingBudget: 0 },
    });
    expect(buildGeminiGenerationConfig("gemini-2.0-flash")).not.toHaveProperty("thinkingConfig");
  });

  it("summarizes student database integrity without treating temporary accounts as official", () => {
    const profile = buildOdinAiStudentProfile({
      id: 77,
      studentNumber: "tmp-uor-0001",
      name: null,
      email: null,
      course: null,
      phone: null,
      avatarUrl: null,
      university: null,
      registrationSource: "CONVENTIONAL_SMS",
      academicSyncedAt: null,
      profileCompletedAt: null,
      deletedAt: new Date("2026-05-18T09:00:00.000Z"),
      deletionReason: "Conta duplicada",
      lastLoginAt: null,
      createdAt: new Date("2026-05-18T08:00:00.000Z"),
      _count: {
        loginAudits: 0,
        votes: 2,
        likes: 0,
        comments: 0,
        passportScans: 1,
        passportPointLedger: 1,
        submissionMemberships: 0,
        submissions: 0,
      },
    });

    expect(profile.accessType).toBe("TEMPORARY");
    expect(profile.integrityFlags).toEqual(expect.arrayContaining([
      "CONTA_ELIMINADA",
      "CONTA_TEMPORARIA",
      "NOME_EM_FALTA",
      "CURSO_EM_FALTA",
      "CONTACTO_EM_FALTA",
      "PERFIL_INCOMPLETO",
    ]));
    expect(profile.behaviorSummary).toMatchObject({
      loginAuditCount: 0,
      voteCount: 2,
      passportScanCount: 1,
    });
  });

  it("removes secrets from the Gemini payload even when attached accidentally", () => {
    const payload = buildOdinAiCasePayload({
      ...baseCase,
      studentDatabaseContext: {
        students: [{
          studentNumber: "20260001",
          name: "Ana",
          password: "senha-que-nao-pode-sair",
          token: "token-privado",
          codeHash: "hash-secreto",
          providerResponseJson: "{\"raw\":true}",
        }],
      },
    } as OdinAiCaseContext);

    const serialized = JSON.stringify(payload);

    expect(serialized).toContain("studentDatabaseContext");
    expect(serialized).toContain("20260001");
    expect(serialized).not.toContain("senha-que-nao-pode-sair");
    expect(serialized).not.toContain("token-privado");
    expect(serialized).not.toContain("hash-secreto");
    expect(serialized).not.toContain("providerResponseJson");
  });
});
