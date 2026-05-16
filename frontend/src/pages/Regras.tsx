import { motion } from "framer-motion";
import { Users, Clock, Award, AlertCircle, CheckCircle, FileText } from "lucide-react";

const rules = [
  { icon: Users, title: "Participação", items: ["Ser estudante da UOR", "Matrícula regular 2025/2026", "Individual ou grupo"] },
  { icon: Users, title: "Grupos", items: ["Máximo 17 membros", "1 grupo por estudante", "Indicar líder na submissão"] },
  { icon: Clock, title: "Apresentação", items: ["10 min de apresentação", "5 min para perguntas", "Pontualidade obrigatória"] },
  { icon: Award, title: "Avaliação", items: ["Inovação 30%", "Viabilidade técnica 25%", "Impacto social 25%", "Apresentação 20%"] },
  { icon: AlertCircle, title: "Regras Gerais", items: ["Projetos originais", "Plágio = desclassificação", "Decisão do júri é final"] },
  { icon: CheckCircle, title: "Submissão", items: ["Formulário completo", "Descrição detalhada", "Link do repositório (opcional)"] },
];

export default function Regras() {
  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-1">Regras</h1>
          <p className="text-muted-foreground text-sm mb-10">Lê atentamente antes de submeter.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
          {rules.map((rule, i) => (
            <motion.div
              key={rule.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-[16px] border border-border/60 bg-white/96 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <rule.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-sm">{rule.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {rule.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-2 w-1 h-1 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
