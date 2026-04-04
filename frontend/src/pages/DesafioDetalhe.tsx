import { useMemo, useState } from "react";
import { ArrowLeft, Lightbulb, Play, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ContestLayout, ContestPanel } from "@/components/challenges/ContestLayout";
import {
  ContestBadge,
  ContestCard,
} from "@/components/challenges/contest-theme";
import { contestButtonClassNames, contestInputClassName, contestTextClassNames } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { challengeItems, challengeQuestionConfigs } from "@/data/challenges";
import { getContestLinkPath } from "@/lib/contest-lab";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";

const difficultyTone = {
  Baixo: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Medio: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  Elevado: "border-red-500/20 bg-red-500/10 text-red-200",
};

export default function DesafioDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const challenge = challengeItems.find((item) => item.slug === slug) ?? null;
  const config = challenge ? challengeQuestionConfigs.find((item) => item.slug === challenge.slug) ?? null : null;

  if (!challenge || !config) {
    return <NotFound />;
  }

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [output, setOutput] = useState("$ terminal.await --execution");
  const [code, setCode] = useState(
    challenge.category === "Portugol"
      ? `algoritmo "${challenge.slug.replaceAll("-", "_")}"\n\nvar\n   resposta : caractere\n\ninicio\n   // ${config.inputFormat}\n   // ${config.outputFormat}\n   escreval("Implementa a tua solução aqui")\nfimalgoritmo`
      : `INICIO\n  // ${challenge.title}\n  // ${config.inputFormat}\n  // ${config.outputFormat}\n  // Organiza a tua lógica por etapas\nFIM`,
  );

  const lineNumbers = useMemo(
    () => Array.from({ length: code.split("\n").length }, (_, index) => String(index + 1).padStart(2, "0")).join("\n"),
    [code],
  );

  const runCommand = () => {
    const successful = code.toLowerCase().includes("escreval") || code.toLowerCase().includes("fim");
    setStatus(successful ? "success" : "error");
    setOutput(
      successful
        ? `> compile success\n> sample_case_01 :: output matched\n✓ Output matched. +${challenge.points} pts added to your score.`
        : "> compile error\n✗ Wrong output. Review your logic and try again.",
    );
  };

  return (
    <ContestLayout
      pageLabel={`editor.${challenge.slug}`}
      title={`${challenge.id} · ${challenge.title}`}
      subtitle="Editor dividido para leitura do enunciado, escrita da solução, execução e submissão com feedback imediato em estilo terminal."
      headerActions={
        <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
          <Link to={getContestLinkPath("/desafios/arena")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos Desafios
          </Link>
        </Button>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
        <ContestPanel kicker="problem.statement" title="Enunciado">
          <div className="flex flex-wrap gap-2">
            <span className={cn("inline-flex items-center rounded-full border px-3 py-1.5 font-tech-mono text-[11px] uppercase tracking-[0.16em]", difficultyTone[challenge.difficulty])}>
              {challenge.difficulty}
            </span>
            <ContestBadge tone="neutral">{challenge.category}</ContestBadge>
            <ContestBadge tone="accent">{challenge.points} pts</ContestBadge>
          </div>

          <ContestCard tone="terminal" className="mt-6 font-tech-mono text-sm leading-8 text-slate-200 shadow-none">
            {config.statement}
          </ContestCard>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ContestCard tone="subtle" padding="cozy" className="shadow-none">
              <p className={contestTextClassNames.mutedLabel}>input.format</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{config.inputFormat}</p>
            </ContestCard>
            <ContestCard tone="subtle" padding="cozy" className="shadow-none">
              <p className={contestTextClassNames.mutedLabel}>output.format</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{config.outputFormat}</p>
            </ContestCard>
          </div>

          <ContestCard tone="subtle" className="mt-6 shadow-none">
            <p className={contestTextClassNames.mutedLabel}>sample.case</p>
            <pre className="mt-4 whitespace-pre-wrap font-tech-mono text-xs leading-7 text-slate-300">{`Input  :: ${config.sampleCases[0]?.input ?? ""}\nOutput :: ${config.sampleCases[0]?.output ?? ""}\n\n${config.sampleCases[0]?.explanation ?? ""}`}</pre>
          </ContestCard>

          <div className="mt-6 space-y-3">
            {config.hints.map((hint) => (
              <ContestCard key={hint} tone="subtle" padding="cozy" className="shadow-none">
                <p className="text-sm leading-7 text-slate-300">
                  <Lightbulb className="mr-3 inline h-4 w-4 text-[#00e5c8]" />
                  {hint}
                </p>
              </ContestCard>
            ))}
          </div>
        </ContestPanel>

        <div className="space-y-5">
          <ContestPanel kicker="editor.workspace" title="Editor de pseudocódigo">
            <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#020507]">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className={contestTextClassNames.mutedLabel}>workspace.pseudo</p>
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">{challenge.category === "Portugol" ? "portugol" : "pseudocódigo"}</p>
              </div>
              <div className="grid grid-cols-[60px_minmax(0,1fr)]">
                <pre className="overflow-hidden border-r border-white/8 bg-black/30 px-4 py-5 font-tech-mono text-xs leading-7 text-slate-500">{lineNumbers}</pre>
                <textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  spellCheck={false}
                  className={cn(contestInputClassName, "min-h-[420px] w-full resize-none rounded-none border-0 bg-transparent px-4 py-5 leading-7 shadow-none focus-visible:ring-0")}
                />
              </div>
            </div>
          </ContestPanel>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className={cn("h-12 px-5", contestButtonClassNames.secondary)} onClick={runCommand}>
              <Play className="mr-2 h-4 w-4" />
              Executar
            </Button>
            <Button type="button" className={cn("h-12 px-5", contestButtonClassNames.primary)} onClick={runCommand}>
              <Send className="mr-2 h-4 w-4" />
              Submeter
            </Button>
            <Button asChild variant="outline" className={cn("h-12 px-5", contestButtonClassNames.secondary)}>
              <Link to={getContestLinkPath("/desafios/arena")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar aos Desafios
              </Link>
            </Button>
          </div>

          <ContestPanel kicker="stdout.panel" title="Output terminal">
            <pre className={cn(
              "min-h-[180px] whitespace-pre-wrap rounded-[28px] border p-5 font-tech-mono text-xs leading-7",
              status === "success"
                ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-200"
                : status === "error"
                  ? "border-red-500/20 bg-red-500/8 text-red-200"
                  : "border-white/8 bg-black/25 text-slate-300",
            )}>
              {output}
            </pre>
          </ContestPanel>
        </div>
      </section>
    </ContestLayout>
  );
}
