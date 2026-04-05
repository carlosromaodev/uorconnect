import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  challengeContestConfig as defaultContestConfig,
  challengeItems as defaultChallengeItems,
  challengeQuestionConfigs as defaultQuestionConfigs,
  type ChallengeCategory,
  type ChallengeContestConfig,
  type ChallengeDifficulty,
  type ChallengeItem,
  type ChallengeQuestionConfig,
} from "@/data/challenges";

const STORAGE_KEY = "uor_laboratorio_runtime_v2";

export type ArenaManagedChallenge = {
  item: ChallengeItem;
  config: ChallengeQuestionConfig;
};

type ArenaGeneratorInput = {
  title: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  points: number;
  summary: string;
  tags: string[];
};

export type ArenaClockState = {
  display: string;
  label: string;
  progress: number;
  runtimePhase: "scheduled" | "running" | "finished";
  startsAt: number;
  endsAt: number;
};

type ArenaStateContextValue = {
  contestConfig: ChallengeContestConfig;
  challenges: ArenaManagedChallenge[];
  saveContestConfig: (nextConfig: Partial<ChallengeContestConfig>) => void;
  upsertChallenge: (challenge: ArenaManagedChallenge) => void;
  removeChallenge: (slug: string) => void;
  generateChallenge: (input: ArenaGeneratorInput) => ArenaManagedChallenge;
  resetArenaState: () => void;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "novo-desafio";
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 6),
    ),
  );
}

function getDefaultStarterCode(challenge: ArenaManagedChallenge) {
  const sample = challenge.config.sampleCases[0];
  const titleSlug = slugify(challenge.item.title).replaceAll("-", "_");
  return [
    `algoritmo "${titleSlug}"`,
    "",
    "var",
    "   entrada : caractere",
    "",
    "inicio",
    `   // ${challenge.item.summary}`,
    `   // Entrada esperada: ${sample?.input || challenge.config.inputFormat}`,
    `   // Saída esperada: ${sample?.output || challenge.config.outputFormat}`,
    "   // Usa inteiro(leia()) ou real(leia()) quando precisares converter valores.",
    "   leia(entrada)",
    '   escreval("Substitui esta linha pela tua solução")',
    "fimalgoritmo",
  ].join("\n");
}

function buildManagedChallenges(): ArenaManagedChallenge[] {
  return defaultChallengeItems.map((item) => ({
    item,
    config: defaultQuestionConfigs.find((config) => config.slug === item.slug)!,
  }));
}

function buildDefaultState() {
  return {
    contestConfig: defaultContestConfig,
    challenges: buildManagedChallenges(),
  };
}

function parseStoredState() {
  if (typeof window === "undefined") {
    return buildDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return buildDefaultState();
    }

    const parsed = JSON.parse(raw) as {
      contestConfig?: ChallengeContestConfig;
      challenges?: ArenaManagedChallenge[];
    };

    return {
      contestConfig: parsed.contestConfig ?? defaultContestConfig,
      challenges: Array.isArray(parsed.challenges) && parsed.challenges.length
        ? parsed.challenges
        : buildManagedChallenges(),
    };
  } catch {
    return buildDefaultState();
  }
}

function formatRemainingTime(totalMs: number) {
  if (totalMs <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function buildArenaClockState(contestConfig: ChallengeContestConfig, nowMs = Date.now()): ArenaClockState {
  const startsAt = new Date(contestConfig.scheduledStartAt).getTime();
  const endsAt = startsAt + contestConfig.durationMinutes * 60 * 1000;
  const totalWindow = Math.max(1, endsAt - startsAt);

  if (nowMs < startsAt) {
    const remaining = startsAt - nowMs;
    const progress = Math.max(0, Math.min(100, Math.round((1 - remaining / totalWindow) * 100)));
    return {
      display: formatRemainingTime(remaining),
      label: "Abertura da arena",
      progress,
      runtimePhase: "scheduled",
      startsAt,
      endsAt,
    };
  }

  if (nowMs >= endsAt) {
    return {
      display: "00:00:00",
      label: "Concurso encerrado",
      progress: 100,
      runtimePhase: "finished",
      startsAt,
      endsAt,
    };
  }

  const remaining = endsAt - nowMs;
  const elapsed = nowMs - startsAt;
  return {
    display: formatRemainingTime(remaining),
    label: "Tempo restante",
    progress: Math.max(0, Math.min(100, Math.round((elapsed / totalWindow) * 100))),
    runtimePhase: "running",
    startsAt,
    endsAt,
  };
}

export function useArenaClock(contestConfig: ChallengeContestConfig) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => buildArenaClockState(contestConfig, nowMs), [contestConfig, nowMs]);
}

