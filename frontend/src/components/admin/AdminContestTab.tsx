import { type ReactNode, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Code2, FileCode2, Play, Settings2, Trophy, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  challengeContestConfig,
  challengeItems,
  challengeQuestionConfigs,
  challengeRanking,
  challengeResultsSummary,
  challengeStudentProgress,
  challengeSubmissions,
} from "@/data/challenges";
import { useContestClock } from "@/lib/contest-lab";

const sections = [
  { id: "control", label: "Controlo", icon: Settings2 },
  { id: "questions", label: "Questões", icon: Code2 },
  { id: "submissions", label: "Monitorização", icon: FileCode2 },
  { id: "leaderboard", label: "Ranking", icon: Trophy },
] as const;

type SectionId = typeof sections[number]["id"];

const statusTone = {
  accepted: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  review: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  rejected: "border-red-500/20 bg-red-500/10 text-red-200",
};

export function AdminContestTab() {
  const [activeSection, setActiveSection] = useState<SectionId>("control");
  const [selectedQuestionSlug, setSelectedQuestionSlug] = useState(challengeItems[0]?.slug ?? "");
  const clock = useContestClock();

  const selectedQuestion = useMemo(
    () => challengeQuestionConfigs.find((item) => item.slug === selectedQuestionSlug) ?? challengeQuestionConfigs[0],
    [selectedQuestionSlug],
  );

  return (
    <div className="space-y-6 rounded-[32px] border border-slate-800 bg-[#071117] p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.24)] md:p-7">
      <div className="overflow-hidden rounded-[30px] border border-[#16F9FE]/18 bg-[radial-gradient(circle_at_top_left,rgba(22,249,254,0.16),transparent_24%),linear-gradient(180deg,rgba(8,19,24,0.98),rgba(6,12,16,0.96))] p-6">
        <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#16F9FE]">admin.control_tower</p>
        <h2 className="mt-3 font-heading text-2xl font-bold">Concurso de Lógica e Portugol · 1º Ano</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Centro de supervisão do laboratório com controlo de janela, catálogo de desafios, presença, ranking ao vivo e publicação final.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Questões" value={String(challengeItems.length)} tone="border-[#16F9FE]/18 bg-[#16F9FE]/10 text-[#16F9FE]" />
          <SummaryCard label="Submissões" value={String(challengeSubmissions.length)} tone="border-amber-500/20 bg-amber-500/10 text-amber-200" />
          <SummaryCard label="Top Score" value={String(challengeRanking[0]?.score ?? 0)} tone="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
          <SummaryCard label="Aceitação" value={challengeResultsSummary.acceptanceRate} tone="border-white/10 bg-white/6 text-slate-100" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "border-[#16F9FE]/30 bg-[#16F9FE]/10 text-[#16F9FE]"
                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {activeSection === "control" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <AdminContestPanel kicker="contest.window" title="Janela do concurso">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Data e hora de início">
                <Input value={new Date(challengeContestConfig.scheduledStartAt).toLocaleString("pt-PT")} readOnly className="border-white/10 bg-white/5 text-white" />
              </Field>
              <Field label="Duração">
                <Input value={`${challengeContestConfig.durationMinutes} minutos`} readOnly className="border-white/10 bg-white/5 text-white" />
              </Field>
              <Field label="Estado atual">
                <Input value={clock.runtimePhase} readOnly className="border-white/10 bg-white/5 font-tech-mono uppercase text-white" />
              </Field>
              <Field label="Contagem oficial">
                <Input value={clock.display} readOnly className="border-[#16F9FE]/18 bg-[#16F9FE]/8 font-tech-mono text-[#16F9FE]" />
              </Field>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">contagem.regressiva</p>
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
                  <CalendarClock className="h-4 w-4 text-[#16F9FE]" />
                  Relógio visível na landing, lobby, arena e editor.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">override.manual</p>
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-300">
                  <Play className="h-4 w-4 text-[#16F9FE]" />
                  Liberta ou encerra a arena sem depender apenas da hora agendada.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" className="bg-[#16F9FE] text-slate-950 hover:bg-[#7cfbff]">Guardar janela</Button>
              <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">Iniciar agora</Button>
              <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">Encerrar concurso</Button>
            </div>
          </AdminContestPanel>

          <AdminContestPanel kicker="live.supervision" title="Supervisão administrativa">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">participantes.online</p>
                <p className="mt-3 text-4xl font-semibold text-white">{challengeContestConfig.onlineParticipants}</p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">posição do estudante</p>
                <p className="mt-3 text-4xl font-semibold text-white">#{challengeStudentProgress.currentPosition}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {challengeContestConfig.waitingMessages.map((message) => (
                <div key={message} className="rounded-[22px] border border-white/8 bg-black/25 px-4 py-3 font-tech-mono text-xs leading-6 text-slate-300">
                  {message}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">Ver participantes</Button>
              <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">Exportar resultados</Button>
            </div>
          </AdminContestPanel>
        </div>
      ) : null}

      {activeSection === "questions" ? (
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <AdminContestPanel kicker="question.catalog" title="Catálogo de desafios">
            <div className="space-y-3">
              {challengeItems.map((challenge) => {
                const config = challengeQuestionConfigs.find((item) => item.slug === challenge.slug);
                const selected = selectedQuestionSlug === challenge.slug;

                return (
                  <button
                    key={challenge.slug}
                    type="button"
                    onClick={() => setSelectedQuestionSlug(challenge.slug)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                      selected ? "border-[#16F9FE]/30 bg-[#16F9FE]/8" : "border-white/8 bg-white/4 hover:bg-white/8"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-tech-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">{challenge.id}</p>
                        <p className="mt-2 text-base font-semibold text-white">{challenge.title}</p>
                        <p className="mt-2 text-sm text-slate-300">{challenge.summary}</p>
                      </div>
                      <Badge variant="outline" className="border-white/10 text-slate-200">{config?.status === "draft" ? "Draft" : "Publicado"}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                      <span>{challenge.difficulty}</span>
                      <span>•</span>
                      <span>{challenge.points} pts</span>
                      <span>•</span>
                      <span>{challenge.timeLimit}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </AdminContestPanel>

          <AdminContestPanel kicker="question.editor" title="Configuração da questão">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Título">
                  <Input value={challengeItems.find((item) => item.slug === selectedQuestion.slug)?.title ?? ""} readOnly className="border-white/10 bg-white/5 text-white" />
                </Field>
                <Field label="Estado">
                  <Input value={selectedQuestion.status === "draft" ? "Draft" : "Publicado"} readOnly className="border-white/10 bg-white/5 text-white" />
                </Field>
                <Field label="Formato de input">
                  <Textarea value={selectedQuestion.inputFormat} readOnly className="min-h-24 border-white/10 bg-white/5 text-white" />
                </Field>
                <Field label="Formato de output">
                  <Textarea value={selectedQuestion.outputFormat} readOnly className="min-h-24 border-white/10 bg-white/5 text-white" />
                </Field>
              </div>

              <Field label="Enunciado oficial">
                <Textarea value={selectedQuestion.statement} readOnly className="min-h-32 border-white/10 bg-white/5 text-white" />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Restrições">
                  <Textarea value={selectedQuestion.constraints.join("\n")} readOnly className="min-h-32 border-white/10 bg-white/5 text-white" />
                </Field>
                <Field label="Critérios de avaliação">
                  <Textarea value={selectedQuestion.evaluation.join("\n")} readOnly className="min-h-32 border-white/10 bg-white/5 text-white" />
                </Field>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Linguagens permitidas</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedQuestion.allowedLanguages.map((language) => (
                    <Badge key={language} variant="outline" className="border-white/10 text-slate-200">{language}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" className="bg-[#16F9FE] text-slate-950 hover:bg-[#7cfbff]">Guardar configuração</Button>
                <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">Duplicar questão</Button>
              </div>
            </div>
          </AdminContestPanel>
        </div>
      ) : null}

      {activeSection === "submissions" ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <AdminContestPanel kicker="submission.monitor" title="Submissões monitoradas">
            <div className="space-y-3">
              {challengeSubmissions.map((submission) => {
                const challenge = challengeItems.find((item) => item.slug === submission.challengeSlug);
                const StatusIcon = submission.status === "accepted" ? CheckCircle2 : submission.status === "review" ? FileCode2 : XCircle;

                return (
                  <div key={submission.id} className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-tech-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">{submission.id}</p>
                        <p className="mt-1 text-base font-semibold text-white">{submission.studentName}</p>
                        <p className="text-sm text-slate-400">
                          {submission.studentNumber} · {challenge?.title ?? submission.challengeSlug}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-white/10 text-slate-200">{submission.language}</Badge>
                        <Badge variant="outline" className={`${statusTone[submission.status]} border`}>
                          <StatusIcon className="mr-1 h-3.5 w-3.5" />
                          {submission.status}
                        </Badge>
                        <Badge variant="outline" className="border-white/10 text-slate-200">{submission.score} pts</Badge>
                        <Badge variant="outline" className="border-white/10 text-slate-200">{submission.runtime}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-400">Submetido em {submission.submittedAt}</p>
                  </div>
                );
              })}
            </div>
          </AdminContestPanel>

          <AdminContestPanel kicker="participant.live" title="Participantes e sinais">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">online.now</p>
                <p className="mt-3 inline-flex items-center gap-2 text-3xl font-semibold text-white">
                  <Users className="h-5 w-5 text-[#16F9FE]" />
                  {challengeContestConfig.onlineParticipants}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">leaderboard.signal</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Score atualizado em tempo real, com desempate por tempo da última submissão pontuável.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">export.pipeline</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Publicação oficial, CSV e revisão final do ranking centralizados aqui.
                </p>
              </div>
            </div>
          </AdminContestPanel>
        </div>
      ) : null}

      {activeSection === "leaderboard" ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {challengeRanking.slice(0, 3).map((entry, index) => (
              <div key={entry.studentNumber} className="rounded-[28px] border border-white/8 bg-white/4 p-5">
                <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">top_{index + 1}</p>
                <p className="mt-4 text-xl font-semibold text-white">{entry.name}</p>
                <p className="mt-1 text-sm text-slate-400">{entry.studentNumber}</p>
                <p className="mt-5 text-4xl font-semibold text-[#16F9FE]">{entry.score}</p>
              </div>
            ))}
          </div>

          <AdminContestPanel kicker="leaderboard.live" title="Ranking validado">
            <div className="space-y-3">
              {challengeRanking.map((entry) => (
                <div key={entry.studentNumber} className="grid gap-3 rounded-[24px] border border-white/8 bg-white/4 p-4 md:grid-cols-[88px_minmax(0,1fr)_140px_160px] md:items-center">
                  <div className="text-sm font-semibold text-[#16F9FE]">#{entry.position}</div>
                  <div>
                    <p className="text-base font-semibold text-white">{entry.name}</p>
                    <p className="text-sm text-slate-400">{entry.studentNumber} · {entry.course}</p>
                  </div>
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Score</p>
                    <p className="text-lg font-semibold text-white">{entry.score}</p>
                  </div>
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Resolvidos</p>
                    <p className="text-lg font-semibold text-white">{entry.solved}</p>
                  </div>
                </div>
              ))}
            </div>
          </AdminContestPanel>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <AdminContestPanel kicker="results.summary" title="Resultados finais">
              <ResultRow label="Campeão" value={challengeResultsSummary.champion} />
              <ResultRow label="Score campeão" value={`${challengeResultsSummary.championScore} pts`} />
              <ResultRow label="Taxa de aceitação" value={challengeResultsSummary.acceptanceRate} />
              <ResultRow label="Publicação" value={challengeResultsSummary.publishedAt} />
              <ResultRow label="Questões da rodada" value={String(challengeResultsSummary.totalQuestions)} />
              <ResultRow label="Total de submissões" value={String(challengeResultsSummary.totalSubmissions)} />
            </AdminContestPanel>

            <AdminContestPanel kicker="results.export" title="Publicação e governação">
              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="font-tech-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">Resumo editorial</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Esta área concentra os resultados oficiais do concurso. A página pública de cada exercício não expõe regras de avaliação internas nem configurações de pergunta; essa governação fica exclusivamente no admin.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryCard label="Pontuação média" value={String(challengeResultsSummary.averageScore)} tone="border-white/10 bg-white/6 text-slate-100" />
                <SummaryCard label="Última revisão" value="Aprovada" tone="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" className="bg-[#16F9FE] text-slate-950 hover:bg-[#7cfbff]">Publicar resultados</Button>
                <Button type="button" variant="outline" className="border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white">Exportar CSV</Button>
              </div>
            </AdminContestPanel>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-[24px] border p-4 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-tech-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      {children}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-3 last:border-none last:pb-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function AdminContestPanel({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,23,0.94),rgba(6,12,18,0.94))] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.22)] md:p-6">
      <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#16F9FE]">{kicker}</p>
      <h3 className="mt-3 text-2xl font-heading font-bold text-white">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}
