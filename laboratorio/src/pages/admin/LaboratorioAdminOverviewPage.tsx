import { ContestCard } from "@/components/challenges/contest-theme";
import { challengeRanking } from "@/data/challenges";
import { useArenaState } from "@app/lib/arena-state";
import { type LaboratorioAdminOutletContext } from "@app/components/LaboratorioAdminShell";
import { useOutletContext } from "react-router-dom";

export default function LaboratorioAdminOverviewPage() {
  const { securityOverview, clock } = useOutletContext<LaboratorioAdminOutletContext>();
  const { challenges } = useArenaState();

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Autorizados" value={String(securityOverview.authorizedStudents.length)} />
        <MetricCard label="Logins recentes" value={String(securityOverview.recentLogins.length)} />
        <MetricCard label="Desafios" value={String(challenges.length)} />
        <MetricCard label="Relógio" value={clock.display} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ContestCard className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">admin.summary</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Operação central da arena</h3>
          <p className="mt-4 text-sm leading-7 text-[#8ea1b8]">
            A partir deste painel controlas o estado da sessão, o catálogo de exercícios, as autorizações e a leitura rápida do ranking.
          </p>
        </ContestCard>

        <ContestCard tone="subtle" className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">top.ranking</p>
          <div className="mt-4 space-y-3">
            {challengeRanking.slice(0, 3).map((entry) => (
              <div key={entry.studentNumber} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="text-sm font-semibold text-white">#{entry.position} · {entry.name}</p>
                <p className="mt-1 text-sm text-[#8ea1b8]">{entry.score} pts · {entry.solved} resolvidos</p>
              </div>
            ))}
          </div>
        </ContestCard>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <ContestCard tone="subtle" className="shadow-none">
      <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">{label}</p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </ContestCard>
  );
}
