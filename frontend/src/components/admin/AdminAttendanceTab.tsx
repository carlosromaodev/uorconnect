import { type FormEvent, useEffect, useState } from "react";
import { Camera, CheckCircle2, ChevronDown, ClipboardCheck, Copy, Download, Eye, Loader2, MessageSquare, Plus, Power, PowerOff, QrCode, RefreshCw, ScanLine, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type AttendanceCheckIn, type AttendanceOverview, type PagedResult, type QrActionItem, type QrActionScanItem, type QrActionsOverview } from "@/lib/api";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import { QrCameraScanner } from "@/components/admin/QrCameraScanner";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const QR_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  CHECKIN: { label: "Check-in", color: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: "check" },
  COURSE_ENROLL: { label: "Inscrição Curso", color: "text-blue-700 bg-blue-50 border-blue-200", icon: "book" },
  EXHIBITOR_VOTE: { label: "Voto Expositor", color: "text-violet-700 bg-violet-50 border-violet-200", icon: "star" },
};

type AdminSubTab = "checkins" | "qr-actions";

export default function AdminAttendanceTab() {
  const [subTab, setSubTab] = useState<AdminSubTab>("checkins");
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [checkIns, setCheckIns] = useState<PagedResult<AttendanceCheckIn> | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [token, setToken] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [scannerOpen, setScannerOpen] = useState(false);

  // QR Actions state
  const [qrOverview, setQrOverview] = useState<QrActionsOverview | null>(null);
  const [qrActions, setQrActions] = useState<PagedResult<QrActionItem> | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPage, setQrPage] = useState(1);
  const [qrSearch, setQrSearch] = useState("");
  const [qrTypeFilter, setQrTypeFilter] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<QrActionItem | null>(null);
  const [actionScans, setActionScans] = useState<QrActionScanItem[]>([]);
  const [creatingAction, setCreatingAction] = useState(false);
  const [newAction, setNewAction] = useState({
    type: "CHECKIN" as string,
    label: "",
    description: "",
    targetId: "",
    eventKey: "",
    eventLabel: "",
    maxScans: "",
    expiresAt: "",
    smsOnScan: false,
    smsTemplate: "",
    smsSender: "",
  });

  /* ---------- Check-ins data ---------- */
  const loadCheckIns = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    try {
      const [nextOverview, nextCheckIns] = await Promise.all([
        api.attendance.overview(),
        api.attendance.checkIns({ page: nextPage, search: nextSearch || undefined }),
      ]);
      setOverview(nextOverview);
      setCheckIns(nextCheckIns);
      setPage(nextCheckIns.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar presenças.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- QR Actions data ---------- */
  const loadQrActions = async (nextPage = qrPage, nextSearch = qrSearch, type = qrTypeFilter) => {
    setQrLoading(true);
    try {
      const [nextOverview, nextActions] = await Promise.all([
        api.attendance.qrActionsOverview(),
        api.attendance.qrActions({ page: nextPage, search: nextSearch || undefined, type: type || undefined }),
      ]);
      setQrOverview(nextOverview);
      setQrActions(nextActions);
      setQrPage(nextActions.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar QR actions.");
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "checkins") void loadCheckIns();
    else void loadQrActions();
  }, [subTab]);

  const handleCheckIn = async () => {
    if (!token.trim() && !studentNumber.trim()) {
      toast.error("Lê o QR ou informa o número de estudante.");
      return;
    }

    setChecking(true);
    try {
      const result = await api.attendance.checkIn({
        token: token.trim() || undefined,
        studentNumber: studentNumber.trim() || undefined,
      });
      toast.success(result.alreadyCheckedIn ? "Presença já estava registada." : "Check-in registado.");
      setToken("");
      setStudentNumber("");
      await loadCheckIns(1, search.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registar check-in.");
    } finally {
      setChecking(false);
    }
  };

  const handleSearchCheckIns = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadCheckIns(1, search.trim());
  };

  const handleCreateQrAction = async () => {
    if (!newAction.label.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }

    setCreatingAction(true);
    try {
      await api.attendance.createQrAction({
        type: newAction.type,
        label: newAction.label.trim(),
        description: newAction.description.trim() || null,
        targetId: newAction.targetId ? Number(newAction.targetId) : null,
        eventKey: newAction.eventKey.trim() || null,
        eventLabel: newAction.eventLabel.trim() || null,
        maxScans: newAction.maxScans ? Number(newAction.maxScans) : null,
        expiresAt: newAction.expiresAt || null,
        smsOnScan: newAction.smsOnScan,
        smsTemplate: newAction.smsTemplate.trim() || null,
        smsSender: newAction.smsSender.trim() || null,
      });
      toast.success("QR criado com sucesso.");
      setCreateDialogOpen(false);
      setNewAction({ type: "CHECKIN", label: "", description: "", targetId: "", eventKey: "", eventLabel: "", maxScans: "", expiresAt: "", smsOnScan: false, smsTemplate: "", smsSender: "" });
      await loadQrActions(1, qrSearch, qrTypeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar QR.");
    } finally {
      setCreatingAction(false);
    }
  };

  const handleToggleActive = async (action: QrActionItem) => {
    try {
      await api.attendance.updateQrAction(action.id, { active: !action.active });
      toast.success(action.active ? "QR desativado." : "QR ativado.");
      await loadQrActions(qrPage, qrSearch, qrTypeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar QR.");
    }
  };

  const handleDeleteAction = async (action: QrActionItem) => {
    try {
      await api.attendance.deleteQrAction(action.id);
      toast.success("QR eliminado.");
      await loadQrActions(qrPage, qrSearch, qrTypeFilter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao eliminar QR.");
    }
  };

  const handleViewDetail = async (action: QrActionItem) => {
    setSelectedAction(action);
    setDetailDialogOpen(true);
    try {
      const detail = await api.attendance.qrActionDetail(action.id);
      setActionScans(detail.scans);
    } catch {
      setActionScans([]);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência.");
  };

  return (
    <div className="space-y-5">
      <QrCameraScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onRead={(value) => {
          setToken(value);
          toast.success("QR lido. Confirma o registo para concluir o check-in.");
        }}
      />

      {/* Sub-tabs */}
      <div className="flex gap-2 rounded-2xl border border-border/60 bg-muted/20 p-1.5">
        <button
          type="button"
          onClick={() => setSubTab("checkins")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${subTab === "checkins" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Check-ins
        </button>
        <button
          type="button"
          onClick={() => setSubTab("qr-actions")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${subTab === "qr-actions" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <QrCode className="h-4 w-4" />
          QR Actions
        </button>
      </div>

      {/* ===== CHECK-INS TAB ===== */}
      {subTab === "checkins" ? (
        <>
          {/* Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Credenciais", value: overview?.totalCredentials ?? 0, color: "border-blue-200 bg-blue-50 text-blue-700" },
              { label: "Presenças", value: overview?.totalCheckIns ?? 0, color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              { label: "Hoje", value: overview?.todayCheckIns ?? 0, color: "border-primary/20 bg-primary/5 text-primary" },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${item.color}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Quick check-in */}
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="border-b border-border/50 bg-muted/20 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <QrCode className="h-4 w-4 text-primary" />
                Check-in rápido
              </h3>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto_140px]">
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o link/token do QR" className="rounded-xl" />
              <Input value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="N.º estudante" className="rounded-xl" />
              <Button variant="outline" className="rounded-xl" onClick={() => setScannerOpen(true)}>
                <Camera className="mr-2 h-4 w-4" />
                Câmara
              </Button>
              <Button className="rounded-xl" onClick={() => void handleCheckIn()} disabled={checking}>
                {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Registar
              </Button>
            </div>
          </div>

          {/* Check-in history */}
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Presenças registadas
              </h3>
              <form className="flex gap-2" onSubmit={handleSearchCheckIns}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-9 rounded-xl pl-9 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar..." />
                </div>
                <Button variant="outline" size="sm" className="rounded-xl" type="submit" disabled={loading}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl" type="button" onClick={() => void loadCheckIns(page, search.trim())} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudante</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">A carregar...</TableCell></TableRow>
                  ) : checkIns?.items.length ? (
                    checkIns.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{item.studentName || `Estudante ${item.studentNumber}`}</p>
                          <p className="text-xs text-muted-foreground">{item.studentNumber}</p>
                        </TableCell>
                        <TableCell className="text-sm">{item.studentCourse || "—"}</TableCell>
                        <TableCell className="text-sm">{item.eventLabel}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(item.checkedInAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.checkedInByStudentNumber}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Sem presenças registadas.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {checkIns ? (
              <div className="border-t border-border/40 px-4 py-2">
                <AdminTablePagination
                  page={checkIns.page}
                  total={checkIns.total}
                  totalPages={checkIns.totalPages}
                  loading={loading}
                  onPageChange={(p) => void loadCheckIns(p, search.trim())}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* ===== QR ACTIONS TAB ===== */}
      {subTab === "qr-actions" ? (
        <>
          {/* QR Overview stats */}
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Total QR", value: qrOverview?.totalActions ?? 0, color: "border-slate-200 bg-slate-50 text-slate-700" },
              { label: "Ativos", value: qrOverview?.activeActions ?? 0, color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
              { label: "Leituras", value: qrOverview?.totalScans ?? 0, color: "border-blue-200 bg-blue-50 text-blue-700" },
              { label: "Hoje", value: qrOverview?.todayScans ?? 0, color: "border-primary/20 bg-primary/5 text-primary" },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${item.color}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Type breakdown */}
          {qrOverview?.byType ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {qrOverview.byType.map((bt) => {
                const meta = QR_TYPE_META[bt.type] ?? { label: bt.type, color: "text-slate-600 bg-slate-50 border-slate-200" };
                return (
                  <div key={bt.type} className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${meta.color}`}>
                    <span className="text-xs font-semibold">{meta.label}</span>
                    <span className="text-xs">{bt.count} QR · {bt.scans} leituras</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-9 w-56 rounded-xl pl-9 text-xs" value={qrSearch} onChange={(e) => setQrSearch(e.target.value)} placeholder="Pesquisar QR..." onKeyDown={(e) => { if (e.key === "Enter") void loadQrActions(1, qrSearch, qrTypeFilter); }} />
              </div>
              <div className="flex gap-1">
                {[{ key: "", label: "Todos" }, ...Object.entries(QR_TYPE_META).map(([key, meta]) => ({ key, label: meta.label }))].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => { setQrTypeFilter(item.key); void loadQrActions(1, qrSearch, item.key); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${qrTypeFilter === item.key ? "bg-foreground text-background" : "bg-muted/40 text-muted-foreground hover:bg-muted"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void loadQrActions(qrPage, qrSearch, qrTypeFilter)} disabled={qrLoading}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${qrLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button size="sm" className="rounded-xl" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Criar QR
              </Button>
            </div>
          </div>

          {/* QR Actions list */}
          {qrLoading ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border/50 bg-card">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : qrActions?.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border/50 bg-card py-12 text-center">
              <QrCode className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">Nenhum QR criado</p>
              <p className="mt-1 text-xs text-muted-foreground/70">Cria QR codes para check-in, inscrição ou votação.</p>
              <Button size="sm" className="mt-4 rounded-xl" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Criar primeiro QR
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {qrActions?.items.map((action) => {
                const meta = QR_TYPE_META[action.type] ?? { label: action.type, color: "text-slate-600 bg-slate-50 border-slate-200" };
                const targetInfo = action.targetMeta ? (() => { try { return JSON.parse(action.targetMeta); } catch { return null; } })() : null;
                return (
                  <div key={action.id} className="overflow-hidden rounded-2xl border border-border/50 bg-card transition-shadow hover:shadow-md">
                    <div className={`h-1 ${action.active ? "bg-gradient-to-r from-emerald-500 to-primary" : "bg-slate-300"}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                          <h3 className="mt-1.5 truncate text-sm font-semibold">{action.label}</h3>
                          {action.description ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.description}</p> : null}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${action.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {action.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>

                      {targetInfo ? (
                        <p className="mt-2 truncate text-[10px] text-muted-foreground">
                          Alvo: {targetInfo.title || targetInfo.name || `ID ${action.targetId}`}
                        </p>
                      ) : null}

                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ScanLine className="h-3 w-3" />
                          {action.scansCount} leituras
                        </span>
                        {action.maxScans ? <span>Máx: {action.maxScans}</span> : null}
                        {action.smsOnScan ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <MessageSquare className="h-3 w-3" />
                            SMS
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-[10px]" onClick={() => void handleViewDetail(action)}>
                          <Eye className="mr-1 h-3 w-3" />
                          Detalhes
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-[10px]" onClick={() => copyToClipboard(action.token)}>
                          <Copy className="mr-1 h-3 w-3" />
                          Token
                        </Button>
                        <Button variant="outline" size="sm" className={`h-7 rounded-lg px-2.5 text-[10px] ${action.active ? "" : "text-emerald-600"}`} onClick={() => void handleToggleActive(action)}>
                          {action.active ? <PowerOff className="mr-1 h-3 w-3" /> : <Power className="mr-1 h-3 w-3" />}
                          {action.active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-[10px] text-rose-600 hover:bg-rose-50" onClick={() => void handleDeleteAction(action)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {qrActions ? (
            <AdminTablePagination
              page={qrActions.page}
              total={qrActions.total}
              totalPages={qrActions.totalPages}
              loading={qrLoading}
              onPageChange={(p) => void loadQrActions(p, qrSearch, qrTypeFilter)}
            />
          ) : null}
        </>
      ) : null}

      {/* ===== CREATE QR DIALOG ===== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[96vw] max-w-lg gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <QrCode className="h-5 w-5" />
                Criar QR Action
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="max-h-[min(65vh,520px)] overflow-y-auto p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(QR_TYPE_META).map(([key, meta]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewAction((c) => ({ ...c, type: key }))}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${newAction.type === key ? `${meta.color} ring-2 ring-offset-1` : "border-border/50 bg-muted/20 text-muted-foreground"}`}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome *</label>
                <Input value={newAction.label} onChange={(e) => setNewAction((c) => ({ ...c, label: e.target.value }))} placeholder="Ex: Check-in evento principal" className="rounded-xl" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Descrição</label>
                <Input value={newAction.description} onChange={(e) => setNewAction((c) => ({ ...c, description: e.target.value }))} placeholder="Descrição opcional..." className="rounded-xl" />
              </div>

              {newAction.type === "CHECKIN" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Event Key</label>
                    <Input value={newAction.eventKey} onChange={(e) => setNewAction((c) => ({ ...c, eventKey: e.target.value }))} placeholder="main-event" className="rounded-xl" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nome do Evento</label>
                    <Input value={newAction.eventLabel} onChange={(e) => setNewAction((c) => ({ ...c, eventLabel: e.target.value }))} placeholder="Evento UOR Connect" className="rounded-xl" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                    {newAction.type === "COURSE_ENROLL" ? "ID do Curso" : "ID do Projeto/Expositor"}
                  </label>
                  <Input value={newAction.targetId} onChange={(e) => setNewAction((c) => ({ ...c, targetId: e.target.value }))} placeholder="ID numérico" type="number" className="rounded-xl" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Máx. leituras</label>
                  <Input value={newAction.maxScans} onChange={(e) => setNewAction((c) => ({ ...c, maxScans: e.target.value }))} placeholder="Ilimitado" type="number" className="rounded-xl" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Expira em</label>
                  <Input value={newAction.expiresAt} onChange={(e) => setNewAction((c) => ({ ...c, expiresAt: e.target.value }))} type="datetime-local" className="rounded-xl" />
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Notificação SMS</p>
                    <p className="text-xs text-muted-foreground">Enviar SMS ao estudante ao escanear</p>
                  </div>
                  <Switch checked={newAction.smsOnScan} onCheckedChange={(v) => setNewAction((c) => ({ ...c, smsOnScan: v }))} />
                </div>
                {newAction.smsOnScan ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Remetente SMS</label>
                      <Input value={newAction.smsSender} onChange={(e) => setNewAction((c) => ({ ...c, smsSender: e.target.value }))} placeholder="UORConnect" className="rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Template SMS</label>
                      <textarea
                        value={newAction.smsTemplate}
                        onChange={(e) => setNewAction((c) => ({ ...c, smsTemplate: e.target.value }))}
                        placeholder="Olá {{nome}}, a tua {{acao}} foi registada com sucesso!"
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                        rows={3}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">Variáveis: {"{{nome}}"}, {"{{numero}}"}, {"{{curso}}"}, {"{{acao}}"}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border/50 bg-muted/10 px-5 py-3">
            <Button variant="outline" className="rounded-xl" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button className="rounded-xl" onClick={() => void handleCreateQrAction()} disabled={creatingAction}>
              {creatingAction ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
              Criar QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== DETAIL DIALOG ===== */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[96vw] max-w-lg gap-0 overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <ScanLine className="h-5 w-5" />
                {selectedAction?.label ?? "Detalhes"}
              </DialogTitle>
            </DialogHeader>
          </div>
          {selectedAction ? (
            <div className="max-h-[min(65vh,520px)] overflow-y-auto p-5">
              <div className="space-y-4">
                {/* Action info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</p>
                    <p className="mt-1 text-sm font-medium">{QR_TYPE_META[selectedAction.type]?.label ?? selectedAction.type}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Leituras</p>
                    <p className="mt-1 text-sm font-medium">{selectedAction.scansCount}{selectedAction.maxScans ? ` / ${selectedAction.maxScans}` : ""}</p>
                  </div>
                </div>

                {/* Token */}
                <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Token</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-muted/30 px-2 py-1 font-mono text-xs">{selectedAction.token}</code>
                    <Button variant="outline" size="sm" className="h-7 shrink-0 rounded-lg px-2" onClick={() => copyToClipboard(selectedAction.token)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* QR image link */}
                <div className="flex items-center gap-3">
                  <img src={selectedAction.qrImageUrl} alt="QR Code" className="h-24 w-24 rounded-xl border border-border/50 bg-white p-1" />
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => copyToClipboard(selectedAction.qrImageUrl)}>
                      <Copy className="mr-1.5 h-3 w-3" />
                      Copiar link QR
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
                      <a href={selectedAction.qrImageUrl} target="_blank" rel="noreferrer">
                        <Download className="mr-1.5 h-3 w-3" />
                        Abrir QR
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Scans history */}
                <div>
                  <h4 className="text-sm font-semibold">Histórico de leituras</h4>
                  {actionScans.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Nenhuma leitura registada.</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {actionScans.map((scan) => (
                        <div key={scan.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${scan.result === "SUCCESS" ? "bg-emerald-500" : scan.result === "ALREADY_DONE" ? "bg-amber-500" : "bg-rose-500"}`} />
                            <div>
                              <p className="text-xs font-medium">{scan.studentName ?? scan.studentNumber}</p>
                              <p className="text-[10px] text-muted-foreground">{scan.message}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(scan.scannedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end border-t border-border/50 bg-muted/10 px-5 py-3">
            <Button variant="outline" className="rounded-xl" onClick={() => setDetailDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
