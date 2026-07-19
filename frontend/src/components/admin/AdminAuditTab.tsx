import { type FormEvent, useEffect, useState } from "react";
import { Download, History, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { api, type AdminAuditLog, type DataRetentionCleanupResult, type DataRetentionPolicy, type PagedResult } from "@/lib/api";
import { AdminTablePagination } from "@/components/admin/AdminTablePagination";
import { downloadBlobFile } from "@/lib/student-documents";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function fallbackActionLabel(action: string) {
  const labels: Record<string, string> = {
    "attendance.check_in": "Check-in registado",
    "certificate.issue": "Certificado individual emitido",
    "certificate.issue_attendees": "Certificados emitidos por presença",
    "certificate.issue_bulk": "Certificados emitidos em lote",
    "certificate.bulk_missing_students": "Estudantes não encontrados para certificados",
    "certificate.reissue": "Certificado reemitido",
    "certificate.revoke": "Certificado revogado",
    "data_export.analytics_events_csv": "Eventos de analytics exportados em CSV",
    "data_export.audit_logs_csv": "Auditoria exportada em CSV",
    "data_retention.cleanup_run": "Política de retenção executada",
    "odin.ai_analysis": "Análise ODIN IA executada",
    "odin.ai_feedback": "Feedback ODIN IA registado",
    "odin.security_report_pdf_job": "Relatório de segurança ODIN gerado",
    "odin.student_exclusion": "Estudante excluído pelo ODIN",
    "passport.challenge_create": "Desafio do passaporte criado",
    "passport.challenge_reset": "Desafio do passaporte reiniciado",
    "passport.challenge_update": "Desafio do passaporte atualizado",
    "passport.ledger_revoke": "Pontos do passaporte revogados",
    "passport.mission_create": "Missão do passaporte criada",
    "passport.mission_qr_create": "QR de missão do passaporte criado",
    "passport.mission_update": "Missão do passaporte atualizada",
    "passport.ranking_freeze": "Ranking do passaporte congelado",
    "passport.ranking_recalculate": "Ranking do passaporte recalculado",
    "passport.reset_confirmation_requested": "Confirmação de reset do passaporte solicitada",
    "passport.scan_review": "Scan do passaporte revisto",
    "passport.surprise_qr_batch_create": "Lote de QR surpresa criado",
    "passport.surprise_qr_create": "QR surpresa criado",
    "passport.surprise_qr_update": "QR surpresa atualizado",
    "passport.winners_export": "Vencedores do passaporte exportados",
    "projects.automatic_missions_awarded": "Missões automáticas dos projetos atribuídas",
    "projects.empty_stand_penalty_checked": "Penalização por stand vazio verificada",
    "projects.member_duty_recorded": "Presença de membro no stand registada",
    "projects.member_levels_awarded": "Níveis dos membros atribuídos",
    "projects.qualified_feedback_reviewed": "Feedback qualificado revisto",
    "projects.score_config_updated": "Configuração da pontuação dos projetos atualizada",
    "projects.score_event_created": "Evento de pontuação criado",
    "projects.score_events_recalculated": "Eventos de pontuação recalculados",
    "projects.score_ranking_csv_exported": "Ranking de pontuação exportado em CSV",
    "projects.score_ranking_exported": "Ranking de pontuação exportado em JSON",
    "projects.score_ranking_frozen": "Ranking de pontuação congelado",
    "projects.score_ranking_pdf_exported": "Ranking de pontuação exportado em PDF",
    "projects.team_bonuses_awarded": "Bónus de equipa atribuídos",
    "projects.votes_control_updated": "Controlo de votação atualizado",
    "projects.votes_reset": "Votos dos projetos reiniciados",
    "security.admin_permission_conflict": "Conflito de permissões administrativas detetado",
    "security.admin_permission_denied": "Permissão administrativa recusada",
    "security.authorize_admin": "Administrador autorizado",
    "security.revoke_admin": "Administrador revogado",
    "student.delete": "Estudante removido",
    "student_profile.consent_update": "Consentimentos do perfil atualizados",
    "student_profile.update": "Perfil do estudante atualizado",
    "submission.update_status": "Estado da candidatura",
    "submission.select_winner": "Vencedor definido",
    "submission.update_presentation": "Apresentação atualizada",
    "submission.clear_winner": "Vencedor removido",
    "submission.delete": "Candidatura removida",
    "submission.payment_review": "Pagamento da candidatura revisto",
    "submission.regenerate_exhibitor_pdf": "PDF do expositor regenerado",
    "submission.team_member_confirm_admin": "Membro da equipa confirmado pela admin",
    "submission.team_member_confirm_external": "Membro externo confirmado",
    "submission.team_member_external_exception": "Exceção para membro externo aprovada",
    "submission.team_member_remove_responsible": "Responsável removido da equipa",
    "submission.team_members_update": "Equipa da candidatura atualizada",
    "submission.update_type": "Tipo da candidatura atualizado",
    "team_credential.auto_create": "Credencial criada automaticamente",
    "team_credential.bulk_invitation": "Convite coletivo de credenciais gerado",
    "team_credential.claim_rejected": "Pedido de credencial recusado",
    "team_credential.create": "Credencial criada",
    "team_credential.disable": "Credencial desativada",
    "team_credential.expositor_claim": "Credencial de expositor reivindicada",
    "team_credential.import_expositors": "Expositores importados para credenciais",
    "team_credential.pass_batch_calibration_pdf": "PDF de calibração dos passes gerado",
    "team_credential.pass_batch_pdf": "PDF de passes em lote gerado",
    "team_credential.pass_template_update": "Template de passe atualizado",
    "team_credential.print_batch_create": "Lote de impressão de credenciais criado",
    "team_credential.print_batch_pdf": "PDF do lote de credenciais gerado",
    "team_credential.reissue": "Credencial reemitida",
    "team_credential.revoke": "Credencial revogada",
    "team_credential.sync_site_guests": "Convidados do site sincronizados",
    "team_credential.update": "Credencial atualizada",
    "team_membership.import_nucleus.deprecated": "Importação antiga do núcleo recusada",
    "team_membership.link_credential": "Credencial ligada a membro da equipa",
    "team_membership.remove": "Membro da equipa removido",
    "team_membership.update": "Membro da equipa atualizado",
    "team_membership_claim.approve": "Solicitação de tomada de posse aprovada",
    "team_membership_claim.reject": "Solicitação de tomada de posse recusada",
    "team_membership_claim.submit": "Solicitação de tomada de posse enviada",
    "team_membership_claim.update": "Solicitação de tomada de posse atualizada",
  };

  const mapped = labels[action];
  if (mapped) return mapped;
  const readable = action.replace(/[._-]+/g, " ").trim();
  return readable
    ? readable.charAt(0).toUpperCase() + readable.slice(1)
    : "Ação registada";
}

function formatReadableAuditAction(log: AdminAuditLog) {
  return log.actionLabel?.trim() || fallbackActionLabel(log.action);
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "Administrador",
    jury: "Júri",
    jury_admin: "Júri/Admin",
    student: "Estudante",
    public: "Público",
  };
  return labels[role] ?? role;
}

