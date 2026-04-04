import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarClock, Lock, Play, Settings2, ShieldCheck, TimerReset, Trophy, Users, Waypoints } from "lucide-react";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import {
  ContestBadge,
  ContestCard,
  ContestProgressBar,
} from "@/components/challenges/contest-theme";
import { contestButtonClassNames, contestTextClassNames, contestTheme } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/api";
import { getContestLinkPath, getContestLoginHref, useContestClock } from "@/lib/contest-lab";
import { challengeContestConfig, challengeItems } from "@/data/challenges";
import { cn } from "@/lib/utils";

const CONTEST_CODE = "PROG.ARENA_01";

const levelTone = {
  Baixo: "border-emerald-500/26 text-emerald-300 hover:border-emerald-400/45",
  Medio: "border-amber-500/26 text-amber-200 hover:border-amber-400/45",
  Elevado: "border-violet-500/26 text-violet-200 hover:border-violet-400/45",
};

const flowSteps = [
  { label: "Login", description: "Sessão validada e acesso preparado para a arena." },
  { label: "Aguardar", description: "Lobby com relógio oficial e presença online." },
  { label: "Iniciar", description: "Janela aberta para a prova competitiva." },
  { label: "Resolver", description: "Editor, execução e submissão em ciclo curto." },
  { label: "Ranking", description: "Classificação final com score consolidado." },
];

const rules = [
  "Escolhe livremente a ordem dos desafios durante a janela oficial.",
  "Em caso de empate, vence quem concluir a pontuação primeiro.",
  "O laboratório fecha automaticamente quando o tempo terminar.",
];

const infoCards = [
  { label: "DATA", value: "15 Abr 2026", description: "dia oficial de execução", icon: CalendarClock },
  { label: "HORA", value: "18:00 WAT", description: "início sincronizado da janela", icon: TimerReset },
  { label: "CURSO", value: challengeContestConfig.course, description: "público-alvo desta arena", icon: ShieldCheck },
  { label: "FORMATO", value: "Pseudocódigo + Portugol", description: "duas formas de resolução aceites", icon: Trophy },
] as const;

const statsCards = [
  {
    label: "PARTICIPANTES ONLINE",
    value: String(challengeContestConfig.onlineParticipants),
    description: "presença atual na arena",
    icon: Users,
  },
  {
    label: "DESAFIOS",
    value: String(challengeItems.length),
    description: "catálogo técnico ativo",
    icon: Waypoints,
  },
  {
    label: "JANELA",
    value: `${challengeContestConfig.durationMinutes} min`,
    description: "tempo oficial da prova",
    icon: Trophy,
  },
  {
    label: "RANKING",
    value: "ao vivo",
    description: "posição atual sincronizada",
    icon: ShieldCheck,
  },
] as const;

