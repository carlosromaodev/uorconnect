import { ArrowRight } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import { getLaboratorioModule, type LaboratorioModuleStatus } from "@/data/laboratorio-modules";
import { LaboratorioModuleCard } from "@/components/LaboratorioModuleCard";
import { LaboratorioPageSection, LaboratorioPublicLayout } from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";

function getStatusTone(status: LaboratorioModuleStatus) {
  switch (status) {
    case "operacional":
      return "success" as const;
    case "piloto":
      return "accent" as const;
    case "curadoria":
      return "warning" as const;
    case "planeado":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export default function LaboratorioModuleDetailPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);
  const { slug } = useParams<{ slug: string }>();
  const module = getLaboratorioModule(slug);

  if (!module || module.slug === "arena") {
    return <Navigate replace to={module?.primaryPath || "/programas"} />;
  }

  return (
    <LaboratorioPublicLayout
      title={module.title}
      subtitle={module.summary}
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to={module.primaryPath}>
              {module.primaryLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/programas">Voltar aos programas</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
        <LaboratorioPageSection kicker={`programa.${module.slug}`} title="Visão geral">
          <ContestBadge tone={getStatusTone(module.status)}>{module.statusLabel}</ContestBadge>
          <p className="mt-5 text-sm leading-7 text-[#8ea1b8]">{module.description}</p>
          <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">Formato</p>
            <p className="mt-3 text-sm leading-7 text-[#d8e2ee]">{module.format}</p>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="outcomes" title="Resultados esperados">
          <div className="grid gap-3">
            {module.outcomes.map((item) => (
              <div key={item} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-[#8ea1b8]">
                {item}
              </div>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <LaboratorioPageSection kicker="operational.fit" title="Como este módulo encaixa no Laboratório">
          <div className="space-y-3 text-sm leading-7 text-[#8ea1b8]">
            <p>Este módulo existe para complementar a Arena e transformar o Laboratório num ambiente contínuo de prática, não apenas num espaço de prova técnica.</p>
            <p>A ideia é criar percursos de trabalho que alternem competição, aprendizagem, inovação aplicada e impacto real.</p>
            <p>Isso permite que o Laboratório seja útil tanto antes como depois da Arena, e não apenas durante o momento da competição.</p>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="cta" title="Próximo passo">
          <LaboratorioModuleCard module={module} compact />
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