function formatAuditActorName(log: AdminAuditLog) {
  if (log.actorName?.trim()) return log.actorName.trim();
  if (log.actorStudentNumber === "unknown") return "Sistema";
  return log.actorStudentNumber;
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
  const [retentionPolicy, setRetentionPolicy] = useState<DataRetentionPolicy | null>(null);
  const [retentionResult, setRetentionResult] = useState<DataRetentionCleanupResult | null>(null);
  const [retentionBusy, setRetentionBusy] = useState(false);
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
    api.audit.retentionPolicy()
      .then(setRetentionPolicy)
      .catch(() => undefined);
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

  const handleRunRetention = async () => {
    const confirmed = window.confirm("Executar a política de retenção agora? Logs antigos serão removidos e credenciais expiradas antigas terão dados privados minimizados.");
    if (!confirmed) return;
    setRetentionBusy(true);
    try {
      const result = await api.audit.runRetentionCleanup();
      setRetentionResult(result);
      toast.success("Política de retenção executada.");
      await load(1, search.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao executar retenção.");
    } finally {
      setRetentionBusy(false);
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
              <option value="passport.ranking_recalculate">Ranking recalculado</option>
              <option value="passport.ranking_freeze">Ranking congelado</option>
              <option value="projects.score_ranking_pdf_exported">Ranking PDF exportado</option>
              <option value="team_credential.print_batch_pdf">PDF de lote de credenciais</option>
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
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Retenção de dados</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {retentionPolicy
                  ? `Auditoria: ${retentionPolicy.auditLogRetentionDays} dias · validações: ${retentionPolicy.credentialValidationLogRetentionDays} dias · credenciais expiradas: ${retentionPolicy.expiredCredentialRetentionDays} dias`
                  : "A carregar política de retenção..."}
              </p>
              {retentionResult ? (
                <p className="mt-1 text-xs text-slate-600">
                  Última execução: {retentionResult.deletedAuditLogs} logs de auditoria, {retentionResult.deletedCredentialValidationLogs} validações e {retentionResult.minimizedExpiredCredentials} credencial(is) minimizada(s).
                </p>
              ) : null}
            </div>
            <Button variant="outline" className="rounded-xl" type="button" onClick={() => void handleRunRetention()} disabled={retentionBusy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${retentionBusy ? "animate-spin" : ""}`} />
              Executar retenção
            </Button>
          </div>
        </div>
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
                      <p className="font-semibold">{formatAuditActorName(log)}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.actorStudentNumber === "unknown" ? "Sem identificador" : log.actorStudentNumber}
                        {" · "}
                        {roleLabel(log.actorRole)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{formatReadableAuditAction(log)}</p>
                      <p className="font-mono text-xs text-muted-foreground">Identificador técnico: {log.action}</p>
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