function buildChallengeId(category: ChallengeCategory, difficulty: ChallengeDifficulty, index: number) {
  const prefix = category === "Portugol" ? "PTG" : "LOG";
  const tier = difficulty === "Baixo" ? 1 : difficulty === "Medio" ? 2 : 3;
  return `${prefix}-${tier}${String(index).padStart(2, "0")}`;
}

function buildTimeLimit(difficulty: ChallengeDifficulty) {
  if (difficulty === "Baixo") return "20 min";
  if (difficulty === "Medio") return "35 min";
  return "55 min";
}

function buildPoints(difficulty: ChallengeDifficulty, points: number) {
  if (points > 0) return points;
  if (difficulty === "Baixo") return 110;
  if (difficulty === "Medio") return 190;
  return 310;
}

function createGeneratedChallenge(input: ArenaGeneratorInput, existingLength: number): ArenaManagedChallenge {
  const slug = slugify(input.title);
  const points = buildPoints(input.difficulty, input.points);
  const id = buildChallengeId(input.category, input.difficulty, existingLength + 1);
  const summary = input.summary.trim() || "Desafio gerado a partir do painel da arena.";
  const tags = normalizeTags(input.tags.length ? input.tags : [input.category, input.difficulty]);

  const item: ChallengeItem = {
    id,
    slug,
    title: input.title.trim() || "Novo desafio",
    category: input.category,
    difficulty: input.difficulty,
    points,
    rating: 4.5,
    timeLimit: buildTimeLimit(input.difficulty),
    submissions: 0,
    summary,
    prompt: `Problema de ${input.category === "Portugol" ? "Portugol" : "lógica"} para a arena técnica.`,
    tags,
    featured: false,
  };

  const config: ChallengeQuestionConfig = {
    slug,
    statement: `Resolve o desafio "${item.title}" respeitando o enunciado definido pela equipa do Laboratório.`,
    inputFormat: "Define aqui a estrutura de entrada. Usa linhas separadas para cada valor relevante.",
    outputFormat: "Define aqui a saída esperada com precisão.",
    constraints: [
      "Mantém a solução dentro do tempo da arena.",
      "Evita leituras ou saídas ambíguas.",
    ],
    hints: [
      "Decompõe o problema em passos pequenos antes de escrever o algoritmo.",
      "Valida casos-limite antes de submeter.",
    ],
    evaluation: [
      "Corretude lógica da solução.",
      "Clareza do algoritmo e consistência da saída.",
    ],
    sampleCases: [
      {
        input: "10",
        output: "Resultado esperado",
        explanation: "Substitui por um caso de teste real antes de publicar.",
      },
    ],
    allowedLanguages: ["VisuAlg", "Portugol"],
    status: "draft",
  };

  return { item, config };
}

const ArenaStateContext = createContext<ArenaStateContextValue | null>(null);

export function ArenaStateProvider({ children }: { children: ReactNode }) {
  const [contestConfig, setContestConfig] = useState<ChallengeContestConfig>(() => parseStoredState().contestConfig);
  const [challenges, setChallenges] = useState<ArenaManagedChallenge[]>(() => parseStoredState().challenges);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        contestConfig,
        challenges,
      }),
    );
  }, [challenges, contestConfig]);

  const value = useMemo<ArenaStateContextValue>(() => ({
    contestConfig,
    challenges,
    saveContestConfig: (nextConfig) => {
      setContestConfig((current) => ({
        ...current,
        ...nextConfig,
        generalRules: nextConfig.generalRules ?? current.generalRules,
        waitingMessages: nextConfig.waitingMessages ?? current.waitingMessages,
      }));
    },
    upsertChallenge: (challenge) => {
      setChallenges((current) => {
        const next = [...current];
        const index = next.findIndex((item) => item.item.slug === challenge.item.slug);
        if (index >= 0) {
          next[index] = challenge;
          return next;
        }
        return [...next, challenge];
      });
    },
    removeChallenge: (slug) => {
      setChallenges((current) => current.filter((item) => item.item.slug !== slug));
    },
    generateChallenge: (input) => createGeneratedChallenge(input, challenges.length),
    resetArenaState: () => {
      const defaults = buildDefaultState();
      setContestConfig(defaults.contestConfig);
      setChallenges(defaults.challenges);
    },
  }), [challenges, contestConfig]);

  return (
    <ArenaStateContext.Provider value={value}>
      {children}
    </ArenaStateContext.Provider>
  );
}

export function useArenaState() {
  const context = useContext(ArenaStateContext);
  if (!context) {
    throw new Error("useArenaState must be used inside ArenaStateProvider");
  }
  return context;
}

export function createStarterCode(challenge: ArenaManagedChallenge) {
  return getDefaultStarterCode(challenge);
}
