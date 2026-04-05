import type { ReactNode } from "react";
import { ArrowRight, Radio, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
  RuntimePhaseBadge,
} from "@app/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@app/lib/arena-state";

export default function LaboratorioHomePage() {
  const { contestConfig, challenges } = useArenaState();
  const clock = useArenaClock(contestConfig);
  const hasSession = Boolean(getToken());
  const featuredChallenges = challenges.filter((challenge) => challenge.item.featured).slice(0, 3);

  return (
    <LaboratorioPublicLayout
      title="Laboratório UOR Connect"
      subtitle="Ambiente da arena técnica com login académico, sala de espera, catálogo de exercícios, ranking e operação administrativa própria."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to={hasSession ? "/lobby" : "/login?redirect=%2Flobby"}>
              {hasSession ? "Entrar na sala de espera" : "Entrar no Laboratório"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/arena">Ver desafios</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <LaboratorioPageSection kicker="arena.status" title="Estado atual da arena">
          <div className="grid gap-4 md:grid-cols-2">
            <ContestCard tone="terminal" className="shadow-none">
              <RuntimePhaseBadge runtimePhase={clock.runtimePhase} />
              <p className="mt-4 text-3xl font-semibold text-white">{clock.display}</p>
              <p className="mt-3 text-sm leading-7 text-[#8ea1b8]">
                {clock.runtimePhase === "running"
                  ? "A arena está ativa e pronta para receber execuções e submissões."
                  : clock.runtimePhase === "finished"
                    ? "A janela terminou. Mantemos ranking e revisão disponíveis."
                    : "A sala de espera está aberta até à libertação oficial da prova."}
              </p>
            </ContestCard>

            <ContestCard tone="subtle" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">
                configuração rápida
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>{contestConfig.course}</p>
                <p>{contestConfig.venue}</p>
                <p>{challenges.length} desafios carregados</p>
              </div>
            </ContestCard>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="quick.access" title="Acesso rápido">
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAccessCard
              to={hasSession ? "/lobby" : "/login?redirect=%2Flobby"}
              label="Sala de espera"
              description="Entrada autenticada antes da arena."
              icon={<Radio className="h-5 w-5" />}
            />
            <QuickAccessCard
              to="/arena"
              label="Arena"
              description="Catálogo de exercícios e editor."
              icon={<Sparkles className="h-5 w-5" />}
            />
            <QuickAccessCard
              to="/ranking"
              label="Ranking"
              description="Classificação consolidada."
              icon={<Trophy className="h-5 w-5" />}
            />
            <QuickAccessCard
              to={hasSession ? "/admin" : "/login?redirect=%2Fadmin"}
              label="Admin"
              description="Governação e controlo da arena."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <LaboratorioPageSection kicker="featured.challenges" title="Desafios em destaque">
          <div className="grid gap-4">
            {featuredChallenges.map((challenge) => (
              <Link
                key={challenge.item.slug}
                to={`/arena/${challenge.item.slug}`}
                className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-[#00e5c8]/18"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">
                      {challenge.item.id}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{challenge.item.title}</h3>
                  </div>
                  <ContestBadge tone="accent">{challenge.item.points} pts</ContestBadge>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#8ea1b8]">{challenge.item.summary}</p>
              </Link>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="flow" title="Fluxo da sessão">
          <div className="space-y-3 text-sm leading-7 text-[#8ea1b8]">
            <p>Faz login com a tua conta académica e entra primeiro na sala de espera para acompanhar a abertura oficial da prova.</p>
            <p>Cada desafio abre num editor próprio com execução VisuAlg, validação de exemplo e diagnóstico de erros.</p>
            <p>O painel do Laboratório mantém as definições da arena, autorizações e ranking em secções distintas.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <p className="text-sm font-semibold text-white">Sala de espera</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">Mantida como etapa obrigatória antes da arena.</p>
            </ContestCard>
            <ContestCard tone="subtle" className="shadow-none">
              <p className="text-sm font-semibold text-white">Executor VisuAlg</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">Base real para pseudocódigo/Portugol dentro da prova.</p>
            </ContestCard>
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}

function QuickAccessCard({
  to,
  label,
  description,
  icon,
}: {
  to: string;
  label: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-[#00e5c8]/18 hover:bg-[#00e5c8]/[0.04]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]">
        {icon}
      </div>
      <p className="mt-4 text-base font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#8ea1b8]">{description}</p>
    </Link>
  );
}
