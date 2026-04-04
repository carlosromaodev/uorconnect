import { motion } from "framer-motion";
import { ArrowRight, Radio, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import {
  ContestCard,
  ContestProgressBar,
} from "@/components/challenges/contest-theme";
import { contestButtonClassNames, contestTextClassNames } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { challengeContestConfig } from "@/data/challenges";
import { getContestLinkPath, useContestClock } from "@/lib/contest-lab";
import { cn } from "@/lib/utils";

export default function DesafiosLobby() {
  const clock = useContestClock();
  const previewAccessEnabled = true;
  const canEnterArena = previewAccessEnabled || clock.runtimePhase === "running";
  const arenaHref = getContestLinkPath("/desafios/arena");

  return (
    <ContestLayout
      pageLabel="lobby.waiting_room"
      title="Sala de Espera do Concurso"
      subtitle="Sessão autenticada, presença registada e relógio técnico em contagem para a libertação oficial da arena."
      headerActions={
        <Button
          asChild={canEnterArena || clock.runtimePhase === "finished"}
          disabled={!canEnterArena && clock.runtimePhase !== "finished"}
          className={cn("h-11 px-5", canEnterArena || clock.runtimePhase === "finished" ? contestButtonClassNames.primary : contestButtonClassNames.disabled)}
        >
          {canEnterArena || clock.runtimePhase === "finished" ? (
            <Link to={arenaHref}>
              Abrir Arena
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
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <ContestPanel kicker="presence.feed" title="Presença técnica">
          <div className="grid gap-4 md:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <Users className="h-5 w-5 text-[#00e5c8]" />
              <p className="mt-4 font-tech-mono text-[10px] uppercase tracking-[0.2em] text-[#7b8ca3]">participantes online</p>
              <p className="mt-2 text-4xl font-semibold text-white">{challengeContestConfig.onlineParticipants}</p>
            </ContestCard>
            <ContestCard tone="subtle" className="shadow-none">
              <Radio className="h-5 w-5 text-[#00e5c8]" />
              <p className="mt-4 font-tech-mono text-[10px] uppercase tracking-[0.2em] text-[#7b8ca3]">estado atual</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {clock.runtimePhase === "finished"
                  ? "contest_finished"
                  : clock.runtimePhase === "running"
                    ? "arena_released"
                    : "awaiting_admin_release"}
              </p>
            </ContestCard>
          </div>

          <ContestCard tone="accent" className="mt-6 shadow-none">
            <p className={contestTextClassNames.accentLabel}>countdown.to.start</p>
            <p className="mt-3 font-tech-mono text-4xl font-semibold tracking-[0.28em] text-[#00e5c8] md:text-5xl">{clock.display}</p>
            <ContestProgressBar className="mt-4" value={clock.runtimePhase === "finished" ? 100 : 72} />
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {clock.runtimePhase === "finished"
                ? "A janela terminou. O sistema mantém a sessão e encaminha-te para o ranking final."
                : clock.runtimePhase === "running"
                  ? "A arena já foi libertada. Podes avançar para os desafios com a sessão atual."
                  : "A tua sessão já está pronta. O sistema mantém o lobby em sincronização até a abertura do concurso."}
            </p>
          </ContestCard>
        </ContestPanel>

        <ContestPanel kicker="terminal.wait" title="Sequência de arranque">
          <div className="space-y-3">
            {challengeContestConfig.waitingMessages.map((message, index) => (
              <motion.div
                key={message}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.12 }}
              >
                <ContestCard tone="terminal" padding="cozy" className="shadow-none">
                  <p className="font-tech-mono text-xs leading-6 text-slate-300">{message}</p>
                </ContestCard>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 font-tech-mono text-xs uppercase tracking-[0.18em] text-[#7b8ca3]">
            cursor :: online _
          </p>
        </ContestPanel>
      </section>
    </ContestLayout>
  );
}
