import { useMemo, useState } from "react";
import { CheckCircle2, Filter, Lock, TimerReset } from "lucide-react";
import { Link } from "react-router-dom";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import {
  ContestBadge,
  ContestCard,
  ContestProgressBar,
} from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import {
  challengeItems,
  challengeQuestionConfigs,
  challengeStudentProgress,
  type ChallengeDifficulty,
} from "@/data/challenges";
import { getContestLinkPath } from "@/lib/contest-lab";
import { cn } from "@/lib/utils";

const filterOptions: Array<ChallengeDifficulty | "Todos"> = ["Todos", "Baixo", "Medio", "Elevado"];

const difficultyTone = {
  Baixo: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Medio: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  Elevado: "border-red-500/20 bg-red-500/10 text-red-200",
};

export default function DesafiosArena() {
  const [filter, setFilter] = useState<ChallengeDifficulty | "Todos">("Todos");

  const filteredChallenges = useMemo(
    () => challengeItems.filter((item) => filter === "Todos" || item.difficulty === filter),
    [filter],
  );

  const totalPoints = challengeItems.reduce((acc, item) => acc + item.points, 0);
  const progressPct = Math.round((challengeStudentProgress.score / totalPoints) * 100);

  return (
    <ContestLayout
      pageLabel="arena.selection"
      title="Seleção de Desafios"
      subtitle="Todos os exercícios da rodada, organizados por nível, com score visível, estado por estudante e temporizador global fixo no topo."
    >
      <ContestCard tone="accent" className="sticky top-[92px] z-20 mb-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ContestBadge tone="accent">
              <Filter className="h-3.5 w-3.5" />
              filtro
            </ContestBadge>
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={cn(
                  "rounded-full px-4 py-2 font-tech-mono text-xs uppercase tracking-[0.18em] transition",
                  filter === option
                    ? "bg-[#00e5c8] text-[#041013]"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:border-[#00e5c8]/26 hover:text-white",
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="min-w-[240px]">
            <div className="flex items-center justify-between font-tech-mono text-[11px] uppercase tracking-[0.18em] text-[#7b8ca3]">
              <span>progress.total</span>
              <span>{progressPct}%</span>
            </div>
            <ContestProgressBar className="mt-2" value={progressPct} />
            <p className="mt-2 text-sm text-slate-300">
              {challengeStudentProgress.solvedCount} resolvidos · {challengeStudentProgress.score} pts · posição #{challengeStudentProgress.currentPosition}
            </p>
          </div>
        </div>
      </ContestCard>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {filteredChallenges.map((challenge, index) => {
          const config = challengeQuestionConfigs.find((item) => item.slug === challenge.slug);
          const isCompleted = challengeStudentProgress.completedSlugs.includes(challenge.slug);
          const isBlocked = config?.status === "draft";
          const statusLabel = isBlocked ? "bloqueado" : isCompleted ? "concluído" : "disponível";
          const detailHref = getContestLinkPath(`/desafios/${challenge.slug}`);

          return (
            <ContestPanel
              key={challenge.slug}
              kicker={`exercise.${String(index + 1).padStart(2, "0")}`}
              padding="flush"
            >
              <div className="flex h-full flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-tech-mono text-[11px] uppercase tracking-[0.18em] text-[#7b8ca3]">#{challenge.id}</p>
                    <h2 className="mt-3 text-2xl font-heading font-bold text-white">{challenge.title}</h2>
                  </div>
                  <ContestBadge tone="accent">{challenge.points} pts</ContestBadge>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">{challenge.summary}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={cn("inline-flex items-center rounded-full border px-3 py-1.5 font-tech-mono text-[11px] uppercase tracking-[0.16em]", difficultyTone[challenge.difficulty])}>
                    {challenge.difficulty}
                  </span>
                  <ContestBadge tone="neutral">{challenge.category}</ContestBadge>
                  <ContestBadge tone={isCompleted ? "success" : isBlocked ? "danger" : "accent"}>
                    {statusLabel}
                  </ContestBadge>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="inline-flex items-center gap-2 text-sm text-slate-300">
                    {isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : isBlocked ? <Lock className="h-4 w-4 text-red-300" /> : <TimerReset className="h-4 w-4 text-[#00e5c8]" />}
                    {isCompleted
                      ? "✓ test passed"
                      : isBlocked
                        ? "Questão reservada pelo admin"
                        : "Pronto para abrir no editor"}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-5">
                  <p className="font-tech-mono text-[11px] uppercase tracking-[0.18em] text-[#7b8ca3]">{challenge.timeLimit}</p>
                  <Button asChild className={cn("h-10 px-4", contestButtonClassNames.primary)} disabled={isBlocked}>
                    <Link to={detailHref}>Abrir editor</Link>
                  </Button>
                </div>
              </div>
            </ContestPanel>
          );
        })}
      </section>
    </ContestLayout>
  );
}
