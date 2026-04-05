import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@app/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@app/lib/arena-state";

export default function LaboratorioRulesPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);

  return (
    <LaboratorioPublicLayout
      title="Regras da Arena"
      subtitle="Regras oficiais, modelo de avaliação e condições de participação do módulo competitivo do Laboratório."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to="/arena">Voltar à Arena</Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/ranking">Ver ranking</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <LaboratorioPageSection kicker="official.rules" title="Regras oficiais">
          <div className="space-y-3">
            {contestConfig.generalRules.map((rule) => (
              <ContestCard key={rule} tone="subtle" className="shadow-none">
                <p className="text-sm leading-7 text-slate-300">{rule}</p>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="evaluation.model" title="Modelo de avaliação">
          <div className="space-y-3 text-sm leading-7 text-[#8ea1b8]">
            <p>O desempate considera score e o momento da última submissão pontuável.</p>
            <p>A arena usa VisuAlg/Portugol no navegador para validar estrutura, semântica e execução antes da submissão.</p>
            <p>O admin pode abrir, fechar e reconfigurar a janela da prova diretamente no painel do Laboratório.</p>
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
