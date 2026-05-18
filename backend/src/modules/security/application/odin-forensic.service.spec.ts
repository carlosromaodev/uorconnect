import { describe, expect, it } from "vitest";
import {
  buildForensicVerdict,
  evaluateOdinAiConsistency,
  classifyForensicPattern,
  buildForensicQueue,
  type ForensicCaseSignals,
} from "./odin-forensic.service";

const scaleCredentialOperation: ForensicCaseSignals = {
  caseId: "DEVICE:8b250c64",
  entityLabel: "Device 8b250c64",
  riskScore: 100,
  distinctAccounts: 51,
  votes: 68,
  fragileAccounts: 16,
  officialAccounts: 35,
  medianLoginToVoteSeconds: 11,
  fastestLoginToVoteSeconds: 3,
  rapidAccountSwitches: 48,
  dominantProjectVotes: 60,
  projectMemberDevice: false,
  rankingTop3Affected: true,
  comments: [
    { content: "Aprendi sobre telecom em segundos", secondsAfterVote: 4 },
    { content: "Aprendi o que é gamificação", secondsAfterVote: 7 },
  ],
};

describe("ODIN forensic operations", () => {
  it("rejects AI probability that contradicts deterministic risk", () => {
    expect(evaluateOdinAiConsistency({
      ruleRiskScore: 100,
      aiFraudProbability: 1,
      confidenceLevel: "HIGH",
    })).toEqual({
      consistencyCheck: "FAILED",
      consistencyReason: "Score de regras crítico contradiz probabilidade AI inferior a 50%.",
    });
  });

  it("classifies large fast multi-account device as TIPO-A with immediate urgency", () => {
    const classification = classifyForensicPattern(scaleCredentialOperation);

    expect(classification.patternType).toBe("TIPO-A");
    expect(classification.actionUrgency).toBe("IMEDIATA");
    expect(classification.operationalState).toBe("FROZEN_REVIEW");
    expect(classification.nextStep).toContain("Cruzar logs");
    expect(classification.cannotBeFalsePositiveIf).toContain("80%");
  });

  it("classifies official shared lab device as TIPO-B without automatic freeze", () => {
    const classification = classifyForensicPattern({
      caseId: "DEVICE:lab",
      entityLabel: "Device laboratório",
      riskScore: 72,
      distinctAccounts: 6,
      votes: 7,
      fragileAccounts: 0,
      officialAccounts: 6,
      medianLoginToVoteSeconds: 90,
      fastestLoginToVoteSeconds: 38,
      rapidAccountSwitches: 0,
      dominantProjectVotes: 3,
      projectMemberDevice: false,
      rankingTop3Affected: false,
      comments: [],
    });

    expect(classification.patternType).toBe("TIPO-B");
    expect(classification.actionUrgency).toBe("24H");
    expect(classification.operationalState).toBe("AWAITING_PHYSICAL_CHECK");
    expect(classification.nextStep).toContain("Checklist presença");
  });

  it("classifies project member device as TIPO-C and asks for exhibitor response", () => {
    const classification = classifyForensicPattern({
      caseId: "EXHIBITOR:42",
      entityLabel: "Expositor SafeDrive",
      riskScore: 68,
      distinctAccounts: 6,
      votes: 8,
      fragileAccounts: 0,
      officialAccounts: 6,
      medianLoginToVoteSeconds: 480,
      fastestLoginToVoteSeconds: 22,
      rapidAccountSwitches: 1,
      dominantProjectVotes: 6,
      projectMemberDevice: true,
      rankingTop3Affected: false,
      comments: [],
    });

    expect(classification.patternType).toBe("TIPO-C");
    expect(classification.operationalState).toBe("AWAITING_EXHIBITOR_RESPONSE");
    expect(classification.notifyExpositor).toBe(true);
    expect(classification.nextStep).toContain("Confrontar expositor");
  });

  it("builds a queue ordered by urgency and ranking impact", () => {
    const queue = buildForensicQueue([
      { ...scaleCredentialOperation, caseId: "DEVICE:critical", rankingTop3Affected: true },
      {
        ...scaleCredentialOperation,
        caseId: "DEVICE:later",
        distinctAccounts: 2,
        votes: 2,
        fragileAccounts: 0,
        officialAccounts: 2,
        rapidAccountSwitches: 0,
        dominantProjectVotes: 1,
        rankingTop3Affected: false,
      },
    ]);

    expect(queue[0]).toMatchObject({
      caseId: "DEVICE:critical",
      actionUrgency: "IMEDIATA",
    });
    expect(queue[1].actionUrgency).toBe("PODE_ESPERAR");
  });

  it("builds forensic verdict with qualitative comment analysis", () => {
    const verdict = buildForensicVerdict({
      signals: scaleCredentialOperation,
      ai: {
        fraudProbability: 1,
        legitimateProbability: 99,
        confidenceLevel: "HIGH",
        evidenceSummary: "",
        commentAnalysis: "",
        recommendedAction: "",
      },
    });

    expect(verdict.consistencyCheck).toBe("FAILED");
    expect(verdict.unifiedRiskScore).toBe(100);
    expect(verdict.commentAnalysis).toContain("engajamento artificial");
    expect(verdict.recommendedAction).toContain("Cruz");
  });
});
