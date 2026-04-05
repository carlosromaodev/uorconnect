import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import type { ChallengeCategory, ChallengeDifficulty } from "@/data/challenges";
import { cn } from "@/lib/utils";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { useArenaState, type ArenaManagedChallenge } from "@app/lib/arena-state";

const difficultyOptions: ChallengeDifficulty[] = ["Baixo", "Medio", "Elevado"];
const categoryOptions: ChallengeCategory[] = ["Logica", "Portugol"];

function cloneChallenge(challenge: ArenaManagedChallenge): ArenaManagedChallenge {
  return JSON.parse(JSON.stringify(challenge)) as ArenaManagedChallenge;
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export default function LaboratorioAdminArenaPage() {
  const {
    challenges,
    contestConfig,
    generateChallenge,
    removeChallenge,
    resetArenaState,
    saveContestConfig,
    upsertChallenge,
  } = useArenaState();
  const [selectedSlug, setSelectedSlug] = useState(challenges[0]?.item.slug ?? "");
  const [draft, setDraft] = useState<ArenaManagedChallenge | null>(() => challenges[0] ? cloneChallenge(challenges[0]) : null);
  const [generator, setGenerator] = useState({
    title: "",
    category: "Logica" as ChallengeCategory,
    difficulty: "Baixo" as ChallengeDifficulty,
    points: 110,
    summary: "",
    tags: "Logica, Base",
  });
  const [settingsDraft, setSettingsDraft] = useState({
    scheduledStartAt: contestConfig.scheduledStartAt,
    durationMinutes: String(contestConfig.durationMinutes),
    venue: contestConfig.venue,
    waitingMessages: contestConfig.waitingMessages.join("\n"),
    generalRules: contestConfig.generalRules.join("\n"),
  });

  const selectedChallenge = useMemo(
    () => challenges.find((challenge) => challenge.item.slug === selectedSlug) ?? null,
    [challenges, selectedSlug],
  );

  useEffect(() => {
    if (selectedChallenge) {
      setDraft(cloneChallenge(selectedChallenge));
    }
  }, [selectedChallenge]);

  useEffect(() => {
    setSettingsDraft({
      scheduledStartAt: contestConfig.scheduledStartAt,
      durationMinutes: String(contestConfig.durationMinutes),
      venue: contestConfig.venue,
      waitingMessages: contestConfig.waitingMessages.join("\n"),
      generalRules: contestConfig.generalRules.join("\n"),
    });
  }, [contestConfig]);

  const handleGenerate = () => {
    const generated = generateChallenge({
      title: generator.title,
      category: generator.category,
      difficulty: generator.difficulty,
      points: Number(generator.points) || 0,
      summary: generator.summary,
      tags: splitLines(generator.tags.replace(/,/g, "\n")),
    });
    upsertChallenge(generated);
    setDraft(generated);
    setSelectedSlug(generated.item.slug);
  };

  const handleSaveChallenge = () => {
    if (!draft) return;
    upsertChallenge(draft);
    setSelectedSlug(draft.item.slug);
  };

  const handleRemoveChallenge = () => {
    if (!draft) return;
    const remainingChallenges = challenges.filter((challenge) => challenge.item.slug !== draft.item.slug);
    removeChallenge(draft.item.slug);
    const next = remainingChallenges[0] ?? null;
    setSelectedSlug(next?.item.slug ?? "");
    setDraft(next ? cloneChallenge(next) : null);
  };

  const handleSaveSettings = () => {
    saveContestConfig({
      scheduledStartAt: settingsDraft.scheduledStartAt,
      durationMinutes: Number(settingsDraft.durationMinutes) || contestConfig.durationMinutes,
      venue: settingsDraft.venue,
      waitingMessages: splitLines(settingsDraft.waitingMessages),
      generalRules: splitLines(settingsDraft.generalRules),
    });
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[0.76fr_1.24fr]">
        <ContestCard className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">arena.generator</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Gerador rápido</h3>
          <div className="mt-5 grid gap-4">
            <Field label="Título">
              <Input value={generator.title} onChange={(event) => setGenerator((current) => ({ ...current, title: event.target.value }))} className="border-white/8 bg-white/[0.03] text-white" />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Categoria">
                <select
                  value={generator.category}
                  onChange={(event) => setGenerator((current) => ({ ...current, category: event.target.value as ChallengeCategory }))}
                  className="h-11 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-white"
                >
                  {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Dificuldade">
                <select
                  value={generator.difficulty}
                  onChange={(event) => setGenerator((current) => ({ ...current, difficulty: event.target.value as ChallengeDifficulty }))}
                  className="h-11 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-white"
                >
                  {difficultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Resumo">
              <Textarea value={generator.summary} onChange={(event) => setGenerator((current) => ({ ...current, summary: event.target.value }))} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
            </Field>
            <Field label="Tags">
              <Input value={generator.tags} onChange={(event) => setGenerator((current) => ({ ...current, tags: event.target.value }))} className="border-white/8 bg-white/[0.03] text-white" />
            </Field>
            <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={handleGenerate}>
              <Wand2 className="mr-2 h-4 w-4" />
              Gerar rascunho
            </Button>
          </div>
        </ContestCard>

        <ContestCard className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">arena.settings</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Janela e mensagens da prova</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Início">
              <Input value={settingsDraft.scheduledStartAt} onChange={(event) => setSettingsDraft((current) => ({ ...current, scheduledStartAt: event.target.value }))} className="border-white/8 bg-white/[0.03] text-white" />
            </Field>
            <Field label="Duração (min)">
              <Input value={settingsDraft.durationMinutes} onChange={(event) => setSettingsDraft((current) => ({ ...current, durationMinutes: event.target.value }))} className="border-white/8 bg-white/[0.03] text-white" />
            </Field>
            <Field label="Local">
              <Input value={settingsDraft.venue} onChange={(event) => setSettingsDraft((current) => ({ ...current, venue: event.target.value }))} className="border-white/8 bg-white/[0.03] text-white" />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Mensagens da sala de espera">
              <Textarea value={settingsDraft.waitingMessages} onChange={(event) => setSettingsDraft((current) => ({ ...current, waitingMessages: event.target.value }))} className="min-h-36 border-white/8 bg-white/[0.03] text-white" />
            </Field>
            <Field label="Regras">
              <Textarea value={settingsDraft.generalRules} onChange={(event) => setSettingsDraft((current) => ({ ...current, generalRules: event.target.value }))} className="min-h-36 border-white/8 bg-white/[0.03] text-white" />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={handleSaveSettings}>
              <Save className="mr-2 h-4 w-4" />
              Guardar janela
            </Button>
            <Button type="button" variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)} onClick={resetArenaState}>
              Repor dados padrão
            </Button>
          </div>
        </ContestCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <ContestCard className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">arena.catalog</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Catálogo</h3>
            </div>
            <ContestBadge tone="neutral">{challenges.length} itens</ContestBadge>
          </div>

          <div className="mt-5 space-y-3">
            {challenges.map((challenge) => (
              <button
                key={challenge.item.slug}
                type="button"
                onClick={() => setSelectedSlug(challenge.item.slug)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors",
                  selectedSlug === challenge.item.slug
                    ? "border-[#00e5c8]/24 bg-[#00e5c8]/10"
                    : "border-white/8 bg-white/[0.03] hover:border-[#00e5c8]/16",
                )}
              >
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">{challenge.item.id}</p>
                <p className="mt-2 text-base font-semibold text-white">{challenge.item.title}</p>
                <p className="mt-2 text-sm text-[#8ea1b8]">{challenge.item.summary}</p>
              </button>
            ))}
          </div>
        </ContestCard>

        <ContestCard className="shadow-none">
          {draft ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">arena.manual_editor</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Editor manual</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={handleSaveChallenge}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar desafio
                  </Button>
                  <Button type="button" variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)} onClick={handleRemoveChallenge}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Título">
                  <Input value={draft.item.title} onChange={(event) => setDraft((current) => current ? { ...current, item: { ...current.item, title: event.target.value } } : current)} className="border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Slug">
                  <Input value={draft.item.slug} onChange={(event) => setDraft((current) => current ? { ...current, item: { ...current.item, slug: event.target.value }, config: { ...current.config, slug: event.target.value } } : current)} className="border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Pontos">
                  <Input value={String(draft.item.points)} onChange={(event) => setDraft((current) => current ? { ...current, item: { ...current.item, points: Number(event.target.value) || 0 } } : current)} className="border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Tempo limite">
                  <Input value={draft.item.timeLimit} onChange={(event) => setDraft((current) => current ? { ...current, item: { ...current.item, timeLimit: event.target.value } } : current)} className="border-white/8 bg-white/[0.03] text-white" />
                </Field>
              </div>

              <Field label="Resumo" className="mt-4">
                <Textarea value={draft.item.summary} onChange={(event) => setDraft((current) => current ? { ...current, item: { ...current.item, summary: event.target.value } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
              </Field>

              <Field label="Enunciado" className="mt-4">
                <Textarea value={draft.config.statement} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, statement: event.target.value } } : current)} className="min-h-32 border-white/8 bg-white/[0.03] text-white" />
              </Field>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Input">
                  <Textarea value={draft.config.inputFormat} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, inputFormat: event.target.value } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Output">
                  <Textarea value={draft.config.outputFormat} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, outputFormat: event.target.value } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Restrições">
                  <Textarea value={draft.config.constraints.join("\n")} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, constraints: splitLines(event.target.value) } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Critérios">
                  <Textarea value={draft.config.evaluation.join("\n")} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, evaluation: splitLines(event.target.value) } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="Sample input">
                  <Textarea value={draft.config.sampleCases[0]?.input ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, sampleCases: [{ ...current.config.sampleCases[0], input: event.target.value, output: current.config.sampleCases[0]?.output ?? "", explanation: current.config.sampleCases[0]?.explanation ?? "" }] } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Sample output">
                  <Textarea value={draft.config.sampleCases[0]?.output ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, sampleCases: [{ ...current.config.sampleCases[0], input: current.config.sampleCases[0]?.input ?? "", output: event.target.value, explanation: current.config.sampleCases[0]?.explanation ?? "" }] } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
                <Field label="Explicação">
                  <Textarea value={draft.config.sampleCases[0]?.explanation ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, config: { ...current.config, sampleCases: [{ ...current.config.sampleCases[0], input: current.config.sampleCases[0]?.input ?? "", output: current.config.sampleCases[0]?.output ?? "", explanation: event.target.value }] } } : current)} className="min-h-24 border-white/8 bg-white/[0.03] text-white" />
                </Field>
              </div>
            </>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center">
              <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={handleGenerate}>
                <Plus className="mr-2 h-4 w-4" />
                Criar novo desafio
              </Button>
            </div>
          )}
        </ContestCard>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-white">{label}</p>
      {children}
    </div>
  );
}
