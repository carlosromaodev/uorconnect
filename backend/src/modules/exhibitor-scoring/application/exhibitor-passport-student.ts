import { prisma } from "../../../shared/prisma";
import type { SubmissionType } from "../../submission/domain/submission";
import { isCompetitionEligible } from "../../submission/domain/submission-policy";
import { exportExhibitorScoreRanking } from "./exhibitor-scoring.admin";
import { parseStoredExhibitorScoreConfig } from "./exhibitor-scoring.config";
import type { ExhibitorScoreConfig } from "./exhibitor-scoring.rules";

type GetStudentExhibitorPassportSummaryInput = {
  studentId: number;
  eventKey?: string;
};

type ExhibitorPassportMissionStatus = "done" | "available" | "locked";

type ExhibitorPassportMission = {
  key: string;
  type: string;
  title: string;
  description: string;
  points: number;
  pointsEarned: number;
  completions: number;
  status: ExhibitorPassportMissionStatus;
  completedAt: string | null;
};

type ExhibitorPassportBadge = {
  key: string;
  label: string;
  description: string;
  icon: string | null;
  earned: boolean;
  awardedAt: string | null;
};

type ExhibitorPassportRecentEvent = {
  id: number;
  businessKey: string;
  submissionId: number;
  submissionName: string;
  action: string;
  sourceType: string;
  points: number;
  reason: string | null;
  roundLabel: string | null;
  awardedAt: string;
  effect: "GAIN" | "LOSS" | "NEUTRAL";
};

type ExhibitorPassportOpportunityStatus = "done" | "available" | "attention" | "locked";

type ExhibitorPassportOpportunity = {
  key: string;
  type: string;
  title: string;
  description: string;
  pointsLabel: string;
  icon: string | null;
  completedCount: number;
  pointsEarned: number;
  status: ExhibitorPassportOpportunityStatus;
};

type ExhibitorPassportMemberEffortLevel = "Ouro" | "Prata" | "Bronze" | "Sem movimento";

type ExhibitorPassportMemberEffort = {
  memberId: number | null;
  name: string;
  studentNumber: string | null;
  role: "RESPONSAVEL" | "MEMBRO";
  confirmed: boolean;
  points: number;
  actions: number;
  positiveActions: number;
  penalties: number;
  level: ExhibitorPassportMemberEffortLevel;
  lastActivityAt: string | null;
};

type ExhibitorPassportRoundFlowItem = {
  key: string;
  label: string;
  multiplier: number;
  startsAt: string;
  endsAt: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED" | "DRAFT";
  phase: "past" | "current" | "next" | "upcoming" | "closed";
  progressPercent: number;
  minutesRemaining: number | null;
  startsInMinutes: number | null;
};

type ExhibitorPassportRoundFlow = {
  generatedAt: string;
  currentRoundKey: string | null;
  currentLabel: string | null;
  currentMultiplier: number;
  minutesRemaining: number | null;
  items: ExhibitorPassportRoundFlowItem[];
  streakTargets: Array<{
    minCourses: number;
    points: number;
    label: string;
  }>;
};

type ExhibitorPassportProject = {
  submissionId: number;
  referenceCode: string;
  name: string;
  course: string | null;
  type: string;
  area: string;
  primaryColor: string;
  secondaryColor: string;
  viewerRole: "RESPONSAVEL" | "MEMBRO";
  score: number;
  ranking: {
    position: number;
    totalProjects: number;
    points: number;
  } | null;
  progressPercent: number;
  completedMissions: number;
  totalMissions: number;
  totalAvailablePoints: number;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  missions: ExhibitorPassportMission[];
  badges: ExhibitorPassportBadge[];
  continuousActions: ExhibitorPassportOpportunity[];
  bonusOpportunities: ExhibitorPassportOpportunity[];
  teamActivity: ExhibitorPassportMemberEffort[];
  recentEvents: ExhibitorPassportRecentEvent[];
};

type SubmissionForPassport = {
  id: number;
  referenceCode: string;
  name: string;
  type: SubmissionType;
  status: string;
  area: string;
  course: string | null;
  primaryColor: string;
  secondaryColor: string;
  studentId: number | null;
  memberConfirmations: Array<{
    id: number;
    name: string;
    studentId: number | null;
    studentNumber: string | null;
    studentName?: string | null;
    studentCourse?: string | null;
    expectedStudentNumber: string | null;
    confirmedAt: Date | string | null;
    isExternal: boolean;
  }>;
};

type LedgerEventForPassport = {
  id: number;
  businessKey: string;
  submissionId: number;
  action: string;
  sourceType: string;
  sourceId?: string | null;
  submissionMemberId?: number | null;
  roundLabel?: string | null;
  points: number;
  status: string;
  reason?: string | null;
  awardedAt: Date | string;
  submission?: { id: number; name: string } | null;
};

type StudentExhibitorPassportDatabase = typeof prisma & {
  submission: {
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
  };
  exhibitorScoreConfig: {
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  };
  exhibitorScoreEvent: {
    findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
  };
};

