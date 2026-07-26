import { useMemo, type ReactNode } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  Wifi,
  WifiOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  UorStudentApiError,
  type UorStudentDataBlock,
  type UorStudentOfficialDataset,
  type UorStudentProvider,
  uorStudentApi,
} from "./api";

const navItems = [
  { to: "/estudante", label: "Hoje", icon: LayoutDashboard, end: true },
  { to: "/estudante/academico", label: "Académico", icon: GraduationCap },
  { to: "/estudante/financas", label: "Finanças", icon: WalletCards },
  { to: "/estudante/aprendizagem", label: "Moodle", icon: BookOpen },
  { to: "/estudante/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/estudante/perfil", label: "Perfil", icon: CircleUserRound },
] as const;

function formatDate(value: string | null) {
  if (!value) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(value));
}

function titleFromKey(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Não disponível";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return Array.isArray(value) ? value.map(displayValue).join(", ") : "Informação detalhada";
  return String(value);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-white ring-1 ring-black/5", compact ? "h-10 w-10" : "h-12 w-12")}>
        <img src="/uor-estudante-mark.svg" alt="" className={compact ? "h-8 w-8" : "h-10 w-10"} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[#837970]">UOR Connect</span>
        <span className="block truncate text-lg font-extrabold tracking-[-0.03em] text-[#050505]">Estudante</span>
      </span>
    </div>
  );
}

function CoverageBadge({ block }: { block: UorStudentDataBlock }) {
  const label = block.stale ? "Dado anterior" : block.coverage === "exact" ? "Atualizado" : block.coverage === "not_synced" ? "Por sincronizar" : "Parcial";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
      block.stale || block.coverage !== "exact" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800",
    )}>
      {block.stale || block.coverage !== "exact" ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function ProviderPill({ provider }: { provider: UorStudentProvider }) {
  const healthy = provider.status === "connected";
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#E7E1DA] bg-white px-3 py-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", healthy ? "bg-emerald-500" : provider.status === "connecting" ? "bg-amber-500" : "bg-stone-300")} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-xs font-extrabold capitalize text-[#201E1C]">{provider.provider}</span>
        <span className="block truncate text-[11px] text-[#746C65]">{healthy ? "Ligado" : provider.status === "connecting" ? "A sincronizar" : "Ação necessária"}</span>
      </span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="uor-student-scope grid min-h-screen place-items-center bg-[#FAF7F3] px-6" role="status" aria-live="polite">
      <div className="text-center">
        <img src="/uor-estudante-mark.svg" alt="" className="mx-auto h-16 w-16 animate-pulse" />
        <p className="mt-4 text-sm font-bold text-[#5E5751]">A preparar a tua área académica…</p>
      </div>
    </div>
  );
}

