import { motion } from "framer-motion";
import { Crown, Medal, TrendingUp } from "lucide-react";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestTextClassNames } from "@/components/challenges/contest-theme.tokens";
import { getSessionStudent } from "@/lib/api";
import { challengeRanking, challengeStudentProgress } from "@/data/challenges";

const podiumTones = [
  "border-[#00e5c8]/20 bg-[#00e5c8]/10 text-[#00e5c8]",
  "border-amber-500/20 bg-amber-500/10 text-amber-200",
  "border-orange-500/20 bg-orange-500/10 text-orange-200",
];

export default function DesafiosRanking() {
  const student = getSessionStudent();
  const activeStudentNumber = student?.studentNumber ?? challengeStudentProgress.studentNumber;
  const topPlayers = challengeRanking.slice(0, 3);

  return (
    <ContestLayout
      pageLabel="ranking.live"
      title="Ranking do Concurso"
      subtitle="Classificação em tempo real com score acumulado, exercícios resolvidos por nível e destaque do participante autenticado."
    >
      <section className="grid gap-5 lg:grid-cols-3">
        {topPlayers.map((entry, index) => (
          <motion.div
            key={entry.studentNumber}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <ContestPanel kicker={`podium.${entry.position}`} className={podiumTones[index]}>
              <div className="flex items-center justify-between gap-3">
                {index === 0 ? <Crown className="h-6 w-6" /> : <Medal className="h-6 w-6" />}
                <span className="font-tech-mono text-[11px] uppercase tracking-[0.18em]">rank #{entry.position}</span>
              </div>
              <p className="mt-6 text-2xl font-heading font-bold text-white">{entry.name}</p>
              <p className="mt-2 font-tech-mono text-sm uppercase tracking-[0.18em] opacity-80">{entry.studentNumber}</p>
              <p className="mt-6 text-5xl font-semibold text-white">{entry.score}</p>
              <p className="mt-2 text-sm opacity-80">{entry.solved} exercícios concluídos</p>
            </ContestPanel>
          </motion.div>
        ))}
      </section>

      <section className="mt-10">
        <ContestPanel kicker="leaderboard.table" title="Classificação completa">
          <div className="space-y-3">
            {challengeRanking.map((entry, index) => {
              const isActiveStudent = entry.studentNumber === activeStudentNumber;
              return (
                <motion.div
                  key={entry.studentNumber}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + index * 0.04 }}
                >
                  <ContestCard
                    tone={isActiveStudent ? "accent" : "subtle"}
                    className="grid gap-4 p-5 lg:grid-cols-[80px_minmax(0,1.4fr)_140px_220px_190px] lg:items-center"
                  >
                    <div className="font-tech-mono text-2xl font-semibold text-[#00e5c8]">#{entry.position}</div>
                    <div>
                      <p className="text-lg font-semibold text-white">{entry.name}</p>
                      <p className="mt-1 font-tech-mono text-xs uppercase tracking-[0.18em] text-[#7b8ca3]">{entry.studentNumber}</p>
                    </div>
                    <div>
                      <p className={contestTextClassNames.mutedLabel}>score.total</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{entry.score}</p>
                    </div>
                    <div>
                      <p className={contestTextClassNames.mutedLabel}>concluídos por nível</p>
                      <p className="mt-2 text-sm text-slate-300">
                        Baixo {entry.solvedByLevel.baixo} · Médio {entry.solvedByLevel.medio} · Elevado {entry.solvedByLevel.elevado}
                      </p>
                    </div>
                    <div>
                      <p className={contestTextClassNames.mutedLabel}>tendência</p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-300">
                        <TrendingUp className="h-4 w-4 text-[#00e5c8]" />
                        {entry.streak} · {new Date(entry.finishedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {isActiveStudent ? (
                      <div className="lg:col-span-full">
                        <ContestBadge tone="accentStrong" size="compact">
                          sessão autenticada
                        </ContestBadge>
                      </div>
                    ) : null}
                  </ContestCard>
                </motion.div>
              );
            })}
          </div>
        </ContestPanel>
      </section>
    </ContestLayout>
  );
}
