import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Play, Send, TerminalSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@app/components/LaboratorioPublicLayout";
import { createStarterCode, useArenaClock, useArenaState } from "@app/lib/arena-state";
import { runVisualgProgram, type ArenaDiagnostic } from "@app/lib/visualg-runtime";

type ExecutionState = {
  status: "idle" | "running" | "success" | "error";
  stdout: string;
  diagnostics: ArenaDiagnostic[];
  verdict?: string;
};

function normalizeOutput(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export default function LaboratorioArenaChallengePage() {
  const { slug } = useParams<{ slug: string }>();
  const { contestConfig, challenges } = useArenaState();
  const clock = useArenaClock(contestConfig);
  const challenge = challenges.find((item) => item.item.slug === slug) ?? null;
  const sampleInput = challenge?.config.sampleCases[0]?.input ?? "";
  const [code, setCode] = useState(() => (challenge ? createStarterCode(challenge) : ""));
  const [stdin, setStdin] = useState(sampleInput);
  const [execution, setExecution] = useState<ExecutionState>({
    status: "idle",
    stdout: "Ainda não executaste o algoritmo.",
    diagnostics: [],
  });

  useEffect(() => {
    if (!challenge) return;
    setCode(createStarterCode(challenge));
    setStdin(challenge.config.sampleCases[0]?.input ?? "");
    setExecution({
      status: "idle",
      stdout: "Ainda não executaste o algoritmo.",
      diagnostics: [],
    });
  }, [challenge]);

  const lineNumbers = useMemo(
    () => Array.from({ length: Math.max(1, code.split("\n").length) }, (_, index) => String(index + 1).padStart(2, "0")).join("\n"),
    [code],
  );

  if (!challenge) {
    return (
      <LaboratorioPublicLayout
        title="Desafio não encontrado"
        subtitle="O link pedido não existe mais no catálogo ativo do Laboratório."
        contestConfig={contestConfig}
        clock={clock}
        actions={
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to="/arena">Voltar à arena</Link>
          </Button>
        }
      >
        <ContestCard>
          <p className="text-sm leading-7 text-[#8ea1b8]">
            Se este desafio foi removido ou renomeado pelo admin, abre o catálogo da arena para escolher a versão atual.
          </p>
        </ContestCard>
      </LaboratorioPublicLayout>
    );
  }

  const runProgram = async (mode: "execute" | "sample" | "submit") => {
    setExecution({
      status: "running",
      stdout: "A interpretar código VisuAlg...",
      diagnostics: [],
    });

    const runtimeInput = mode === "sample" || mode === "submit"
      ? challenge.config.sampleCases[0]?.input ?? ""
      : stdin;

    const result = await runVisualgProgram(code, runtimeInput);
    const expectedOutput = normalizeOutput(challenge.config.sampleCases[0]?.output ?? "");
    const actualOutput = normalizeOutput(result.stdout);
    const sampleMatched = expectedOutput ? actualOutput === expectedOutput : result.success;

    setExecution({
      status: result.success ? "success" : "error",
      stdout: result.stdout || "Sem saída visível.",
      diagnostics: result.diagnostics,
      verdict:
        mode === "execute"
          ? (result.success ? "Execução concluída." : "Execução falhou.")
          : sampleMatched
            ? (mode === "submit"
              ? `Submissão simulada aceite. +${challenge.item.points} pts.`
              : "Caso de teste exemplo validado com sucesso.")
            : (mode === "submit"
              ? "Submissão simulada rejeitada. O output ainda não coincide com o caso exemplo."
              : "O output do caso exemplo não coincide com o esperado."),
    });
  };

  return (
    <LaboratorioPublicLayout
      title={challenge.item.title}
      subtitle="Editor separado por desafio, com execução real de VisuAlg/Portugol e painel explícito de diagnóstico."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/arena">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar à arena
            </Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <LaboratorioPageSection kicker={challenge.item.id} title="Enunciado">
          <div className="flex flex-wrap gap-2">
            <ContestBadge tone="accent">{challenge.item.points} pts</ContestBadge>
            <ContestBadge tone="neutral">{challenge.item.category}</ContestBadge>
            <ContestBadge tone={challenge.config.status === "draft" ? "warning" : "success"}>
              {challenge.config.status === "draft" ? "draft" : "publicado"}
            </ContestBadge>
          </div>

          <p className="mt-5 text-sm leading-7 text-[#8ea1b8]">{challenge.config.statement}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ContestCard tone="subtle" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">input</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{challenge.config.inputFormat}</p>
            </ContestCard>
            <ContestCard tone="subtle" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">output</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">{challenge.config.outputFormat}</p>
            </ContestCard>
          </div>

          <div className="mt-5 grid gap-4">
            <ContestCard tone="terminal" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">caso.exemplo</p>
              <pre className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{`Input:\n${challenge.config.sampleCases[0]?.input || "-"}\n\nOutput esperado:\n${challenge.config.sampleCases[0]?.output || "-"}`}</pre>
            </ContestCard>

            <ContestCard tone="subtle" className="shadow-none">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">critérios</p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
                {challenge.config.evaluation.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
            </ContestCard>
          </div>
        </LaboratorioPageSection>

        <div className="space-y-5">
          <LaboratorioPageSection kicker="editor.runtime" title="Editor da arena">
            <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#020507]">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">visualg.workspace</p>
                <TerminalSquare className="h-4 w-4 text-[#00e5c8]" />
              </div>
              <div className="grid grid-cols-[58px_minmax(0,1fr)]">
                <pre className="border-r border-white/8 bg-black/30 px-3 py-4 font-tech-mono text-xs leading-7 text-[#52647c]">
                  {lineNumbers}
                </pre>
                <Textarea
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  spellCheck={false}
                  className="min-h-[430px] resize-none rounded-none border-0 bg-transparent px-4 py-4 font-tech-mono text-sm leading-7 text-white shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
              <ContestCard tone="subtle" className="shadow-none">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">stdin</p>
                <Textarea
                  value={stdin}
                  onChange={(event) => setStdin(event.target.value)}
                  spellCheck={false}
                  className="mt-3 min-h-[160px] resize-none border-white/8 bg-[#03080c] font-tech-mono text-sm text-white"
                />
              </ContestCard>

              <ContestCard tone={execution.status === "error" ? "terminal" : "subtle"} className="shadow-none">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">stdout</p>
                <pre className="mt-3 min-h-[160px] whitespace-pre-wrap rounded-2xl border border-white/8 bg-black/30 px-4 py-4 font-tech-mono text-xs leading-7 text-slate-200">
                  {execution.stdout}
                </pre>
                {execution.verdict ? (
                  <p className={cn(
                    "mt-4 text-sm font-medium",
                    execution.status === "error" ? "text-red-300" : "text-emerald-300",
                  )}>
                    {execution.verdict}
                  </p>
                ) : null}
              </ContestCard>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)} onClick={() => void runProgram("execute")}>
                <Play className="mr-2 h-4 w-4" />
                Executar
              </Button>
              <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={() => void runProgram("sample")}>
                Validar exemplo
              </Button>
              <Button type="button" variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)} onClick={() => void runProgram("submit")}>
                <Send className="mr-2 h-4 w-4" />
                Submeter
              </Button>
            </div>
          </LaboratorioPageSection>

          <LaboratorioPageSection kicker="diagnostics" title="Diagnóstico">
            {execution.diagnostics.length ? (
              <div className="space-y-3">
                {execution.diagnostics.map((diagnostic, index) => (
                  <ContestCard key={`${diagnostic.stage}-${index}`} tone="terminal" className="shadow-none">
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">
                      {diagnostic.stage}
                      {diagnostic.line ? ` · linha ${diagnostic.line}` : ""}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{diagnostic.message}</p>
                  </ContestCard>
                ))}
              </div>
            ) : (
              <ContestCard tone="subtle" className="shadow-none">
                <p className="text-sm leading-7 text-[#8ea1b8]">
                  Sem erros reportados. Quando existirem falhas léxicas, sintáticas, semânticas ou de execução, elas aparecem aqui.
                </p>
              </ContestCard>
            )}
          </LaboratorioPageSection>
        </div>
      </section>
    </LaboratorioPublicLayout>
  );
}
