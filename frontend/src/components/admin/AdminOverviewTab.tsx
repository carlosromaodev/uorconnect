import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Banknote,
  BarChart3,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Crown,
  Download,
  FolderOpen,
  GraduationCap,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  Package,
  Phone,
  Search,
  Shield,
  Target,
  ThumbsUp,
  TrendingUp,
  Users,
  WalletCards,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentProfile, StudentWithStats } from "@/lib/api";

type ProjectSummary = {
  id: number;
  nome: string;
  tipo: "projeto" | "negocio" | "produto";
  votos: number;
  pontos: number;
  isWinner: boolean;
};

type AdminOverviewStats = {
  total: number;
  pendentes: number;
  aprovados: number;
  recusados: number;
  totalVotos: number;
  totalEstudantes: number;
};

type EconomicSummary = {
  exhibitorCount: number;
  approvedCount: number;
  projectCount: number;
  businessCount: number;
  productCount: number;
  paidValue: number;
  projectedRevenue: number;
  approvedRevenue: number;
};

type AdminOverviewTabProps = {
  exportingReport: boolean;
  rankedProjects: ProjectSummary[];
  rankedStudents: StudentWithStats[];
  stats: AdminOverviewStats;
  economicSummary: EconomicSummary;
  speakerCount: number;
  courseCount: number;
  adminCount: number;
  recentLogins: StudentProfile[];
  submissionsOpen: boolean;
  onExportOverviewReport: () => void;
  onNavigateTab?: (tab: string) => void;
};

const tipoIcons: Record<ProjectSummary["tipo"], LucideIcon> = {
  projeto: GraduationCap,
  negocio: Briefcase,
  produto: Package,
};

const tipoLabels: Record<ProjectSummary["tipo"], string> = {
  projeto: "Projeto",
  negocio: "Negócio",
  produto: "Produto",
};

