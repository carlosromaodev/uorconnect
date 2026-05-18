export type ForensicPatternType = "TIPO-A" | "TIPO-B" | "TIPO-C";
export type ForensicActionUrgency = "IMEDIATA" | "24H" | "PODE_ESPERAR";
export type ForensicConsistencyCheck = "PASSED" | "FAILED" | "NOT_EVALUATED";
export type ForensicOperationalState =
  | "OPEN"
  | "ANALYSIS_INCONSISTENT"
  | "FROZEN_REVIEW"
  | "AWAITING_PHYSICAL_CHECK"
  | "AWAITING_EXHIBITOR_RESPONSE"
  | "READY_FOR_DECISION";

export type ForensicCommentSignal = {
  content: string;
  secondsAfterVote: number | null;
};

export type ForensicCaseSignals = {
  caseId: string;
  entityLabel: string;
  riskScore: number;
  distinctAccounts: number;
  votes: number;
  fragileAccounts: number;
  officialAccounts: number;
  medianLoginToVoteSeconds: number | null;
  fastestLoginToVoteSeconds: number | null;
  rapidAccountSwitches: number;
  dominantProjectVotes: number;
  projectMemberDevice: boolean;
  rankingTop3Affected: boolean;
  comments: ForensicCommentSignal[];
};

export type ForensicClassification = {
  patternType: ForensicPatternType;
  actionUrgency: ForensicActionUrgency;
  operationalState: ForensicOperationalState;
  notifyExpositor: boolean;
  nextStep: string;
  recommendedAction: string;
  evidenceSummary: string;
  cannotBeFalsePositiveIf: string;
  votesToReview: number;
  accountsToReview: number;
};

export type ForensicVerdict = ForensicClassification & {
  ruleRiskScore: number;
  aiFraudProbability: number;
  unifiedRiskScore: number;
  consistencyCheck: ForensicConsistencyCheck;
  consistencyReason: string;
  commentAnalysis: string;
  alternativePlausibility: "ALTA" | "MEDIA" | "BAIXA";
};

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function isHighConfidence(value: string) {
  return value.trim().toUpperCase() === "HIGH" || value.trim().toLowerCase() === "alta";
}

export function evaluateOdinAiConsistency(input: {
  ruleRiskScore: number;
  aiFraudProbability: number;
  confidenceLevel: string;
}): { consistencyCheck: ForensicConsistencyCheck; consistencyReason: string } {
  if (input.ruleRiskScore >= 90 && input.aiFraudProbability < 50) {
    return {
      consistencyCheck: "FAILED",
      consistencyReason: "Score de regras crítico contradiz probabilidade AI inferior a 50%.",
    };
  }

  if (input.ruleRiskScore >= 75 && input.aiFraudProbability < 35) {
    return {
      consistencyCheck: "FAILED",
      consistencyReason: "Score de regras alto contradiz probabilidade AI inferior a 35%.",
    };
  }

  if (isHighConfidence(input.confidenceLevel) && input.ruleRiskScore >= 80 && input.aiFraudProbability < 60) {
    return {
      consistencyCheck: "FAILED",
      consistencyReason: "Confiança HIGH não é compatível com probabilidade baixa perante score elevado.",
    };
  }

  return {
    consistencyCheck: "PASSED",
    consistencyReason: "Análise coerente com o score determinístico.",
  };
}

function urgencyRank(value: ForensicActionUrgency) {
  if (value === "IMEDIATA") return 0;
  if (value === "24H") return 1;
  return 2;
}

function commentAnalysis(comments: ForensicCommentSignal[]) {
  const artificial = comments.filter((comment) =>
    comment.secondsAfterVote !== null
    && comment.secondsAfterVote <= 10
    && comment.content.trim().length > 0
  );

  if (artificial.length > 0) {
    return `${artificial.length} comentário(s) surgiram até 10s após o voto. Isto não é prova isolada, mas reforça sinal de engajamento artificial quando combinado com login→voto rápido.`;
  }

  if (comments.length > 0) {
    return "Há comentários associados, mas sem velocidade incompatível. Usar como sinal qualitativo auxiliar, não como prova isolada.";
  }

  return "Sem comentários relevantes no caso. Ausência de comentário é neutra e não deve penalizar o estudante.";
}

