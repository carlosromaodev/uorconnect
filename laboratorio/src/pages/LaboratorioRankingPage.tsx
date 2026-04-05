import { challengeRanking } from "@/data/challenges";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@app/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@app/lib/arena-state";

export default function LaboratorioRankingPage() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);

  return (
    <LaboratorioPublicLayout
      title="Ranking"
      subtitle="Tabela direta, sem ruído visual, com a classificação consolidada da arena."
      contestConfig={contestConfig}
      clock={clock}
    >
      <LaboratorioPageSection kicker="leaderboard" title="Classificação">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="border-b border-white/8 text-xs uppercase tracking-[0.18em] text-[#7b8ca3]">
              <tr>
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">Estudante</th>
                <th className="px-4 py-3">Curso</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Resolvidos</th>
                <th className="px-4 py-3">Fecho</th>
              </tr>
            </thead>
            <tbody>
              {challengeRanking.map((entry) => (
                <tr key={entry.studentNumber} className="border-b border-white/8">
                  <td className="px-4 py-4 font-semibold text-[#00e5c8]">#{entry.position}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">{entry.name}</p>
                    <p className="text-xs text-[#7b8ca3]">{entry.studentNumber}</p>
                  </td>
                  <td className="px-4 py-4">{entry.course}</td>
                  <td className="px-4 py-4">{entry.score}</td>
                  <td className="px-4 py-4">{entry.solved}</td>
                  <td className="px-4 py-4">{new Date(entry.finishedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LaboratorioPageSection>
    </LaboratorioPublicLayout>
  );
}
