import { useMemo, useState } from "react";
import { ArrowRight, Filter, Lock, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard, ContestProgressBar } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChallengeDifficulty } from "@/data/challenges";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@app/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@app/lib/arena-state";

const filterOptions: Array<ChallengeDifficulty | "Todos"> = ["Todos", "Baixo", "Medio", "Elevado"];

const difficultyTone = {
  Baixo: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Medio: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  Elevado: "border-red-500/20 bg-red-500/10 text-red-200",
};

export default function LaboratorioArenaPage() {
  const { contestConfig, challenges } = useArenaState();
  const clock = useArenaClock(contestConfig);
  const [filter, setFilter] = useState<ChallengeDifficulty | "Todos">("Todos");
  const hasSession = Boolean(getToken());

  const filteredChallenges = useMemo(
    () => challenges.filter((challenge) => filter === "Todos" || challenge.item.difficulty === filter),
    [challenges, filter],
  );

  const totalPoints = challenges.reduce((acc, challenge) => acc + challenge.item.points, 0);

  return (
    <LaboratorioPublicLayout
      title="Arena de lógica e pseudocódigo"
      subtitle="Módulo técnico do Laboratório dedicado a treino, prova controlada e leitura objetiva de desempenho."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to={hasSession ? "/lobby" : "/login?redirect=%2Flobby"}>{hasSession ? "Abrir sala de espera" : "Entrar para a Arena"}</Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/ranking">Ver ranking Arena</Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/regras">Ler regras</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <LaboratorioPageSection kicker="arena.filters" title="Filtrar catálogo">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors",
                  filter === option
                    ? "border-[#00e5c8]/28 bg-[#00e5c8]/10 text-[#00e5c8]"
                    : "border-white/8 bg-white/[0.03] text-[#9fb0c3] hover:border-[#00e5c8]/18 hover:text-white",
                )}
              >
                <Filter className="mr-2 h-4 w-4" />
                {option}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">desafios</p>
              <p className="mt-3 text-3xl font-semibold text-white">{filteredChallenges.length}</p>
            </ContestCard>
            <ContestCard tone="subtle" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">pontuação total</p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalPoints}</p>
            </ContestCard>
          </div>

          <ContestCard tone="accent" className="mt-5 shadow-none">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">estado da prova</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              A arena centraliza o catálogo da sessão e encaminha cada problema para o seu editor e respetivo diagnóstico.
            </p>
            <ContestProgressBar className="mt-4" value={clock.progress} />
          </ContestCard>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="arena.catalog" title="Desafios disponíveis">
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredChallenges.map((challenge) => (
              <ContestCard key={challenge.item.slug} tone="default" className="flex h-full flex-col shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">
                      {challenge.item.id}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{challenge.item.title}</h3>
                  </div>
                  <ContestBadge tone="accent">{challenge.item.points} pts</ContestBadge>
                </div>

                <p className="mt-4 text-sm leading-7 text-[#8ea1b8]">{challenge.item.summary}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={cn("inline-flex items-center rounded-full border px-3 py-1.5 font-tech-mono text-[11px] uppercase tracking-[0.16em]", difficultyTone[challenge.item.difficulty])}>
                    {challenge.item.difficulty}
                  </span>
                  <ContestBadge tone="neutral">{challenge.item.category}</ContestBadge>
                  <ContestBadge tone={challenge.config.status === "draft" ? "warning" : "success"}>
                    {challenge.config.status === "draft" ? "draft" : "publicado"}
                  </ContestBadge>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
                  <p className="inline-flex items-center gap-2 text-sm text-[#8ea1b8]">
                    {challenge.config.status === "draft" ? <Lock className="h-4 w-4" /> : <Trophy className="h-4 w-4 text-[#00e5c8]" />}
                    {challenge.item.timeLimit}
                  </p>

                  <Button asChild className={cn("h-10 px-4", contestButtonClassNames.primary)}>
                    <Link to={`/arena/${challenge.item.slug}`}>
                      Abrir editor
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
