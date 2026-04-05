import { ArrowRight, BookOpen, BriefcaseBusiness, Compass, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";
import {
  laboratorioMentorRoster,
  laboratorioResourceCollections,
  laboratorioSpaces,
} from "@/lib/laboratorio-hub-state";

function getResourceIcon(id: string) {
  if (id.includes("mentoria")) return <Users className="h-5 w-5 text-[#7bd3c6]" />;
  if (id.includes("equipa")) return <BriefcaseBusiness className="h-5 w-5 text-[#7bd3c6]" />;
  if (id.includes("espacos")) return <Compass className="h-5 w-5 text-[#7bd3c6]" />;
  return <BookOpen className="h-5 w-5 text-[#7bd3c6]" />;
}

export default function LaboratorioResourcesPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);

  return (
    <LaboratorioPublicLayout
      title="Recursos do Laboratório"
      subtitle="Guias, kits, roster de mentoria e leitura dos espaços para ajudar o estudante a entrar melhor em cada experiência."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to="/programas">
              Ver programas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/agenda">Ver agenda</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <LaboratorioPageSection kicker="recursos.kits" title="Kits e guias de operação">
          <div className="grid gap-4">
            {laboratorioResourceCollections.map((resource) => (
              <ContestCard key={resource.id} tone="subtle" className="shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{resource.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{resource.description}</p>
                  </div>
                  {getResourceIcon(resource.id)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#7f8da0]">
                  {resource.items.map((item) => (
                    <span key={item} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-5">
                  <Button asChild variant="outline" className={cn("h-10 px-4", contestButtonClassNames.secondary)}>
                    <Link to={resource.ctaPath}>{resource.ctaLabel}</Link>
                  </Button>
                </div>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="recursos.mentoria" title="Mentoria e apoio humano">
          <div className="grid gap-3">
            {laboratorioMentorRoster.map((mentor) => (
              <ContestCard key={mentor.id} tone="subtle" className="shadow-none">
                <p className="text-base font-semibold text-white">{mentor.name}</p>
                <p className="mt-2 text-sm text-[#7bd3c6]">{mentor.area}</p>
                <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{mentor.focus}</p>
                <p className="mt-3 text-sm text-[#7f8da0]">{mentor.availability}</p>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8">
        <LaboratorioPageSection kicker="recursos.espacos" title="Mapa rápido dos espaços">
          <div className="grid gap-4 md:grid-cols-2">
            {laboratorioSpaces.map((space) => (
              <ContestCard key={space.id} tone="subtle" className="shadow-none">
                <p className="text-base font-semibold text-white">{space.title}</p>
                <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{space.description}</p>
                <p className="mt-3 text-sm text-[#7f8da0]">{space.uses.join(" · ")}</p>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