export default function Desafios() {
  const clock = useContestClock();
  const contestStarted = clock.runtimePhase === "running";
  const contestFinished = clock.runtimePhase === "finished";
  const hasSession = Boolean(getToken());
  const previewAccessEnabled = true;
  const isActionEnabled = previewAccessEnabled || contestStarted;
  const primaryHref = hasSession ? getContestLinkPath("/lobby") : getContestLoginHref("/lobby");
  const statusLabel = previewAccessEnabled
    ? "PREVIEW_OPEN"
    : contestFinished
      ? "FINISHED"
      : contestStarted
        ? "RUNNING"
        : "LOCKED";

  return (
    <ContestLayout showTimerChip={false}>
      <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-7">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.22em] text-[#00e5c8]">LANDING.PAGE</p>
            <h1 className="max-w-[760px] text-[32px] font-bold leading-[1.02] text-white md:text-[48px]">
              Laboratório de <span className="text-[#00e5c8]">Programação</span> Competitiva
            </h1>
            <p className="max-w-[520px] text-[15px] leading-[1.6] text-[#7b8ca3]">
              Arena técnica para estudantes do 1º ano de Informática, com desafios em pseudocódigo e Portugol, score progressivo e ritmo de prova competitiva.
            </p>

            <div className="flex flex-wrap gap-3">
              <Tag>PSEUDOCÓDIGO + PORTUGOL</Tag>
              <Tag>DURAÇÃO {challengeContestConfig.durationMinutes} MIN</Tag>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            {infoCards.map((card) => (
              <InfoCard key={card.label} {...card} />
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <ContestCard tone="accent">
            <p className={contestTextClassNames.accentLabel}>COUNTDOWN.CLI</p>
            <div className="mt-5 rounded-[24px] border border-[#00e5c8]/16 bg-[radial-gradient(circle_at_center,rgba(0,229,200,0.16),rgba(0,229,200,0.03))] px-5 py-4">
              <span className="font-tech-mono text-[40px] font-semibold tracking-[0.22em] text-[#00e5c8]">{clock.display}</span>
            </div>
            <ContestProgressBar className="mt-4" value={clock.runtimePhase === "finished" ? 100 : 68} />
            <p className="mt-4 text-[13px] leading-[1.6] text-[#7b8ca3]">
              {contestFinished
                ? "A janela oficial terminou e o ranking final permanece disponível."
                : contestStarted
                  ? "O laboratório já está ativo e pronto para entrada."
                  : "A janela oficial ainda está em contagem, mas o fluxo foi libertado para preview estrutural."}
            </p>

            <div className="mt-6">
              <PrimaryActionButton enabled={isActionEnabled} href={primaryHref} />
            </div>

            <p className="mt-4 font-tech-mono text-[11px] uppercase tracking-[0.18em] text-[#7b8ca3]">
              STATUS :: {statusLabel}
            </p>
          </ContestCard>
        </motion.div>
      </section>

      <section className="mt-10 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {statsCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        <ContestPanel kicker="INFO.SECTION" title="Regras do concurso">
          <div className="space-y-3">
            {rules.map((rule) => (
              <ContestCard key={rule} tone="muted" padding="cozy" className="shadow-none">
                <p className="text-[13px] leading-[1.6] text-[#7b8ca3]">
                  <span className="mr-3 font-tech-mono text-[#00e5c8]">{">"}</span>
                  {rule}
                </p>
              </ContestCard>
            ))}
          </div>
        </ContestPanel>
      </section>

      <section className="mt-10">
        <ContestPanel kicker="LEVELS.SECTION" title="Níveis de dificuldade">
          <div className="grid gap-4 lg:grid-cols-3">
            {challengeContestConfig.levelScoring.map((level) => (
              <ContestCard
                key={level.difficulty}
                tone="default"
                className={cn(levelTone[level.difficulty], "shadow-none")}
              >
                <p className={contestTextClassNames.mutedLabel}>{level.pointsLabel}</p>
                <div className="mt-6 font-tech-mono text-4xl font-semibold">{level.icon}</div>
                <p className="mt-5 text-[22px] font-semibold text-white">{level.difficulty}</p>
                <p className="mt-3 text-[13px] leading-[1.6] text-[#7b8ca3]">
                  {level.difficulty === "Baixo"
                    ? "Leitura, decisão e base lógica para ganhar ritmo."
                    : level.difficulty === "Medio"
                      ? "Controle de fluxo, repetição e organização da solução."
                      : "Separação do topo com modelação, simulação e precisão."}
                </p>
              </ContestCard>
            ))}
          </div>
        </ContestPanel>
      </section>

      <section className="mt-10">
        <ContestPanel kicker="PIPELINE.SECTION" title="Como funciona">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {flowSteps.map((step, index) => (
              <ContestCard
                key={step.label}
                tone="default"
                className={cn(
                  "relative shadow-none",
                  index === flowSteps.length - 1 ? "sm:col-span-2 sm:mx-auto sm:w-[calc(50%-0.5rem)] xl:col-span-1 xl:mx-0 xl:w-auto" : "",
                )}
              >
                {index < flowSteps.length - 1 ? (
                  <span className="absolute right-[-14px] top-9 hidden h-px w-7 bg-[linear-gradient(90deg,rgba(0,229,200,0.28),transparent)] min-[901px]:block" />
                ) : null}
                <p className={contestTextClassNames.mutedLabel}>STAGE_{String(index + 1).padStart(2, "0")}</p>
                <p className="mt-4 text-lg font-semibold text-white">{step.label}</p>
                <p className="mt-3 text-[13px] leading-[1.6] text-[#7b8ca3]">{step.description}</p>
              </ContestCard>
            ))}
          </div>
        </ContestPanel>
      </section>

      <footer className={cn("mt-10 border-t py-6", contestTheme.border)}>
        <div className="flex flex-col items-center justify-between gap-2 text-center min-[901px]:flex-row min-[901px]:text-left">
          <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#e2e8f0]">UOR CONNECT :: LABORATÓRIO</p>
          <p className="text-[13px] text-[#7b8ca3]">{CONTEST_CODE} · 1º Ano · 2026</p>
        </div>
        <div className="mt-6 flex flex-col items-center gap-3 rounded-[28px] border border-[#00e5c8]/16 bg-[linear-gradient(180deg,rgba(6,13,16,0.94),rgba(7,11,15,0.98))] px-5 py-5 text-center md:flex-row md:justify-between md:text-left">
          <div className="max-w-2xl">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.2em] text-[#00e5c8]">ADMIN.PANEL</p>
            <p className="mt-2 text-sm leading-6 text-[#7b8ca3]">
              Governação interna, autorização de contas, publicação da arena e controlo dos exercícios.
            </p>
          </div>
          <Button asChild className={cn(contestButtonClassNames.primary, "h-11 px-5")}>
            <Link to={getContestLinkPath("/admin")} className="inline-flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Admin do laboratório
            </Link>
          </Button>
        </div>
      </footer>
    </ContestLayout>
  );
}

function Tag({ children }: { children: string }) {
  return <ContestBadge tone="neutral">[{children}]</ContestBadge>;
}

function InfoCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <ContestCard tone="default">
      <p className={contestTextClassNames.accentLabel}>{label}</p>
      <Icon className="mt-4 h-4 w-4 text-[#00e5c8]" />
      <p className="mt-4 text-base font-semibold text-white">{value}</p>
      <p className="mt-2 text-[13px] leading-[1.6] text-[#7b8ca3]">{description}</p>
    </ContestCard>
  );
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <ContestCard tone="subtle">
      <p className={contestTextClassNames.accentLabel}>{label}</p>
      <Icon className="mt-4 h-4 w-4 text-[#00e5c8]" />
      <p className="mt-4 text-lg font-semibold text-white">{value}</p>
      <p className="mt-2 text-[13px] leading-[1.6] text-[#7b8ca3]">{description}</p>
    </ContestCard>
  );
}

function PrimaryActionButton({ enabled, href }: { enabled: boolean; href: string }) {
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        className={cn("flex w-full cursor-not-allowed items-center justify-center px-4 py-[14px] text-sm font-semibold", contestButtonClassNames.disabled)}
      >
        <Lock className="mr-2 h-4 w-4" />
        Aguardar libertação
      </button>
    );
  }

  return (
    <Button
      asChild
      className={cn("flex h-auto w-full items-center justify-center px-4 py-[14px] text-sm font-bold transition-all duration-200 ease-out hover:scale-[1.01]", contestButtonClassNames.primary)}
    >
      <Link to={href}>
        <Play className="mr-2 h-4 w-4" />
        Entrar no Laboratório
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  );
}
