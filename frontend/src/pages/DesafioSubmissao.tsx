import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Send, ShieldCheck, TerminalSquare } from "lucide-react";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import {
  ContestBadge,
  ContestCard,
} from "@/components/challenges/contest-theme";
import { contestButtonClassNames, contestTextClassNames } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { getContestLinkPath } from "@/lib/contest-lab";
import { challengeItems, challengeQuestionConfigs } from "@/data/challenges";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";

export default function DesafioSubmissao() {
  const { slug } = useParams<{ slug: string }>();
  const challenge = challengeItems.find((item) => item.slug === slug) ?? null;
  const config = challenge ? challengeQuestionConfigs.find((item) => item.slug === challenge.slug) ?? null : null;

  if (!challenge || !config) {
    return <NotFound />;
  }

  const templateLabel = challenge.category === "Portugol" ? "template.por" : "template.logic";

  return (
    <ContestLayout
      pageLabel={`submission.${challenge.slug}`}
      title={`Submeter solução · ${challenge.id}`}
      subtitle="Checkpoint final antes do envio oficial, com template técnico, checklist de verificação e metadados da submissão."
    >
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Button asChild variant="ghost" className={cn("mb-5 px-0 hover:bg-transparent", contestButtonClassNames.ghost)}>
          <Link to={getContestLinkPath(`/desafios/${challenge.slug}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao problema
          </Link>
        </Button>
      </motion.div>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <ContestPanel kicker="submission.workspace" title={`${challenge.id} · ${challenge.title}`}>
            <div className="flex flex-col gap-3 border-b border-white/8 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#00e5c8]">runtime.workspace</p>
                <h2 className="mt-2 text-2xl font-heading font-bold text-white">{challenge.id} · {challenge.title}</h2>
              </div>
              <ContestBadge tone="accent">autosave on</ContestBadge>
            </div>

            <ContestCard tone="terminal" className="mt-6 shadow-none">
              <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#00e5c8]">{templateLabel}</p>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-tech-mono text-sm leading-7 text-slate-100">
{challenge.category === "Portugol"
  ? `algoritmo "${challenge.slug.replaceAll("-", "_")}"\n\nvar\n   resposta : caractere\n\ninicio\n   // entrada esperada\n   // ${config.inputFormat}\n   // saida esperada\n   // ${config.outputFormat}\nfimalgoritmo`
  : `INICIO\n  // entrada esperada\n  // ${config.inputFormat}\n  // saida esperada\n  // ${config.outputFormat}\nFIM`}
              </pre>
            </ContestCard>

            <ContestCard tone="subtle" className="mt-5 shadow-none">
              <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#00e5c8]">validation.log</p>
              <div className="mt-4 space-y-3 text-sm">
                <p className="inline-flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Estrutura base da resposta validada.
                </p>
                <p className="inline-flex items-center gap-2 text-amber-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Casos privados e critérios da rodada seriam executados após o envio real.
                </p>
              </div>
            </ContestCard>
          </ContestPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="space-y-5">
          <ContestPanel kicker="submission.checklist" title="Checklist técnico">
            <div className="space-y-3">
              {[
                "Confirmar que a trilha e a linguagem estão entre as permitidas.",
                "Testar input e output com o caso de exemplo e com variações simples.",
                "Garantir que não há texto extra na saída final.",
                "Submeter antes do fecho da rodada oficial do nível.",
              ].map((item, index) => (
                <ContestCard key={item} tone="subtle" padding="cozy" className="shadow-none">
                  <p className={contestTextClassNames.accentLabel}>check_0{index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item}</p>
                </ContestCard>
              ))}
            </div>
          </ContestPanel>

          <ContestPanel kicker="submission.meta" title="Metadados oficiais">
            <div className="grid gap-3">
              <MetaCard label="Linguagens" value={config.allowedLanguages.join(" · ")} />
              <MetaCard label="Pontuação" value={`${challenge.points} pts`} />
              <MetaCard label="Tempo sugerido" value={challenge.timeLimit} />
              <MetaCard label="Estado" value="Pronto para enviar" />
            </div>
          </ContestPanel>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className={cn("px-5", contestButtonClassNames.secondary)}>
              <Link to={getContestLinkPath(`/desafios/${challenge.slug}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao problema
              </Link>
            </Button>
            <Button className={cn("px-5", contestButtonClassNames.primary)}>
              <Send className="mr-2 h-4 w-4" />
              Enviar solução
            </Button>
            <Button asChild variant="outline" className={cn("px-5", contestButtonClassNames.secondary)}>
              <Link to={getContestLinkPath("/desafios/ranking")}>
                <TerminalSquare className="mr-2 h-4 w-4" />
                Ver ranking
              </Link>
            </Button>
          </div>

          <ContestPanel kicker="session.state" title="Sessão autenticada">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#00e5c8]" />
              Sessão autenticada e submissão ligada ao teu perfil.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Este checkpoint é parte do laboratório do concurso e já não reaproveita o dashboard raiz do portal. Tudo aqui responde à linguagem técnica da arena.
            </p>
          </ContestPanel>
        </motion.div>
      </section>
    </ContestLayout>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <ContestCard tone="subtle" padding="cozy" className="shadow-none">
      <p className={contestTextClassNames.accentLabel}>{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </ContestCard>
  );
}