function studentInteractions(student: StudentWithStats) {
  return (student._count?.likes ?? 0) + (student._count?.votes ?? 0) + (student._count?.comments ?? 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-PT").format(value);
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem registo";
  try {
    return new Date(value).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sem registo";
  }
}

function whatsappUrl(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("244") ? digits : `244${digits}`}`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  tone = "default",
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  tone?: "default" | "attention" | "success";
  delay?: number;
}) {
  const toneClass = tone === "attention"
    ? "border-amber-200/80 bg-amber-50/70"
    : tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/70"
      : "border-slate-200 bg-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className={`admin-report-metric rounded-2xl border p-4 ${toneClass}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="text-xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 text-[11px] text-muted-foreground/70">{sub}</p>}
    </motion.div>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {action && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          {action}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function AdminOverviewTab({
  exportingReport,
  rankedProjects,
  rankedStudents,
  stats,
  economicSummary,
  speakerCount,
  courseCount,
  adminCount,
  recentLogins,
  submissionsOpen,
  onExportOverviewReport,
  onNavigateTab,
}: AdminOverviewTabProps) {
  const approvalRate = stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0;
  const pendingRate = stats.total > 0 ? Math.round((stats.pendentes / stats.total) * 100) : 0;
  const financeCaptureRate = economicSummary.projectedRevenue > 0
    ? Math.round((economicSummary.approvedRevenue / economicSummary.projectedRevenue) * 100)
    : 0;
  const reportHealth = stats.pendentes === 0
    ? "Estável"
    : stats.pendentes <= Math.max(2, Math.ceil(stats.total * 0.18))
      ? "Em controlo"
      : "Requer ação";
  const reportHealthTone = stats.pendentes === 0
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : stats.pendentes <= Math.max(2, Math.ceil(stats.total * 0.18))
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-rose-200 bg-rose-50 text-rose-700";
  const reportSignals = [
    {
      label: "Decisões pendentes",
      value: formatNumber(stats.pendentes),
      note: `${formatPercent(pendingRate)} das candidaturas`,
      icon: AlertTriangle,
      tone: stats.pendentes > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      label: "Conversão aprovada",
      value: formatPercent(approvalRate),
      note: `${formatNumber(stats.aprovados)} aprovadas`,
      icon: Target,
      tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      label: "Cobertura financeira",
      value: formatPercent(financeCaptureRate),
      note: `${formatCurrency(economicSummary.approvedRevenue)} confirmado`,
      icon: WalletCards,
      tone: "text-sky-700 bg-sky-50 border-sky-200",
    },
  ];
  const [loginSearch, setLoginSearch] = useState("");
  const [loginPage, setLoginPage] = useState(1);
  const loginPageSize = 6;
  const filteredLogins = useMemo(() => {
    const query = loginSearch.trim().toLowerCase();
    if (!query) return recentLogins;
    return recentLogins.filter((student) =>
      student.studentNumber.toLowerCase().includes(query) ||
      (student.name ?? "").toLowerCase().includes(query) ||
      (student.course ?? "").toLowerCase().includes(query) ||
      (student.email ?? "").toLowerCase().includes(query)
    );
  }, [loginSearch, recentLogins]);
  const loginTotalPages = Math.max(1, Math.ceil(filteredLogins.length / loginPageSize));
  const currentLoginPage = Math.min(loginPage, loginTotalPages);
  const loginPageItems = filteredLogins.slice((currentLoginPage - 1) * loginPageSize, currentLoginPage * loginPageSize);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="admin-report-hero overflow-hidden rounded-3xl border border-slate-200 bg-white"
      >
        <div className="relative z-10 grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)] lg:p-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
              <Award className="h-3.5 w-3.5 text-orange-600" />
              Relatório executivo
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Visão Geral</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Leitura operacional, financeira e de participação para orientar decisões rápidas da organização.
                </p>
              </div>
              <Button onClick={onExportOverviewReport} disabled={exportingReport} size="sm" className="h-10 rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                {exportingReport ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                Baixar relatório geral
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {reportSignals.map((signal, index) => {
                const SignalIcon = signal.icon;
                return (
                  <motion.div
                    key={signal.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + index * 0.04, duration: 0.24 }}
                    className={`rounded-2xl border p-3 ${signal.tone}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/75">
                        <SignalIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{signal.label}</p>
                        <p className="mt-1 text-xl font-black tracking-tight">{signal.value}</p>
                        <p className="text-[11px] opacity-75">{signal.note}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Estado da operação</p>
                <p className="mt-1 text-xl font-black text-slate-950">{reportHealth}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${reportHealthTone}`}>
                <Activity className="h-3.5 w-3.5" />
                {submissionsOpen ? "Aberto" : "Fechado"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Aprovação</span>
                  <span>{formatPercent(approvalRate)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: formatPercent(approvalRate) }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Finanças confirmadas</span>
                  <span>{formatPercent(financeCaptureRate)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: formatPercent(financeCaptureRate) }} />
                </div>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              {stats.pendentes > 0
                ? `${formatNumber(stats.pendentes)} candidatura(s) precisam de decisão para reduzir fila operacional.`
                : "Sem fila pendente neste momento. Mantém a rotina de revisão e auditoria."}
            </p>
          </div>
        </div>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={FolderOpen} label="Candidaturas" value={formatNumber(stats.total)} accent="bg-primary/10 text-primary" delay={0} />
        <MetricCard icon={AlertTriangle} label="Pendentes" value={formatNumber(stats.pendentes)} accent="bg-amber-500/10 text-amber-600" tone={stats.pendentes > 0 ? "attention" : "success"} delay={0.03} />
        <MetricCard icon={CheckCircle} label="Aprovados" value={formatNumber(stats.aprovados)} accent="bg-emerald-500/10 text-emerald-600" tone="success" delay={0.06} />
        <MetricCard icon={XCircle} label="Recusados" value={formatNumber(stats.recusados)} accent="bg-red-500/10 text-red-500" delay={0.09} />
        <MetricCard icon={ThumbsUp} label="Votos totais" value={formatNumber(stats.totalVotos)} accent="bg-blue-500/10 text-blue-600" delay={0.12} />
        <MetricCard icon={Users} label="Estudantes" value={formatNumber(stats.totalEstudantes)} accent="bg-violet-500/10 text-violet-600" delay={0.15} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={TrendingUp} label="Taxa de aprovação" value={formatPercent(approvalRate)} accent="bg-emerald-500/10 text-emerald-600" sub={`${formatNumber(stats.aprovados)} aprovadas de ${formatNumber(stats.total)}`} delay={0.18} />
        <MetricCard icon={Banknote} label="Receita aprovada" value={formatCurrency(economicSummary.approvedRevenue)} accent="bg-amber-500/10 text-amber-600" sub="Pagamentos confirmados" delay={0.21} />
        <MetricCard icon={Banknote} label="Receita prevista" value={formatCurrency(economicSummary.projectedRevenue)} accent="bg-blue-500/10 text-blue-600" sub={`${formatCurrency(economicSummary.paidValue)} por expositor`} delay={0.24} />
        <MetricCard icon={BarChart3} label="Cobertura financeira" value={formatPercent(financeCaptureRate)} accent="bg-sky-500/10 text-sky-600" sub="Confirmado sobre previsto" delay={0.27} />
      </div>

      {/* Breakdown by type + platform stats */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border/50 bg-white p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Por tipo</p>
          <div className="mt-3 space-y-2.5">
            {([["projeto", economicSummary.projectCount], ["negocio", economicSummary.businessCount], ["produto", economicSummary.productCount]] as const).map(([tipo, count]) => {
              const Icon = tipoIcons[tipo];
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={tipo} className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="flex-1 text-xs font-medium">{tipoLabels[tipo]}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted/50">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33 }}
          className="rounded-2xl border border-border/50 bg-white p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plataforma</p>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <Mic className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="flex-1 text-xs font-medium">Palestrantes</span>
              <span className="text-sm font-semibold">{speakerCount}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="flex-1 text-xs font-medium">Cursos</span>
              <span className="text-sm font-semibold">{courseCount}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Shield className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="flex-1 text-xs font-medium">Administradores</span>
              <span className="text-sm font-semibold">{adminCount}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span className="flex-1 text-xs font-medium">Logins recentes</span>
              <span className="text-sm font-semibold">{recentLogins.length}</span>
            </div>
          </div>
        </motion.div>

        {/* Top projects mini */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="rounded-2xl border border-border/50 bg-white p-4 lg:col-span-2"
        >
          <SectionHeader
            title="Top Projetos"
            action="Ver todos"
            onAction={onNavigateTab ? () => onNavigateTab("submissions") : undefined}
          />
          <div className="mt-3 space-y-1">
            {rankedProjects.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Sem dados de projetos.</p>
            ) : (
              rankedProjects.slice(0, 5).map((project, i) => {
                const Icon = tipoIcons[project.tipo];
                return (
                  <div key={project.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/30">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                      i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <span className="flex-1 truncate text-xs font-medium">{project.nome}</span>
                    {project.isWinner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {project.votos}v · {project.pontos}pts
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Active students */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-border/50 bg-white p-4"
      >
        <SectionHeader
          title="Estudantes Mais Ativos"
          action="Ver todos"
          onAction={onNavigateTab ? () => onNavigateTab("students") : undefined}
        />
        {rankedStudents.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Dados de estudantes ainda não carregados. Abre a aba "Estudantes" para sincronizar.
          </p>
        ) : (
          <div className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
            {rankedStudents.slice(0, 5).map((student, i) => {
              const initial = student.name ? student.name.charAt(0).toUpperCase() : "#";
              return (
                <div key={student.id} className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/10 p-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-amber-700" : "bg-slate-300"
                  }`}>
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{student.name || `Est. ${student.studentNumber}`}</p>
                    <p className="text-[11px] text-muted-foreground">{studentInteractions(student)} interações</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.43 }}
        className="rounded-2xl border border-border/50 bg-white p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader title="Logins recentes" />
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9 text-sm"
              placeholder="Filtrar por nome, número ou curso"
              value={loginSearch}
              onChange={(event) => {
                setLoginSearch(event.target.value);
                setLoginPage(1);
              }}
            />
          </div>
        </div>

        {loginPageItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {loginSearch ? "Nenhum login corresponde à pesquisa." : "Ainda não existem logins recentes."}
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-border/50">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] border-b border-border/50 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Estudante</span>
              <span>Contacto</span>
              <span className="text-right">Último login</span>
            </div>
            <div className="divide-y divide-border/50">
              {loginPageItems.map((student) => {
                const waUrl = whatsappUrl(student.phone);
                return (
                  <div key={student.id} className="grid gap-3 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{student.name || `Estudante ${student.studentNumber}`}</p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">
                          {student.studentNumber}
                        </span>
                        {student.course ? <span className="min-w-0 truncate">· {student.course}</span> : null}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{student.email || "Sem email"}</span>
                      </p>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="flex min-w-0 items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{student.phone || "Sem telefone"}</span>
                        </p>
                        {waUrl ? (
                          <Button asChild size="sm" className="h-7 rounded-md bg-[#25D366] px-2 text-[11px] text-white hover:bg-[#1fb85a]">
                            <a href={waUrl} target="_blank" rel="noreferrer noopener">
                              <MessageSquare className="mr-1 h-3 w-3" />
                              WhatsApp
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(student.lastLoginAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {filteredLogins.length} registo(s)
            {filteredLogins.length > 0 ? ` · página ${currentLoginPage} de ${loginTotalPages}` : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={currentLoginPage <= 1}
              onClick={() => setLoginPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={currentLoginPage >= loginTotalPages}
              onClick={() => setLoginPage((page) => Math.min(loginTotalPages, page + 1))}
            >
              Próxima
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
