import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Clock3,
  Eye,
  GraduationCap,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Vote,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type PublicLiveVoteProject, type PublicLiveVotesOverview } from "@/lib/api";

const LIVE_POLL_INTERVAL_MS = 7_000;

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-PT", { notation: value >= 10_000 ? "compact" : "standard" }).format(value);
}

function projectTone(rank: number) {
  if (rank === 1) return "is-gold";
  if (rank === 2) return "is-silver";
  if (rank === 3) return "is-bronze";
  return "is-default";
}

function metricCards(data: PublicLiveVotesOverview | null) {
  return [
    { label: "Pontos", value: data?.totals.score ?? 0, icon: Trophy, tone: "orange" },
    { label: "Votos", value: data?.totals.votes ?? 0, icon: Vote, tone: "ink" },
    { label: "Cursos", value: data?.totals.activeCourses ?? 0, icon: GraduationCap, tone: "green" },
    { label: "Recentes", value: data?.totals.recentVotes ?? 0, icon: Activity, tone: "blue" },
    { label: "Visitantes", value: data?.totals.uniqueVisitors ?? 0, icon: Eye, tone: "violet" },
  ] as const;
}

function LiveVotesMetric({ item }: { item: ReturnType<typeof metricCards>[number] }) {
  const Icon = item.icon;
  return (
    <div className={`live-votes-metric live-votes-metric--${item.tone}`}>
      <span className="live-votes-metric__icon">
        <Icon className="h-4 w-4" />
      </span>
      <span className="live-votes-metric__label">{item.label}</span>
      <strong>{compactNumber(item.value)}</strong>
    </div>
  );
}

function ProjectRaceRow({ project, maxScore }: { project: PublicLiveVoteProject; maxScore: number }) {
  const width = maxScore > 0 ? Math.max(5, Math.round((project.score / maxScore) * 100)) : 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`live-votes-race-row ${projectTone(project.rank)}`}
    >
      <div className="live-votes-race-row__rank">#{project.rank}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-950 sm:text-base">{project.name}</h3>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {project.share}% da corrida · {project.uniqueVisitors} visitantes únicos
            </p>
          </div>
          <div className="shrink-0 text-right">
            <strong className="block text-lg font-black text-slate-950">{compactNumber(project.score)}</strong>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">pontos</span>
          </div>
        </div>
        <div className="live-votes-race-row__bar" aria-hidden="true">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wide">
          {project.recentVotes > 0 ? <span className="live-votes-chip is-hot">+{project.recentVotes} recentes</span> : null}
          <span className="live-votes-chip">{project.votes} votos</span>
          {project.authenticatedVisitors > 0 ? <span className="live-votes-chip">login verificado</span> : null}
          <span className="live-votes-chip">{project.pageViews} acessos</span>
        </div>
      </div>
    </motion.article>
  );
}

