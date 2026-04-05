import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { featuredLaboratorioModules, laboratorioModules } from "@/data/laboratorio-modules";
import { LaboratorioModuleCard } from "@/components/LaboratorioModuleCard";
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
  const arenaModule = laboratorioModules.find((module) => module.slug === "arena");
  const supportingModules = featuredLaboratorioModules.filter((module) => module.slug !== "arena").slice(0, 3);

  return (
    <LaboratorioPublicLayout
      title="Laboratório UOR Connect"
      subtitle="Home institucional do Laboratório, com identidade própria, acesso à Arena e visão clara dos programas práticos que complementam a experiência técnica."
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
        <LaboratorioPageSection kicker="laboratorio.home" title="Entrada principal do Laboratório">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 rounded-[28px] border border-[#00e5c8]/14 bg-[linear-gradient(135deg,rgba(7,17,23,0.98),rgba(5,12,16,0.98))] p-5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <img
                  src="/logouorconnectLaboratorio.svg"
                  alt="Logotipo do Laboratório UOR Connect"
                  className="h-12 w-auto md:h-14"
                />
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#8ea1b8]">
                  O Laboratório é o ambiente dedicado da UOR Connect para prática técnica, programas colaborativos, prototipagem, mentoria e experiências orientadas a execução.
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

        <LaboratorioPageSection kicker="arena.entry" title="Arena em destaque">
          {arenaModule ? <LaboratorioModuleCard module={arenaModule} /> : null}
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <LaboratorioPageSection kicker="programas" title="Outros programas do Laboratório">
          <div className="grid gap-4">
            {supportingModules.map((module) => (
              <LaboratorioModuleCard key={module.slug} module={module} compact />
            ))}
          </div>
          <div className="mt-5">
            <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
              <Link to="/programas">
                Ver todos os programas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="operacao" title="Como o produto está organizado">
          <div className="space-y-3 text-sm leading-7 text-[#8ea1b8]">
            <p>A home funciona como porta de entrada do produto, separando claramente Arena, programas e operação.</p>
            <p>A Arena mantém o foco técnico, enquanto os outros módulos ampliam aprendizagem, inovação aplicada e impacto.</p>
            <p>O backend de autenticação continua o mesmo, mas o design, o branding e a navegação do Laboratório já são independentes.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <p className="text-sm font-semibold text-white">Sessão e operação</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">Sala de espera, ranking e admin continuam próprios do Laboratório.</p>
            </ContestCard>
            <ContestCard tone="subtle" className="shadow-none">
              <p className="text-sm font-semibold text-white">Pseudocódigo e execução</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">A Arena continua a usar o executor VisuAlg como base de prova prática.</p>
            </ContestCard>
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <LaboratorioPageSection kicker="featured.challenges" title="Desafios em destaque da Arena">
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

        <LaboratorioPageSection kicker="next.release" title="Próximas frentes a consolidar">
          <div className="grid gap-3">
            <RoadmapPoint title="Aprendizagem em grupo" description="Blocos guiados por tema, solução partilhada e revisão em equipa." />
            <RoadmapPoint title="Hackathons e prototipagem" description="Execução rápida com entrega, pitch e teste de solução." />
            <RoadmapPoint title="Mentorias e soft skills" description="Carreira, comunicação, liderança e preparação para apresentação." />
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
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

function RoadmapPoint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[#8ea1b8]">{description}</p>
    </div>
  );
}
