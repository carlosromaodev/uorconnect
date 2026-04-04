import { motion } from "framer-motion";
import { CheckCheck, FileLock2, Shield, Trophy } from "lucide-react";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import { ContestCard } from "@/components/challenges/contest-theme";

export default function DesafiosRegras() {
  const rules = [
    {
      icon: Shield,
      title: "Acesso validado",
      description: "O estudante entra com número de estudante e a mesma palavra-passe da Secretaria UOR. O laboratório não tem credenciais próprias.",
      tone: "bg-[#00e5c8]/10 text-[#00e5c8]",
    },
    {
      icon: CheckCheck,
      title: "Pontuação por nível",
      description: "Os desafios baixo, médio e elevado têm pontuações distintas. O ranking soma o score acumulado em tempo real.",
      tone: "bg-emerald-500/10 text-emerald-300",
    },
    {
      icon: FileLock2,
      title: "Validação automática",
      description: "Cada submissão é validada automaticamente e o output precisa obedecer ao formato oficial do exercício.",
      tone: "bg-amber-500/10 text-amber-200",
    },
    {
      icon: Trophy,
      title: "Desempate técnico",
      description: "Em caso de empate, vence quem tiver concluído a pontuação primeiro dentro da janela oficial do concurso.",
      tone: "bg-red-500/10 text-red-200",
    },
  ];

  return (
    <ContestLayout
      pageLabel="contest.rules"
      title="Regras do Concurso"
      subtitle="Regulamento da arena com linguagem técnica, leitura objetiva e foco no funcionamento real do concurso."
    >
      <section className="grid gap-5 md:grid-cols-2">
        {rules.map((rule, index) => {
          const Icon = rule.icon;

          return (
            <motion.div
              key={rule.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ContestPanel kicker={`protocol_${String(index + 1).padStart(2, "0")}`} title={rule.title} className="h-full">
                <ContestCard tone="muted" padding="cozy" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border-0 shadow-none">
                  <div className={`flex h-full w-full items-center justify-center rounded-2xl ${rule.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </ContestCard>
                <p className="mt-4 text-sm leading-7 text-slate-300">{rule.description}</p>
              </ContestPanel>
            </motion.div>
          );
        })}
      </section>
    </ContestLayout>
  );
}
