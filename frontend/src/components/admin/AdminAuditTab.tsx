import { type FormEvent, useEffect, useState } from "react";
import { Download, History, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { api, type AdminAuditLog, type PagedResult } from "@/lib/api";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import { downloadBlobFile } from "@/lib/student-documents";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "attendance.check_in": "Check-in registado",
    "certificate.issue": "Certificado emitido",
    "certificate.issue_attendees": "Certificados por presença",
    "certificate.issue_bulk": "Certificados em lote",
    "certificate.bulk_missing_students": "Estudantes não encontrados",
    "certificate.revoke": "Certificado revogado",
    "security.authorize_admin": "Admin autorizado",
    "security.revoke_admin": "Admin revogado",
    "student.delete": "Estudante removido",
    "submission.update_status": "Estado da candidatura",
    "submission.select_winner": "Vencedor definido",
    "submission.update_presentation": "Apresentação atualizada",
    "submission.clear_winner": "Vencedor removido",
    "submission.delete": "Candidatura removida",
  };

  return labels[action] ?? action;
}

function entityLabel(entityType: string | null) {
  if (entityType === "AttendanceCheckIn") return "Presença";
  if (entityType === "Certificate") return "Certificado";
  if (entityType === "Submission") return "Candidatura";
  if (entityType === "Student") return "Estudante";
  if (entityType === "AdminAuthorizedStudent") return "Acesso admin";
  return entityType || "Sistema";
}

export default function AdminAuditTab() {
  const [logs, setLogs] = useState<PagedResult<AdminAuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("todos");
  const [entityType, setEntityType] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const buildFilters = (nextSearch = search) => ({
    search: nextSearch.trim() || undefined,
    action: action === "todos" ? undefined : action,
    entityType: entityType === "todos" ? undefined : entityType,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  });

  const load = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    try {
      const payload = await api.audit.logs({ page: nextPage, ...buildFilters(nextSearch) });
      setLogs(payload);
      setPage(payload.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar auditoria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void load(1, search.trim());
  };

  const handlePageChange = (nextPage: number) => {
    void load(nextPage, search.trim());
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.audit.exportCsv({ ...buildFilters(search), limit: 5000 });
      downloadBlobFile(blob, `auditoria-admin-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Auditoria exportada em CSV.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar auditoria.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            Auditoria administrativa
          </CardTitle>
          <form className="flex flex-col gap-2 xl:flex-row xl:flex-wrap" onSubmit={handleSearch}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar ação, ator ou entidade..." />
            </div>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="todos">Todas ações</option>
              <option value="attendance.check_in">Check-in</option>
              <option value="certificate.issue">Certificado individual</option>
              <option value="certificate.issue_attendees">Certificados por presença</option>
              <option value="certificate.issue_bulk">Certificados em lote</option>
              <option value="certificate.revoke">Certificado revogado</option>
              <option value="security.authorize_admin">Admin autorizado</option>
              <option value="security.revoke_admin">Admin revogado</option>
              <option value="student.delete">Estudante removido</option>
              <option value="submission.update_status">Estado da candidatura</option>
              <option value="submission.select_winner">Vencedor definido</option>
              <option value="submission.delete">Candidatura removida</option>
            </select>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
              <option value="todos">Todas entidades</option>
              <option value="AttendanceCheckIn">Presenças</option>
              <option value="Certificate">Certificados</option>
              <option value="Submission">Candidaturas</option>
              <option value="Student">Estudantes</option>
              <option value="AdminAuthorizedStudent">Acessos admin</option>
            </select>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="xl:w-40" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="xl:w-40" />
            <Button variant="outline" className="rounded-xl" type="submit" disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Pesquisar
            </Button>
            <Button variant="outline" className="rounded-xl" type="button" onClick={() => void load(page, search.trim())} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" className="rounded-xl" type="button" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              CSV
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5}>A carregar auditoria...</TableCell></TableRow>
              ) : logs?.items.length ? (
                logs.items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                    <TableCell>
                      <p className="font-semibold">{log.actorStudentNumber}</p>
                      <p className="text-xs text-muted-foreground">{log.actorRole}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{actionLabel(log.action)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{log.action}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{entityLabel(log.entityType)}</p>
                      <p className="text-xs text-muted-foreground">{log.entityId || "Sem ID"}</p>
                    </TableCell>
                    <TableCell className="min-w-[260px]">{log.summary}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5}>Sem logs registados para estes filtros.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {logs ? (
          <AdminTablePagination
            page={logs.page}
            total={logs.total}
            totalPages={logs.totalPages}
            loading={loading}
            onPageChange={handlePageChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