export function classifyForensicPattern(signals: ForensicCaseSignals): ForensicClassification {
  const fragileRatio = percentage(signals.fragileAccounts, signals.distinctAccounts);
  const dominantVoteRatio = percentage(signals.dominantProjectVotes, Math.max(signals.votes, 1));
  const veryFastMedian = signals.medianLoginToVoteSeconds !== null && signals.medianLoginToVoteSeconds < 45;
  const scaleOperation = signals.distinctAccounts > 10
    && (veryFastMedian || signals.rapidAccountSwitches >= 3 || dominantVoteRatio >= 70);
  const labLike = signals.distinctAccounts >= 3
    && signals.distinctAccounts <= 10
    && (signals.medianLoginToVoteSeconds ?? 999) >= 60
    && signals.officialAccounts > signals.fragileAccounts
    && signals.rapidAccountSwitches === 0;

  if (scaleOperation) {
    const immediate = signals.distinctAccounts > 20 || signals.rankingTop3Affected || signals.votes > 20;
    return {
      patternType: "TIPO-A",
      actionUrgency: immediate ? "IMEDIATA" : "24H",
      operationalState: "FROZEN_REVIEW",
      notifyExpositor: false,
      nextStep: "Cruzar logs do servidor antes de notificar envolvidos.",
      recommendedAction: "1. Congelar votos associados. 2. Cruzar timestamps com logs. 3. Pedir segundo admin se afetar ranking.",
      evidenceSummary: `${signals.distinctAccounts} conta(s), ${signals.votes} voto(s), ${signals.rapidAccountSwitches} troca(s) rápida(s) e ${dominantVoteRatio}% dos votos concentrados no alvo dominante.`,
      cannotBeFalsePositiveIf: "Se os logs confirmarem login→voto abaixo de 20s em massa e não houver presença física documentada de 80% das contas.",
      votesToReview: signals.votes,
      accountsToReview: signals.distinctAccounts,
    };
  }

  if (signals.projectMemberDevice) {
    return {
      patternType: "TIPO-C",
      actionUrgency: "24H",
      operationalState: "AWAITING_EXHIBITOR_RESPONSE",
      notifyExpositor: true,
      nextStep: "Confrontar expositor internamente e guardar resposta no dossiê.",
      recommendedAction: "1. Contactar expositor. 2. Dar prazo para explicação. 3. Cruzar resposta com presença e timestamps.",
      evidenceSummary: `${signals.distinctAccounts} conta(s) aparecem em dispositivo associado a membro/expositor, com ${signals.dominantProjectVotes} voto(s) no projeto beneficiado.`,
      cannotBeFalsePositiveIf: "Se o expositor não explicar a posse do dispositivo e houver contas frágeis ou conversões rápidas para o próprio projeto.",
      votesToReview: signals.dominantProjectVotes || signals.votes,
      accountsToReview: signals.distinctAccounts,
    };
  }

  if (labLike) {
    return {
      patternType: "TIPO-B",
      actionUrgency: "24H",
      operationalState: "AWAITING_PHYSICAL_CHECK",
      notifyExpositor: false,
      nextStep: "Checklist presença física antes de qualquer ação destrutiva.",
      recommendedAction: "1. Cruzar lista de presença. 2. Confirmar se era computador/laboratório partilhado. 3. Decidir depois do checklist.",
      evidenceSummary: `${signals.distinctAccounts} conta(s), maioria oficial e sem trocas rápidas sistemáticas. Compatível com dispositivo físico partilhado.`,
      cannotBeFalsePositiveIf: "Se presença física não for documentada e os votos estiverem concentrados num único projeto.",
      votesToReview: signals.votes,
      accountsToReview: signals.distinctAccounts,
    };
  }

  return {
    patternType: "TIPO-B",
    actionUrgency: signals.distinctAccounts < 3 ? "PODE_ESPERAR" : "24H",
    operationalState: signals.distinctAccounts < 3 ? "OPEN" : "AWAITING_PHYSICAL_CHECK",
    notifyExpositor: false,
    nextStep: signals.distinctAccounts < 3 ? "Monitorizar sem ação imediata." : "Rever contexto presencial.",
    recommendedAction: signals.distinctAccounts < 3
      ? "Documentar e aguardar mais dados antes de agir."
      : "1. Confirmar presença física. 2. Rever origem das contas. 3. Só agir se o padrão se repetir.",
    evidenceSummary: `${signals.distinctAccounts} conta(s) e ${signals.votes} voto(s). Ainda não há prova matemática suficiente para ação imediata.`,
    cannotBeFalsePositiveIf: "Se surgirem novas trocas rápidas, contas frágeis e concentração de votos no mesmo projeto.",
    votesToReview: signals.votes,
    accountsToReview: signals.distinctAccounts,
  };
}