export default function VotacaoAoVivo() {
  const [data, setData] = useState<PublicLiveVotesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (background = false) => {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);
      const next = await api.interactions.liveVotes();
      setData(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a votação ao vivo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => void load(true), LIVE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const projects = data?.projects ?? [];
  const topThree = projects.slice(0, 3);
  const leader = data?.leader ?? null;
  const runnerUp = projects[1] ?? null;
  const maxScore = Math.max(...projects.map((project) => project.score), 0);
  const leaderAdvantage = leader ? Math.max(leader.score - (runnerUp?.score ?? 0), 0) : 0;
  const lastUpdate = formatTime(data?.generatedAt);

  const broadcastLine = useMemo(() => {
    if (!leader) return "A votação ainda está à espera dos primeiros votos.";
    if (leaderAdvantage === 0) return `${leader.name} está empatado na liderança.`;
    return `${leader.name} lidera com ${compactNumber(leaderAdvantage)} ponto(s) de vantagem.`;
  }, [leader, leaderAdvantage]);

  return (
    <div className="live-votes-stage">
      <main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="live-votes-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-uor.png" alt="UOR Connect" className="h-11 w-auto shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-700">UOR Connect</p>
              <h1 className="truncate text-xl font-black text-slate-950 sm:text-2xl">Votação ao vivo</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="live-votes-live-pill">
              <span className="admin-votes-live-dot" />
              Ao vivo
            </span>
            <span className="live-votes-time-pill">
              <Clock3 className="h-4 w-4" />
              {lastUpdate}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-slate-200 bg-white/90 px-4 text-xs font-black"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </header>

        <section className="live-votes-hero-panel" aria-live="polite">
          <div className="live-votes-hero-panel__rail" aria-hidden="true" />
          <div className="relative z-10 grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-orange-800">
                <Radio className="h-3.5 w-3.5" />
                Transmissão pública
              </div>
              <h2 className="mt-4 max-w-5xl text-4xl font-black leading-[0.96] text-slate-950 sm:text-6xl xl:text-7xl">
                A corrida do público, em tempo real.
              </h2>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                Resultados atualizados automaticamente, com energia por curso, liderança do momento e ritmo da feira sem expor dados pessoais.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-5">
                {metricCards(data).map((item) => <LiveVotesMetric key={item.label} item={item} />)}
              </div>
            </div>

            <div className="live-votes-leader-board">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-orange-800">
                <Trophy className="h-4 w-4" />
                Projeto em destaque
              </p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={leader?.id ?? "empty"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  <h3 className="mt-4 line-clamp-3 text-3xl font-black leading-none text-slate-950">
                    {leader?.name ?? "Aguardar votos"}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{broadcastLine}</p>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="live-votes-leader-board__stat">
                      <span>Pontos</span>
                      <strong>{compactNumber(leader?.score ?? 0)}</strong>
                    </div>
                    <div className="live-votes-leader-board__stat">
                      <span>Votos</span>
                      <strong>{leader?.votes ?? 0}</strong>
                    </div>
                    <div className="live-votes-leader-board__stat">
                      <span>Vantagem</span>
                      <strong>{compactNumber(leaderAdvantage)}</strong>
                    </div>
                  </div>
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/80">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${leader?.share ?? 0}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="h-full rounded-full bg-slate-950"
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {topThree.map((project) => (
                <motion.article
                  key={project.id}
                  layout
                  className={`live-votes-podium-card ${projectTone(project.rank)}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="live-votes-podium-card__rank">#{project.rank}</span>
                  <h3 className="line-clamp-2 text-lg font-black leading-tight text-slate-950">{project.name}</h3>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <strong className="text-4xl font-black leading-none text-slate-950">{compactNumber(project.score)}</strong>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">pontos</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{project.votes} votos</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-slate-800">{project.share}%</span>
                      {project.recentVotes > 0 ? <p className="mt-2 text-[10px] font-black uppercase text-emerald-700">+{project.recentVotes} agora</p> : null}
                    </div>
                  </div>
                </motion.article>
              ))}
              {!loading && topThree.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/75 p-6 text-sm font-semibold text-slate-500 md:col-span-3">
                  Nenhum projeto em votação foi encontrado. Assim que a votação abrir, o pódio aparece aqui.
                </div>
              ) : null}
            </div>

            <section className="live-votes-race-panel">
              <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-orange-700">
                    <BarChart3 className="h-4 w-4" />
                    Corrida dos projetos
                  </p>
                  <h2 className="text-xl font-black text-slate-950">Classificação pública</h2>
                </div>
                <p className="text-xs font-semibold text-slate-500">Atualiza a cada {LIVE_POLL_INTERVAL_MS / 1000}s</p>
              </div>
              <div className="space-y-3 p-3 sm:p-4">
                {projects.slice(0, 10).map((project) => (
                  <ProjectRaceRow key={project.id} project={project} maxScore={maxScore} />
                ))}
                {loading && projects.length === 0 ? (
                  <div className="grid gap-3">
                    {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-3xl bg-slate-100" />)}
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="live-votes-side-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-orange-700">Pulso por curso</p>
                  <h2 className="text-xl font-black text-slate-950">Quem está a mover a sala</h2>
                </div>
                <GraduationCap className="h-6 w-6 text-orange-600" />
              </div>
              <div className="mt-4 space-y-3">
                {(data?.courses ?? []).slice(0, 6).map((course) => {
                  const width = data?.totals.votes ? Math.max(6, Math.round((course.votes / data.totals.votes) * 100)) : 0;
                  return (
                    <div key={course.course} className="live-votes-course-pulse">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-black text-slate-950">{course.course}</span>
                        <span className="text-xs font-black text-slate-500">{course.votes}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.6 }}
                          className="block h-full rounded-full bg-orange-500"
                        />
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {course.students} estudante(s) · {course.recentVotes} recente(s)
                      </p>
                    </div>
                  );
                })}
                {!loading && (data?.courses ?? []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    O pulso dos cursos aparece assim que os estudantes começarem a votar.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="live-votes-side-panel">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-orange-700">Momento ao vivo</p>
                  <h2 className="text-xl font-black text-slate-950">O que acabou de acontecer</h2>
                </div>
                <Wifi className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="mt-4 space-y-2">
                {(data?.moments ?? []).slice(0, 7).map((moment) => (
                  <motion.div
                    key={moment.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="live-votes-moment-public"
                  >
                    <span className="admin-votes-live-dot" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{moment.course}</p>
                      <p className="truncate text-xs font-semibold text-slate-600">votou em {moment.project}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                      {formatTime(moment.createdAt)}
                    </span>
                  </motion.div>
                ))}
                {!loading && (data?.moments ?? []).length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Os momentos entram aqui em tempo real, sem expor nomes ou números.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="live-votes-privacy-note">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="font-black text-slate-950">Painel público anonimizado</p>
                <p className="text-xs font-semibold leading-5 text-slate-600">
                  Mostra cursos, projetos e ritmo. A auditoria com estudante e número fica apenas na admin.
                </p>
              </div>
            </section>
          </aside>
        </section>

        <footer className="flex flex-col gap-2 pb-2 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-600" />
            UOR Connect · resultados em tempo real
          </span>
          <Link to="/projetos" className="font-black text-slate-800 underline decoration-orange-400 underline-offset-4">
            Ver projetos participantes
          </Link>
        </footer>
      </main>
    </div>
  );
}