function ErrorPanel({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-extrabold text-amber-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-amber-900">{message}</p>
          {retry ? (
            <button type="button" onClick={retry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-950 px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A00]/30">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#FF5A00]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.045em] text-[#050505] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F6963] sm:text-base">{description}</p>
      </div>
      {action}
    </header>
  );
}

function DashboardPage() {
  const query = useQuery({ queryKey: ["uor-student", "today"], queryFn: uorStudentApi.today });
  if (query.isLoading) return <LoadingScreen />;
  if (query.error || !query.data) return <ErrorPanel title="Não foi possível carregar o resumo" message="Os teus dados continuam protegidos. Verifica a ligação e tenta novamente." retry={() => void query.refetch()} />;
  const data = query.data;
  const metrics = [
    { label: "Cadeiras", value: data.academic.enrollments, icon: GraduationCap, to: "/estudante/academico" },
    { label: "Materiais", value: data.learning.materials, icon: BookOpen, to: "/estudante/aprendizagem" },
    { label: "Referências", value: data.finance.references, icon: WalletCards, to: "/estudante/financas" },
    { label: "Exames", value: data.agenda.officialExams, icon: CalendarDays, to: "/estudante/agenda" },
  ];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="O teu dia académico" title={`Olá, ${data.identity.displayName?.split(" ")[0] ?? "estudante"}.`} description={`${data.identity.course ?? "Curso por sincronizar"} · ${data.identity.academicPeriod ?? "Período por sincronizar"}`} />
      {data.priorities.length ? (
        <section aria-labelledby="priorities-title">
          <h2 id="priorities-title" className="sr-only">Prioridades</h2>
          <div className="grid gap-3">
            {data.priorities.map((priority) => (
              <div key={priority.id} className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#C74600]" />
                <div><p className="font-extrabold text-[#32180A]">{priority.title}</p><p className="mt-1 text-sm leading-6 text-[#74411F]">{priority.reason}</p></div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section aria-labelledby="summary-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="summary-title" className="text-xl font-extrabold text-[#171513]">Visão rápida</h2>
          <CoverageBadge block={data.academic.provenance} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <NavLink key={metric.label} to={metric.to} className="group rounded-3xl border border-[#E7E1DA] bg-white p-4 shadow-[0_8px_28px_rgba(30,20,10,0.04)] transition hover:-translate-y-0.5 hover:border-[#FF5A00]/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A00]/25">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF0E6] text-[#D94D00]"><Icon className="h-5 w-5" /></span>
                <strong className="mt-6 block text-3xl font-extrabold tracking-tight text-[#050505]">{metric.value ?? "—"}</strong>
                <span className="mt-1 flex items-center justify-between text-sm font-bold text-[#6F6963]">{metric.label}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </NavLink>
            );
          })}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-3xl bg-[#050505] p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF8A4C]">Sincronização automática</p>
          <h2 className="mt-3 text-2xl font-extrabold">Secretaria e Moodle, sem botão para atualizar.</h2>
          <p className="mt-3 text-sm leading-6 text-white/65">O backend atualiza os provedores com segurança. Quando uma fonte falha, o último dado válido permanece identificado pela sua data.</p>
          <p className="mt-5 text-xs text-white/50">Último dado académico: {formatDate(data.academic.provenance.observedAt)}</p>
        </div>
        <div className="rounded-3xl border border-[#E7E1DA] bg-white p-5">
          <h2 className="font-extrabold text-[#171513]">Ligações</h2>
          <div className="mt-4 grid gap-3">{data.providers.map((provider) => <ProviderPill key={provider.provider} provider={provider} />)}</div>
        </div>
      </section>
    </div>
  );
}

function DatasetCards({ dataset }: { dataset: UorStudentOfficialDataset }) {
  if (!dataset.items.length) {
    return <div className="rounded-3xl border border-dashed border-[#D8D0C8] bg-white/70 p-8 text-center text-sm text-[#6F6963]">Ainda não existem dados oficiais disponíveis neste contexto.</div>;
  }
  return (
    <div className="grid gap-3">
      {dataset.items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-[#E7E1DA] bg-white p-4">
          <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(item.attributes).slice(0, 8).map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#91877E]">{titleFromKey(key)}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[#292521]">{displayValue(value)}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

function OfficialDatasetPage({ kind }: { kind: "finance" | "agenda" | "learning" }) {
  type DatasetEndpoint = {
    key: string;
    label: string;
    path: string;
    source: "official" | "learning";
  };
  const config = kind === "finance"
    ? { eyebrow: "Situação financeira", title: "Finanças", description: "Propinas, dívidas, pagamentos e referências confirmados pela Secretaria.", endpoints: [
      { key: "tuition", label: "Propinas", path: "/finance/tuition", source: "official" },
      { key: "debts", label: "Dívidas", path: "/finance/debts", source: "official" },
      { key: "payments", label: "Histórico de pagamentos", path: "/finance/payments", source: "official" },
      { key: "references", label: "Referências de pagamento", path: "/finance/references", source: "official" },
    ] satisfies DatasetEndpoint[] }
    : kind === "agenda"
      ? { eyebrow: "Tempo e presença", title: "Agenda", description: "Horário, exames e assiduidade com origem e atualização visíveis.", endpoints: [
        { key: "schedule", label: "Horário", path: "/schedule", source: "official" },
        { key: "exams", label: "Exames", path: "/exams", source: "official" },
        { key: "attendance", label: "Assiduidade", path: "/attendance", source: "official" },
      ] satisfies DatasetEndpoint[] }
      : { eyebrow: "Ambiente pedagógico", title: "Moodle", description: "Cursos e materiais sincronizados automaticamente, sem expor a sessão externa.", endpoints: [
        { key: "courses", label: "Disciplinas no Moodle", path: "/learning/courses", source: "learning" },
        { key: "materials", label: "Materiais disponíveis", path: "/learning/materials", source: "learning" },
      ] satisfies DatasetEndpoint[] };
  const queries = useQueries({
    queries: config.endpoints.map((endpoint) => ({
      queryKey: ["uor-student", endpoint.key],
      queryFn: () => endpoint.source === "learning"
        ? uorStudentApi.learningItems(endpoint.path as "/learning/courses" | "/learning/materials")
        : uorStudentApi.dataset(endpoint.path),
      retry: false,
    })),
  });
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
      <div className="space-y-7">
        {config.endpoints.map((endpoint, index) => {
          const query = queries[index];
          return (
            <section key={endpoint.key} aria-labelledby={`dataset-${endpoint.key}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 id={`dataset-${endpoint.key}`} className="text-xl font-extrabold text-[#171513]">{endpoint.label}</h2>
                {query.data ? <CoverageBadge block={query.data.provenance} /> : null}
              </div>
              {query.isLoading ? (
                <div className="h-32 animate-pulse rounded-3xl border border-[#E7E1DA] bg-white" role="status" aria-label={`A carregar ${endpoint.label}`} />
              ) : query.data ? (
                <>
                  <p className="mb-3 text-xs text-[#746C65]">Fonte: {query.data.provenance.source === "moodle" ? "Moodle" : "Secretaria UOR"} · {formatDate(query.data.provenance.observedAt)}</p>
                  <DatasetCards dataset={query.data} />
                </>
              ) : (
                <ErrorPanel title={`${endpoint.label} indisponível`} message="A sincronização automática continuará no backend. O último dado válido aparecerá assim que estiver disponível." retry={() => void query.refetch()} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AcademicPage() {
  const averages = useQuery({ queryKey: ["uor-student", "averages"], queryFn: uorStudentApi.averages, retry: false });
  const enrollments = useQuery({ queryKey: ["uor-student", "enrollments"], queryFn: () => uorStudentApi.dataset("/academic/enrollments"), retry: false });
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Desempenho académico" title="Académico" description="Notas oficiais separadas dos cálculos reproduzíveis da UOR Estudante." />
      {averages.data ? (
        <section className="grid gap-4 lg:grid-cols-[0.35fr_1fr]">
          <div className="rounded-3xl bg-[#050505] p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF8A4C]">Média observada</p>
            <strong className="mt-4 block text-5xl font-extrabold">{averages.data.overall.average ?? "—"}</strong>
            <p className="mt-2 text-sm text-white/60">{averages.data.overall.consideredSubjects} cadeiras consideradas</p>
            <p className="mt-6 text-xs leading-5 text-white/45">Cálculo derivado · regra v{averages.data.rule.version}. Não altera as notas oficiais.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {averages.data.subjects.map((subject) => (
              <article key={`${subject.subjectKey}:${subject.period}`} className="rounded-3xl border border-[#E7E1DA] bg-white p-5">
                <p className="text-sm font-extrabold text-[#292521]">{subject.subjectName}</p>
                <p className="mt-1 text-xs text-[#8A8179]">{subject.period ?? "Período não indicado"}</p>
                <p className="mt-5 text-3xl font-extrabold text-[#050505]">{subject.average ?? "—"}</p>
              </article>
            ))}
          </div>
        </section>
      ) : averages.isError ? <ErrorPanel title="Médias indisponíveis" message="As notas oficiais continuam intactas; tenta novamente depois da sincronização." retry={() => void averages.refetch()} /> : <LoadingScreen />}
      {enrollments.data ? <section><h2 className="mb-4 text-xl font-extrabold">Inscrições oficiais</h2><DatasetCards dataset={enrollments.data} /></section> : null}
    </div>
  );
}

function ProfilePage() {
  const profile = useQuery({ queryKey: ["uor-student", "profile"], queryFn: uorStudentApi.profile });
  const providers = useQuery({ queryKey: ["uor-student", "providers"], queryFn: uorStudentApi.providers });
  if (!profile.data) return profile.isError ? <ErrorPanel title="Perfil indisponível" message="Não foi possível carregar o perfil institucional." retry={() => void profile.refetch()} /> : <LoadingScreen />;
  const fields = Object.entries(profile.data.fields);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Identidade e privacidade" title="O teu perfil" description="Dados oficiais e declarados permanecem separados pela origem." />
      <section className="rounded-3xl border border-[#E7E1DA] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-[#EEE9E4] pb-6 sm:flex-row sm:items-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[#FFF0E6] text-2xl font-extrabold text-[#D94D00]">{profile.data.fields.displayName.value?.charAt(0) ?? "E"}</span>
          <div><h2 className="text-2xl font-extrabold">{profile.data.fields.displayName.value ?? "Estudante UOR"}</h2><p className="mt-1 text-sm text-[#6F6963]">{profile.data.studentNumber} · {profile.data.fields.course.value ?? "Curso por sincronizar"}</p></div>
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map(([key, field]) => (
            <div key={key}><dt className="text-xs font-bold uppercase tracking-[0.1em] text-[#91877E]">{titleFromKey(key)}</dt><dd className="mt-1 font-semibold text-[#292521]">{field.value ?? "Não indicado"}</dd><dd className="mt-1 text-[11px] text-[#9A9189]">{field.source === "secretaria_uor" ? "Oficial · Secretaria UOR" : field.source === "student" ? "Declarado por ti" : "Sem origem confirmada"}</dd></div>
          ))}
        </dl>
      </section>
      <section><h2 className="mb-4 text-xl font-extrabold">Plataformas ligadas</h2><div className="grid gap-3 sm:grid-cols-2">{providers.data?.map((provider) => <ProviderPill key={provider.provider} provider={provider} />)}</div></section>
    </div>
  );
}

function UorStudentShell({ session }: { session: Awaited<ReturnType<typeof uorStudentApi.session>> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: async () => {
      await Promise.allSettled([uorStudentApi.terminateExternalSessions(), api.auth.logout()]);
    },
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ["uor-student"] });
      navigate("/estudante-login", { replace: true });
    },
  });
  return (
    <div className="uor-student-scope min-h-screen bg-[#FAF7F3] text-[#050505]">
      <a href="#uor-student-content" className="sr-only z-[100] rounded-lg bg-[#050505] px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Saltar para o conteúdo</a>
      <div className="uor-student-orbit" aria-hidden="true" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#E7E1DA] bg-[#FAF7F3]/95 px-5 py-6 backdrop-blur-xl lg:flex lg:flex-col">
        <Brand />
        <nav aria-label="Navegação UOR Estudante" className="mt-10 space-y-1.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5A00]/25", isActive ? "bg-[#050505] text-white" : "text-[#5F5852] hover:bg-white hover:text-[#050505]")}>
              <Icon className="h-5 w-5" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="rounded-2xl border border-[#E7E1DA] bg-white p-3 text-xs"><p className="font-extrabold text-[#292521]">Sessão protegida</p><p className="mt-1 text-[#817870]">{session.institutionCode} · ID opaco</p></div>
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 text-sm font-bold text-[#6F6963] hover:bg-red-50 hover:text-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:opacity-60"><LogOut className="h-5 w-5" />Terminar sessão</button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#E7E1DA]/80 bg-[#FAF7F3]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="lg:hidden"><Brand compact /></div>
            <div className="hidden items-center gap-2 text-xs font-bold text-[#6F6963] lg:flex"><ShieldCheck className="h-4 w-4 text-emerald-600" />Área privada</div>
            <div className="flex items-center gap-2">{session.providers.map((provider) => <span key={provider.provider} className={cn("h-2.5 w-2.5 rounded-full", provider.connected ? "bg-emerald-500" : "bg-amber-400")} title={`${provider.provider}: ${provider.status}`} />)}</div>
          </div>
        </header>
        <main id="uor-student-content" className="relative mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-12 lg:pt-10">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="academico" element={<AcademicPage />} />
            <Route path="financas" element={<OfficialDatasetPage kind="finance" />} />
            <Route path="aprendizagem" element={<OfficialDatasetPage kind="learning" />} />
            <Route path="agenda" element={<OfficialDatasetPage kind="agenda" />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/estudante" replace />} />
          </Routes>
        </main>
      </div>
      <nav aria-label="Navegação móvel UOR Estudante" className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-3xl border border-white/50 bg-[#050505]/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {navItems.filter((item) => item.to !== "/estudante/agenda").slice(0, 5).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A4C]", isActive ? "bg-[#FF5A00] text-white" : "text-white/60")}>
            <Icon className="h-5 w-5" /><span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function UorStudentApp() {
  const location = useLocation();
  const session = useQuery({
    queryKey: ["uor-student", "session"],
    queryFn: uorStudentApi.session,
    retry: false,
    staleTime: 60_000,
  });
  const redirect = useMemo(() => encodeURIComponent(`${location.pathname}${location.search}`), [location.pathname, location.search]);
  if (session.isLoading) return <LoadingScreen />;
  if (session.error instanceof UorStudentApiError && [401, 403].includes(session.error.status)) {
    return <Navigate to={`/estudante-login?redirect=${redirect}`} replace />;
  }
  if (!session.data) return <div className="uor-student-scope min-h-screen bg-[#FAF7F3] p-6"><ErrorPanel title="Área académica indisponível" message="Não foi possível validar a sessão da UOR Estudante." retry={() => void session.refetch()} /></div>;
  return <UorStudentShell session={session.data} />;
}