const missionDefinitions = [
  {
    key: "project-approved",
    type: "EXHIBITOR_PROJECT",
    title: "Projeto aprovado",
    description: "Projeto elegível para competir no Passaporte do Expositor.",
    points: 0,
    match: (context: MissionContext) => context.projectApproved,
  },
  {
    key: "team-confirmed",
    type: "EXHIBITOR_TEAM",
    title: "Equipa confirmada",
    description: "Membros principais associados e confirmados no sistema.",
    points: 0,
    match: (context: MissionContext) => context.teamConfirmed,
  },
  {
    key: "vote-qr-ready",
    type: "EXHIBITOR_VISIBILITY",
    title: "QR de voto pronto",
    description: "Projeto já pode receber visitantes pelo QR oficial de votação.",
    points: 0,
    match: (context: MissionContext) => context.projectApproved,
  },
  {
    key: "stand-active",
    type: "EXHIBITOR_STAND",
    title: "Stand ativo",
    description: "Dois expositores registados como ativos na ronda.",
    points: 5,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceType === "STAND_ACTIVE" || event.sourceId?.includes("STAND_ACTIVE")),
  },
  {
    key: "first-valid-vote",
    type: "EXHIBITOR_CONVERSION",
    title: "Primeiro voto válido",
    description: "Primeiro estudante autenticado converteu o voto no projeto.",
    points: 1,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.action === "STUDENT_VOTE"),
  },
  {
    key: "five-valid-votes",
    type: "EXHIBITOR_CONVERSION",
    title: "5 votos válidos",
    description: "Projeto já começou a criar tração real na feira.",
    points: 5,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "STUDENT_VOTE") >= 5,
  },
  {
    key: "ten-valid-votes",
    type: "EXHIBITOR_CONVERSION",
    title: "10 votos válidos",
    description: "Projeto mostra consistência de conversão com estudantes autenticados.",
    points: 10,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "STUDENT_VOTE") >= 10,
  },
  {
    key: "first-course",
    type: "EXHIBITOR_DIVERSITY",
    title: "Primeiro curso alcançado",
    description: "Primeiro voto vindo de um curso ainda não alcançado.",
    points: 3,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.action === "FIRST_COURSE_VOTE_BONUS"),
  },
  {
    key: "three-courses",
    type: "EXHIBITOR_DIVERSITY",
    title: "3 cursos alcançados",
    description: "Equipa já saiu da própria bolha académica.",
    points: 9,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "FIRST_COURSE_VOTE_BONUS") >= 3,
  },
  {
    key: "five-courses",
    type: "EXHIBITOR_DIVERSITY",
    title: "5 cursos alcançados",
    description: "Projeto conquistou diversidade suficiente para disputar bónus grandes.",
    points: 15,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "FIRST_COURSE_VOTE_BONUS") >= 5,
  },
  {
    key: "inter-university-vote",
    type: "EXHIBITOR_DIVERSITY",
    title: "Voto de outra universidade",
    description: "Primeiro voto válido vindo de outra universidade ou instituto.",
    points: 3,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.action === "OTHER_UNIVERSITY_VOTE_BONUS"),
  },
  {
    key: "three-external-votes",
    type: "EXHIBITOR_DIVERSITY",
    title: "3 votos externos",
    description: "Projeto começou a convencer estudantes fora da universidade base.",
    points: 9,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "OTHER_UNIVERSITY_VOTE_BONUS") >= 3,
  },
  {
    key: "qualified-feedback",
    type: "EXHIBITOR_FEEDBACK",
    title: "Feedback qualificado",
    description: "Recebeu uma observação útil e aprovada pela organização.",
    points: 2,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.action === "QUALIFIED_FEEDBACK"),
  },
  {
    key: "feedback-streak",
    type: "EXHIBITOR_FEEDBACK",
    title: "5 feedbacks qualificados",
    description: "Projeto está a gerar conversa com valor para melhoria.",
    points: 10,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "QUALIFIED_FEEDBACK") >= 5,
  },
  {
    key: "course-explorer",
    type: "AMBASSADOR_MISSION",
    title: "Explorador de Cursos",
    description: "Embaixador alcançou cursos diferentes na ronda.",
    points: 15,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceId?.includes("AMBASSADOR_COURSE_EXPLORER")),
  },
  {
    key: "fast-converter",
    type: "AMBASSADOR_MISSION",
    title: "Conversor Rápido",
    description: "Duas conversões atribuídas em até 15 minutos.",
    points: 8,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceId?.includes("AMBASSADOR_FAST_CONVERTER")),
  },
  {
    key: "complete-ambassador",
    type: "AMBASSADOR_MISSION",
    title: "Embaixador Completo",
    description: "Gerou voto e feedback qualificado na mesma ronda.",
    points: 12,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceId?.includes("AMBASSADOR_COMPLETE")),
  },
  {
    key: "elite-host",
    type: "EXHIBITOR_MISSION",
    title: "Anfitrião de Elite",
    description: "Stand manteve atendimento ativo e gerou conversões.",
    points: 10,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceId?.includes("EXHIBITOR_ELITE_HOST")),
  },
  {
    key: "perfect-presentation",
    type: "EXHIBITOR_MISSION",
    title: "Apresentação Perfeita",
    description: "Projeto recebeu avaliação de júri com stand ativo.",
    points: 15,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceId?.includes("PERFECT_PRESENTATION")),
  },
  {
    key: "jury-vote",
    type: "EXHIBITOR_JURY",
    title: "Júri convertido",
    description: "Projeto recebeu avaliação oficial de júri.",
    points: 500,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.action === "JURY_VOTE"),
  },
  {
    key: "member-bronze",
    type: "EXHIBITOR_TEAM",
    title: "Membro Bronze",
    description: "Pelo menos um membro já desbloqueou nível interno.",
    points: 0,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceType === "MEMBER_LEVEL" || sourceIncludes(event, "MEMBER_LEVEL")),
  },
  {
    key: "team-bronze",
    type: "EXHIBITOR_TEAM",
    title: "Equipa Bronze+",
    description: "Equipa transformou esforço individual em bónus coletivo.",
    points: 0,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some(isTeamBronzePlusEvent),
  },
  {
    key: "stand-consistency",
    type: "EXHIBITOR_STAND",
    title: "Stand consistente",
    description: "Atendimento ativo repetido em pelo menos 3 rondas.",
    points: 15,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.action === "STAND_BONUS" || sourceIncludes(event, "STAND_ACTIVE")) >= 3,
  },
  {
    key: "borderless",
    type: "AMBASSADOR_MISSION",
    title: "Sem Fronteiras",
    description: "Equipa alcançou diversidade alta de cursos.",
    points: 50,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      events.some((event) => event.sourceId?.includes("AMBASSADOR_BORDERLESS")),
  },
  {
    key: "zero-penalties",
    type: "EXHIBITOR_MISSION",
    title: "Zero Penalizações",
    description: "Projeto segue a feira sem penalizações válidas.",
    points: 10,
    match: (context: MissionContext, events: LedgerEventForPassport[]) =>
      context.hasScoringEvents && !events.some((event) => event.action === "PENALTY" || event.points < 0),
  },
  {
    key: "clean-finish",
    type: "EXHIBITOR_MISSION",
    title: "Fecho limpo",
    description: "Projeto mantém pontuação positiva sem penalizações após várias ações.",
    points: 10,
    match: (_context: MissionContext, events: LedgerEventForPassport[]) =>
      countEvents(events, (event) => event.points > 0) >= 10 &&
      !events.some((event) => event.action === "PENALTY" || event.points < 0),
  },
] as const;

