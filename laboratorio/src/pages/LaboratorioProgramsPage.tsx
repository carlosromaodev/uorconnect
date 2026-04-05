import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { featuredLaboratorioModules, laboratorioModules } from "@/data/laboratorio-modules";
import { LaboratorioModuleCard } from "@/components/LaboratorioModuleCard";
import { ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";

const trackMeta = {
  competicao: {
    title: "Competição e execução",
    description: "Programas focados em prova técnica, ritmo de entrega e leitura objetiva de desempenho.",
  },
  aprendizagem: {
    title: "Aprendizagem e mentoria",
    description: "Modelos de acompanhamento, trabalho colaborativo e reforço de competências humanas e técnicas.",
  },
  inovacao: {
    title: "Inovação e produto",
    description: "Formatos práticos para testar ideias, construir protótipos e simular contextos reais de decisão.",
  },
  impacto: {
    title: "Impacto e integração",
    description: "Desafios aplicados com relevância social e colaboração entre áreas diferentes.",
  },
} as const;

export default function LaboratorioProgramsPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);

  return (
    <LaboratorioPublicLayout
      title="Programas do Laboratório"
      subtitle="O Laboratório não se limita à Arena. Aqui ficam as frentes práticas que estruturam aprendizagem, inovação aplicada e experiências orientadas a execução."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
          <Link to="/arena">
            Ir para a arena
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <LaboratorioPageSection kicker="featured.modules" title="Frentes em destaque">
          <div className="grid gap-4 md:grid-cols-2">
            {featuredLaboratorioModules.map((module) => (
              <LaboratorioModuleCard key={module.slug} module={module} compact />
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="design.direction" title="Como esta estrutura foi pensada">
          <div className="space-y-3 text-sm leading-7 text-[#8ea1b8]">
            <p>A Arena continua a ser o motor técnico, mas o Laboratório passa a incluir experiências de aprendizagem, mentoria, inovação e impacto.</p>
            <p>Essa divisão ajuda a manter o produto mais claro: home institucional, programas organizados por objetivo e áreas técnicas com navegação própria.</p>
            <p>O efeito prático é um Laboratório mais útil e compreensível, sem parecer uma única página longa com abas escondidas.</p>
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5">
        {Object.entries(trackMeta).map(([track, meta]) => {
          const items = laboratorioModules.filter((module) => module.track === track);
          if (!items.length) return null;

          return (
            <LaboratorioPageSection key={track} kicker={`track.${track}`} title={meta.title}>
              <p className="text-sm leading-7 text-[#8ea1b8]">{meta.description}</p>
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
          <h3 className="text-2xl font-semibold text-white">Leitura rápida da estratégia</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StrategyPoint
              title="Execução"
              description="Arena, ranking e sala de espera mantêm o eixo competitivo e operacional."
            />
            <StrategyPoint
              title="Crescimento"
              description="Aprendizagem em grupo, mentorias e soft skills reforçam evolução contínua."
            />
            <StrategyPoint
              title="Aplicação"
              description="Hackathons, prototipagem, simulação empresarial e impacto social ampliam o valor prático."
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
      <p className="mt-2 text-sm leading-7 text-[#8ea1b8]">{description}</p>
    </div>
  );
}
