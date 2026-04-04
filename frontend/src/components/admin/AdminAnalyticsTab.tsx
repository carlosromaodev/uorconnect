import { Clock3, Cookie, Download, Filter, Loader2, Radio, RefreshCcw, Search, ShieldCheck, Sparkles, Ticket, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AnalyticsDashboard, AnalyticsEventsPayload, AnalyticsFilterInput } from "@/lib/api";

type Props = {
  loading: boolean;
  dashboard: AnalyticsDashboard | null;
  events: AnalyticsEventsPayload | null;
  error?: string | null;
  filters: AnalyticsFilterInput;
  onFiltersChange: (patch: Partial<AnalyticsFilterInput>) => void;
  onRefresh: () => void;
  onExport: () => void;
};

const audienceColors = ["#0A3D62", "#00B894"];
const topCourseColors = ["#0A3D62", "#00B894", "#10B981", "#38BDF8", "#F59E0B", "#22C55E"];
const cookieCatalog = [
  { name: "uor_auth", category: "Essencial", purpose: "Mantém a sessão autenticada e protege pedidos administrativos." },
  { name: "uor_consent_state", category: "Consentimento", purpose: "Guarda as preferências de cookies escolhidas pelo utilizador." },
  { name: "uor_analytics_visitor", category: "Analytics", purpose: "Identifica o visitante para medir navegação e conversão." },
  { name: "uor_analytics_session", category: "Analytics", purpose: "Agrupa eventos da mesma sessão para funil e retenção." },
];