type MissionContext = {
  projectApproved: boolean;
  teamConfirmed: boolean;
  hasScoringEvents: boolean;
};

function countEvents(
  events: LedgerEventForPassport[],
  predicate: (event: LedgerEventForPassport) => boolean,
) {
  return events.filter(predicate).length;
}

function asStudentExhibitorPassportDatabase(db = prisma): StudentExhibitorPassportDatabase {
  return db as StudentExhibitorPassportDatabase;
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function minutesUntil(target: number, now: number) {
  return Math.max(0, Math.ceil((target - now) / 60000));
}

async function loadActiveScoreConfig(tx: StudentExhibitorPassportDatabase, eventKey: string) {
  const stored = await tx.exhibitorScoreConfig.findFirst({
    where: {
      eventKey,
      active: true,
    },
    orderBy: { version: "desc" },
    select: {
      version: true,
      weightsJson: true,
      streakBonusesJson: true,
      roundsJson: true,
    },
  });

  return parseStoredExhibitorScoreConfig(stored as {
    version?: number | null;
    weightsJson?: string | null;
    streakBonusesJson?: string | null;
    roundsJson?: string | null;
  } | null);
}

function buildDefaultRoundFlowRounds(generatedAt: Date): NonNullable<ExhibitorScoreConfig["rounds"]> {
  const dayStart = Date.UTC(
    generatedAt.getUTCFullYear(),
    generatedAt.getUTCMonth(),
    generatedAt.getUTCDate(),
    7,
    0,
    0,
    0,
  );
  const hour = 60 * 60 * 1000;
  const iso = (offsetHours: number) => new Date(dayStart + offsetHours * hour).toISOString();

  return [
    {
      key: "default-start",
      label: "Início da atividade",
      multiplier: 1,
      startsAt: iso(0),
      endsAt: iso(2),
      status: "ACTIVE",
    },
    {
      key: "default-middle",
      label: "Meio da atividade",
      multiplier: 1.5,
      startsAt: iso(2),
      endsAt: iso(5),
      status: "ACTIVE",
    },
    {
      key: "default-final",
      label: "Fim da atividade",
      multiplier: 2,
      startsAt: iso(5),
      endsAt: iso(8),
      status: "ACTIVE",
    },
  ];
}

function buildRoundFlow(config: ExhibitorScoreConfig, generatedAt: Date): ExhibitorPassportRoundFlow {
  const configuredRounds = (config.rounds ?? [])
    .filter((round) => round.status !== "DRAFT")
    .slice()
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const visibleRounds = configuredRounds.length > 0
    ? configuredRounds
    : buildDefaultRoundFlowRounds(generatedAt);

  const now = generatedAt.getTime();
  let nextAssigned = false;

  const items = visibleRounds.map<ExhibitorPassportRoundFlowItem>((round) => {
    const startsAt = Date.parse(round.startsAt);
    const endsAt = Date.parse(round.endsAt);
    const duration = Math.max(1, endsAt - startsAt);
    const isCurrent = round.status === "ACTIVE" && now >= startsAt && now <= endsAt;
    const isFuture = round.status === "ACTIVE" && now < startsAt;
    const isPast = now > endsAt;
    let phase: ExhibitorPassportRoundFlowItem["phase"] = "closed";

    if (isCurrent) {
      phase = "current";
    } else if (isFuture) {
      phase = nextAssigned ? "upcoming" : "next";
      nextAssigned = true;
    } else if (isPast) {
      phase = "past";
    }

    return {
      key: round.key,
      label: round.label,
      multiplier: round.multiplier,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      status: round.status,
      phase,
      progressPercent: phase === "current"
        ? clampPercent(((now - startsAt) / duration) * 100)
        : isPast
          ? 100
          : 0,
      minutesRemaining: phase === "current" ? minutesUntil(endsAt, now) : null,
      startsInMinutes: phase === "next" || phase === "upcoming" ? minutesUntil(startsAt, now) : null,
    };
  });

  const currentRound = items.find((item) => item.phase === "current") ?? null;

  return {
    generatedAt: generatedAt.toISOString(),
    currentRoundKey: currentRound?.key ?? null,
    currentLabel: currentRound?.label ?? null,
    currentMultiplier: currentRound?.multiplier ?? 1,
    minutesRemaining: currentRound?.minutesRemaining ?? null,
    items,
    streakTargets: config.streakBonuses
      .slice()
      .sort((left, right) => left.minCourses - right.minCourses)
      .map((bonus) => ({
        minCourses: bonus.minCourses,
        points: bonus.points,
        label: `${bonus.minCourses} cursos`,
      })),
  };
}

function eventEffect(points: number): ExhibitorPassportRecentEvent["effect"] {
  if (points > 0) return "GAIN";
  if (points < 0) return "LOSS";
  return "NEUTRAL";
}

function eventMatchesMission(event: LedgerEventForPassport, key: string) {
  if (key === "first-course") return event.action === "FIRST_COURSE_VOTE_BONUS";
  if (key === "first-valid-vote" || key === "five-valid-votes" || key === "ten-valid-votes") {
    return event.action === "STUDENT_VOTE";
  }
  if (key === "three-courses" || key === "five-courses") {
    return event.action === "FIRST_COURSE_VOTE_BONUS";
  }
  if (key === "inter-university-vote" || key === "three-external-votes") {
    return event.action === "OTHER_UNIVERSITY_VOTE_BONUS";
  }
  if (key === "qualified-feedback" || key === "feedback-streak") {
    return event.action === "QUALIFIED_FEEDBACK";
  }
  if (key === "jury-vote") return event.action === "JURY_VOTE";
  const normalizedKey = key.toUpperCase().replace(/-/g, "_");
  return event.sourceId?.includes(normalizedKey) || event.sourceType?.includes(normalizedKey);
}

function buildMissions(context: MissionContext, events: LedgerEventForPassport[]) {
  let previousDone = true;

  return missionDefinitions.map<ExhibitorPassportMission>((definition) => {
    const done = definition.match(context, events);
    const matchingEvents = events.filter((event) => eventMatchesMission(event, definition.key));
    const pointsEarned = done
      ? roundScore(
        matchingEvents.length
          ? matchingEvents.reduce((sum, event) => sum + event.points, 0)
          : definition.points,
      )
      : 0;
    const completedAt = matchingEvents
      .map((event) => toDate(event.awardedAt))
      .sort((left, right) => right.getTime() - left.getTime())[0]?.toISOString() ?? null;
    const status: ExhibitorPassportMissionStatus = done
      ? "done"
      : previousDone
        ? "available"
        : "locked";

    previousDone = previousDone && done;

    return {
      key: definition.key,
      type: definition.type,
      title: definition.title,
      description: definition.description,
      points: definition.points,
      pointsEarned,
      completions: done ? 1 : 0,
      status,
      completedAt,
    };
  });
}

function buildBadges(input: {
  teamConfirmed: boolean;
  missions: ExhibitorPassportMission[];
  events: LedgerEventForPassport[];
}) {
  const missionDone = new Set(input.missions.filter((mission) => mission.status === "done").map((mission) => mission.key));
  const levelEvent = input.events.find((event) => event.sourceType === "MEMBER_LEVEL");
  const noPenalty = !input.events.some((event) => event.action === "PENALTY" || event.points < 0);

  return [
    {
      key: "team-ready",
      label: "Equipa pronta",
      description: "Responsável e membros confirmados.",
      icon: "users",
      earned: input.teamConfirmed,
      awardedAt: null,
    },
    {
      key: "course-explorer",
      label: "Explorador de Cursos",
      description: "Diversidade de cursos alcançada.",
      icon: "route",
      earned: missionDone.has("course-explorer"),
      awardedAt: input.missions.find((mission) => mission.key === "course-explorer")?.completedAt ?? null,
    },
    {
      key: "inter-university",
      label: "Ponte institucional",
      description: "Recebeu voto válido de outra universidade ou instituto.",
      icon: "globe",
      earned: missionDone.has("inter-university-vote"),
      awardedAt: input.missions.find((mission) => mission.key === "inter-university-vote")?.completedAt ?? null,
    },
    {
      key: "elite-host",
      label: "Anfitrião",
      description: "Atendimento ativo e conversões no stand.",
      icon: "badge",
      earned: missionDone.has("elite-host") || missionDone.has("perfect-presentation"),
      awardedAt: input.missions.find((mission) => mission.key === "elite-host" || mission.key === "perfect-presentation")?.completedAt ?? null,
    },
    {
      key: "member-level",
      label: levelEvent?.sourceId?.split(":").at(-1) ?? "Nível da equipa",
      description: "Nível Bronze, Prata ou Ouro atribuído a membro.",
      icon: "award",
      earned: Boolean(levelEvent),
      awardedAt: levelEvent ? toDate(levelEvent.awardedAt).toISOString() : null,
    },
    {
      key: "clean-round",
      label: "Sem penalizações",
      description: "Nenhuma perda de pontos registada no projeto.",
      icon: "shield",
      earned: input.events.length > 0 && noPenalty,
      awardedAt: null,
    },
  ] satisfies ExhibitorPassportBadge[];
}

function buildRecentEvents(events: LedgerEventForPassport[], limit = 8) {
  return events
    .slice()
    .sort((left, right) => toDate(right.awardedAt).getTime() - toDate(left.awardedAt).getTime())
    .slice(0, limit)
    .map<ExhibitorPassportRecentEvent>((event) => ({
      id: event.id,
      businessKey: event.businessKey,
      submissionId: event.submissionId,
      submissionName: event.submission?.name ?? `Projeto ${event.submissionId}`,
      action: event.action,
      sourceType: event.sourceType,
      points: roundScore(event.points),
      reason: event.reason ?? null,
      roundLabel: event.roundLabel ?? null,
      awardedAt: toDate(event.awardedAt).toISOString(),
      effect: eventEffect(event.points),
    }));
}

function validScoringEvents(events: LedgerEventForPassport[]) {
  return events.filter((event) => event.status === "VALID");
}

function sumEventPoints(events: LedgerEventForPassport[]) {
  return roundScore(events.reduce((sum, event) => sum + event.points, 0));
}

function memberIdFromEvent(event: LedgerEventForPassport) {
  if (typeof event.submissionMemberId === "number") return event.submissionMemberId;
  const canInferFromSource =
    event.action === "AMBASSADOR_MISSION" ||
    event.action === "EXHIBITOR_MISSION" ||
    event.action === "STAND_BONUS" ||
    event.action === "EXHIBITOR_CHECK_IN" ||
    event.action === "EXHIBITOR_CHECK_OUT" ||
    event.sourceType === "MISSION" ||
    event.sourceType === "MEMBER_LEVEL" ||
    event.sourceType === "STAND_ACTIVE" ||
    sourceIncludes(event, "AMBASSADOR") ||
    sourceIncludes(event, "MEMBER_LEVEL") ||
    sourceIncludes(event, "STAND_ACTIVE");
  if (!canInferFromSource) return null;
  const sourcePrefix = event.sourceId?.split(":").at(0);
  if (!sourcePrefix) return null;
  const parsed = Number(sourcePrefix);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function memberEffortLevel(points: number): ExhibitorPassportMemberEffortLevel {
  if (points >= 30) return "Ouro";
  if (points >= 15) return "Prata";
  if (points >= 5) return "Bronze";
  return "Sem movimento";
}

function buildMemberEffort(
  submission: SubmissionForPassport,
  events: LedgerEventForPassport[],
): ExhibitorPassportMemberEffort[] {
  const stats = new Map<number | null, ExhibitorPassportMemberEffort>();

  const addMember = (
    memberId: number | null,
    name: string,
    role: "RESPONSAVEL" | "MEMBRO",
    confirmed: boolean,
    studentNumber: string | null,
  ) => {
    stats.set(memberId, {
      memberId,
      name,
      studentNumber,
      role,
      confirmed,
      points: 0,
      actions: 0,
      positiveActions: 0,
      penalties: 0,
      level: "Sem movimento",
      lastActivityAt: null,
    });
  };

  const responsibleMemberId =
    submission.memberConfirmations.find((member) =>
      Boolean(submission.studentId && member.studentId === submission.studentId),
    )?.id ?? submission.memberConfirmations[0]?.id ?? null;

  submission.memberConfirmations.forEach((member) => {
    const isResponsible = member.id === responsibleMemberId;
    addMember(
      member.id,
      member.studentName ?? member.name,
      isResponsible ? "RESPONSAVEL" : "MEMBRO",
      Boolean(member.confirmedAt || member.isExternal),
      member.studentNumber ?? member.expectedStudentNumber ?? null,
    );
  });

  if (stats.size === 0) {
    addMember(null, "Responsável do projeto", "RESPONSAVEL", Boolean(submission.studentId), null);
  }

  for (const event of validScoringEvents(events)) {
    const memberId = memberIdFromEvent(event);
    if (memberId === null) continue;

    const current = stats.get(memberId) ?? {
      memberId,
      name: `Membro ${memberId}`,
      studentNumber: null,
      role: "MEMBRO" as const,
      confirmed: false,
      points: 0,
      actions: 0,
      positiveActions: 0,
      penalties: 0,
      level: "Sem movimento" as const,
      lastActivityAt: null,
    };

    current.points = roundScore(current.points + event.points);
    current.actions += 1;
    if (event.points > 0) current.positiveActions += 1;
    if (event.points < 0 || event.action === "PENALTY") current.penalties += 1;

    const eventDate = toDate(event.awardedAt).toISOString();
    if (!current.lastActivityAt || eventDate > current.lastActivityAt) {
      current.lastActivityAt = eventDate;
    }

    stats.set(memberId, current);
  }

  return [...stats.values()]
    .map((member) => ({
      ...member,
      points: roundScore(member.points),
      level: memberEffortLevel(member.points),
    }))
    .sort((left, right) =>
      right.points - left.points ||
      right.actions - left.actions ||
      Number(right.confirmed) - Number(left.confirmed) ||
      left.name.localeCompare(right.name),
    );
}

function opportunityStatus(
  events: LedgerEventForPassport[],
  fallback: ExhibitorPassportOpportunityStatus = "available",
): ExhibitorPassportOpportunityStatus {
  return events.length > 0 ? "done" : fallback;
}

function buildOpportunity(input: {
  key: string;
  type: string;
  title: string;
  description: string;
  pointsLabel: string;
  icon: string | null;
  events: LedgerEventForPassport[];
  status?: ExhibitorPassportOpportunityStatus;
}): ExhibitorPassportOpportunity {
  return {
    key: input.key,
    type: input.type,
    title: input.title,
    description: input.description,
    pointsLabel: input.pointsLabel,
    icon: input.icon,
    completedCount: input.events.length,
    pointsEarned: sumEventPoints(input.events),
    status: input.status ?? opportunityStatus(input.events),
  };
}

function sourceIncludes(event: LedgerEventForPassport, value: string) {
  return event.sourceId?.includes(value) || event.sourceType?.includes(value);
}

function sourceEquals(event: LedgerEventForPassport, value: string) {
  return event.sourceId === value || event.sourceType === value;
}

function isTeamBronzePlusEvent(event: LedgerEventForPassport) {
  return (
    sourceEquals(event, "TEAM_BRONZE_PLUS") ||
    sourceEquals(event, "TEAM_ALL_BRONZE") ||
    sourceIncludes(event, ":TEAM_BRONZE_PLUS") ||
    sourceIncludes(event, ":TEAM_ALL_BRONZE")
  );
}

function buildContinuousActions(events: LedgerEventForPassport[]) {
  const validEvents = validScoringEvents(events);
  const penaltyEvents = validEvents.filter((event) => event.action === "PENALTY" || event.points < 0);

  return [
    buildOpportunity({
      key: "valid-votes",
      type: "EXHIBITOR_REPEATABLE",
      title: "Conseguir votos válidos",
      description: "Cada estudante autenticado pode votar uma vez por projeto.",
      pointsLabel: "+1/+2 por voto",
      icon: "vote",
      events: validEvents.filter((event) => event.action === "STUDENT_VOTE"),
    }),
    buildOpportunity({
      key: "new-courses",
      type: "EXHIBITOR_REPEATABLE",
      title: "Alcançar cursos novos",
      description: "O primeiro voto de cada curso novo gera bónus de diversidade.",
      pointsLabel: "+3 por curso novo",
      icon: "route",
      events: validEvents.filter((event) => event.action === "FIRST_COURSE_VOTE_BONUS"),
    }),
    buildOpportunity({
      key: "other-universities",
      type: "EXHIBITOR_REPEATABLE",
      title: "Atrair outras instituições",
      description: "Votos válidos de outras universidades ou institutos geram bónus separado.",
      pointsLabel: "+3 por voto externo",
      icon: "globe",
      events: validEvents.filter((event) => event.action === "OTHER_UNIVERSITY_VOTE_BONUS"),
    }),
    buildOpportunity({
      key: "qualified-feedback",
      type: "EXHIBITOR_REPEATABLE",
      title: "Gerar feedback qualificado",
      description: "Feedback aprovado pela organização reforça a pontuação.",
      pointsLabel: "+2 por feedback",
      icon: "feedback",
      events: validEvents.filter((event) => event.action === "QUALIFIED_FEEDBACK"),
    }),
    buildOpportunity({
      key: "stand-active-rounds",
      type: "EXHIBITOR_REPEATABLE",
      title: "Manter o stand ativo",
      description: "Dois expositores ativos no stand desbloqueiam bónus por ronda.",
      pointsLabel: "+5 por ronda",
      icon: "stand",
      events: validEvents.filter((event) => event.action === "STAND_BONUS" || sourceIncludes(event, "STAND_ACTIVE")),
    }),
    buildOpportunity({
      key: "ambassador-fieldwork",
      type: "EXHIBITOR_REPEATABLE",
      title: "Trabalhar como embaixador",
      description: "Membros fora do stand podem converter visitantes e desbloquear missões.",
      pointsLabel: "conversões + missões",
      icon: "network",
      events: validEvents.filter((event) =>
        event.action === "AMBASSADOR_MISSION" ||
        sourceIncludes(event, "AMBASSADOR") ||
        event.action === "STAND_VISIT",
      ),
    }),
    buildOpportunity({
      key: "jury-and-presentation",
      type: "EXHIBITOR_REPEATABLE",
      title: "Preparar avaliação de júri",
      description: "Atendimento organizado e apresentação clara aumentam impacto competitivo.",
      pointsLabel: "+500 júri / +15 missão",
      icon: "jury",
      events: validEvents.filter((event) => event.action === "JURY_VOTE" || sourceIncludes(event, "PERFECT_PRESENTATION")),
    }),
    buildOpportunity({
      key: "avoid-penalties",
      type: "EXHIBITOR_REPEATABLE",
      title: "Evitar penalizações",
      description: "Boas práticas preservam pontos, selos e vantagem no desempate.",
      pointsLabel: "evita perdas",
      icon: "shield",
      events: penaltyEvents,
      status: penaltyEvents.length > 0 ? "attention" : "available",
    }),
  ] satisfies ExhibitorPassportOpportunity[];
}

function buildBonusOpportunities(events: LedgerEventForPassport[]) {
  const validEvents = validScoringEvents(events);
  const noPenalty = !validEvents.some((event) => event.action === "PENALTY" || event.points < 0);
  const zeroPenaltyEvents = validEvents.filter((event) => sourceIncludes(event, "ZERO_PENALTIES"));

  return [
    buildOpportunity({
      key: "ambassador-first-contact",
      type: "EXHIBITOR_BONUS",
      title: "Primeiro Contacto",
      description: "Primeira conversão válida de um curso para o projeto.",
      pointsLabel: "+10 pts",
      icon: "user-plus",
      events: validEvents.filter((event) => sourceIncludes(event, "AMBASSADOR_FIRST_CONTACT")),
    }),
    buildOpportunity({
      key: "ambassador-course-explorer",
      type: "EXHIBITOR_BONUS",
      title: "Explorador de Cursos",
      description: "Embaixador alcança vários cursos na mesma ronda.",
      pointsLabel: "+15 pts",
      icon: "route",
      events: validEvents.filter((event) => sourceIncludes(event, "AMBASSADOR_COURSE_EXPLORER")),
    }),
    buildOpportunity({
      key: "ambassador-fast-converter",
      type: "EXHIBITOR_BONUS",
      title: "Conversor Rápido",
      description: "Duas conversões atribuídas num intervalo curto.",
      pointsLabel: "+8 pts",
      icon: "zap",
      events: validEvents.filter((event) => sourceIncludes(event, "AMBASSADOR_FAST_CONVERTER")),
    }),
    buildOpportunity({
      key: "ambassador-complete",
      type: "EXHIBITOR_BONUS",
      title: "Embaixador Completo",
      description: "Gera voto e feedback qualificado na mesma ronda.",
      pointsLabel: "+12 pts",
      icon: "network",
      events: validEvents.filter((event) => sourceIncludes(event, "AMBASSADOR_COMPLETE")),
    }),
    buildOpportunity({
      key: "ambassador-max-diversity",
      type: "EXHIBITOR_BONUS",
      title: "Diversidade Máxima",
      description: "Membro alcança diversidade elevada de cursos.",
      pointsLabel: "+25 pts",
      icon: "layers",
      events: validEvents.filter((event) => sourceIncludes(event, "AMBASSADOR_MAX_DIVERSITY")),
    }),
    buildOpportunity({
      key: "ambassador-borderless",
      type: "EXHIBITOR_BONUS",
      title: "Sem Fronteiras",
      description: "Equipa alcança diversidade muito alta de cursos.",
      pointsLabel: "+50 pts",
      icon: "crown",
      events: validEvents.filter((event) => sourceIncludes(event, "AMBASSADOR_BORDERLESS")),
    }),
    buildOpportunity({
      key: "course-diversity-streak",
      type: "EXHIBITOR_BONUS",
      title: "Streak de cursos",
      description: "Sequência de cursos novos desbloqueia bónus configurados por ronda.",
      pointsLabel: "bónus por streak",
      icon: "route",
      events: validEvents.filter((event) => sourceEquals(event, "COURSE_DIVERSITY_STREAK")),
    }),
    buildOpportunity({
      key: "inter-university-streak",
      type: "EXHIBITOR_BONUS",
      title: "Ponte entre universidades",
      description: "Equipa transforma votos externos em alcance institucional.",
      pointsLabel: "bónus externo",
      icon: "globe",
      events: validEvents.filter((event) => event.action === "OTHER_UNIVERSITY_VOTE_BONUS"),
    }),
    buildOpportunity({
      key: "elite-host",
      type: "EXHIBITOR_BONUS",
      title: "Anfitrião de Elite",
      description: "Stand mantém atendimento forte e gera conversões.",
      pointsLabel: "+10 pts",
      icon: "stand",
      events: validEvents.filter((event) => sourceIncludes(event, "EXHIBITOR_ELITE_HOST")),
    }),
    buildOpportunity({
      key: "perfect-presentation",
      type: "EXHIBITOR_BONUS",
      title: "Apresentação Perfeita",
      description: "Projeto recebe avaliação de júri com stand ativo.",
      pointsLabel: "+15 pts",
      icon: "trophy",
      events: validEvents.filter((event) => sourceIncludes(event, "PERFECT_PRESENTATION")),
    }),
    buildOpportunity({
      key: "team-mvp-conversions",
      type: "EXHIBITOR_BONUS",
      title: "MVP de conversões",
      description: "Embaixador com mais conversões válidas dentro da equipa.",
      pointsLabel: "+20 pts",
      icon: "trophy",
      events: validEvents.filter((event) => sourceEquals(event, "TOP_CONVERSIONS")),
    }),
    buildOpportunity({
      key: "team-mvp-courses",
      type: "EXHIBITOR_BONUS",
      title: "MVP de cursos",
      description: "Membro que mais expandiu o projeto para cursos diferentes.",
      pointsLabel: "+15 pts",
      icon: "route",
      events: validEvents.filter((event) => sourceEquals(event, "TOP_COURSES")),
    }),
    buildOpportunity({
      key: "team-mvp-streak",
      type: "EXHIBITOR_BONUS",
      title: "MVP de streak",
      description: "Membro com maior sequência de cursos alcançados.",
      pointsLabel: "+15 pts",
      icon: "zap",
      events: validEvents.filter((event) => sourceEquals(event, "TOP_STREAK")),
    }),
    buildOpportunity({
      key: "team-mvp-missions",
      type: "EXHIBITOR_BONUS",
      title: "MVP de missões",
      description: "Membro com mais pontos em missões automáticas.",
      pointsLabel: "+10 pts",
      icon: "award",
      events: validEvents.filter((event) => sourceEquals(event, "TOP_MISSIONS")),
    }),
    buildOpportunity({
      key: "zero-penalties",
      type: "EXHIBITOR_BONUS",
      title: "Zero Penalizações",
      description: "Projeto mantém conduta limpa até ao fecho da ronda.",
      pointsLabel: "+10 pts",
      icon: "shield",
      events: zeroPenaltyEvents,
      status: zeroPenaltyEvents.length > 0
        ? "done"
        : noPenalty && validEvents.length > 0
          ? "available"
          : "attention",
    }),
    buildOpportunity({
      key: "member-levels",
      type: "EXHIBITOR_BONUS",
      title: "Níveis dos membros",
      description: "Membros podem fechar Bronze, Prata ou Ouro por contributo real.",
      pointsLabel: "Bronze/Prata/Ouro",
      icon: "award",
      events: validEvents.filter((event) => event.sourceType === "MEMBER_LEVEL" || sourceIncludes(event, "MEMBER_LEVEL")),
    }),
    buildOpportunity({
      key: "team-bronze",
      type: "EXHIBITOR_BONUS",
      title: "Equipa Bronze+",
      description: "Bónus coletivo quando todos os membros atingem nível mínimo.",
      pointsLabel: "bónus coletivo",
      icon: "users",
      events: validEvents.filter(isTeamBronzePlusEvent),
    }),
  ] satisfies ExhibitorPassportOpportunity[];
}

export async function getStudentExhibitorPassportSummary(
  input: GetStudentExhibitorPassportSummaryInput,
  db = prisma,
) {
  const eventKey = input.eventKey ?? "main-event";
  const tx = asStudentExhibitorPassportDatabase(db);
  const submissions = (await tx.submission.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      OR: [
        { studentId: input.studentId },
        {
          memberConfirmations: {
            some: {
              studentId: input.studentId,
              confirmedAt: { not: null },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      referenceCode: true,
      name: true,
      type: true,
      status: true,
      area: true,
      course: true,
      primaryColor: true,
      secondaryColor: true,
      studentId: true,
      memberConfirmations: {
        select: {
          id: true,
          name: true,
          studentId: true,
          studentNumber: true,
          studentName: true,
          studentCourse: true,
          expectedStudentNumber: true,
          confirmedAt: true,
          isExternal: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })) as SubmissionForPassport[];

  const eligibleSubmissions = submissions.filter((submission) =>
    isCompetitionEligible(submission.type, submission.area),
  );

  const generatedAt = new Date();

  if (eligibleSubmissions.length === 0) {
    const scoreConfig = await loadActiveScoreConfig(tx, eventKey);

    return {
      eventKey,
      generatedAt: generatedAt.toISOString(),
      hasExhibitorPassport: false,
      activeProject: null,
      projects: [],
      roundFlow: buildRoundFlow(scoreConfig, generatedAt),
    };
  }

  const submissionIds = eligibleSubmissions.map((submission) => submission.id);
  const [ranking, ledgerEvents, scoreConfig] = await Promise.all([
    exportExhibitorScoreRanking({ eventKey }, db),
    tx.exhibitorScoreEvent.findMany({
      where: {
        eventKey,
        submissionId: { in: submissionIds },
        revokedAt: null,
        status: { in: ["VALID", "PENDING_REVIEW", "CANCELLED"] },
      },
      select: {
        id: true,
        businessKey: true,
        submissionId: true,
        action: true,
        sourceType: true,
        sourceId: true,
        submissionMemberId: true,
        roundLabel: true,
        points: true,
        status: true,
        reason: true,
        awardedAt: true,
        submission: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { awardedAt: "desc" },
      take: 200,
    }) as Promise<LedgerEventForPassport[]>,
    loadActiveScoreConfig(tx, eventKey),
  ]);
  const roundFlow = buildRoundFlow(scoreConfig, generatedAt);

  const eventsBySubmission = new Map<number, LedgerEventForPassport[]>();
  for (const event of ledgerEvents) {
    eventsBySubmission.set(event.submissionId, [...(eventsBySubmission.get(event.submissionId) ?? []), event]);
  }

  const projects = eligibleSubmissions.map<ExhibitorPassportProject>((submission) => {
    const events = eventsBySubmission.get(submission.id) ?? [];
    const rankedProject = ranking.projects.find((project) => project.submissionId === submission.id);
    const teamTotalMembers = Math.max(1, submission.memberConfirmations.length);
    const teamConfirmedMembers = Math.max(
      submission.studentId === input.studentId ? 1 : 0,
      submission.memberConfirmations.filter((member) => member.confirmedAt || member.isExternal).length,
    );
    const teamConfirmed = teamConfirmedMembers >= teamTotalMembers;
    const missions = buildMissions({
      projectApproved: submission.status === "APPROVED",
      teamConfirmed,
      hasScoringEvents: events.length > 0,
    }, events);
    const completedMissions = missions.filter((mission) => mission.status === "done").length;
    const totalAvailablePoints = missions.reduce((sum, mission) => sum + mission.points, 0);
    const score = rankedProject?.score ?? roundScore(events.filter((event) => event.status === "VALID").reduce((sum, event) => sum + event.points, 0));

    return {
      submissionId: submission.id,
      referenceCode: submission.referenceCode,
      name: submission.name,
      course: submission.course,
      type: submission.type,
      area: submission.area,
      primaryColor: submission.primaryColor,
      secondaryColor: submission.secondaryColor,
      viewerRole: submission.studentId === input.studentId ? "RESPONSAVEL" : "MEMBRO",
      score,
      ranking: rankedProject
        ? {
            position: rankedProject.rank,
            totalProjects: ranking.totalProjects,
            points: rankedProject.score,
          }
        : null,
      progressPercent: Math.round((completedMissions / missions.length) * 100),
      completedMissions,
      totalMissions: missions.length,
      totalAvailablePoints,
      teamTotalMembers,
      teamConfirmedMembers,
      missions,
      badges: buildBadges({ teamConfirmed, missions, events }),
      continuousActions: buildContinuousActions(events),
      bonusOpportunities: buildBonusOpportunities(events),
      teamActivity: buildMemberEffort(submission, events),
      recentEvents: buildRecentEvents(events),
    };
  }).sort((left, right) => {
    if (left.ranking && right.ranking) return left.ranking.position - right.ranking.position;
    if (left.ranking) return -1;
    if (right.ranking) return 1;
    return right.score - left.score || left.name.localeCompare(right.name);
  });

  return {
    eventKey,
    generatedAt: generatedAt.toISOString(),
    hasExhibitorPassport: projects.length > 0,
    activeProject: projects[0] ?? null,
    projects,
    roundFlow,
  };
}