export function buildUnifiedRiskScore(input: {
  ruleRiskScore: number;
  aiFraudProbability: number;
  consistencyCheck: ForensicConsistencyCheck;
}) {
  if (input.consistencyCheck === "FAILED") return Math.max(0, Math.min(100, Math.round(input.ruleRiskScore)));
  return Math.max(0, Math.min(100, Math.round((input.ruleRiskScore * 0.7) + (input.aiFraudProbability * 0.3))));
}

export function buildForensicVerdict(input: {
  signals: ForensicCaseSignals;
  ai: {
    fraudProbability: number;
    legitimateProbability: number;
    confidenceLevel: string;
    evidenceSummary?: string | null;
    commentAnalysis?: string | null;
    recommendedAction?: string | null;
    alternativePlausibility?: "ALTA" | "MEDIA" | "BAIXA" | null;
  };
}): ForensicVerdict {
  const consistency = evaluateOdinAiConsistency({
    ruleRiskScore: input.signals.riskScore,
    aiFraudProbability: input.ai.fraudProbability,
    confidenceLevel: input.ai.confidenceLevel,
  });
  const classification = classifyForensicPattern(input.signals);

  return {
    ...classification,
    ruleRiskScore: input.signals.riskScore,
    aiFraudProbability: input.ai.fraudProbability,
    unifiedRiskScore: buildUnifiedRiskScore({
      ruleRiskScore: input.signals.riskScore,
      aiFraudProbability: input.ai.fraudProbability,
      consistencyCheck: consistency.consistencyCheck,
    }),
    consistencyCheck: consistency.consistencyCheck,
    consistencyReason: consistency.consistencyReason,
    evidenceSummary: input.ai.evidenceSummary?.trim() || classification.evidenceSummary,
    commentAnalysis: input.ai.commentAnalysis?.trim() || commentAnalysis(input.signals.comments),
    recommendedAction: input.ai.recommendedAction?.trim() || classification.recommendedAction,
    alternativePlausibility: input.ai.alternativePlausibility ?? (
      classification.patternType === "TIPO-A" ? "BAIXA" : "MEDIA"
    ),
  };
}

export function buildForensicQueue(signals: ForensicCaseSignals[]) {
  return signals
    .map((item) => ({
      ...buildForensicVerdict({
        signals: item,
        ai: {
          fraudProbability: item.riskScore,
          legitimateProbability: 100 - item.riskScore,
          confidenceLevel: item.riskScore >= 80 ? "HIGH" : "MEDIUM",
        },
      }),
      caseId: item.caseId,
      entityLabel: item.entityLabel,
      rankingTop3Affected: item.rankingTop3Affected,
    }))
    .sort((left, right) =>
      urgencyRank(left.actionUrgency) - urgencyRank(right.actionUrgency)
      || Number(right.rankingTop3Affected) - Number(left.rankingTop3Affected)
      || right.unifiedRiskScore - left.unifiedRiskScore
      || right.votesToReview - left.votesToReview
    );
}
