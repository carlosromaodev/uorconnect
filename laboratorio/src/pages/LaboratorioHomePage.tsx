import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Compass, Layers3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { getToken } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LaboratorioModuleCard } from "@/components/LaboratorioModuleCard";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
  RuntimePhaseBadge,
} from "@app/components/LaboratorioPublicLayout";
import {
  laboratorioOperationalSteps,
  laboratorioResourceCollections,
  laboratorioSpaces,
  useLaboratorioHub,
} from "@app/lib/laboratorio-hub-state";
import { useArenaClock, useArenaState } from "@app/lib/arena-state";

function formatAgendaDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  });
}

export default function LaboratorioHomePage() {
  const { contestConfig } = useArenaState();
  const { modules, featuredModules, agendaItems } = useLaboratorioHub();
  const clock = useArenaClock(contestConfig);
  const hasSession = Boolean(getToken());
  const arenaModule = modules.find((module) => module.slug === "arena");
  const highlightedModules = featuredModules.filter((module) => module.slug !== "arena").slice(0, 4);
  const nextAgenda = agendaItems.slice(0, 3);

  return (
    <LaboratorioPublicLayout
      title="Laboratório UOR Connect"
      subtitle="Ambiente prático para estudantes de todos os cursos, com experiências organizadas por objetivos, agenda clara e módulos próprios para aprender, testar, colaborar e apresentar."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to="/programas">
              Explorar programas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to={hasSession ? "/agenda" : "/login"}>
              {hasSession ? "Ver agenda" : "Entrar no Laboratório"}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
        <LaboratorioPageSection kicker="home.missao" title="Uma entrada única para experiências diferentes">
          <div className="grid gap-5">
            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(19,29,44,0.96),rgba(13,21,33,0.96))] p-5">
              <img
                src="/logouorconnectLaboratorio.svg"
                alt="Logotipo do Laboratório UOR Connect"
                className="h-12 w-auto md:h-14"
              />
              <p className="mt-5 max-w-3xl text-sm leading-7 text-[#9fb0c3]">
                O Laboratório já não é uma página única com abas escondidas. Agora funciona como um produto com jornadas claras:
                descobrir um módulo, perceber a agenda, entrar na experiência certa e evoluir para a próxima etapa.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard icon={<Layers3 className="h-5 w-5 text-[#7bd3c6]" />} label="Módulos ativos" value={String(modules.length)} />
              <InfoCard icon={<CalendarDays className="h-5 w-5 text-[#7bd3c6]" />} label="Agenda publicada" value={`${agendaItems.length} momentos`} />
              <InfoCard icon={<Compass className="h-5 w-5 text-[#7bd3c6]" />} label="Ambientes" value={`${laboratorioSpaces.length} espaços`} />
            </div>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="home.arena" title="Arena dentro do ecossistema">
          <ContestCard tone="terminal" className="shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <ContestBadge tone="accentStrong">Arena</ContestBadge>
                <h3 className="mt-4 text-2xl font-semibold text-white">Arena de lógica e pseudocódigo</h3>
                <p className="mt-3 text-sm leading-7 text-[#9fb0c3]">
                  A Arena continua disponível, mas agora aparece como um módulo específico do Laboratório e não como a estrutura inteira do produto.
                </p>
              </div>
              <RuntimePhaseBadge runtimePhase={clock.runtimePhase} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ContestCard tone="subtle" className="shadow-none">
                <p className="text-sm font-semibold text-white">{clock.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{clock.display}</p>
              </ContestCard>
              <ContestCard tone="subtle" className="shadow-none">
                <p className="text-sm font-semibold text-white">Entrada rápida</p>
                <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">
                  Usa a Arena quando precisares de treino técnico, prova controlada ou leitura objetiva de desempenho.
                </p>
              </ContestCard>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
                <Link to="/arena">
                  Ir para a Arena
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
                <Link to={hasSession ? "/lobby" : "/login?redirect=%2Flobby"}>Abrir sala de espera</Link>
              </Button>
              {arenaModule ? (
                <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
                  <Link to={`/programas/${arenaModule.slug}`}>Ver estrutura da Arena</Link>
                </Button>
              ) : null}
            </div>
          </ContestCard>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <LaboratorioPageSection kicker="home.featured" title="Experiências em destaque">
          <div className="grid gap-4 md:grid-cols-2">
            {highlightedModules.map((module) => (
              <LaboratorioModuleCard key={module.slug} module={module} compact />
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="home.pathways" title="Como participar">
          <div className="space-y-3">
            {laboratorioOperationalSteps.slice(0, 4).map((step, index) => (
              <div key={step.id} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">
                  Etapa {index + 1}
                </p>
                <p className="mt-2 text-base font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{step.description}</p>
              </div>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
        <LaboratorioPageSection kicker="home.agenda" title="Próximos momentos publicados">
          <div className="grid gap-4">
            {nextAgenda.map((item) => (
              <ContestCard key={item.id} tone="subtle" className="shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">
                      {formatAgendaDate(item.date)} · {item.startTime}-{item.endTime}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{item.title}</h3>
                  </div>
                  <ContestBadge tone={item.featured ? "accent" : "neutral"}>{item.format}</ContestBadge>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#9fb0c3]">{item.summary}</p>
                <p className="mt-3 text-sm text-[#7f8da0]">{item.location} · {item.audience}</p>
              </ContestCard>
            ))}
          </div>

          <div className="mt-5">
            <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
              <Link to="/agenda">Ver agenda completa</Link>
            </Button>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="home.resources" title="Recursos e espaços do Laboratório">
          <div className="grid gap-3">
            {laboratorioResourceCollections.slice(0, 3).map((resource) => (
              <ContestCard key={resource.id} tone="subtle" className="shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-white">{resource.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{resource.description}</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-[#7bd3c6]" />
                </div>
              </ContestCard>
            ))}
          </div>

          <div className="mt-5">
            <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
              <Link to="/recursos">Abrir recursos</Link>
            </Button>
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <ContestCard tone="subtle" className="shadow-none">
      {icon}
      <p className="mt-4 font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8da0]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </ContestCard>
  );
}
