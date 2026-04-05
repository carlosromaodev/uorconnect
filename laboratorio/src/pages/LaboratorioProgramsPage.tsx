import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import { LaboratorioModuleCard } from "@/components/LaboratorioModuleCard";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";
import { useLaboratorioHub } from "@/lib/laboratorio-hub-state";

const trackMeta = {
  competicao: {
    title: "Competição e execução técnica",
    description: "Experiências para treino objetivo, prova, lógica e leitura de desempenho.",
  },
  aprendizagem: {
    title: "Aprendizagem e desenvolvimento humano",
    description: "Sessões guiadas para estudo, comunicação, mentoria e progressão contínua.",
  },
  inovacao: {
    title: "Inovação, produto e experimentação",
    description: "Formatos para testar ideias, construir soluções e simular ambientes reais de decisão.",
  },
  impacto: {
    title: "Impacto e integração interdisciplinar",
    description: "Desafios voltados a colaboração entre áreas, utilidade social e visão sistémica.",
  },
} as const;

export default function LaboratorioProgramsPage() {
  const { contestConfig } = useArenaState();
  const { modules, featuredModules } = useLaboratorioHub();
  const clock = useArenaClock(contestConfig);

  return (
    <LaboratorioPublicLayout
      title="Programas do Laboratório"
      subtitle="Os programas estão organizados por objetivo e não por uma única modalidade. Isso permite que estudantes de cursos diferentes entendam rapidamente onde entram e o que podem fazer dentro do Laboratório."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to="/agenda">
              Ver agenda
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/funcionamento">Como funciona</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <LaboratorioPageSection kicker="programas.destaque" title="Experiências em destaque">
          <div className="grid gap-4 md:grid-cols-2">
            {featuredModules.map((module) => (
              <LaboratorioModuleCard key={module.slug} module={module} compact />
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="programas.logica" title="Leitura institucional do catálogo">
          <div className="space-y-3 text-sm leading-7 text-[#9fb0c3]">
            <p>O catálogo foi separado por frentes de valor: aprender, executar, inovar e integrar perfis diferentes.</p>
            <p>Isso reduz ruído, evita que o Laboratório pareça uma única página com secções sobrepostas e ajuda cada estudante a encontrar um ponto de entrada real.</p>
            <p>A Arena mantém a sua importância, mas aparece ao lado de mentorias, grupos, prototipagem, impacto social e simulação.</p>
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5">
        {Object.entries(trackMeta).map(([track, meta]) => {
          const items = modules.filter((module) => module.track === track);
          if (!items.length) return null;

          return (
            <LaboratorioPageSection key={track} kicker={`track.${track}`} title={meta.title}>
              <p className="text-sm leading-7 text-[#9fb0c3]">{meta.description}</p>
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                {items.map((module) => (
                  <LaboratorioModuleCard key={module.slug} module={module} />
                ))}
              </div>
            </LaboratorioPageSection>
          );
        })}
      </section>

      <section className="mt-8">
        <ContestCard tone="terminal" className="shadow-none">
          <h3 className="text-2xl font-semibold text-white">O que muda na prática</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StrategyPoint
              title="Entrada clara"
              description="Home, agenda, programas e recursos deixaram de competir entre si e passaram a responder a perguntas diferentes."
            />
            <StrategyPoint
              title="Módulos com identidade"
              description="Cada programa tem objetivo, cadência, tipo de acesso, públicos e superfície própria de gestão."
            />
            <StrategyPoint
              title="Progressão contínua"
              description="O estudante pode sair de uma experiência e ser encaminhado para outra sem reiniciar todo o percurso."
            />
          </div>
        </ContestCard>
      </section>
    </LaboratorioPublicLayout>
  );
}

function StrategyPoint({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{description}</p>
    </div>
  );
}
