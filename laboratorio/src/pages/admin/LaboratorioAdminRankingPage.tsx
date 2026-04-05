import { BarChart3, Trophy } from "lucide-react";
import { challengeRanking } from "@/data/challenges";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { useArenaState } from "@app/lib/arena-state";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LaboratorioAdminRankingPage() {
  const { challenges } = useArenaState();
  const totalScore = challengeRanking.reduce((acc, entry) => acc + entry.score, 0);
  const averageScore = challengeRanking.length ? Math.round(totalScore / challengeRanking.length) : 0;
  const bestScore = challengeRanking[0]?.score ?? 0;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Participantes" value={String(challengeRanking.length)} />
        <MetricCard label="Melhor score" value={String(bestScore)} />
        <MetricCard label="Score médio" value={String(averageScore)} />
        <MetricCard label="Desafios ativos" value={String(challenges.length)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <ContestCard className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">ranking.table</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Classificação da arena</h3>
            </div>
            <BarChart3 className="h-5 w-5 text-[#00e5c8]" />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="border-b border-white/8 text-xs uppercase tracking-[0.18em] text-[#7b8ca3]">
                <tr>
                  <th className="px-4 py-3">Pos</th>
                  <th className="px-4 py-3">Estudante</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Baixo</th>
                  <th className="px-4 py-3">Médio</th>
                  <th className="px-4 py-3">Elevado</th>
                  <th className="px-4 py-3">Fecho</th>
                </tr>
              </thead>
              <tbody>
                {challengeRanking.map((entry) => (
                  <tr key={entry.studentNumber} className="border-b border-white/8">
                    <td className="px-4 py-4 font-semibold text-[#00e5c8]">#{entry.position}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{entry.name}</p>
                      <p className="text-xs text-[#7b8ca3]">{entry.studentNumber} · {entry.course}</p>
                    </td>
                    <td className="px-4 py-4">{entry.score}</td>
                    <td className="px-4 py-4">{entry.solvedByLevel.baixo}</td>
                    <td className="px-4 py-4">{entry.solvedByLevel.medio}</td>
                    <td className="px-4 py-4">{entry.solvedByLevel.elevado}</td>
                    <td className="px-4 py-4">{formatTime(entry.finishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContestCard>

        <div className="space-y-6">
          <ContestCard tone="subtle" className="shadow-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">ranking.podium</p>
                <h3 className="mt-3 text-2xl font-semibold text-white">Pódio</h3>
              </div>
              <Trophy className="h-5 w-5 text-[#00e5c8]" />
            </div>

            <div className="mt-5 space-y-3">
              {challengeRanking.slice(0, 3).map((entry) => (
                <div key={entry.studentNumber} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-white">#{entry.position} · {entry.name}</p>
                    <ContestBadge tone="accent">{entry.score} pts</ContestBadge>
                  </div>
                  <p className="mt-2 text-sm text-[#8ea1b8]">
                    {entry.solved} resolvidos · streak {entry.streak}
                  </p>
                </div>
              ))}
            </div>
          </ContestCard>

          <ContestCard tone="subtle" className="shadow-none">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">ranking.policy</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Leitura operacional</h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#8ea1b8]">
              <p>O desempate considera score final e o instante da última submissão pontuável.</p>
              <p>Quando a arena encerrar, esta visão continua útil para revisão do júri e conferência da classificação.</p>
              <p>Na próxima fase, esta secção pode passar a consumir submissões reais em vez do dataset estático atual.</p>
            </div>
          </ContestCard>
        </div>
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
