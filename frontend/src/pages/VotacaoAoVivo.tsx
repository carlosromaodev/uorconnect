import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Clock3,
  Eye,
  GraduationCap,
  RefreshCw,
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`live-votes-race-row live-votes-race-row--compact ${projectTone(project.rank)}`}
    >
      <div className="live-votes-race-row__rank">{project.rank}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-black text-slate-950 sm:text-base">{project.name}</h3>
          <div className="flex shrink-0 items-center gap-2">
            {project.recentVotes > 0 ? <span className="live-votes-chip is-hot">+{project.recentVotes}</span> : null}
            <span className="live-votes-chip">{project.share}%</span>
          </div>
        </div>
        <div className="live-votes-race-row__bar" aria-hidden="true">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        </div>
      </div>
      <div className="live-votes-race-row__score">
        <strong>{compactNumber(project.score)}</strong>
        <span>{project.votes} votos</span>
      </div>
    </motion.article>
  );
}

export default function VotacaoAoVivo() {
  const [data, setData] = useState<PublicLiveVotesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(900);

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

  useEffect(() => {
    const syncViewport = () => setViewportHeight(window.innerHeight);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const projects = data?.projects ?? [];
  const leader = data?.leader ?? null;
  const runnerUp = projects[1] ?? null;
  const maxScore = Math.max(...projects.map((project) => project.score), 0);
  const leaderAdvantage = leader ? Math.max(leader.score - (runnerUp?.score ?? 0), 0) : 0;
  const lastUpdate = formatTime(data?.generatedAt);
  const isTallDisplay = viewportHeight >= 1_000;
  const rankingLimit = isTallDisplay ? 10 : 7;
  const courseLimit = isTallDisplay ? 4 : 2;
  const momentLimit = isTallDisplay ? 5 : 3;

  return (
    <div className="live-votes-stage">
      <main className="live-votes-control-room live-votes-broadcast-shell mx-auto grid h-screen w-full max-w-[1800px] gap-3 px-3 py-3 sm:px-4 lg:px-5">
        <header className="live-votes-topbar live-votes-broadcast-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/logo-uor.png" alt="UOR Connect" className="h-10 w-auto shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-700">UOR Connect</p>
              <h1 className="truncate text-xl font-black text-slate-950 sm:text-2xl">Placar oficial</h1>
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
              className="h-9 rounded-lg border-slate-200 bg-white/90 px-3 text-xs font-black"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </header>

        <section className="live-votes-scoreboard live-votes-kpi-strip" aria-live="polite">
          <div className="live-votes-leader-compact">
            <div className="live-votes-leader-compact__rank">
              <Trophy className="h-5 w-5" />
              #1
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-wide text-orange-800">Líder</span>
              <h2 className="truncate text-2xl font-black leading-none text-slate-950 xl:text-3xl">
                {leader?.name ?? "Aguardar votos"}
              </h2>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${leader?.share ?? 0}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="h-full rounded-full bg-slate-950"
                />
              </div>
            </div>
            <div className="live-votes-leader-compact__score">
              <strong>{compactNumber(leader?.score ?? 0)}</strong>
              <span>+{compactNumber(leaderAdvantage)}</span>
            </div>
          </div>

          {metricCards(data).map((item) => <LiveVotesMetric key={item.label} item={item} />)}
        </section>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="live-votes-main-grid">
          <section className="live-votes-ranking-table live-votes-race-panel">
            <div className="live-votes-panel-header">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-orange-700">
                  <BarChart3 className="h-4 w-4" />
                  Ranking
                </p>
                <h2 className="text-xl font-black text-slate-950">Classificação pública</h2>
              </div>
              <span>{projects.length} projetos</span>
            </div>
            <div className="live-votes-ranking-table__body">
              {projects.slice(0, rankingLimit).map((project) => (
                <ProjectRaceRow key={project.id} project={project} maxScore={maxScore} />
              ))}
              {loading && projects.length === 0 ? (
                <div className="grid gap-2">
                  {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}
                </div>
              ) : null}
              {!loading && projects.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white/75 p-5 text-sm font-semibold text-slate-500">
                  Nenhum projeto em votação.
                </div>
              ) : null}
            </div>
          </section>

          <aside className="live-votes-compact-column">
            <section className="live-votes-side-panel live-votes-compact-panel">
              <div className="live-votes-panel-header">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-orange-700">Cursos</p>
                  <h2 className="text-lg font-black text-slate-950">Pulso</h2>
                </div>
                <GraduationCap className="h-5 w-5 text-orange-600" />
              </div>
              <div className="live-votes-compact-list">
                {(data?.courses ?? []).slice(0, courseLimit).map((course) => {
                  const width = data?.totals.votes ? Math.max(6, Math.round((course.votes / data.totals.votes) * 100)) : 0;
                  return (
                    <div key={course.course} className="live-votes-course-pulse">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-black text-slate-950">{course.course}</span>
                        <span className="hidden shrink-0 text-xs font-black text-slate-500 2xl:inline">{course.votes}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.45 }}
                          className="block h-full rounded-full bg-orange-500"
                        />
                      </div>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {course.votes} votos · {course.students} estudantes · +{course.recentVotes}
                      </p>
                    </div>
                  );
                })}
                {!loading && (data?.courses ?? []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Sem votos por curso.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="live-votes-side-panel live-votes-compact-panel">
              <div className="live-votes-panel-header">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Agora</p>
                  <h2 className="text-lg font-black text-slate-950">Movimentos</h2>
                </div>
                <Wifi className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="live-votes-compact-list">
                {(data?.moments ?? []).slice(0, momentLimit).map((moment) => (
                  <motion.div
                    key={moment.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="live-votes-moment-public"
                  >
                    <span className="admin-votes-live-dot" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{moment.course}</p>
                      <p className="truncate text-xs font-semibold text-slate-600">{moment.project}</p>
                    </div>
                    <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 2xl:inline-flex">
                      {formatTime(moment.createdAt)}
                    </span>
                  </motion.div>
                ))}
                {!loading && (data?.moments ?? []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    Sem movimentos.
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
