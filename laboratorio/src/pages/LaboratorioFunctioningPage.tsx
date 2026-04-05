import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";
import {
  laboratorioCourseClusters,
  laboratorioOperationalSteps,
  laboratorioSpaces,
} from "@/lib/laboratorio-hub-state";

export default function LaboratorioFunctioningPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);

  return (
    <LaboratorioPublicLayout
      title="Funcionamento do Laboratório"
      subtitle="Cadeia lógica de operação do produto, desde a descoberta do módulo até à continuidade após a participação."
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
            <Link to="/recursos">Abrir recursos</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <LaboratorioPageSection kicker="fluxo" title="Cadeia operacional">
          <div className="space-y-3">
            {laboratorioOperationalSteps.map((step, index) => (
              <ContestCard key={step.id} tone="subtle" className="shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">
                      Etapa {index + 1}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">{step.title}</p>
                    <p className="mt-3 text-sm leading-7 text-[#9fb0c3]">{step.description}</p>
                  </div>
                  <ContestBadge tone="neutral">{step.owner}</ContestBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {step.outputs.map((item) => (
                    <ContestBadge key={item} tone="muted">{item}</ContestBadge>
                  ))}
                </div>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="principios" title="Princípios de organização">
          <div className="space-y-3 text-sm leading-7 text-[#9fb0c3]">
            <p>Cada página responde a uma intenção concreta: descobrir, decidir, entrar, operar e continuar.</p>
            <p>Cada módulo tem lógica própria de acesso, cadência, público, entrega e leitura de resultado.</p>
            <p>O admin gere o Laboratório por programas, agenda, Arena e segurança, sem misturar tudo num único painel indiferenciado.</p>
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <LaboratorioPageSection kicker="cursos" title="Perfis e clusters atendidos">
          <div className="grid gap-3">
            {laboratorioCourseClusters.map((cluster) => (
              <ContestCard key={cluster.slug} tone="subtle" className="shadow-none">
                <p className="text-base font-semibold text-white">{cluster.title}</p>
                <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{cluster.summary}</p>
                <p className="mt-3 text-sm text-[#7f8da0]">{cluster.courses.join(", ")}</p>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="espacos" title="Espaços operacionais">
          <div className="grid gap-3">
            {laboratorioSpaces.map((space) => (
              <ContestCard key={space.id} tone="subtle" className="shadow-none">
                <p className="text-base font-semibold text-white">{space.title}</p>
                <p className="mt-2 text-sm leading-7 text-[#9fb0c3]">{space.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {space.uses.map((item) => (
                    <ContestBadge key={item} tone="neutral">{item}</ContestBadge>
                  ))}
                </div>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