function formatDuration(seconds: number) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function AdminAnalyticsTab({
  loading,
  dashboard,
  events,
  error,
  filters,
  onFiltersChange,
  onRefresh,
  onExport,
}: Props) {
  const kpis = dashboard?.kpis;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(135deg,rgba(10,61,98,0.08),rgba(0,184,148,0.06),rgba(255,255,255,0.96))] p-6 shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0A3D62]/10 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0A3D62]">
              <Sparkles className="h-3.5 w-3.5" />
              Analytics UOR Connect
            </div>
            <div>
              <h2 className="font-heading text-3xl font-bold text-[#0A3D62]">Inteligência de comportamento, campanhas e conversão.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                Este painel cruza visitantes anónimos, utilizadores autenticados, tickets, WhatsApp, Ao Vivo e inscrições para te dar uma visão realmente acionável do evento.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-xl" onClick={onRefresh}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button className="rounded-xl bg-[#0A3D62] text-white hover:bg-[#082f4b]" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </section>

      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4 text-[#0A3D62]" />
            Filtros avançados
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Data inicial</span>
            <Input type="date" value={filters.from?.slice(0, 10) ?? ""} onChange={(e) => onFiltersChange({ from: e.target.value || undefined })} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Data final</span>
            <Input type="date" value={filters.to?.slice(0, 10) ?? ""} onChange={(e) => onFiltersChange({ to: e.target.value || undefined })} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curso</span>
            <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={filters.course ?? "all"} onChange={(e) => onFiltersChange({ course: e.target.value === "all" ? undefined : e.target.value })}>
              <option value="all">Todos</option>
              {dashboard?.courseOptions.map((course) => (
                <option key={course} value={course}>{course}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Audiência</span>
            <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={filters.audience ?? "all"} onChange={(e) => onFiltersChange({ audience: e.target.value as AnalyticsFilterInput["audience"] })}>
              <option value="all">Todos</option>
              <option value="anonymous">Anónimo</option>
              <option value="authenticated">Autenticado</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Consentimento</span>
            <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={filters.consent ?? "all"} onChange={(e) => onFiltersChange({ consent: e.target.value as AnalyticsFilterInput["consent"] })}>
              <option value="all">Todos</option>
              <option value="analytics">Analytics</option>
              <option value="functional">Funcionalidade</option>
              <option value="marketing">Marketing</option>
              <option value="essential-only">Só essenciais</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pesquisa</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={filters.search ?? ""} onChange={(e) => onFiltersChange({ search: e.target.value || undefined, page: 1 })} placeholder="evento, página, curso..." />
            </div>
          </label>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-[22px] border border-amber-500/25 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{error}</p>
            <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={onRefresh}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Visitantes hoje", value: kpis?.visitorsToday ?? 0, icon: Users, accent: "bg-[#0A3D62]/8 text-[#0A3D62]" },
          { label: "Sessões únicas", value: kpis?.uniqueSessions ?? 0, icon: Radio, accent: "bg-[#00B894]/10 text-[#00B894]" },
          { label: "Tempo médio", value: formatDuration(kpis?.averageSessionDurationSeconds ?? 0), icon: Clock3, accent: "bg-amber-500/10 text-amber-600" },
          { label: "Tickets partilhados", value: kpis?.ticketShares ?? 0, icon: Ticket, accent: "bg-sky-500/10 text-sky-600" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-border/70">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 font-heading text-3xl font-bold">{item.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0A3D62]" />
              Central de consentimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Analytics", value: dashboard?.consent.analytics ?? 0, tone: "border-[#0A3D62]/10 bg-[#0A3D62]/5 text-[#0A3D62]" },
                { label: "Funcionais", value: dashboard?.consent.functional ?? 0, tone: "border-[#00B894]/15 bg-[#00B894]/8 text-[#008f73]" },
                { label: "Marketing", value: dashboard?.consent.marketing ?? 0, tone: "border-amber-500/15 bg-amber-500/8 text-amber-700" },
                { label: "Só essenciais", value: dashboard?.consent.essentialOnly ?? 0, tone: "border-slate-200 bg-slate-50 text-slate-700" },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em]">{item.label}</p>
                  <p className="mt-3 font-heading text-3xl font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4 text-sm leading-7 text-muted-foreground">
              A tipografia de referência do portal principal de agendamento continua alinhada com este frontend: <strong className="text-foreground">DM Sans</strong> no corpo e <strong className="text-foreground">Sora</strong> nos títulos.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="h-4 w-4 text-[#0A3D62]" />
              Inventário de cookies do portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cookieCatalog.map((cookie) => (
              <div key={cookie.name} className="rounded-2xl border border-border/60 bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-sm font-semibold text-[#0A3D62]">{cookie.name}</p>
                  <span className="inline-flex w-fit rounded-full border border-border/60 bg-muted/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {cookie.category}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{cookie.purpose}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {loading && (
        <Card className="border-border/70">
          <CardContent className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            A carregar analytics...
          </CardContent>
        </Card>
      )}

      {!loading && !dashboard && !events && (
        <Card className="border-border/70">
          <CardContent className="space-y-4 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0A3D62]/8 text-[#0A3D62]">
              <RefreshCcw className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[#0A3D62]">Os analytics ainda não ficaram disponíveis.</h3>
              <p className="mx-auto max-w-xl text-sm leading-7 text-muted-foreground">
                Revê os filtros ou volta a tentar o carregamento. Se o problema foi parcial, os dados restantes continuarão visíveis aqui.
              </p>
            </div>
            <div className="flex justify-center">
              <Button className="rounded-xl bg-[#0A3D62] text-white hover:bg-[#082f4b]" onClick={onRefresh}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Recarregar analytics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && dashboard && (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Visitantes, sessões e conversões por dia</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.charts.visitorsByDay}>
                    <defs>
                      <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0A3D62" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0A3D62" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00B894" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#00B894" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="visitors" stroke="#0A3D62" fill="url(#visitorsFill)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="sessions" stroke="#00B894" fill="url(#sessionsFill)" strokeWidth={2.2} />
                    <Area type="monotone" dataKey="conversions" stroke="#F59E0B" fillOpacity={0} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Anonymous vs logado</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.charts.audienceSplit} dataKey="value" nameKey="label" innerRadius={68} outerRadius={108}>
                      {dashboard.charts.audienceSplit.map((entry, index) => (
                        <Cell key={entry.label} fill={audienceColors[index % audienceColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="border-border/70 xl:col-span-1">
              <CardHeader>
                <CardTitle>Funil de conversão</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.charts.conversionFunnel} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="step" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 12, 12, 0]} fill="#0A3D62" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70 xl:col-span-1">
              <CardHeader>
                <CardTitle>Top eventos</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.charts.topEvents}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#00B894" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/70 xl:col-span-1">
              <CardHeader>
                <CardTitle>Top cursos</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.charts.topCourses} dataKey="value" nameKey="label" innerRadius={50} outerRadius={98}>
                      {dashboard.charts.topCourses.map((entry, index) => (
                        <Cell key={entry.label} fill={topCourseColors[index % topCourseColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Top páginas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard.charts.topPages.map((page) => (
                  <div key={page.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate text-slate-700">{page.label}</span>
                      <span className="font-semibold text-[#0A3D62]">{page.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#0A3D62]" style={{ width: `${Math.max(10, (page.value / Math.max(dashboard.charts.topPages[0]?.value || 1, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Logística e campanhas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#0A3D62]/10 bg-[#0A3D62]/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A3D62]">Sinal de ocupação</p>
                  <p className="mt-3 font-heading text-3xl font-bold">{dashboard.logistics.expectedOccupancySignal}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Interesse bruto em cursos e inscrições iniciadas.</p>
                </div>
                <div className="rounded-2xl border border-[#00B894]/15 bg-[#00B894]/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#008f73]">Impacto do ticket</p>
                  <p className="mt-3 font-heading text-3xl font-bold text-[#0A3D62]">{dashboard.logistics.ticketInfluenceVisits}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Visitas ligadas a partilhas e tickets.</p>
                </div>
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">WhatsApp</p>
                  <p className="mt-3 font-heading text-3xl font-bold">{dashboard.logistics.whatsappClicks}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Cliques para comunidade e validação.</p>
                </div>
                <div className="rounded-2xl border border-sky-500/15 bg-sky-500/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Conversão global</p>
                  <p className="mt-3 font-heading text-3xl font-bold">{dashboard.kpis.conversionRate}%</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Visitante para ação valiosa no portal.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Eventos recentes</CardTitle>
              <p className="text-sm text-muted-foreground">Tabela operacional para auditoria, busca e exportação.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <table className="min-w-full divide-y divide-border/60 text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {["Quando", "Evento", "Categoria", "Página", "Audiência", "Estudante", "Curso"].map((header) => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-background">
                    {(events?.items ?? []).map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(event.createdAt).toLocaleString("pt-PT")}</td>
                        <td className="px-4 py-3 font-medium text-[#0A3D62]">{event.eventType}</td>
                        <td className="px-4 py-3">{event.eventCategory}</td>
                        <td className="px-4 py-3 max-w-[280px] truncate">{event.pageUrl || event.referrer || "Sem página"}</td>
                        <td className="px-4 py-3">{event.audience}</td>
                        <td className="px-4 py-3">{event.studentName || "Anónimo"}</td>
                        <td className="px-4 py-3">{event.studentCourse || "Sem curso"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!events?.items.length && (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 px-6 py-12 text-center text-sm text-muted-foreground">
                  Ainda não há eventos para os filtros atuais.
                </div>
              )}

              {events && events.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">Página {events.page} de {events.totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={events.page <= 1} onClick={() => onFiltersChange({ page: Math.max(1, events.page - 1) })}>
                      Anterior
                    </Button>
                    <Button variant="outline" disabled={events.page >= events.totalPages} onClick={() => onFiltersChange({ page: Math.min(events.totalPages, events.page + 1) })}>
                      Seguinte
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
