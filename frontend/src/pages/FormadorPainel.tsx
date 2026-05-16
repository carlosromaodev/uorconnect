import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, api, type TrainerDashboard } from "@/lib/api";

function friendlyDashboardError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Entra com o telefone aprovado para abrir o painel do formador.";
    if (error.status === 403) return error.message || "O acesso ainda não foi liberado pela organização.";
    return error.message;
  }
  if (error instanceof TypeError) return "Sem ligação ao servidor. Tenta novamente em instantes.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Não foi possível carregar o painel.";
}

export default function FormadorPainel() {
  const [dashboard, setDashboard] = useState<TrainerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.trainers
      .dashboard()
      .then((payload) => {
        if (!active) return;
        setDashboard(payload);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(friendlyDashboardError(err));
        setDashboard(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const completionRate = useMemo(() => {
    if (!dashboard || dashboard.metrics.totalEnrollments === 0) return 0;
    return Math.round((dashboard.metrics.confirmedPayments / dashboard.metrics.totalEnrollments) * 100);
  }, [dashboard]);

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-4 py-8 text-slate-950 sm:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/8 sm:flex-row sm:items-center sm:p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Painel limitado
            </div>
            <h1 className="mt-3 text-2xl font-black sm:text-4xl">Área do formador</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Acompanha apenas os indicadores agregados do curso atribuído pela organização.
            </p>
          </div>
          <Button asChild className="h-11 rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
            <Link to="/formadores/cadastro">
              Acesso por SMS
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              A carregar painel...
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-xl shadow-amber-900/8">
            <AlertCircle className="h-8 w-8" />
            <h2 className="mt-4 text-xl font-black">Acesso ainda não disponível</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">{error}</p>
            <Button asChild className="mt-6 h-11 rounded-2xl bg-amber-700 text-white hover:bg-amber-800">
              <Link to="/formadores/cadastro">Validar telefone</Link>
            </Button>
          </div>
        ) : null}

        {!loading && dashboard ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.78fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Curso atribuído</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{dashboard.course.name}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{dashboard.course.description}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
                  {dashboard.course.companyName}
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={UsersRound}
                  label="Inscrições"
                  value={dashboard.metrics.totalEnrollments}
                  tone="slate"
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Pagamentos confirmados"
                  value={dashboard.metrics.confirmedPayments}
                  tone="emerald"
                />
                <MetricCard
                  icon={Clock3}
                  label="Em validação"
                  value={dashboard.metrics.pendingPayments}
                  tone="amber"
                />
                <MetricCard
                  icon={XCircle}
                  label="Não aprovados"
                  value={dashboard.metrics.rejectedPayments}
                  tone="rose"
                />
              </div>
            </section>

            <aside className="rounded-[2rem] border border-slate-200 bg-[#07130d] p-6 text-white shadow-xl shadow-emerald-950/12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-black">Leitura rápida</h3>
              <p className="mt-3 text-sm leading-6 text-white/62">
                O painel mostra progresso do curso sem expor dados pessoais. Para listas nominais, comprovativos ou alterações, usa a equipa administrativa.
              </p>

              <div className="mt-7">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-bold text-white/70">Confirmação financeira</span>
                  <span className="text-3xl font-black">{completionRate}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.max(4, completionRate)}%` }}
                  />
                </div>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="text-sm font-black">{dashboard.course.companyCategory}</p>
                    <p className="mt-1 text-xs text-white/45">
                      Atualizado em {new Date(dashboard.updatedAt).toLocaleString("pt-AO")}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-900 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    rose: "bg-rose-50 text-rose-900 border-rose-200",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-5 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] opacity-65">{label}</p>
    </div>
  );
}
