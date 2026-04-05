import { ContestCard } from "@/components/challenges/contest-theme";
import { challengeRanking } from "@/data/challenges";
import { type LaboratorioAdminOutletContext } from "@app/components/LaboratorioAdminShell";
import { useArenaState } from "@app/lib/arena-state";
import { useLaboratorioHub } from "@app/lib/laboratorio-hub-state";
import { useOutletContext } from "react-router-dom";

export default function LaboratorioAdminOverviewPage() {
  const { securityOverview, clock } = useOutletContext<LaboratorioAdminOutletContext>();
  const { challenges } = useArenaState();
  const { agendaItems, featuredModules, modules } = useLaboratorioHub();

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Módulos" value={String(modules.length)} />
        <MetricCard label="Destaques" value={String(featuredModules.length)} />
        <MetricCard label="Agenda" value={String(agendaItems.length)} />
        <MetricCard label="Autorizados" value={String(securityOverview.authorizedStudents.length)} />
        <MetricCard label="Relógio Arena" value={clock.display} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <ContestCard className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">admin.summary</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Leitura central do Laboratório</h3>
          <p className="mt-4 text-sm leading-7 text-[#8ea1b8]">
            O Laboratório passou a ser tratado como produto com múltiplos programas. A partir deste painel controlas catálogo, agenda, Arena e segurança de forma separada.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MiniCard label="Eventos abertos" value={String(agendaItems.filter((item) => item.status === "aberto").length)} />
            <MiniCard label="Desafios da Arena" value={String(challenges.length)} />
            <MiniCard label="Logins recentes" value={String(securityOverview.recentLogins.length)} />
            <MiniCard label="Top score Arena" value={String(challengeRanking[0]?.score ?? 0)} />
          </div>
        </ContestCard>

        <ContestCard tone="subtle" className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">agenda.proxima</p>
          <div className="mt-4 space-y-3">
            {agendaItems.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-[#8ea1b8]">{item.date} · {item.startTime} · {item.location}</p>
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

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
