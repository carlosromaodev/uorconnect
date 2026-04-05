import { ArrowRight, Radio, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestCard, ContestProgressBar } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
  RuntimePhaseBadge,
} from "@app/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@app/lib/arena-state";

export default function LaboratorioLobbyPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);
  const canEnterArena = clock.runtimePhase !== "scheduled";

  return (
    <LaboratorioPublicLayout
      title="Sala de espera da arena"
      subtitle="Antes da prova, o estudante entra aqui para confirmar presença, acompanhar o relógio e avançar para o catálogo da arena no momento certo."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <Button
          asChild={canEnterArena}
          disabled={!canEnterArena}
          className={cn("h-11 px-5", canEnterArena ? contestButtonClassNames.primary : contestButtonClassNames.disabled)}
        >
          {canEnterArena ? (
            <Link to="/arena">
              Abrir arena
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2">
              A aguardar início
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </Button>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <LaboratorioPageSection kicker="arena.presence" title="Presença confirmada">
          <div className="grid gap-4 md:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <Users className="h-5 w-5 text-[#00e5c8]" />
              <p className="mt-4 text-3xl font-semibold text-white">{contestConfig.onlineParticipants}</p>
              <p className="mt-2 text-sm text-[#8ea1b8]">participantes online</p>
            </ContestCard>

            <ContestCard tone="subtle" className="shadow-none">
              <Radio className="h-5 w-5 text-[#00e5c8]" />
              <div className="mt-4">
                <RuntimePhaseBadge runtimePhase={clock.runtimePhase} />
              </div>
              <p className="mt-3 text-sm text-[#8ea1b8]">
                {clock.runtimePhase === "running"
                  ? "A arena já foi libertada."
                  : clock.runtimePhase === "finished"
                    ? "A janela oficial encerrou."
                    : "Aguardamos a abertura oficial."}
              </p>
            </ContestCard>
          </div>

          <ContestCard tone="accent" className="mt-5 shadow-none">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">{clock.label}</p>
            <p className="mt-3 text-4xl font-semibold tracking-[0.18em] text-white">{clock.display}</p>
            <ContestProgressBar className="mt-4" value={clock.progress} />
          </ContestCard>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="system.feed" title="Sequência de arranque">
          <div className="space-y-3">
            {contestConfig.waitingMessages.map((message) => (
              <ContestCard key={message} tone="terminal" padding="cozy" className="shadow-none">
                <p className="font-tech-mono text-xs leading-6 text-slate-300">{message}</p>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
