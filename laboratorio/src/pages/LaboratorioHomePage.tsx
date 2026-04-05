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
      subtitle="Espaço digital do Laboratório para arena, apoio operativo, acompanhamento da sessão e controlo académico da competição."
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
            <Link to="/arena">Ir para a arena</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <LaboratorioPageSection kicker="laboratorio.home" title="Uma experiência própria do Laboratório">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-[28px] border border-[#00e5c8]/14 bg-[linear-gradient(135deg,rgba(7,17,23,0.98),rgba(5,12,16,0.98))] p-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <img
                  src="/logouorconnectLaboratorio.svg"
                  alt="Logotipo do Laboratório UOR Connect"
                  className="h-12 w-auto md:h-14"
                />
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#8ea1b8]">
                  O Laboratório é a frente técnica dedicada da UOR Connect para sessões de programação, arena competitiva, controlo da prova e leitura do ranking.
                </p>
              </div>
              <ContestCard tone="terminal" className="w-full max-w-sm shrink-0 shadow-none">
                <RuntimePhaseBadge runtimePhase={clock.runtimePhase} />
                <p className="mt-4 text-3xl font-semibold text-white">{clock.display}</p>
                <p className="mt-2 text-sm text-[#8ea1b8]">{clock.label}</p>
              </ContestCard>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard label="Curso" value={contestConfig.course} />
              <InfoCard label="Local" value={contestConfig.venue} />
              <InfoCard label="Exercícios" value={`${challenges.length} desafios ativos`} />
            </div>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="acesso.rapido" title="Áreas principais">
          <div className="grid gap-3">
            <ActionCard
              to="/arena"
              label="Arena"
              description="Abre o catálogo de exercícios e entra diretamente no editor da prova."
              buttonLabel="Ir para a arena"
              icon={<Sparkles className="h-5 w-5" />}
              highlighted
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickAccessCard
                to={hasSession ? "/lobby" : "/login?redirect=%2Flobby"}
                label="Sala de espera"
                description="Entrada autenticada antes do início oficial."
                icon={<Radio className="h-5 w-5" />}
              />
              <QuickAccessCard
                to="/ranking"
                label="Ranking"
                description="Consulta a classificação consolidada."
                icon={<Trophy className="h-5 w-5" />}
              />
              <QuickAccessCard
                to={hasSession ? "/admin" : "/login?redirect=%2Fadmin"}
                label="Admin"
                description="Painel de controlo e operação da sessão."
                icon={<ShieldCheck className="h-5 w-5" />}
              />
            </div>
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

        <LaboratorioPageSection kicker="sobre.o.laboratorio" title="Como o Laboratório está organizado">
          <div className="space-y-3 text-sm leading-7 text-[#8ea1b8]">
            <p>A home funciona como entrada principal do Laboratório, com identidade própria, informação da sessão e acesso rápido às áreas essenciais.</p>
            <p>A arena continua a ser o núcleo técnico da competição, mas o produto também inclui sala de espera, ranking e painel administrativo próprios.</p>
            <p>O backend de autenticação foi mantido, mas a experiência visual e a navegação do Laboratório já não dependem do portal público.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <p className="text-sm font-semibold text-white">Login académico</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">Acesso limpo e próprio do Laboratório, sem misturar o design do portal.</p>
            </ContestCard>
            <ContestCard tone="subtle" className="shadow-none">
              <p className="text-sm font-semibold text-white">Executor VisuAlg</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">Base real para pseudocódigo e Portugol dentro da arena.</p>
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

function ActionCard({
  to,
  label,
  description,
  buttonLabel,
  icon,
  highlighted = false,
}: {
  to: string;
  label: string;
  description: string;
  buttonLabel: string;
  icon: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <ContestCard tone={highlighted ? "accent" : "subtle"} className="shadow-none">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]">
        {icon}
      </div>
      <p className="mt-4 text-lg font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#8ea1b8]">{description}</p>
      <Button asChild className={cn("mt-5 h-11 px-5", contestButtonClassNames.primary)}>
        <Link to={to}>
          {buttonLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </ContestCard>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <ContestCard tone="subtle" className="shadow-none">
      <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </ContestCard>
  );
}
